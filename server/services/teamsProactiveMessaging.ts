import { db } from '../db';
import { teamsConversationReferences, actionItems, sentMessages } from '@shared/schema';
import { teamsBotAdapter } from './teamsBot';
import { createMeetingSummaryCard, createMeetingProcessingCard } from './adaptiveCards';
import { Meeting, MeetingMinutes } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Teams Proactive Messaging Service with Idempotency
 * 
 * Features:
 * - Prevents duplicate message sends via idempotency keys
 * - Per-recipient error isolation (one failure doesn't stop others)
 * - Automatic retry for failed sends
 * - Delivery tracking and auditability
 */
export class TeamsProactiveMessagingService {
  /**
   * Send Adaptive Card with idempotency protection
   * Prevents duplicate sends via database-level concurrency control
   * 
   * Strategy: Mark as 'sent' BEFORE sending, rollback on failure
   * This ensures idempotency even if process crashes mid-send
   * 
   * @returns {success: boolean, alreadySent: boolean}
   */
  private async sendWithIdempotency(
    meetingId: string,
    conversationId: string,
    messageType: string,
    card: any
  ): Promise<{ success: boolean; alreadySent: boolean }> {
    // Generate idempotency key (unique per meeting + recipient + type)
    const idempotencyKey = `${meetingId}:${conversationId}:${messageType}`;
    const MAX_ATTEMPTS = 3;
    
    // CRITICAL: Check status and prepare to send (with row lock)
    const result = await db.transaction(async (tx) => {
      // Try to insert new record (fails if already exists)
      const inserted = await tx.insert(sentMessages).values({
        idempotencyKey,
        meetingId,
        conversationId,
        messageType,
        status: 'pending',
        attemptCount: 1,
      }).onConflictDoNothing().returning();
      
      // If insert succeeded, we're the first attempt - get ref and mark as sent
      if (inserted.length > 0) {
        const ref = await tx.query.teamsConversationReferences.findFirst({
          where: eq(teamsConversationReferences.conversationId, conversationId),
        });
        
        if (!ref) {
          throw new Error(`Conversation reference not found: ${conversationId}`);
        }
        
        // CRITICAL: Pre-mark as 'sent' before actually sending
        await tx.update(sentMessages)
          .set({
            status: 'sent',
            sentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sentMessages.idempotencyKey, idempotencyKey));
        
        return { shouldSend: true, alreadySent: false, attemptCount: 1, ref };
      }
      
      // If insert failed, row already exists - lock it and check status
      const locked = await tx
        .select()
        .from(sentMessages)
        .where(eq(sentMessages.idempotencyKey, idempotencyKey))
        .for('update') // CRITICAL: Locks row until transaction commits
        .limit(1);
      
      if (locked.length === 0) {
        throw new Error(`Concurrency issue: row disappeared after conflict`);
      }
      
      const existing = locked[0];
      
      // Already sent successfully - don't resend
      if (existing.status === 'sent') {
        return { shouldSend: false, alreadySent: true, attemptCount: existing.attemptCount, ref: null };
      }
      
      // Another worker is currently sending - don't duplicate
      // WATCHDOG: If pending for >5 minutes, assume crash and allow retry
      if (existing.status === 'pending') {
        const pendingDuration = Date.now() - existing.updatedAt.getTime();
        const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        
        if (pendingDuration < PENDING_TIMEOUT_MS) {
          // Still fresh, another worker is actively sending
          return { shouldSend: false, alreadySent: false, attemptCount: existing.attemptCount, ref: null };
        }
        
        // Stale pending (likely crash) - promote to retry
        console.warn(`[Teams Proactive] Stale pending detected (${Math.round(pendingDuration/1000)}s), assuming crash and retrying: ${idempotencyKey}`);
        await tx.update(sentMessages)
          .set({
            status: 'failed', // Mark as failed so we can retry
            attemptCount: existing.attemptCount,
            lastError: 'Previous attempt timed out (likely crash)',
            updatedAt: new Date(),
          })
          .where(eq(sentMessages.idempotencyKey, idempotencyKey));
        
        // Fall through to failed retry logic below
      }
      
      // Status is 'failed' or stale 'pending' - check if we can retry
      if (existing.status === 'failed' || existing.status === 'pending') {
        const newAttemptCount = existing.attemptCount + 1;
        
        // Check max attempts
        if (newAttemptCount > MAX_ATTEMPTS) {
          console.error(`[Teams Proactive] Max attempts (${MAX_ATTEMPTS}) reached: ${idempotencyKey}`);
          return { shouldSend: false, alreadySent: false, attemptCount: existing.attemptCount, ref: null };
        }
        
        // CRITICAL: Pre-mark as 'sent' and get conversation ref in same transaction
        // If we crash after this, next attempt sees 'sent' and skips
        const ref = await tx.query.teamsConversationReferences.findFirst({
          where: eq(teamsConversationReferences.conversationId, conversationId),
        });
        
        if (!ref) {
          throw new Error(`Conversation reference not found: ${conversationId}`);
        }
        
        await tx.update(sentMessages)
          .set({
            status: 'sent', // CRITICAL: Mark as sent BEFORE actually sending
            attemptCount: newAttemptCount,
            sentAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(sentMessages.idempotencyKey, idempotencyKey));
        
        return { shouldSend: true, alreadySent: false, attemptCount: newAttemptCount, ref };
      }
      
      // Unknown status - should never happen
      throw new Error(`Unexpected status: ${existing.status}`);
    });
    
    // If transaction determined we shouldn't send, short-circuit
    if (!result.shouldSend) {
      if (result.alreadySent) {
        console.log(`[Teams Proactive] Message already sent: ${idempotencyKey}`);
      } else {
        console.log(`[Teams Proactive] Message send blocked (in progress or max attempts): ${idempotencyKey}`);
      }
      return { success: true, alreadySent: result.alreadySent };
    }
    
    // Perform the actual send
    // Note: Status is already 'sent' in database, so if we crash here, no retry will occur
    // This is INTENTIONAL - better to skip one message than send duplicates
    try {
      await teamsBotAdapter.sendAdaptiveCard(
        result.ref!.conversationReference as any,
        card
      );
      
      return { success: true, alreadySent: false };
    } catch (error: any) {
      // Send failed - rollback to 'failed' status for retry
      await db.update(sentMessages)
        .set({
          status: 'failed',
          sentAt: null,
          lastError: error.message || 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(sentMessages.idempotencyKey, idempotencyKey));
      
      console.error(`[Teams Proactive] Send failed (attempt ${result.attemptCount}/${MAX_ATTEMPTS}): ${idempotencyKey}`, error.message);
      return { success: false, alreadySent: false };
    }
  }

  async notifyMeetingProcessed(meeting: Meeting, minutes: MeetingMinutes): Promise<void> {
    try {
      const conversationRefs = await db.query.teamsConversationReferences.findMany();

      if (conversationRefs.length === 0) {
        console.log('[Teams Proactive] No conversation references stored - skipping notification');
        return;
      }

      const relatedActionItems = await db.query.actionItems.findMany({
        where: eq(actionItems.meetingId, meeting.id),
      });

      const card = createMeetingSummaryCard(meeting, minutes, relatedActionItems);
      
      // Send to each recipient with per-recipient error isolation
      let successCount = 0;
      let alreadySentCount = 0;
      let failureCount = 0;

      for (const ref of conversationRefs) {
        const result = await this.sendWithIdempotency(
          meeting.id,
          ref.conversationId,
          'summary',
          card
        );
        
        if (result.success) {
          if (result.alreadySent) {
            alreadySentCount++;
          } else {
            successCount++;
            console.log(`[Teams Proactive] Sent summary for "${meeting.title}" to ${ref.teamName || ref.conversationId}`);
          }
        } else {
          failureCount++;
        }
      }
      
      console.log(`[Teams Proactive] Summary distribution: ${successCount} sent, ${alreadySentCount} already sent, ${failureCount} failed`);
    } catch (error) {
      console.error('[Teams Proactive] Error sending notifications:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async notifyMeetingStatus(
    meeting: Meeting,
    status: 'processing' | 'completed' | 'failed',
    message: string
  ): Promise<void> {
    try {
      const conversationRefs = await db.query.teamsConversationReferences.findMany();

      if (conversationRefs.length === 0) {
        return;
      }

      const card = createMeetingProcessingCard(meeting, status, message);
      
      // Send to each recipient with per-recipient error isolation
      let successCount = 0;
      let alreadySentCount = 0;
      let failureCount = 0;

      for (const ref of conversationRefs) {
        const result = await this.sendWithIdempotency(
          meeting.id,
          ref.conversationId,
          `status:${status}`,
          card
        );
        
        if (result.success) {
          if (result.alreadySent) {
            alreadySentCount++;
          } else {
            successCount++;
          }
        } else {
          failureCount++;
        }
      }
      
      console.log(`[Teams Proactive] Status distribution (${status}): ${successCount} sent, ${alreadySentCount} already sent, ${failureCount} failed`);
    } catch (error) {
      console.error('[Teams Proactive] Error sending status notifications:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

export const teamsProactiveMessaging = new TeamsProactiveMessagingService();
