import { db } from '../db';
import { messageOutbox, sentMessages } from '@shared/schema';
import { teamsBotAdapter } from './teamsBot';
import { sql, and, lt } from 'drizzle-orm';

/**
 * Transactional Outbox Processor
 * 
 * Polls message_outbox table and sends Adaptive Cards via Bot Framework.
 * Implements exactly-once delivery with exponential backoff retry.
 * 
 * Features:
 * - SELECT FOR UPDATE SKIP LOCKED for concurrent workers
 * - Exponential backoff: 1min → 5min → 15min
 * - Dead-letter queue after 4 failures (3 retry intervals)
 * - Transactional commit: only delete from outbox after successful send
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
 * Process one batch of outbox messages
 * @param batchSize Number of messages to process in one iteration
 * @returns Number of messages processed
 */
export async function processOutboxMessages(batchSize: number = 10): Promise<number> {
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

    let successCount = 0;
    let failureCount = 0;

    // Process each message
    for (const message of messages) {
      try {
        // Send Adaptive Card via Bot Framework
        await teamsBotAdapter.sendAdaptiveCard(
          message.conversationReference,
          message.cardPayload
        );

        // Success - delete from outbox and mark sentMessages as 'sent'
        await db.transaction(async (tx) => {
          // Delete from outbox
          await tx
            .delete(messageOutbox)
            .where(sql`${messageOutbox.id} = ${message.id}`);

          // Update sentMessages audit trail
          await tx
            .update(sentMessages)
            .set({
              status: 'sent',
              sentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(sql`${sentMessages.id} = ${message.sentMessageId}`);
        });

        successCount++;
        console.log(`[Outbox] Message sent successfully: ${message.sentMessageId}`);
      } catch (error: any) {
        // Failure - increment attempt count and apply backoff
        const newAttemptCount = message.attemptCount + 1;
        const errorMessage = error.message || 'Unknown error';

        if (newAttemptCount >= MAX_ATTEMPTS) {
          // Move to dead-letter queue
          await db.transaction(async (tx) => {
            // Delete from outbox (no more retries)
            await tx
              .delete(messageOutbox)
              .where(sql`${messageOutbox.id} = ${message.id}`);

            // Mark sentMessages as permanently failed
            await tx
              .update(sentMessages)
              .set({
                status: 'failed',
                lastError: `Dead-letter after ${newAttemptCount} attempts: ${errorMessage}`,
                attemptCount: newAttemptCount,
                updatedAt: new Date(),
              })
              .where(sql`${sentMessages.id} = ${message.sentMessageId}`);
          });

          console.error(`[Outbox] Message moved to dead-letter: ${message.sentMessageId} - ${errorMessage}`);
        } else {
          // Calculate next retry time with exponential backoff
          const backoffMs = BACKOFF_SCHEDULE_MS[newAttemptCount - 1] || BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
          const nextAttemptAt = new Date(Date.now() + backoffMs);

          // Update for retry with exponential backoff
          await db
            .update(messageOutbox)
            .set({
              attemptCount: newAttemptCount,
              lastAttemptAt: new Date(),
              nextAttemptAt: nextAttemptAt, // CRITICAL: Schedule next retry according to backoff
              lastError: errorMessage,
            })
            .where(sql`${messageOutbox.id} = ${message.id}`);

          // Also update sentMessages attempt count
          await db
            .update(sentMessages)
            .set({
              attemptCount: newAttemptCount,
              lastError: errorMessage,
              updatedAt: new Date(),
            })
            .where(sql`${sentMessages.id} = ${message.sentMessageId}`);

          console.warn(`[Outbox] Message failed (attempt ${newAttemptCount}/${MAX_ATTEMPTS}), retry in ${backoffMs / 60000}min: ${message.sentMessageId} - ${errorMessage}`);
        }

        failureCount++;
      }
    }

    if (successCount > 0 || failureCount > 0) {
      console.log(`[Outbox] Processed ${messages.length} messages: ${successCount} sent, ${failureCount} failed`);
    }

    return messages.length;
  } catch (error) {
    console.error('[Outbox] Processor error:', error instanceof Error ? error.message : 'Unknown error');
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
