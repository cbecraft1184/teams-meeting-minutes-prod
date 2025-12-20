// Reference: blueprint:javascript_database
import {
  meetings,
  meetingMinutes,
  actionItems,
  meetingTemplates,
  appSettings,
  meetingEvents,
  dismissedMeetings,
  shareLinks,
  shareLinkAuditLog,
  jobQueue,
  type Meeting,
  type InsertMeeting,
  type MeetingMinutes,
  type InsertMeetingMinutes,
  type ActionItem,
  type InsertActionItem,
  type MeetingTemplate,
  type InsertMeetingTemplate,
  type MeetingWithMinutes,
  type AppSettings,
  type InsertAppSettings,
  type MeetingEvent,
  type InsertMeetingEvent,
  type DismissedMeeting,
  type ShareLink,
  type InsertShareLink,
  type ShareLinkAuditLog,
  type InsertShareLinkAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // Meetings
  getMeeting(id: string): Promise<MeetingWithMinutes | undefined>;
  getMeetingForTenant(id: string, tenantId: string): Promise<MeetingWithMinutes | undefined>;
  getAllMeetings(): Promise<MeetingWithMinutes[]>;
  getMeetingsByTenant(tenantId: string): Promise<MeetingWithMinutes[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  
  // Meeting Minutes
  getMinutes(id: string): Promise<MeetingMinutes | undefined>;
  getMinutesByMeetingId(meetingId: string): Promise<MeetingMinutes | undefined>;
  getAllMinutes(): Promise<MeetingMinutes[]>;
  getMinutesByTenant(tenantId: string): Promise<MeetingMinutes[]>;
  createMinutes(minutes: InsertMeetingMinutes): Promise<MeetingMinutes>;
  updateMinutes(id: string, updates: Partial<MeetingMinutes>): Promise<MeetingMinutes>;
  
  // Action Items
  getActionItem(id: string): Promise<ActionItem | undefined>;
  getActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]>;
  getAllActionItems(): Promise<ActionItem[]>;
  createActionItem(item: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: string, updates: Partial<ActionItem>): Promise<ActionItem>;
  deleteActionItem(id: string): Promise<void>;

  // Meeting Templates
  getTemplate(id: string): Promise<MeetingTemplate | undefined>;
  getAllTemplates(): Promise<MeetingTemplate[]>;
  getSystemTemplates(): Promise<MeetingTemplate[]>;
  createTemplate(template: InsertMeetingTemplate): Promise<MeetingTemplate>;
  updateTemplate(id: string, updates: Partial<MeetingTemplate>): Promise<MeetingTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // Application Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(updates: Partial<InsertAppSettings>): Promise<AppSettings>;

  // Meeting Events (Audit Trail)
  getMeetingEvents(meetingId: string, options?: { limit?: number; offset?: number }): Promise<MeetingEvent[]>;
  createMeetingEvent(event: InsertMeetingEvent): Promise<MeetingEvent>;
  getMeetingEventsByDateRange(startDate: Date, endDate: Date): Promise<MeetingEvent[]>;

  // Dismissed Meetings
  dismissMeeting(tenantId: string, meetingId: string, userEmail: string): Promise<DismissedMeeting>;
  restoreMeeting(tenantId: string, meetingId: string, userEmail: string): Promise<void>;
  getDismissedMeetingIds(tenantId: string, userEmail: string): Promise<string[]>;
  isMeetingDismissed(tenantId: string, meetingId: string, userEmail: string): Promise<boolean>;

  // Share Links
  createShareLink(link: Omit<InsertShareLink, 'id' | 'createdAt'>): Promise<ShareLink>;
  getShareLinkByToken(token: string): Promise<ShareLink | undefined>;
  getShareLinksByMeetingId(meetingId: string): Promise<ShareLink[]>;
  updateShareLink(id: string, updates: Partial<ShareLink>): Promise<ShareLink>;
  deactivateShareLink(id: string): Promise<void>;
  incrementShareLinkAccess(id: string, accessorEmail?: string): Promise<void>;
  
  // Share Link Audit
  createShareLinkAuditLog(entry: Omit<InsertShareLinkAuditLog, 'id' | 'accessedAt'>): Promise<ShareLinkAuditLog>;
  getShareLinkAuditLog(shareLinkId: string): Promise<ShareLinkAuditLog[]>;
  
  // Job Queue Admin
  getJobsByStatus(status: string, limit?: number): Promise<any[]>;
  getJobById(id: string): Promise<any | undefined>;
  retryJob(id: string, resolvedBy: string): Promise<any>;
  getJobStats(): Promise<{ pending: number; processing: number; failed: number; deadLetter: number; completed: number }>;
}

export class DatabaseStorage implements IStorage {
  // Meetings
  async getMeeting(id: string): Promise<MeetingWithMinutes | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    if (!meeting) return undefined;

    const [minutes] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, id));
    const items = await db.select().from(actionItems).where(eq(actionItems.meetingId, id));

    return {
      ...meeting,
      minutes,
      actionItems: items
    };
  }

  async getAllMeetings(): Promise<MeetingWithMinutes[]> {
    const allMeetings = await db.select().from(meetings).orderBy(desc(meetings.scheduledAt));
    
    // Fetch all minutes and action items for these meetings
    const allMinutes = await db.select().from(meetingMinutes);
    const allActionItems = await db.select().from(actionItems);
    
    // Build a map for quick lookup
    const minutesMap = new Map(allMinutes.map(m => [m.meetingId, m]));
    const actionItemsMap = new Map<string, ActionItem[]>();
    
    allActionItems.forEach(item => {
      const existing = actionItemsMap.get(item.meetingId) || [];
      existing.push(item);
      actionItemsMap.set(item.meetingId, existing);
    });
    
    return allMeetings.map(meeting => ({
      ...meeting,
      minutes: minutesMap.get(meeting.id),
      actionItems: actionItemsMap.get(meeting.id) || []
    }));
  }
  
  // TENANT-ISOLATED: Get meeting only if it belongs to the specified tenant
  async getMeetingForTenant(id: string, tenantId: string): Promise<MeetingWithMinutes | undefined> {
    const [meeting] = await db.select().from(meetings).where(
      and(eq(meetings.id, id), eq(meetings.tenantId, tenantId))
    );
    if (!meeting) return undefined;

    const [minutes] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, id));
    const items = await db.select().from(actionItems).where(eq(actionItems.meetingId, id));

    return {
      ...meeting,
      minutes,
      actionItems: items
    };
  }
  
  // TENANT-ISOLATED: Get all meetings for a specific tenant
  async getMeetingsByTenant(tenantId: string): Promise<MeetingWithMinutes[]> {
    const tenantMeetings = await db.select()
      .from(meetings)
      .where(eq(meetings.tenantId, tenantId))
      .orderBy(desc(meetings.scheduledAt));
    
    if (tenantMeetings.length === 0) return [];
    
    const meetingIds = tenantMeetings.map(m => m.id);
    
    // Fetch minutes and action items only for these tenant's meetings
    const tenantMinutes = await db.select()
      .from(meetingMinutes)
      .where(eq(meetingMinutes.tenantId, tenantId));
    const tenantActionItems = await db.select()
      .from(actionItems)
      .where(eq(actionItems.tenantId, tenantId));
    
    const minutesMap = new Map(tenantMinutes.map(m => [m.meetingId, m]));
    const actionItemsMap = new Map<string, ActionItem[]>();
    
    tenantActionItems.forEach(item => {
      const existing = actionItemsMap.get(item.meetingId) || [];
      existing.push(item);
      actionItemsMap.set(item.meetingId, existing);
    });
    
    return tenantMeetings.map(meeting => ({
      ...meeting,
      minutes: minutesMap.get(meeting.id),
      actionItems: actionItemsMap.get(meeting.id) || []
    }));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting> {
    const [meeting] = await db.update(meetings)
      .set(updates)
      .where(eq(meetings.id, id))
      .returning();
    
    if (!meeting) throw new Error('Meeting not found');
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Meeting Minutes
  async getMinutes(id: string): Promise<MeetingMinutes | undefined> {
    const [minutes] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, id));
    return minutes || undefined;
  }

  async getMinutesByMeetingId(meetingId: string): Promise<MeetingMinutes | undefined> {
    const [minutes] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, meetingId));
    return minutes || undefined;
  }

  async getAllMinutes(): Promise<MeetingMinutes[]> {
    return await db.select().from(meetingMinutes).orderBy(desc(meetingMinutes.createdAt));
  }
  
  // TENANT-ISOLATED: Get all minutes for a specific tenant
  async getMinutesByTenant(tenantId: string): Promise<MeetingMinutes[]> {
    return await db.select()
      .from(meetingMinutes)
      .where(eq(meetingMinutes.tenantId, tenantId))
      .orderBy(desc(meetingMinutes.createdAt));
  }

  async createMinutes(insertMinutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    const [minutes] = await db.insert(meetingMinutes).values(insertMinutes).returning();
    return minutes;
  }

  async updateMinutes(id: string, updates: Partial<MeetingMinutes>): Promise<MeetingMinutes> {
    const [minutes] = await db.update(meetingMinutes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(meetingMinutes.id, id))
      .returning();
    
    if (!minutes) throw new Error('Minutes not found');
    return minutes;
  }

  // Action Items
  async getActionItem(id: string): Promise<ActionItem | undefined> {
    const [item] = await db.select().from(actionItems).where(eq(actionItems.id, id));
    return item || undefined;
  }

  async getActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]> {
    return await db.select().from(actionItems).where(eq(actionItems.meetingId, meetingId));
  }

  async getAllActionItems(): Promise<ActionItem[]> {
    return await db.select().from(actionItems).orderBy(desc(actionItems.createdAt));
  }

  async createActionItem(insertItem: InsertActionItem): Promise<ActionItem> {
    const [item] = await db.insert(actionItems).values(insertItem).returning();
    return item;
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>): Promise<ActionItem> {
    const [item] = await db.update(actionItems)
      .set(updates)
      .where(eq(actionItems.id, id))
      .returning();
    
    if (!item) throw new Error('Action item not found');
    return item;
  }

  async deleteActionItem(id: string): Promise<void> {
    await db.delete(actionItems).where(eq(actionItems.id, id));
  }

  // Meeting Templates
  async getTemplate(id: string): Promise<MeetingTemplate | undefined> {
    const [template] = await db.select().from(meetingTemplates).where(eq(meetingTemplates.id, id));
    return template || undefined;
  }

  async getAllTemplates(): Promise<MeetingTemplate[]> {
    return await db.select().from(meetingTemplates).orderBy(desc(meetingTemplates.createdAt));
  }

  async getSystemTemplates(): Promise<MeetingTemplate[]> {
    return await db.select().from(meetingTemplates).where(eq(meetingTemplates.isSystem, true));
  }

  async createTemplate(insertTemplate: InsertMeetingTemplate): Promise<MeetingTemplate> {
    const [template] = await db.insert(meetingTemplates).values(insertTemplate).returning();
    return template;
  }

  async updateTemplate(id: string, updates: Partial<MeetingTemplate>): Promise<MeetingTemplate> {
    const [template] = await db.update(meetingTemplates)
      .set(updates)
      .where(eq(meetingTemplates.id, id))
      .returning();
    
    if (!template) throw new Error('Template not found');
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(meetingTemplates).where(eq(meetingTemplates.id, id));
  }

  // Application Settings
  async getSettings(): Promise<AppSettings> {
    // Settings is a singleton table with id='default'
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, "default"));
    
    // If no settings exist, create default settings
    if (!settings) {
      const [newSettings] = await db.insert(appSettings).values({
        id: "default",
        requireApprovalForMinutes: true,
        enableEmailDistribution: true,
        enableSharePointArchival: true,
        enableTeamsCardNotifications: true,
      }).returning();
      return newSettings;
    }
    
    return settings;
  }

  async updateSettings(updates: Partial<InsertAppSettings>): Promise<AppSettings> {
    // Ensure default settings exist first
    await this.getSettings();
    
    // Update settings
    const [settings] = await db.update(appSettings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(appSettings.id, "default"))
      .returning();
    
    if (!settings) throw new Error('Failed to update settings');
    return settings;
  }

  // Meeting Events (Audit Trail)
  async getMeetingEvents(meetingId: string, options?: { limit?: number; offset?: number }): Promise<MeetingEvent[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    
    return await db.select()
      .from(meetingEvents)
      .where(eq(meetingEvents.meetingId, meetingId))
      .orderBy(desc(meetingEvents.occurredAt))
      .limit(limit)
      .offset(offset);
  }

  async createMeetingEvent(event: InsertMeetingEvent): Promise<MeetingEvent> {
    const [newEvent] = await db.insert(meetingEvents).values(event).returning();
    return newEvent;
  }

  async getMeetingEventsByDateRange(startDate: Date, endDate: Date): Promise<MeetingEvent[]> {
    return await db.select()
      .from(meetingEvents)
      .where(
        and(
          gte(meetingEvents.occurredAt, startDate),
          lte(meetingEvents.occurredAt, endDate)
        )
      )
      .orderBy(desc(meetingEvents.occurredAt));
  }

  // Dismissed Meetings
  async dismissMeeting(tenantId: string, meetingId: string, userEmail: string): Promise<DismissedMeeting> {
    // Check if there's an existing dismissal record (including restored ones)
    const [existing] = await db.select()
      .from(dismissedMeetings)
      .where(
        and(
          eq(dismissedMeetings.tenantId, tenantId),
          eq(dismissedMeetings.meetingId, meetingId),
          eq(dismissedMeetings.userEmail, userEmail)
        )
      );

    if (existing) {
      // Re-dismiss by clearing restoredAt
      const [updated] = await db.update(dismissedMeetings)
        .set({ 
          dismissedAt: new Date(),
          restoredAt: null 
        })
        .where(eq(dismissedMeetings.id, existing.id))
        .returning();
      return updated;
    }

    // Create new dismissal record
    const [dismissed] = await db.insert(dismissedMeetings)
      .values({
        tenantId,
        meetingId,
        userEmail,
        dismissedAt: new Date()
      })
      .returning();
    return dismissed;
  }

  async restoreMeeting(tenantId: string, meetingId: string, userEmail: string): Promise<void> {
    await db.update(dismissedMeetings)
      .set({ restoredAt: new Date() })
      .where(
        and(
          eq(dismissedMeetings.tenantId, tenantId),
          eq(dismissedMeetings.meetingId, meetingId),
          eq(dismissedMeetings.userEmail, userEmail),
          isNull(dismissedMeetings.restoredAt)
        )
      );
  }

  async getDismissedMeetingIds(tenantId: string, userEmail: string): Promise<string[]> {
    const dismissed = await db.select({ meetingId: dismissedMeetings.meetingId })
      .from(dismissedMeetings)
      .where(
        and(
          eq(dismissedMeetings.tenantId, tenantId),
          eq(dismissedMeetings.userEmail, userEmail),
          isNull(dismissedMeetings.restoredAt)
        )
      );
    return dismissed.map(d => d.meetingId);
  }

  async isMeetingDismissed(tenantId: string, meetingId: string, userEmail: string): Promise<boolean> {
    const [dismissed] = await db.select()
      .from(dismissedMeetings)
      .where(
        and(
          eq(dismissedMeetings.tenantId, tenantId),
          eq(dismissedMeetings.meetingId, meetingId),
          eq(dismissedMeetings.userEmail, userEmail),
          isNull(dismissedMeetings.restoredAt)
        )
      );
    return !!dismissed;
  }

  // Share Links
  async createShareLink(link: Omit<InsertShareLink, 'id' | 'createdAt'>): Promise<ShareLink> {
    const [created] = await db.insert(shareLinks).values(link).returning();
    return created;
  }

  async getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
    const [link] = await db.select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token));
    return link;
  }

  async getShareLinksByMeetingId(meetingId: string): Promise<ShareLink[]> {
    return db.select()
      .from(shareLinks)
      .where(eq(shareLinks.meetingId, meetingId))
      .orderBy(desc(shareLinks.createdAt));
  }

  async updateShareLink(id: string, updates: Partial<ShareLink>): Promise<ShareLink> {
    const [updated] = await db.update(shareLinks)
      .set(updates)
      .where(eq(shareLinks.id, id))
      .returning();
    
    // BUGFIX: Guard against undefined return when ID doesn't exist
    if (!updated) {
      throw new Error('Share link not found');
    }
    return updated;
  }

  async deactivateShareLink(id: string): Promise<void> {
    await db.update(shareLinks)
      .set({ isActive: false })
      .where(eq(shareLinks.id, id));
  }

  async incrementShareLinkAccess(id: string, accessorEmail?: string): Promise<void> {
    await db.update(shareLinks)
      .set({
        accessCount: sql`${shareLinks.accessCount} + 1`,
        lastAccessedAt: new Date(),
        ...(accessorEmail ? { lastAccessorEmail: accessorEmail } : {})
      })
      .where(eq(shareLinks.id, id));
  }
  
  // Share Link Audit
  async createShareLinkAuditLog(entry: Omit<InsertShareLinkAuditLog, 'id' | 'accessedAt'>): Promise<ShareLinkAuditLog> {
    const [created] = await db.insert(shareLinkAuditLog).values(entry).returning();
    return created;
  }
  
  async getShareLinkAuditLog(shareLinkId: string): Promise<ShareLinkAuditLog[]> {
    return db.select()
      .from(shareLinkAuditLog)
      .where(eq(shareLinkAuditLog.shareLinkId, shareLinkId))
      .orderBy(desc(shareLinkAuditLog.accessedAt));
  }
  
  // Job Queue Admin
  async getJobsByStatus(status: string, limit: number = 50): Promise<any[]> {
    if (status === 'dead_letter') {
      // Dead letter jobs have deadLetteredAt set
      return db.select()
        .from(jobQueue)
        .where(sql`${jobQueue.deadLetteredAt} IS NOT NULL`)
        .orderBy(desc(jobQueue.createdAt))
        .limit(limit);
    }
    // Use sql template for enum comparison
    return db.select()
      .from(jobQueue)
      .where(sql`${jobQueue.status} = ${status}`)
      .orderBy(desc(jobQueue.createdAt))
      .limit(limit);
  }
  
  async getJobById(id: string): Promise<any | undefined> {
    const [job] = await db.select().from(jobQueue).where(eq(jobQueue.id, id));
    return job;
  }
  
  async retryJob(id: string, resolvedBy: string): Promise<any> {
    // Reset job for retry: clear dead letter status, reset attempts, set to pending
    // Also reset scheduling metadata so the durable queue worker picks it up
    const [updated] = await db.update(jobQueue)
      .set({
        status: 'pending',
        attemptCount: 0,
        deadLetteredAt: null,
        resolvedAt: new Date(),
        resolvedBy,
        lastError: null,
        // Reset scheduling metadata for the durable queue worker
        scheduledFor: new Date(), // Schedule for immediate processing
        processedAt: null,        // Clear processed timestamp
        lastAttemptAt: null       // Clear last attempt timestamp
      })
      .where(eq(jobQueue.id, id))
      .returning();
    
    // BUGFIX: Guard against undefined return when job ID doesn't exist
    if (!updated) {
      throw new Error('Job not found');
    }
    return updated;
  }
  
  async getJobStats(): Promise<{ pending: number; processing: number; failed: number; deadLetter: number; completed: number }> {
    const stats = await db.select({
      status: jobQueue.status,
      count: sql<number>`count(*)::int`
    })
      .from(jobQueue)
      .groupBy(jobQueue.status);
    
    const deadLetterCount = await db.select({
      count: sql<number>`count(*)::int`
    })
      .from(jobQueue)
      .where(sql`${jobQueue.deadLetteredAt} IS NOT NULL`);
    
    const statusMap = new Map(stats.map(s => [s.status, s.count]));
    
    return {
      pending: statusMap.get('pending') || 0,
      processing: statusMap.get('processing') || 0,
      failed: statusMap.get('failed') || 0,
      deadLetter: deadLetterCount[0]?.count || 0,
      completed: statusMap.get('completed') || 0
    };
  }
}

export const storage = new DatabaseStorage();
