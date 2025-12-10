/**
 * Calendar Sync Service
 * 
 * Fetches scheduled meetings from Microsoft Graph Calendar API
 * Used to sync meetings that were scheduled before webhook subscription
 * and to provide a backup mechanism for webhook failures
 */

import { db } from '../db';
import { meetings } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { acquireTokenByClientCredentials, getGraphClient } from './microsoftIdentity';
import { getConfig } from './configValidator';

interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer: { emailAddress: { address: string; name: string } };
  attendees: Array<{ emailAddress: { address: string; name: string } }>;
  isOnlineMeeting: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
  onlineMeetingId?: string;
  bodyPreview?: string;
}

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

class CalendarSyncService {
  /**
   * Sync meetings from Microsoft Graph for a specific user
   * Fetches calendar events for the next 7 days that are online meetings
   */
  async syncUserCalendar(userEmail: string, userId: string): Promise<SyncResult> {
    const config = getConfig();
    const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };
    
    if (config.useMockServices) {
      console.log('[CalendarSync] Mock mode - skipping calendar sync');
      return result;
    }

    try {
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('[CalendarSync] Failed to acquire access token');
        return result;
      }

      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('[CalendarSync] Failed to create Graph client');
        return result;
      }

      const now = new Date();
      const startDateTime = now.toISOString();
      const endDateTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      console.log(`📅 [CalendarSync] Fetching events for ${userEmail} from ${startDateTime} to ${endDateTime}`);

      const response = await graphClient.get(
        `/users/${userEmail}/calendar/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$filter=isOnlineMeeting eq true&$select=id,subject,start,end,organizer,attendees,isOnlineMeeting,onlineMeeting,bodyPreview&$top=50`
      );

      const events: GraphEvent[] = response?.value || [];
      console.log(`📅 [CalendarSync] Found ${events.length} online meetings`);

      for (const event of events) {
        try {
          await this.upsertMeetingFromEvent(event, userId);
          result.synced++;
        } catch (error) {
          console.error(`[CalendarSync] Error syncing event ${event.id}:`, error);
          result.errors++;
        }
      }

      return result;
    } catch (error) {
      console.error('[CalendarSync] Error syncing calendar:', error);
      return result;
    }
  }

  /**
   * Sync all upcoming meetings from the organization
   * Uses application permissions to fetch meetings across all users
   */
  async syncOrganizationMeetings(daysAhead: number = 7): Promise<SyncResult> {
    const config = getConfig();
    const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };
    
    if (config.useMockServices) {
      console.log('[CalendarSync] Mock mode - skipping organization sync');
      return result;
    }

    try {
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('[CalendarSync] Failed to acquire access token');
        return result;
      }

      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('[CalendarSync] Failed to create Graph client');
        return result;
      }

      const now = new Date();
      const startDateTime = now.toISOString();
      const endDateTime = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      console.log(`📅 [CalendarSync] Syncing organization meetings for next ${daysAhead} days`);

      const response = await graphClient.get(
        `/communications/onlineMeetings?$filter=startDateTime ge ${startDateTime} and startDateTime le ${endDateTime}&$top=100`
      );

      const onlineMeetings = response?.value || [];
      console.log(`📅 [CalendarSync] Found ${onlineMeetings.length} online meetings`);

      for (const meeting of onlineMeetings) {
        try {
          await this.upsertMeetingFromOnlineMeeting(meeting);
          result.synced++;
        } catch (error: any) {
          if (error.message?.includes('already exists')) {
            result.skipped++;
          } else {
            console.error(`[CalendarSync] Error syncing meeting ${meeting.id}:`, error);
            result.errors++;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('[CalendarSync] Error syncing organization meetings:', error);
      return result;
    }
  }

  /**
   * Upsert meeting from calendar event
   */
  private async upsertMeetingFromEvent(event: GraphEvent, userId: string): Promise<void> {
    const onlineMeetingId = event.onlineMeetingId || event.id;
    
    const [existing] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.onlineMeetingId, onlineMeetingId))
      .limit(1);

    if (existing) {
      console.log(`   ⏭️ Meeting already exists: ${event.subject}`);
      return;
    }

    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const attendeeEmails = event.attendees?.map(a => a.emailAddress.address) || [];

    await db.insert(meetings).values({
      title: event.subject || 'Teams Meeting',
      description: event.bodyPreview || null,
      scheduledAt: startTime,
      endTime: endTime,
      duration: `${durationMinutes} minutes`,
      status: startTime > new Date() ? 'scheduled' : 'completed',
      classificationLevel: 'UNCLASSIFIED',
      organizerEmail: event.organizer?.emailAddress?.address || null,
      organizerAadId: userId,
      attendees: attendeeEmails, // Initially same as invitees, updated by enrichment with actual participants
      invitees: attendeeEmails, // Store original invitees for email distribution option
      onlineMeetingId,
      teamsJoinLink: event.onlineMeeting?.joinUrl || null,
      isOnlineMeeting: true,
      graphSyncStatus: 'synced',
    });

    console.log(`   ✅ Synced meeting: ${event.subject}`);
  }

  /**
   * Upsert meeting from online meeting object (from /communications/onlineMeetings)
   */
  private async upsertMeetingFromOnlineMeeting(meeting: any): Promise<void> {
    const onlineMeetingId = meeting.id;
    
    const [existing] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.onlineMeetingId, onlineMeetingId))
      .limit(1);

    if (existing) {
      return;
    }

    const startTime = new Date(meeting.startDateTime);
    const endTime = new Date(meeting.endDateTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const attendeeEmails = meeting.participants?.attendees?.map((a: any) => 
      a.upn || a.identity?.user?.id || 'unknown'
    ) || [];

    await db.insert(meetings).values({
      title: meeting.subject || 'Teams Meeting',
      description: null,
      scheduledAt: startTime,
      endTime: endTime,
      duration: `${durationMinutes} minutes`,
      status: startTime > new Date() ? 'scheduled' : 'completed',
      classificationLevel: 'UNCLASSIFIED',
      organizerEmail: meeting.participants?.organizer?.upn || null,
      organizerAadId: meeting.participants?.organizer?.identity?.user?.id || null,
      attendees: attendeeEmails, // Initially same as invitees, updated by enrichment with actual participants
      invitees: attendeeEmails, // Store original invitees for email distribution option
      onlineMeetingId,
      teamsJoinLink: meeting.joinWebUrl || null,
      isOnlineMeeting: true,
      graphSyncStatus: 'synced',
    });

    console.log(`   ✅ Synced meeting: ${meeting.subject}`);
  }

  /**
   * Get meetings that need transcript enrichment
   * (Completed meetings that don't have transcripts yet)
   */
  async getMeetingsNeedingEnrichment(): Promise<string[]> {
    const now = new Date();
    const result = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(
        and(
          eq(meetings.status, 'completed'),
          eq(meetings.isOnlineMeeting, true),
          eq(meetings.enrichmentStatus, 'pending')
        )
      )
      .limit(10);

    return result.map(m => m.id);
  }
}

export const calendarSyncService = new CalendarSyncService();
