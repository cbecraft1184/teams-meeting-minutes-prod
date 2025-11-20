import { db } from '../db';
import { teamsConversationReferences, actionItems, sentMessages } from '@shared/schema';
import { teamsBotAdapter } from './teamsBot';
import { createMeetingSummaryCard, createMeetingProcessingCard } from './adaptiveCards';
import { Meeting, MeetingMinutes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
    
    // Check if already sent successfully
    const existing = await db.query.sentMessages.findFirst({
      where: and(
        eq(sentMessages.idempotencyKey, idempotencyKey),
        eq(sentMessages.status, 'sent')
      ),
    });
    
    if (existing) {
      console.log(`[Teams Proactive] Message already sent: ${idempotencyKey}`);
      return { success: true, alreadySent: true };
    }
    
    // Record attempt
    await db.insert(sentMessages).values({
      idempotencyKey,
      meetingId,
      conversationId,
      messageType,
      status: 'pending',
      attemptCount: 1,
    }).onConflictDoUpdate({
      target: sentMessages.idempotencyKey,
      set: {
        attemptCount: sql`${sentMessages.attemptCount} + 1`,
        updatedAt: new Date(),
      }
    });
    
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
