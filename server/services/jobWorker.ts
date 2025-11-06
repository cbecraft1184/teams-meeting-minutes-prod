import { dequeueJob, recoverStuckJobs, getJobStats, cleanupOldJobs } from "./durableQueue";
import { processJob } from "./meetingOrchestrator";
import type { JobType } from "./durableQueue";

/**
 * Job Worker
 * 
 * Continuously polls the durable queue and processes jobs
 * - Runs in background as long as the application is running
 * - Processes one job at a time to avoid overload
 * - Automatically recovers stuck jobs on startup
 * - Supports graceful shutdown
 */

let isRunning = false;
let shouldStop = false;

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour

/**
 * Start the job worker
 */
export async function startJobWorker(): Promise<void> {
  if (isRunning) {
    console.log("[JobWorker] Already running");
    return;
  }

  console.log("[JobWorker] Starting...");
  isRunning = true;
  shouldStop = false;

  // Recover stuck jobs from previous crashes
  await recoverStuckJobs();

  // Start cleanup interval
  const cleanupInterval = setInterval(async () => {
    try {
      await cleanupOldJobs();
    } catch (error) {
      console.error("[JobWorker] Cleanup error:", error);
    }
  }, CLEANUP_INTERVAL_MS);

  // Main processing loop
  while (!shouldStop) {
    try {
      // Get next job
      const job = await dequeueJob();

      if (job) {
        // Process the job
        await processJob(job);
      } else {
        // No jobs available, wait before polling again
        await sleep(POLL_INTERVAL_MS);
      }

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

  clearInterval(cleanupInterval);
  isRunning = false;
  console.log("[JobWorker] Stopped");
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
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
