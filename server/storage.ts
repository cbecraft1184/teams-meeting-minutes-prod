// Reference: blueprint:javascript_database
import {
  meetings,
  meetingMinutes,
  actionItems,
  type Meeting,
  type InsertMeeting,
  type MeetingMinutes,
  type InsertMeetingMinutes,
  type ActionItem,
  type InsertActionItem,
  type MeetingWithMinutes
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Meetings
  getMeeting(id: string): Promise<MeetingWithMinutes | undefined>;
  getAllMeetings(): Promise<MeetingWithMinutes[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  
  // Meeting Minutes
  getMinutes(id: string): Promise<MeetingMinutes | undefined>;
  getMinutesByMeetingId(meetingId: string): Promise<MeetingMinutes | undefined>;
  getAllMinutes(): Promise<MeetingMinutes[]>;
  createMinutes(minutes: InsertMeetingMinutes): Promise<MeetingMinutes>;
  updateMinutes(id: string, updates: Partial<MeetingMinutes>): Promise<MeetingMinutes>;
  
  // Action Items
  getActionItem(id: string): Promise<ActionItem | undefined>;
  getActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]>;
  getAllActionItems(): Promise<ActionItem[]>;
  createActionItem(item: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: string, updates: Partial<ActionItem>): Promise<ActionItem>;
  deleteActionItem(id: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
