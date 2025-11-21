import { dequeueJob, recoverStuckJobs, getJobStats, cleanupOldJobs } from "./durableQueue";
import { processJob } from "./meetingOrchestrator";
import { processOutboxMessages, recoverOutboxMessages } from "./outboxProcessor";
import type { JobType } from "./durableQueue";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Job Worker with PostgreSQL Advisory Locking
 * 
 * Ensures only ONE active worker across all App Service instances using
 * PostgreSQL advisory locks. This prevents duplicate job processing when
 * Azure App Service scales horizontally to multiple instances.
 * 
 * Features:
 * - Distributed locking via pg_try_advisory_lock()
 * - Automatic lock release on crash/disconnect
 * - Graceful handling when another instance holds the lock
 * - Continuous job processing with one job at a time
 */

let isRunning = false;
let shouldStop = false;
let workerLockHeld = false;

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour
const WORKER_LOCK_ID = 1234567890; // Unique ID for job worker advisory lock

/**
 * Start the job worker with distributed locking
 * 
 * CRITICAL: Uses PostgreSQL advisory locks to ensure only ONE worker
 * is active across all App Service instances. This prevents duplicate
 * job processing when Azure scales horizontally.
 * 
 * FAILOVER BEHAVIOR:
 * - If lock is unavailable, instance enters STANDBY mode
 * - Standby instances retry acquiring the lock every 30 seconds
 * - When active worker crashes/stops, a standby instance becomes active
 * - This ensures continuous job processing with automatic failover
 */
export async function startJobWorker(): Promise<void> {
  if (isRunning) {
    console.log("[JobWorker] Already running in this process");
    return;
  }

  console.log("[JobWorker] Attempting to acquire worker lock...");
  isRunning = true; // Mark as running even in standby mode
  shouldStop = false;

  // Try to acquire distributed worker lock with retry loop
  while (!shouldStop) {
    const lockAcquired = await tryAcquireWorkerLock();

    if (lockAcquired) {
      console.log("✅ [JobWorker] Worker lock acquired - this instance is the ACTIVE worker");
      workerLockHeld = true;
      break; // Exit retry loop and start processing
    }

    // Lock not acquired - enter STANDBY mode with periodic retry
    console.log("[JobWorker] Another instance holds the lock - entering STANDBY mode");
    console.log("[JobWorker] Will retry lock acquisition every 30 seconds for failover...");
    
    // Wait before retrying (allows active worker to process, enables failover)
    await sleep(30000); // 30 seconds
  }

  // Check if shutdown was triggered during standby/acquisition
  if (shouldStop) {
    // CRITICAL: Release lock if we acquired it but processing was stopped
    if (workerLockHeld) {
      await releaseWorkerLock();
      workerLockHeld = false;
      console.log("[JobWorker] Released lock during shutdown");
    }
    isRunning = false;
    console.log("[JobWorker] Stopped during standby or after lock acquisition");
    return;
  }

  console.log("[JobWorker] Starting job processing loop...");

  // CRITICAL: Wrap entire post-lock section in try/finally
  // This ensures the advisory lock is ALWAYS released, even if:
  // - recoverStuckJobs() throws
  // - processJob() throws unhandled error
  // - Any other async operation fails
  let cleanupInterval: NodeJS.Timeout | null = null;

  try {
    // Recover stuck jobs and outbox messages from previous crashes
    await recoverStuckJobs();
    await recoverOutboxMessages();

    // Start cleanup interval
    cleanupInterval = setInterval(async () => {
      try {
        await cleanupOldJobs();
      } catch (error) {
        console.error("[JobWorker] Cleanup error:", error);
      }
    }, CLEANUP_INTERVAL_MS);

    // Main processing loop
    while (!shouldStop) {
      try {
        // Process outbox messages first (high priority - user-facing notifications)
        const outboxProcessed = await processOutboxMessages(10);

        // Get next job from durable queue
        const job = await dequeueJob();

        if (job) {
          // Process the job
          await processJob(job);
        } else if (outboxProcessed === 0) {
          // No outbox messages AND no jobs - wait before polling again
          await sleep(POLL_INTERVAL_MS);
        }
        // If outbox had messages, continue immediately for next batch

        // Log stats periodically (every 10 iterations)
        if (Math.random() < 0.1) {
          const stats = await getJobStats();
          console.log("[JobWorker] Stats:", stats);
        }
      } catch (error) {
        console.error("[JobWorker] Processing error:", error);
        // Wait a bit before retrying to avoid tight error loops
        await sleep(POLL_INTERVAL_MS);
      }
    }
  } finally {
    // CRITICAL: Always clean up, even if startup or processing fails
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }

    // CRITICAL: Always release advisory lock to allow failover
    if (workerLockHeld) {
      await releaseWorkerLock();
      workerLockHeld = false;
    }

    isRunning = false;
    console.log("[JobWorker] Stopped and lock released");
  }
}

/**
 * Stop the job worker gracefully
 */
export function stopJobWorker(): void {
  console.log("[JobWorker] Stopping...");
  shouldStop = true;
}

/**
 * Check if worker is running
 */
export function isJobWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Try to acquire PostgreSQL advisory lock for job worker
 * 
 * Uses pg_try_advisory_lock() which is:
 * - Database-wide (works across all app instances)
 * - Session-based (auto-released if connection dies)
 * - Non-blocking (returns false if already locked)
 * 
 * @returns true if lock acquired, false if another instance holds it
 */
async function tryAcquireWorkerLock(): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(${WORKER_LOCK_ID}) as locked`
    );

    const locked = result.rows[0]?.locked;
    return locked === true || locked === 't' || locked === 1;
  } catch (error) {
    console.error("[JobWorker] Error acquiring lock:", error);
    return false; // Fail-safe: don't start worker if lock check fails
  }
}

/**
 * Release PostgreSQL advisory lock for job worker
 * 
 * Called on graceful shutdown. Lock is also automatically released
 * if the database connection drops (crash recovery).
 */
async function releaseWorkerLock(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${WORKER_LOCK_ID})`
    );
    console.log("✅ [JobWorker] Worker lock released");
  } catch (error) {
    console.error("[JobWorker] Error releasing lock:", error);
    // Lock will be auto-released when connection closes anyway
  }
}

/**
 * Check if this instance holds the worker lock
 */
export function hasWorkerLock(): boolean {
  return workerLockHeld;
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
