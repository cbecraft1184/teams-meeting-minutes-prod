/**
 * Microsoft Graph Calendar Sync Service
 * 
 * Syncs calendar events from Microsoft Graph API to the local meetings database.
 * Pulls Teams meetings from users' calendars and creates corresponding meeting records.
 */

import { db } from '../db';
import { meetings, users } from '@shared/schema';
import { eq, and, or, isNotNull, isNull, sql } from 'drizzle-orm';
import { acquireTokenByClientCredentials, acquireTokenOnBehalfOf, getGraphClient } from './microsoftIdentity';
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
   * Sync calendar events for a specific user using On-Behalf-Of (OBO) flow
   * @param userEmail - User's email address
   * @param userId - User's Azure AD object ID
   * @param userSsoToken - User's SSO token from Teams (optional, uses client credentials if not provided)
   */
  async syncUserCalendar(userEmail: string, userId: string, userSsoToken?: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    const config = getConfig();
    
    // DIAGNOSTIC LOGGING - Start
    console.log(`[CalendarSync] ========== SYNC START ==========`);
    console.log(`[CalendarSync] User: ${userEmail}`);
    console.log(`[CalendarSync] UserId: ${userId}`);
    console.log(`[CalendarSync] SSO Token Provided: ${!!userSsoToken}`);
    console.log(`[CalendarSync] SSO Token Length: ${userSsoToken ? userSsoToken.length : 0}`);
    console.log(`[CalendarSync] Mock Services: ${config.useMockServices}`);

    if (config.useMockServices) {
      console.log(`[CalendarSync] Mock mode - generating sample events for ${userEmail}`);
      return this.syncMockCalendarEvents(userEmail);
    }

    try {
      let accessToken: string | null = null;
      let usedOboFlow = false;  // Track if OBO succeeded to choose correct endpoint
      
      // Use OBO flow if user's SSO token is provided (preferred for delegated permissions)
      if (userSsoToken) {
        console.log(`[CalendarSync] Attempting OBO flow for ${userEmail}`);
        console.log(`[CalendarSync] OBO Scopes: Calendars.Read, User.Read`);
        try {
          accessToken = await acquireTokenOnBehalfOf(userSsoToken, [
            'https://graph.microsoft.com/Calendars.Read',
            'https://graph.microsoft.com/User.Read'
          ]);
          
          if (accessToken) {
            usedOboFlow = true;
            console.log(`[CalendarSync] OBO SUCCESS - Token acquired (length: ${accessToken.length})`);
          } else {
            console.warn(`[CalendarSync] OBO FAILED - Returned null, falling back to client credentials`);
          }
        } catch (oboError) {
          console.error(`[CalendarSync] OBO EXCEPTION:`, oboError instanceof Error ? oboError.message : 'Unknown error');
          console.error(`[CalendarSync] OBO Full Error:`, JSON.stringify(oboError, null, 2));
        }
      } else {
        console.log(`[CalendarSync] NO SSO TOKEN - Skipping OBO, using client credentials`);
      }
      
      // Fallback to client credentials if OBO fails or no SSO token provided
      if (!accessToken) {
        console.log(`[CalendarSync] Using client credentials for ${userEmail}`);
        accessToken = await acquireTokenByClientCredentials([
          'https://graph.microsoft.com/.default'
        ]);
        usedOboFlow = false;  // Ensure we use application endpoint
        console.log(`[CalendarSync] Client credentials result: ${accessToken ? 'SUCCESS' : 'FAILED'}`);
      }

      if (!accessToken) {
        const error = 'Failed to acquire access token via both OBO and client credentials';
        console.error(`[CalendarSync] FATAL: ${error}`);
        result.errors.push(error);
        return result;
      }

      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        const error = 'Failed to create Graph client';
        console.error(`[CalendarSync] FATAL: ${error}`);
        result.errors.push(error);
        return result;
      }

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 60);

      const filterStart = startDate.toISOString();
      const filterEnd = endDate.toISOString();

      // Use /me/calendarView ONLY when OBO succeeded (delegated token)
      // Use /users/{userId}/calendarView when using client credentials (application token)
      const endpoint = usedOboFlow
        ? `/me/calendarView?startDateTime=${filterStart}&endDateTime=${filterEnd}&$select=id,subject,bodyPreview,body,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,iCalUId,changeKey,lastModifiedDateTime&$orderby=start/dateTime&$top=100`
        : `/users/${userId}/calendarView?startDateTime=${filterStart}&endDateTime=${filterEnd}&$select=id,subject,bodyPreview,body,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,iCalUId,changeKey,lastModifiedDateTime&$orderby=start/dateTime&$top=100`;

      console.log(`[CalendarSync] ========== GRAPH API CALL ==========`);
      console.log(`[CalendarSync] Used OBO Flow: ${usedOboFlow}`);
      console.log(`[CalendarSync] Endpoint: ${usedOboFlow ? '/me/calendarView' : `/users/${userId}/calendarView`}`);
      console.log(`[CalendarSync] Date Range: ${filterStart} to ${filterEnd}`);

      let eventsResponse;
      try {
        eventsResponse = await graphClient.get(endpoint);
        console.log(`[CalendarSync] Graph API Response Status: SUCCESS`);
        console.log(`[CalendarSync] Response has 'value': ${!!eventsResponse?.value}`);
      } catch (graphError: any) {
        console.error(`[CalendarSync] GRAPH API ERROR:`, graphError?.message || 'Unknown');
        console.error(`[CalendarSync] Graph Error Status:`, graphError?.statusCode || 'N/A');
        console.error(`[CalendarSync] Graph Error Body:`, JSON.stringify(graphError?.body || graphError, null, 2));
        throw graphError;
      }

      const events: GraphCalendarEvent[] = eventsResponse.value || [];
      
      console.log(`[CalendarSync] ========== EVENTS RECEIVED ==========`);
      console.log(`[CalendarSync] Total Events Found: ${events.length}`);
      
      // Log each event for debugging
      let onlineMeetingCount = 0;
      events.forEach((event, idx) => {
        const isOnline = event.isOnlineMeeting || !!event.onlineMeetingUrl;
        if (isOnline) onlineMeetingCount++;
        console.log(`[CalendarSync] Event ${idx + 1}: "${event.subject}" | Online: ${isOnline} | Start: ${event.start?.dateTime}`);
      });

      console.log(`[CalendarSync] Online meetings to process: ${onlineMeetingCount} of ${events.length}`);

      for (const event of events) {
        if (!event.isOnlineMeeting && !event.onlineMeetingUrl) {
          console.log(`[CalendarSync] SKIPPING non-online event: "${event.subject}"`);
          continue;
        }

        try {
          const syncResult = await this.upsertMeetingFromEvent(event, userEmail);
          result.synced++;
          if (syncResult === 'created') {
            result.created++;
            console.log(`[CalendarSync] CREATED: "${event.subject}"`);
          } else if (syncResult === 'updated') {
            result.updated++;
            console.log(`[CalendarSync] UPDATED: "${event.subject}"`);
          } else {
            console.log(`[CalendarSync] UNCHANGED: "${event.subject}"`);
          }
        } catch (error) {
          const errorMsg = `Failed to sync event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[CalendarSync] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[CalendarSync] ========== SYNC COMPLETE ==========`);
      console.log(`[CalendarSync] User: ${userEmail}`);
      console.log(`[CalendarSync] Created: ${result.created}`);
      console.log(`[CalendarSync] Updated: ${result.updated}`);
      console.log(`[CalendarSync] Synced: ${result.synced}`);
      console.log(`[CalendarSync] Errors: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.log(`[CalendarSync] Error details:`, result.errors);
      }

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
    // Find canonical meeting (parent_meeting_id IS NULL) by Graph identifiers
    // Child sessions inherit these IDs but should not be matched for calendar sync updates
    const existingMeeting = await db.query.meetings.findFirst({
      where: and(
        isNull(meetings.parentMeetingId),
        or(
          eq(meetings.graphEventId, event.id),
          event.iCalUId ? eq(meetings.iCalUid, event.iCalUId) : undefined
        )
      ),
    });

    // Get all invitee emails from the event
    const inviteeEmails = (event.attendees || [])
      .map(a => a.emailAddress.address)
      .filter(Boolean);
    
    // Get organizer email
    const organizerEmailAddr = event.organizer?.emailAddress.address || organizerEmail;
    
    // Create full attendees list: organizer + all invitees (deduplicated)
    const allAttendees = [organizerEmailAddr, ...inviteeEmails].filter(Boolean);
    const uniqueAttendees = Array.from(new Set(allAttendees.map(e => e.toLowerCase())));
    
    console.log(`[CalendarSync] Meeting "${event.subject}" - Attendees: ${uniqueAttendees.length} (organizer + ${inviteeEmails.length} invitees)`);

    const startTime = new Date(event.start.dateTime + 'Z');
    const endTime = new Date(event.end.dateTime + 'Z');
    const duration = this.calculateDuration(event.start.dateTime, event.end.dateTime);

    const meetingData = {
      title: event.subject || 'Untitled Meeting',
      description: event.bodyPreview || event.body?.content?.substring(0, 500) || null,
      scheduledAt: startTime,
      endTime: endTime,
      duration,
      attendees: uniqueAttendees,
      invitees: uniqueAttendees, // Also populate invitees field
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
