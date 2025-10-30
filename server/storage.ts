import {
  type Meeting,
  type InsertMeeting,
  type MeetingMinutes,
  type InsertMeetingMinutes,
  type ActionItem,
  type InsertActionItem,
  type MeetingWithMinutes
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private meetings: Map<string, Meeting>;
  private minutes: Map<string, MeetingMinutes>;
  private actionItems: Map<string, ActionItem>;

  constructor() {
    this.meetings = new Map();
    this.minutes = new Map();
    this.actionItems = new Map();
    
    // Add sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample meeting 1
    const meeting1Id = randomUUID();
    const meeting1: Meeting = {
      id: meeting1Id,
      title: "Weekly Status Review",
      description: "Review project progress and discuss any blockers",
      scheduledAt: new Date("2025-10-25T14:00:00Z"),
      duration: "1h 30m",
      attendees: ["john.doe@dod.gov", "jane.smith@dod.gov", "bob.johnson@dod.gov"],
      status: "completed",
      classificationLevel: "UNCLASSIFIED",
      recordingUrl: null,
      transcriptUrl: null,
      createdAt: new Date("2025-10-25T12:00:00Z")
    };
    this.meetings.set(meeting1Id, meeting1);

    // Sample minutes for meeting 1
    const minutes1Id = randomUUID();
    const minutes1: MeetingMinutes = {
      id: minutes1Id,
      meetingId: meeting1Id,
      summary: "Team discussed quarterly objectives and reviewed current sprint progress. All milestones are on track for Q4 delivery.",
      keyDiscussions: [
        "Q4 budget allocation and resource planning",
        "Timeline review for upcoming deliverables",
        "Risk assessment for critical path items"
      ],
      decisions: [
        "Approved additional team member hire",
        "Extended deadline for security review by 1 week",
        "Increased travel budget for stakeholder meetings"
      ],
      attendeesPresent: ["john.doe@dod.gov", "jane.smith@dod.gov", "bob.johnson@dod.gov"],
      processingStatus: "completed",
      sharepointUrl: null,
      docxUrl: null,
      pdfUrl: null,
      createdAt: new Date("2025-10-25T15:30:00Z"),
      updatedAt: new Date("2025-10-25T15:45:00Z")
    };
    this.minutes.set(minutes1Id, minutes1);

    // Sample action items
    const action1Id = randomUUID();
    this.actionItems.set(action1Id, {
      id: action1Id,
      meetingId: meeting1Id,
      minutesId: minutes1Id,
      task: "Prepare Q4 budget proposal with updated resource requirements",
      assignee: "john.doe@dod.gov",
      dueDate: new Date("2025-11-05T00:00:00Z"),
      priority: "high",
      status: "in_progress",
      createdAt: new Date("2025-10-25T15:45:00Z")
    });

    const action2Id = randomUUID();
    this.actionItems.set(action2Id, {
      id: action2Id,
      meetingId: meeting1Id,
      minutesId: minutes1Id,
      task: "Schedule security review meeting with compliance team",
      assignee: "jane.smith@dod.gov",
      dueDate: new Date("2025-11-01T00:00:00Z"),
      priority: "high",
      status: "pending",
      createdAt: new Date("2025-10-25T15:45:00Z")
    });

    // Sample meeting 2
    const meeting2Id = randomUUID();
    const meeting2: Meeting = {
      id: meeting2Id,
      title: "Security Architecture Review",
      description: "Quarterly security posture assessment and compliance check",
      scheduledAt: new Date("2025-10-28T10:00:00Z"),
      duration: "2h",
      attendees: ["security.officer@dod.gov", "architect@dod.gov", "compliance@dod.gov"],
      status: "completed",
      classificationLevel: "CONFIDENTIAL",
      recordingUrl: null,
      transcriptUrl: null,
      createdAt: new Date("2025-10-28T08:00:00Z")
    };
    this.meetings.set(meeting2Id, meeting2);

    // Sample meeting 3 (pending minutes)
    const meeting3Id = randomUUID();
    const meeting3: Meeting = {
      id: meeting3Id,
      title: "Emergency Response Planning",
      description: "Discuss and update emergency response procedures",
      scheduledAt: new Date("2025-10-30T09:00:00Z"),
      duration: "1h",
      attendees: ["emergency.coord@dod.gov", "ops.manager@dod.gov"],
      status: "in_progress",
      classificationLevel: "SECRET",
      recordingUrl: null,
      transcriptUrl: null,
      createdAt: new Date("2025-10-30T07:00:00Z")
    };
    this.meetings.set(meeting3Id, meeting3);

    // Add pending minutes
    const minutes3Id = randomUUID();
    this.minutes.set(minutes3Id, {
      id: minutes3Id,
      meetingId: meeting3Id,
      summary: "",
      keyDiscussions: [],
      decisions: [],
      attendeesPresent: [],
      processingStatus: "pending",
      sharepointUrl: null,
      docxUrl: null,
      pdfUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Meetings
  async getMeeting(id: string): Promise<MeetingWithMinutes | undefined> {
    const meeting = this.meetings.get(id);
    if (!meeting) return undefined;

    const minutes = Array.from(this.minutes.values()).find(m => m.meetingId === id);
    const actionItems = Array.from(this.actionItems.values()).filter(a => a.meetingId === id);

    return {
      ...meeting,
      minutes,
      actionItems
    };
  }

  async getAllMeetings(): Promise<MeetingWithMinutes[]> {
    const meetings = Array.from(this.meetings.values());
    return Promise.all(meetings.map(async m => {
      const withMinutes = await this.getMeeting(m.id);
      return withMinutes!;
    }));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = randomUUID();
    const meeting: Meeting = {
      ...insertMeeting,
      id,
      createdAt: new Date()
    };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting> {
    const existing = this.meetings.get(id);
    if (!existing) throw new Error('Meeting not found');
    
    const updated = { ...existing, ...updates };
    this.meetings.set(id, updated);
    return updated;
  }

  async deleteMeeting(id: string): Promise<void> {
    this.meetings.delete(id);
    // Delete associated minutes and action items
    Array.from(this.minutes.entries())
      .filter(([_, m]) => m.meetingId === id)
      .forEach(([minutesId]) => this.minutes.delete(minutesId));
    
    Array.from(this.actionItems.entries())
      .filter(([_, a]) => a.meetingId === id)
      .forEach(([actionId]) => this.actionItems.delete(actionId));
  }

  // Meeting Minutes
  async getMinutes(id: string): Promise<MeetingMinutes | undefined> {
    return this.minutes.get(id);
  }

  async getMinutesByMeetingId(meetingId: string): Promise<MeetingMinutes | undefined> {
    return Array.from(this.minutes.values()).find(m => m.meetingId === meetingId);
  }

  async getAllMinutes(): Promise<MeetingMinutes[]> {
    return Array.from(this.minutes.values());
  }

  async createMinutes(insertMinutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    const id = randomUUID();
    const minutes: MeetingMinutes = {
      ...insertMinutes,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.minutes.set(id, minutes);
    return minutes;
  }

  async updateMinutes(id: string, updates: Partial<MeetingMinutes>): Promise<MeetingMinutes> {
    const existing = this.minutes.get(id);
    if (!existing) throw new Error('Minutes not found');
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.minutes.set(id, updated);
    return updated;
  }

  // Action Items
  async getActionItem(id: string): Promise<ActionItem | undefined> {
    return this.actionItems.get(id);
  }

  async getActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]> {
    return Array.from(this.actionItems.values())
      .filter(item => item.meetingId === meetingId);
  }

  async getAllActionItems(): Promise<ActionItem[]> {
    return Array.from(this.actionItems.values());
  }

  async createActionItem(insertItem: InsertActionItem): Promise<ActionItem> {
    const id = randomUUID();
    const item: ActionItem = {
      ...insertItem,
      id,
      createdAt: new Date()
    };
    this.actionItems.set(id, item);
    return item;
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>): Promise<ActionItem> {
    const existing = this.actionItems.get(id);
    if (!existing) throw new Error('Action item not found');
    
    const updated = { ...existing, ...updates };
    this.actionItems.set(id, updated);
    return updated;
  }

  async deleteActionItem(id: string): Promise<void> {
    this.actionItems.delete(id);
  }
}

export const storage = new MemStorage();
