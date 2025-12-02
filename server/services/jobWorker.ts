import { dequeueJob, recoverStuckJobs, getJobStats, cleanupOldJobs, enqueueJob } from "./durableQueue";
import { processJob } from "./meetingOrchestrator";
import { processOutboxMessages, recoverOutboxMessages } from "./outboxProcessor";
import { db } from "../db";
import { sql, and, lt, eq, or, isNull, gt } from "drizzle-orm";
import { meetings, jobWorkerLeases } from "@shared/schema";
import { nanoid } from "nanoid";

/**
 * Job Worker with Lease-Based Distributed Locking
 * 
 * Ensures only ONE active worker across all Container App instances using
 * a lease table pattern. This prevents duplicate job processing when
 * Azure Container Apps scales horizontally.
 * 
 * ARCHITECTURE (per architect recommendation):
 * - Lease table replaces advisory locks (works without superuser privileges)
 * - INSERT...ON CONFLICT with heartbeat updates for atomic lease management
 * - 2× poll interval lease window with automatic takeover on stale leases
 * - No zombie sessions - leases expire automatically based on timestamp
 * 
 * Features:
 * - Distributed locking via job_worker_leases table
 * - Automatic lease expiration and takeover (no pg_terminate_backend needed)
 * - Graceful handling when another instance holds the lease
 * - Continuous job processing with one job at a time
 */

let isRunning = false;
let shouldStop = false;
let leaseHeld = false;
let heartbeatInterval: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour
const MEETING_SCAN_INTERVAL_MS = 60 * 1000; // Scan for ended meetings every minute
const WORKER_NAME = "main_job_worker";
const INSTANCE_ID = `worker-${nanoid(8)}`; // Unique per process
const LEASE_DURATION_MS = POLL_INTERVAL_MS * 3; // 15 seconds (3× poll interval for safety)
const HEARTBEAT_INTERVAL_MS = POLL_INTERVAL_MS; // Heartbeat every poll interval
const MEETING_END_BUFFER_MINUTES = 5; // Wait 5 minutes after meeting ends before enrichment

let lastMeetingScan = 0;

/**
 * Try to acquire or renew the worker lease
 * 
 * Uses INSERT...ON CONFLICT to atomically:
 * 1. Create new lease if none exists
 * 2. Take over expired lease from crashed instance
 * 3. Renew own lease via heartbeat
 */
async function tryAcquireLease(): Promise<boolean> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
    
    // Step 1: Atomic upsert - acquire if not exists, takeover if expired, renew if ours
    await db.execute(sql`
      INSERT INTO job_worker_leases (worker_name, instance_id, acquired_at, last_heartbeat, lease_expires_at)
      VALUES (${WORKER_NAME}, ${INSTANCE_ID}, NOW(), NOW(), ${expiresAt})
      ON CONFLICT (worker_name) DO UPDATE SET
        instance_id = CASE 
          WHEN job_worker_leases.lease_expires_at < NOW() THEN ${INSTANCE_ID}
          WHEN job_worker_leases.instance_id = ${INSTANCE_ID} THEN ${INSTANCE_ID}
          ELSE job_worker_leases.instance_id
        END,
        acquired_at = CASE
          WHEN job_worker_leases.lease_expires_at < NOW() THEN NOW()
          WHEN job_worker_leases.instance_id = ${INSTANCE_ID} THEN job_worker_leases.acquired_at
          ELSE job_worker_leases.acquired_at
        END,
        last_heartbeat = CASE
          WHEN job_worker_leases.lease_expires_at < NOW() THEN NOW()
          WHEN job_worker_leases.instance_id = ${INSTANCE_ID} THEN NOW()
          ELSE job_worker_leases.last_heartbeat
        END,
        lease_expires_at = CASE
          WHEN job_worker_leases.lease_expires_at < NOW() THEN ${expiresAt}
          WHEN job_worker_leases.instance_id = ${INSTANCE_ID} THEN ${expiresAt}
          ELSE job_worker_leases.lease_expires_at
        END
    `);
    
    // Step 2: Confirmatory SELECT to verify we actually hold the lease
    // This prevents race conditions where two instances believe they own the worker
    const confirmResult = await db.execute(sql`
      SELECT instance_id FROM job_worker_leases 
      WHERE worker_name = ${WORKER_NAME} AND instance_id = ${INSTANCE_ID}
    `);
    
    const rows = confirmResult.rows as { instance_id: string }[];
    return rows.length > 0 && rows[0].instance_id === INSTANCE_ID;
  } catch (error) {
    console.error("[JobWorker] Error acquiring lease:", error);
    return false;
  }
}

/**
 * Release the worker lease (graceful shutdown)
 */
async function releaseLease(): Promise<void> {
  try {
    await db.delete(jobWorkerLeases)
      .where(and(
        eq(jobWorkerLeases.workerName, WORKER_NAME),
        eq(jobWorkerLeases.instanceId, INSTANCE_ID)
      ));
    console.log(`[JobWorker] Released lease for ${INSTANCE_ID}`);
  } catch (error) {
    console.error("[JobWorker] Error releasing lease:", error);
  }
}

/**
 * Start heartbeat to keep lease alive
 */
function startHeartbeat(): void {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(async () => {
    if (!leaseHeld || shouldStop) return;
    
    const stillHeld = await tryAcquireLease();
    if (!stillHeld) {
      console.warn("[JobWorker] Lost lease to another instance, stopping...");
      leaseHeld = false;
      shouldStop = true;
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Start the job worker with lease-based locking
 * 
 * CRITICAL: Uses lease table to ensure only ONE worker is active across
 * all Container App instances. This prevents duplicate job processing
 * when Azure scales horizontally.
 * 
 * FAILOVER BEHAVIOR:
 * - If lease is unavailable, instance enters STANDBY mode
 * - Standby instances retry acquiring the lease every 30 seconds
 * - When active worker crashes, its lease expires automatically
 * - Standby instance takes over within one lease period (15s)
 */
export async function startJobWorker(): Promise<void> {
  if (isRunning) {
    console.log("[JobWorker] Already running in this process");
    return;
  }

  console.log(`[JobWorker] Instance ${INSTANCE_ID} attempting to acquire lease...`);
  isRunning = true;
  shouldStop = false;

  // Try to acquire lease with retry loop
  while (!shouldStop) {
    const acquired = await tryAcquireLease();

    if (acquired) {
      console.log(`✅ [JobWorker] Lease acquired by ${INSTANCE_ID} - this instance is the ACTIVE worker`);
      leaseHeld = true;
      startHeartbeat();
      break;
    }

    console.log("[JobWorker] Another instance holds the lease - entering STANDBY mode");
    console.log("[JobWorker] Will retry lease acquisition every 30 seconds for failover...");
    
    await sleep(30000);
  }

  if (shouldStop) {
    if (leaseHeld) {
      stopHeartbeat();
      await releaseLease();
      leaseHeld = false;
    }
    isRunning = false;
    console.log("[JobWorker] Stopped during standby or after lease acquisition");
    return;
  }

  console.log("[JobWorker] Starting job processing loop...");

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
    while (!shouldStop && leaseHeld) {
      try {
        // Scan for ended meetings periodically
        const now = Date.now();
        if (now - lastMeetingScan > MEETING_SCAN_INTERVAL_MS) {
          lastMeetingScan = now;
          const scanned = await scanForEndedMeetings();
          if (scanned > 0) {
            console.log(`[JobWorker] Scanned and enqueued ${scanned} meetings for enrichment`);
          }
        }

        // Process outbox messages first (high priority - user-facing notifications)
        await processOutboxMessages();

        // Dequeue and process next job
        const job = await dequeueJob();

        if (job) {
          console.log(`[JobWorker] Processing job: ${job.jobType} (${job.id})`);
          await processJob(job);
        }

        // Brief pause between iterations
        await sleep(POLL_INTERVAL_MS);

      } catch (error) {
        console.error("[JobWorker] Error in processing loop:", error);
        await sleep(POLL_INTERVAL_MS);
      }
    }
  } finally {
    // Cleanup on exit
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    stopHeartbeat();
    
    if (leaseHeld) {
      await releaseLease();
      leaseHeld = false;
    }
    
    isRunning = false;
    console.log("[JobWorker] Worker stopped and lease released");
  }
}

/**
 * Stop the job worker gracefully
 */
export async function stopJobWorker(): Promise<void> {
  if (!isRunning) {
    console.log("[JobWorker] Not running");
    return;
  }

  console.log("[JobWorker] Stopping...");
  shouldStop = true;
}

/**
 * Check if the job worker is currently running
 */
export function isJobWorkerRunning(): boolean {
  return isRunning && leaseHeld;
}

/**
 * Get current worker status including lease info
 */
export async function getWorkerStatus(): Promise<{
  running: boolean;
  leaseHeld: boolean;
  instanceId: string;
  stats: { pending: number; processing: number; completed: number; failed: number };
}> {
  const stats = await getJobStats();
  return {
    running: isRunning,
    leaseHeld,
    instanceId: INSTANCE_ID,
    stats: {
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed
    }
  };
}

/**
 * Scan for meetings that have ended and need enrichment
 */
async function scanForEndedMeetings(): Promise<number> {
  try {
    const bufferTime = new Date(Date.now() - MEETING_END_BUFFER_MINUTES * 60 * 1000);
    
    // Find meetings that:
    // 1. Have endTime in the past (meeting ended)
    // 2. Haven't been enriched yet (transcriptUrl is null)
    // 3. Processing decision is pending or null
    const endedMeetings = await db.select({
      id: meetings.id,
      title: meetings.title,
      endTime: meetings.endTime,
    })
    .from(meetings)
    .where(and(
      lt(meetings.endTime, bufferTime),
      isNull(meetings.transcriptUrl),
      or(
        eq(meetings.processingDecision, 'pending'),
        isNull(meetings.processingDecision)
      )
    ))
    .limit(10);

    let enqueued = 0;
    for (const meeting of endedMeetings) {
      try {
        await enqueueJob({
          jobType: 'enrich_meeting',
          payload: { meetingId: meeting.id },
          idempotencyKey: `enrich:${meeting.id}`
        });
        enqueued++;
        console.log(`[JobWorker] Enqueued enrichment for meeting: ${meeting.title} (${meeting.id})`);
      } catch (error: any) {
        // Ignore duplicate key errors (already enqueued)
        if (!error.message?.includes('duplicate key')) {
          console.error(`[JobWorker] Error enqueuing meeting ${meeting.id}:`, error);
        }
      }
    }

    return enqueued;
  } catch (error) {
    console.error("[JobWorker] Error scanning for ended meetings:", error);
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
