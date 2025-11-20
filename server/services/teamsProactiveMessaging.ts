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
    
    // CRITICAL: Use SELECT FOR UPDATE to lock row and prevent concurrent sends
    // This ensures only ONE worker can attempt to send this message
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
      
      // If insert succeeded, we're the first attempt - proceed to send
      if (inserted.length > 0) {
        return { shouldSend: true, alreadySent: false };
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
        return { shouldSend: false, alreadySent: true };
      }
      
      // Another worker is currently sending - don't duplicate
      // WATCHDOG: If pending for >5 minutes, assume crash and allow retry
      if (existing.status === 'pending') {
        const pendingDuration = Date.now() - existing.updatedAt.getTime();
        const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        
        if (pendingDuration < PENDING_TIMEOUT_MS) {
          // Still fresh, another worker is actively sending
          return { shouldSend: false, alreadySent: false };
        }
        
        // Stale pending (likely crash) - promote to retry
        console.warn(`[Teams Proactive] Stale pending detected (${Math.round(pendingDuration/1000)}s), assuming crash and retrying: ${idempotencyKey}`);
        await tx.update(sentMessages)
          .set({
            status: 'pending', // Keep as pending (we're about to send)
            attemptCount: existing.attemptCount + 1,
            lastError: 'Previous attempt timed out (likely crash)',
            updatedAt: new Date(),
          })
          .where(eq(sentMessages.idempotencyKey, idempotencyKey));
        
        return { shouldSend: true, alreadySent: false };
      }
      
      // Status is 'failed' - atomically transition to 'pending' for retry
      // This prevents concurrent workers from both retrying
      await tx.update(sentMessages)
        .set({
          status: 'pending', // CRITICAL: Prevents other workers from retrying
          attemptCount: existing.attemptCount + 1,
          lastError: null, // Clear previous error
          updatedAt: new Date(),
        })
        .where(eq(sentMessages.idempotencyKey, idempotencyKey));
      
      return { shouldSend: true, alreadySent: false };
    });
    
    // If transaction determined we shouldn't send, short-circuit
    if (!result.shouldSend) {
      if (result.alreadySent) {
        console.log(`[Teams Proactive] Message already sent: ${idempotencyKey}`);
      } else {
        console.log(`[Teams Proactive] Message send in progress (concurrent worker): ${idempotencyKey}`);
      }
      return { success: true, alreadySent: result.alreadySent };
    }
    
    try {
      // Get conversation reference
      const ref = await db.query.teamsConversationReferences.findFirst({
        where: eq(teamsConversationReferences.conversationId, conversationId),
      });
      
      if (!ref) {
        throw new Error(`Conversation reference not found: ${conversationId}`);
      }
      
      // Send via Bot Framework
      await teamsBotAdapter.sendAdaptiveCard(
        ref.conversationReference as any,
        card
      );
      
      // Mark as sent
      await db.update(sentMessages)
        .set({
          status: 'sent',
          sentAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(sentMessages.idempotencyKey, idempotencyKey));
      
      return { success: true, alreadySent: false };
    } catch (error: any) {
      // Record failure
      await db.update(sentMessages)
        .set({
          status: 'failed',
          lastError: error.message || 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(sentMessages.idempotencyKey, idempotencyKey));
      
      console.error(`[Teams Proactive] Send failed: ${idempotencyKey}`, error.message);
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
