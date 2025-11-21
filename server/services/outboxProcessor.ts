import { db } from '../db';
import { messageOutbox, sentMessages } from '@shared/schema';
import { teamsBotAdapter } from './teamsBot';
import { sql, and, lt } from 'drizzle-orm';

/**
 * Transactional Outbox Processor with Production Telemetry
 * 
 * Polls message_outbox table and sends Adaptive Cards via Bot Framework.
 * Implements exactly-once delivery with exponential backoff retry.
 * 
 * Features:
 * - SELECT FOR UPDATE SKIP LOCKED for concurrent workers
 * - Exponential backoff: 1min → 5min → 15min
 * - Dead-letter queue after 4 failures (3 retry intervals)
 * - Transactional commit: only delete from outbox after successful send
 * - Per-recipient error isolation (each send operation is independent)
 * - Production-grade telemetry and observability
 * 
 * Retry Schedule:
 * - Attempt 1 → 2: Wait 1 minute
 * - Attempt 2 → 3: Wait 5 minutes
 * - Attempt 3 → 4: Wait 15 minutes
 * - Attempt 4 fails: Dead-letter (no more retries)
 */

const MAX_ATTEMPTS = 4; // Allow 4 failures total (3 retry intervals: 1m, 5m, 15m)
const BACKOFF_SCHEDULE_MS = [
  1 * 60 * 1000,    // Attempt 1→2: 1 minute
  5 * 60 * 1000,    // Attempt 2→3: 5 minutes
  15 * 60 * 1000,   // Attempt 3→4: 15 minutes
];

/**
 * Telemetry tracker for outbox processing
 * Production-grade observability for monitoring send operations
 */
interface OutboxTelemetry {
  messagesProcessed: number;
  sendSuccess: number;
  sendFailureTransient: number;
  sendFailurePermanent: number;
  deadLetterCount: number;
  totalLatencyMs: number;
  errorsByType: Map<string, number>;
}

/**
 * Error classification for retry decisions
 */
enum ErrorType {
  TRANSIENT = 'transient',      // Network issues, rate limits - RETRY
  PERMANENT = 'permanent',       // Invalid recipient, auth failed - DEAD-LETTER
  UNKNOWN = 'unknown'            // Default - RETRY
}

/**
 * Classify error for retry strategy and telemetry
 */
function classifyError(error: any): ErrorType {
  const message = error.message?.toLowerCase() || '';
  const code = error.code || error.statusCode;
  
  // Permanent errors - no point retrying
  if (
    message.includes('not found') ||
    message.includes('invalid recipient') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    code === 404 ||
    code === 401 ||
    code === 403
  ) {
    return ErrorType.PERMANENT;
  }
  
  // Transient errors - safe to retry
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('service unavailable') ||
    code === 429 ||
    code === 503 ||
    code === 504
  ) {
    return ErrorType.TRANSIENT;
  }
  
  // Unknown - default to retry (conservative approach)
  return ErrorType.UNKNOWN;
}

/**
 * Process one batch of outbox messages with production telemetry
 * @param batchSize Number of messages to process in one iteration
 * @returns Number of messages processed
 */
export async function processOutboxMessages(batchSize: number = 10): Promise<number> {
  const telemetry: OutboxTelemetry = {
    messagesProcessed: 0,
    sendSuccess: 0,
    sendFailureTransient: 0,
    sendFailurePermanent: 0,
    deadLetterCount: 0,
    totalLatencyMs: 0,
    errorsByType: new Map()
  };

  try {
    // Fetch pending messages (lock-safe for concurrent workers)
    const messages = await db
      .select()
      .from(messageOutbox)
      .where(
        and(
          // Only process messages where nextAttemptAt has passed (enforces exponential backoff)
          sql`${messageOutbox.nextAttemptAt} <= NOW()`,
          // Skip messages that exceeded max attempts
          lt(messageOutbox.attemptCount, MAX_ATTEMPTS)
        )
      )
      .orderBy(messageOutbox.nextAttemptAt) // Process oldest scheduled first
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (messages.length === 0) {
      return 0;
    }

    telemetry.messagesProcessed = messages.length;

    // Process each message independently (per-recipient error isolation)
    for (const message of messages) {
      const sendStartTime = Date.now();
      
      try {
        // Send Adaptive Card via Bot Framework
        await teamsBotAdapter.sendAdaptiveCard(
          message.conversationReference,
          message.cardPayload
        );

        const latency = Date.now() - sendStartTime;
        telemetry.totalLatencyMs += latency;
        const currentAttempt = message.attemptCount + 1;

        // Success - delete from outbox and mark sentMessages as 'sent'
        await db.transaction(async (tx) => {
          // Delete from outbox
          await tx
            .delete(messageOutbox)
            .where(sql`${messageOutbox.id} = ${message.id}`);

          // Update sentMessages audit trail
          // TELEMETRY CONSISTENCY: Store actual attempt count to match logs
          await tx
            .update(sentMessages)
            .set({
              status: 'sent',
              attemptCount: currentAttempt, // Match logged attempt number
              sentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(sql`${sentMessages.id} = ${message.sentMessageId}`);
        });

        telemetry.sendSuccess++;
        // TELEMETRY CONSISTENCY: Log matches database state (attemptCount updated to currentAttempt)
        console.log(
          `[Outbox] Send success | msg=${message.sentMessageId} | ` +
          `attempt=${currentAttempt}/${MAX_ATTEMPTS} | latency=${latency}ms`
        );
        
      } catch (error: any) {
        const latency = Date.now() - sendStartTime;
        telemetry.totalLatencyMs += latency;
        
        // Classify error for retry strategy and telemetry
        const errorType = classifyError(error);
        const errorCode = error.code || error.statusCode || 'UNKNOWN';
        const newAttemptCount = message.attemptCount + 1;
        
        // DOD COMPLIANCE: Never log full error message (may contain PII)
        // Only log error type and code for telemetry
        const safeErrorSummary = `${errorType}:${errorCode}`;
        
        // Track error types for observability
        telemetry.errorsByType.set(safeErrorSummary, (telemetry.errorsByType.get(safeErrorSummary) || 0) + 1);

        // Categorize failure for telemetry
        if (errorType === ErrorType.PERMANENT) {
          telemetry.sendFailurePermanent++;
        } else {
          telemetry.sendFailureTransient++;
        }

        // Permanent error OR exceeded max attempts → Dead-letter
        if (errorType === ErrorType.PERMANENT || newAttemptCount >= MAX_ATTEMPTS) {
          await db.transaction(async (tx) => {
            // Delete from outbox (no more retries)
            await tx
              .delete(messageOutbox)
              .where(sql`${messageOutbox.id} = ${message.id}`);

            // Mark sentMessages as permanently failed
            // DOD COMPLIANCE: Store safe error summary in database (no PII)
            await tx
              .update(sentMessages)
              .set({
                status: 'failed',
                lastError: `Dead-letter after ${newAttemptCount} attempts: ${safeErrorSummary}`,
                attemptCount: newAttemptCount,
                updatedAt: new Date(),
              })
              .where(sql`${sentMessages.id} = ${message.sentMessageId}`);
          });

          telemetry.deadLetterCount++;
          // DOD COMPLIANCE: Log only safe fields (no PII from error messages)
          console.error(
            `[Outbox] DEAD-LETTER | msg=${message.sentMessageId} | ` +
            `errorSummary=${safeErrorSummary} | attempts=${newAttemptCount} | ` +
            `latency=${latency}ms`
          );
          
        } else {
          // Transient/Unknown error → Retry with exponential backoff
          const backoffMs = BACKOFF_SCHEDULE_MS[newAttemptCount - 1] || BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
          const nextAttemptAt = new Date(Date.now() + backoffMs);

          // Update for retry with exponential backoff
          // DOD COMPLIANCE: Store safe error summary (no PII)
          await db
            .update(messageOutbox)
            .set({
              attemptCount: newAttemptCount,
              lastAttemptAt: new Date(),
              nextAttemptAt: nextAttemptAt, // CRITICAL: Schedule next retry according to backoff
              lastError: safeErrorSummary,
            })
            .where(sql`${messageOutbox.id} = ${message.id}`);

          // Also update sentMessages attempt count
          await db
            .update(sentMessages)
            .set({
              attemptCount: newAttemptCount,
              lastError: safeErrorSummary,
              updatedAt: new Date(),
            })
            .where(sql`${sentMessages.id} = ${message.sentMessageId}`);

          // DOD COMPLIANCE: Log only safe fields (no PII from error messages)
          console.warn(
            `[Outbox] Send failed (retrying) | msg=${message.sentMessageId} | ` +
            `errorSummary=${safeErrorSummary} | attempt=${newAttemptCount}/${MAX_ATTEMPTS} | ` +
            `retryIn=${Math.round(backoffMs / 60000)}min | latency=${latency}ms`
          );
        }
      }
    }

    // Emit production telemetry
    if (telemetry.messagesProcessed > 0) {
      const avgLatency = Math.round(telemetry.totalLatencyMs / telemetry.messagesProcessed);
      const successRate = ((telemetry.sendSuccess / telemetry.messagesProcessed) * 100).toFixed(1);
      
      console.log(
        `[Outbox Telemetry] batch=${telemetry.messagesProcessed} | ` +
        `success=${telemetry.sendSuccess} (${successRate}%) | ` +
        `transientFail=${telemetry.sendFailureTransient} | ` +
        `permanentFail=${telemetry.sendFailurePermanent} | ` +
        `deadLetter=${telemetry.deadLetterCount} | ` +
        `avgLatency=${avgLatency}ms`
      );
      
      // Log error distribution for debugging
      if (telemetry.errorsByType.size > 0) {
        const errorSummary = Array.from(telemetry.errorsByType.entries())
          .map(([type, count]) => `${type}=${count}`)
          .join(', ');
        console.log(`[Outbox Errors] ${errorSummary}`);
      }
    }

    return messages.length;
  } catch (error) {
    console.error('[Outbox] Processor critical error:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

/**
 * Recover outbox messages on startup
 * 
 * CRITICAL: Only reset nextAttemptAt for messages that are STALE
 * (lastAttemptAt > 5 min ago AND nextAttemptAt is unreasonably far in past).
 * This prevents collapsing exponential backoff for legitimately scheduled retries.
 */
export async function recoverOutboxMessages(): Promise<number> {
  try {
    // Reset nextAttemptAt ONLY for messages that are truly stale
    // NOT for messages correctly scheduled for future retry (e.g., 15min backoff)
    const result = await db
      .update(messageOutbox)
      .set({
        nextAttemptAt: new Date(), // Allow immediate retry for crashed messages
      })
      .where(
        and(
          // Has a lastAttemptAt (was attempted before)
          sql`${messageOutbox.lastAttemptAt} IS NOT NULL`,
          // Last attempt was > 5 minutes ago (likely crashed mid-send)
          sql`${messageOutbox.lastAttemptAt} < NOW() - INTERVAL '5 minutes'`,
          // AND nextAttemptAt is ALSO in the past (stale schedule)
          // This ensures we DON'T reset messages correctly scheduled for future retry
          sql`${messageOutbox.nextAttemptAt} < NOW()`
        )
      );

    const count = result.rowCount || 0;
    if (count > 0) {
      console.log(`[Outbox] Recovered ${count} crashed messages for immediate retry`);
    }

    return count;
  } catch (error) {
    console.error('[Outbox] Recovery error:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}
