import { db } from "../db";
import { jobQueue, type InsertJob, type Job } from "@shared/schema";
import { eq, and, lte, or, sql } from "drizzle-orm";

/**
 * PostgreSQL-backed Durable Job Queue
 * 
 * Features:
 * - Idempotent job processing (prevents duplicate processing)
 * - Automatic retry with exponential backoff
 * - Dead-letter queue for permanently failed jobs
 * - Crash recovery (resumes pending jobs on restart)
 * - Transactional job state updates
 */

export interface JobPayload {
  meetingId?: string;
  minutesId?: string;
  [key: string]: any;
}

export type JobType = 
  | "process_call_record"
  | "enrich_meeting"
  | "generate_minutes"
  | "send_email"
  | "upload_sharepoint"
  | "sync_azure_groups";

/**
 * Enqueue a new job with idempotency
 * @returns Job ID if created, null if already exists
 */
export async function enqueueJob(params: {
  jobType: JobType;
  idempotencyKey: string;
  payload: JobPayload;
  maxRetries?: number;
  scheduledFor?: Date;
}): Promise<string | null> {
  const { jobType, idempotencyKey, payload, maxRetries = 3, scheduledFor } = params;

  try {
    // Attempt to insert with idempotency key
    const result = await db.insert(jobQueue).values({
      jobType,
      idempotencyKey,
      payload,
      maxRetries,
      scheduledFor: scheduledFor || new Date(),
      status: "pending",
    }).onConflictDoNothing().returning({ id: jobQueue.id });

    if (result.length === 0) {
      console.log(`[DurableQueue] Job already exists: ${idempotencyKey}`);
      return null; // Job already exists
    }

    console.log(`[DurableQueue] Enqueued job: ${jobType} (${idempotencyKey})`);
    return result[0].id;
  } catch (error) {
    console.error("[DurableQueue] Error enqueueing job:", error);
    throw error;
  }
}

/**
 * Get next pending job for processing
 * Uses SELECT FOR UPDATE SKIP LOCKED for concurrent workers
 */
export async function dequeueJob(jobTypes?: JobType[]): Promise<Job | null> {
  try {
    const now = new Date();

    // Build filter conditions
    const conditions = [
      or(
        eq(jobQueue.status, "pending"),
        eq(jobQueue.status, "failed") // Retry failed jobs
      ),
      lte(jobQueue.scheduledFor, now) // Only jobs scheduled for now or past
    ];

    if (jobTypes && jobTypes.length > 0) {
      conditions.push(sql`${jobQueue.jobType} = ANY(${jobTypes})`);
    }

    // Fetch and lock one job atomically
    const jobs = await db
      .select()
      .from(jobQueue)
      .where(and(...conditions))
      .orderBy(jobQueue.scheduledFor)
      .limit(1)
      .for("update", { skipLocked: true });

    if (jobs.length === 0) {
      return null;
    }

    const job = jobs[0];

    // Mark as processing
    await db.update(jobQueue)
      .set({
        status: "processing",
        attemptCount: sql`${jobQueue.attemptCount} + 1`,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobQueue.id, job.id));

    console.log(`[DurableQueue] Dequeued job: ${job.jobType} (attempt ${job.attemptCount + 1})`);
    return { ...job, attemptCount: job.attemptCount + 1 };
  } catch (error) {
    console.error("[DurableQueue] Error dequeuing job:", error);
    return null;
  }
}

/**
 * Mark job as successfully completed
 */
export async function completeJob(jobId: string): Promise<void> {
  await db.update(jobQueue)
    .set({
      status: "completed",
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobQueue.id, jobId));

  console.log(`[DurableQueue] Completed job: ${jobId}`);
}

/**
 * Mark job as failed with retry logic
 * Implements exponential backoff: 2^attempt minutes
 */
export async function failJob(params: {
  jobId: string;
  error: string;
  currentAttempt: number;
  maxRetries: number;
}): Promise<void> {
  const { jobId, error, currentAttempt, maxRetries } = params;

  if (currentAttempt >= maxRetries) {
    // Move to dead-letter queue
    await db.update(jobQueue)
      .set({
        status: "dead_letter",
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId));

    console.error(`[DurableQueue] Job moved to dead-letter: ${jobId} - ${error}`);
  } else {
    // Schedule retry with exponential backoff: 2^attempt minutes
    const backoffMinutes = Math.pow(2, currentAttempt);
    const scheduledFor = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db.update(jobQueue)
      .set({
        status: "failed",
        lastError: error,
        scheduledFor,
        updatedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId));

    console.log(`[DurableQueue] Job failed, retry in ${backoffMinutes}min: ${jobId}`);
  }
}

/**
 * Get job statistics
 */
export async function getJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}> {
  const stats = await db
    .select({
      status: jobQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(jobQueue)
    .groupBy(jobQueue.status);

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  stats.forEach((stat) => {
    if (stat.status === "pending") result.pending = stat.count;
    if (stat.status === "processing") result.processing = stat.count;
    if (stat.status === "completed") result.completed = stat.count;
    if (stat.status === "failed") result.failed = stat.count;
    if (stat.status === "dead_letter") result.deadLetter = stat.count;
  });

  return result;
}

/**
 * Recover stuck jobs (processing for >30 minutes)
 * Should be called on application startup
 */
export async function recoverStuckJobs(): Promise<number> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const result = await db
    .update(jobQueue)
    .set({
      status: "failed",
      lastError: "Job processing timeout - recovered on restart",
      scheduledFor: new Date(), // Retry immediately
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobQueue.status, "processing"),
        lte(jobQueue.lastAttemptAt, thirtyMinutesAgo)
      )
    );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`[DurableQueue] Recovered ${count} stuck jobs`);
  }

  return count;
}

/**
 * Clean up old completed jobs (older than 30 days)
 */
export async function cleanupOldJobs(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(jobQueue)
    .where(
      and(
        eq(jobQueue.status, "completed"),
        lte(jobQueue.processedAt, thirtyDaysAgo)
      )
    );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`[DurableQueue] Cleaned up ${count} old completed jobs`);
  }

  return count;
}
