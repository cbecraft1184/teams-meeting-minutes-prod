import { db } from '../db';
import { teamsConversationReferences, actionItems } from '@shared/schema';
import { teamsBotAdapter } from './teamsBot';
import { createMeetingSummaryCard, createMeetingProcessingCard } from './adaptiveCards';
import { Meeting, MeetingMinutes } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class TeamsProactiveMessagingService {
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

      for (const ref of conversationRefs) {
        try {
          await teamsBotAdapter.sendAdaptiveCard(
            ref.conversationReference as any,
            card
          );
          console.log(`[Teams Proactive] Sent summary for "${meeting.title}" to ${ref.teamName || ref.conversationId}`);
        } catch (error: any) {
          console.error(`[Teams Proactive] Failed to send to ${ref.conversationId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Teams Proactive] Error sending notifications:', error);
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

      for (const ref of conversationRefs) {
        try {
          await teamsBotAdapter.sendAdaptiveCard(
            ref.conversationReference as any,
            card
          );
        } catch (error: any) {
          console.error(`[Teams Proactive] Status notification failed for ${ref.conversationId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Teams Proactive] Error sending status notifications:', error);
    }
  }
}

export const teamsProactiveMessaging = new TeamsProactiveMessagingService();
