/**
 * Microsoft Graph Calendar Sync Service
 * 
 * Syncs calendar events from Microsoft Graph API to the local meetings database.
 * Pulls Teams meetings from users' calendars and creates corresponding meeting records.
 */

import { db } from '../db';
import { meetings, users } from '@shared/schema';
import { eq, and, or, isNotNull, sql } from 'drizzle-orm';
import { acquireTokenByClientCredentials, getGraphClient } from './microsoftIdentity';
import { getConfig } from './configValidator';

interface GraphCalendarEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: string;
    status?: {
      response?: string;
    };
  }>;
  organizer?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl?: string;
  };
  onlineMeetingUrl?: string;
  iCalUId?: string;
  changeKey?: string;
  lastModifiedDateTime?: string;
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export class GraphCalendarSyncService {
  
  /**
   * Calculate duration string from start and end times
   */
  private calculateDuration(startDateTime: string, endDateTime: string): string {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (mins === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${mins}m`;
  }

  /**
   * Sync calendar events for a specific user
   * @param userEmail - User's email address
   * @param userId - User's Azure AD object ID
   */
  async syncUserCalendar(userEmail: string, userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    const config = getConfig();

    if (config.useMockServices) {
      console.log(`[CalendarSync] Mock mode - generating sample events for ${userEmail}`);
      return this.syncMockCalendarEvents(userEmail);
    }

    try {
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        result.errors.push('Failed to acquire access token');
        return result;
      }

      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        result.errors.push('Failed to create Graph client');
        return result;
      }

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 60);

      const filterStart = startDate.toISOString();
      const filterEnd = endDate.toISOString();

      console.log(`[CalendarSync] Fetching events for ${userEmail} from ${filterStart} to ${filterEnd}`);

      const eventsResponse = await graphClient.get(
        `/users/${userId}/calendarView?startDateTime=${filterStart}&endDateTime=${filterEnd}&$select=id,subject,bodyPreview,body,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,iCalUId,changeKey,lastModifiedDateTime&$orderby=start/dateTime&$top=100`
      );

      const events: GraphCalendarEvent[] = eventsResponse.value || [];
      
      console.log(`[CalendarSync] Found ${events.length} calendar events for ${userEmail}`);

      for (const event of events) {
        if (!event.isOnlineMeeting && !event.onlineMeetingUrl) {
          continue;
        }

        try {
          const syncResult = await this.upsertMeetingFromEvent(event, userEmail);
          result.synced++;
          if (syncResult === 'created') {
            result.created++;
          } else if (syncResult === 'updated') {
            result.updated++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[CalendarSync] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[CalendarSync] Sync complete for ${userEmail}: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`);

      return result;
    } catch (error) {
      const errorMsg = `Calendar sync failed for ${userEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[CalendarSync] ${errorMsg}`);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Upsert a meeting from a Graph calendar event
   */
  private async upsertMeetingFromEvent(
    event: GraphCalendarEvent,
    organizerEmail: string
  ): Promise<'created' | 'updated' | 'unchanged'> {
    const existingMeeting = await db.query.meetings.findFirst({
      where: or(
        eq(meetings.graphEventId, event.id),
        event.iCalUId ? eq(meetings.iCalUid, event.iCalUId) : undefined
      ),
    });

    const attendeeEmails = (event.attendees || [])
      .map(a => a.emailAddress.address)
      .filter(Boolean);

    const startTime = new Date(event.start.dateTime + 'Z');
    const endTime = new Date(event.end.dateTime + 'Z');
    const duration = this.calculateDuration(event.start.dateTime, event.end.dateTime);

    const meetingData = {
      title: event.subject || 'Untitled Meeting',
      description: event.bodyPreview || event.body?.content?.substring(0, 500) || null,
      scheduledAt: startTime,
      endTime: endTime,
      duration,
      attendees: attendeeEmails,
      location: event.location?.displayName || null,
      isOnlineMeeting: event.isOnlineMeeting || !!event.onlineMeetingUrl,
      teamsJoinLink: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || null,
      organizerEmail: event.organizer?.emailAddress.address || organizerEmail,
      startTimeZone: event.start.timeZone,
      endTimeZone: event.end.timeZone,
      graphEventId: event.id,
      iCalUid: event.iCalUId || null,
      graphChangeKey: event.changeKey || null,
      sourceType: 'graph_calendar' as const,
      graphSyncStatus: 'synced' as const,
      lastGraphSync: new Date(),
    };

    if (existingMeeting) {
      if (existingMeeting.graphChangeKey === event.changeKey) {
        return 'unchanged';
      }

      await db
        .update(meetings)
        .set({
          ...meetingData,
          status: this.determineStatus(startTime, endTime),
        })
        .where(eq(meetings.id, existingMeeting.id));

      console.log(`[CalendarSync] Updated meeting: ${event.subject}`);
      return 'updated';
    } else {
      await db.insert(meetings).values({
        ...meetingData,
        status: this.determineStatus(startTime, endTime),
        classificationLevel: 'UNCLASSIFIED',
      });

      console.log(`[CalendarSync] Created meeting: ${event.subject}`);
      return 'created';
    }
  }

  /**
   * Determine meeting status based on time
   */
  private determineStatus(startTime: Date, endTime: Date): 'scheduled' | 'in_progress' | 'completed' {
    const now = new Date();
    
    if (now < startTime) {
      return 'scheduled';
    } else if (now >= startTime && now <= endTime) {
      return 'in_progress';
    } else {
      return 'completed';
    }
  }

  /**
   * Sync calendars for all registered users with Azure AD IDs
   */
  async syncAllUsersCalendars(): Promise<{ totalSynced: number; totalErrors: number; userResults: Record<string, SyncResult> }> {
    const usersWithAzureId = await db.query.users.findMany({
      where: isNotNull(users.azureAdId),
    });

    console.log(`[CalendarSync] Starting sync for ${usersWithAzureId.length} users`);

    const results: Record<string, SyncResult> = {};
    let totalSynced = 0;
    let totalErrors = 0;

    for (const user of usersWithAzureId) {
      if (!user.azureAdId) continue;
      
      const result = await this.syncUserCalendar(user.email, user.azureAdId);
      results[user.email] = result;
      totalSynced += result.synced;
      totalErrors += result.errors.length;
    }

    console.log(`[CalendarSync] All users sync complete: ${totalSynced} meetings synced, ${totalErrors} errors`);

    return { totalSynced, totalErrors, userResults: results };
  }

  /**
   * Mock calendar sync for development mode
   */
  private async syncMockCalendarEvents(userEmail: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    const now = new Date();
    
    const mockEvents: Partial<typeof meetings.$inferInsert>[] = [
      {
        title: 'Weekly Team Sync',
        description: 'Weekly sync meeting with the development team to discuss progress and blockers.',
        scheduledAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        duration: '1h',
        attendees: [userEmail, 'teammate1@contoso.com', 'teammate2@contoso.com'],
        isOnlineMeeting: true,
        teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/mock-weekly-sync',
        organizerEmail: userEmail,
        sourceType: 'graph_calendar',
        graphEventId: 'mock-event-weekly-sync',
        status: 'completed',
        graphSyncStatus: 'synced',
        lastGraphSync: now,
      },
      {
        title: 'Project Planning Session',
        description: 'Q1 2026 project planning and resource allocation discussion.',
        scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        duration: '2h',
        attendees: [userEmail, 'manager@contoso.com', 'pm@contoso.com'],
        isOnlineMeeting: true,
        teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/mock-planning',
        organizerEmail: userEmail,
        sourceType: 'graph_calendar',
        graphEventId: 'mock-event-planning',
        status: 'scheduled',
        graphSyncStatus: 'synced',
        lastGraphSync: now,
      },
      {
        title: 'Sprint Retrospective',
        description: 'End of sprint review - what went well, what needs improvement.',
        scheduledAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
        duration: '45m',
        attendees: [userEmail, 'scrum-master@contoso.com', 'dev-lead@contoso.com'],
        isOnlineMeeting: true,
        teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/mock-retro',
        organizerEmail: 'scrum-master@contoso.com',
        sourceType: 'graph_calendar',
        graphEventId: 'mock-event-retro',
        status: 'completed',
        graphSyncStatus: 'synced',
        lastGraphSync: now,
      },
    ];

    for (const eventData of mockEvents) {
      try {
        const existing = await db.query.meetings.findFirst({
          where: eq(meetings.graphEventId, eventData.graphEventId!),
        });

        if (!existing) {
          await db.insert(meetings).values({
            ...eventData,
            classificationLevel: 'UNCLASSIFIED',
          } as typeof meetings.$inferInsert);
          
          result.created++;
          console.log(`[CalendarSync] Created mock meeting: ${eventData.title}`);
        } else {
          result.updated++;
        }
        result.synced++;
      } catch (error) {
        const errorMsg = `Failed to create mock event: ${error instanceof Error ? error.message : 'Unknown'}`;
        result.errors.push(errorMsg);
      }
    }

    console.log(`[CalendarSync] Mock sync complete: ${result.created} created, ${result.updated} existing`);
    return result;
  }

  /**
   * Get sync status for debugging
   */
  async getSyncStatus(): Promise<{
    totalMeetingsFromGraph: number;
    lastSyncTimes: { email: string; lastSync: Date | null }[];
  }> {
    const graphMeetings = await db.query.meetings.findMany({
      where: eq(meetings.sourceType, 'graph_calendar'),
    });

    const usersWithSync = await db.query.users.findMany({
      where: isNotNull(users.lastGraphSync),
    });

    return {
      totalMeetingsFromGraph: graphMeetings.length,
      lastSyncTimes: usersWithSync.map(u => ({
        email: u.email,
        lastSync: u.lastGraphSync,
      })),
    };
  }
}

export const graphCalendarSync = new GraphCalendarSyncService();
