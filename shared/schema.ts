import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Meeting schema
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: text("duration").notNull(), // e.g., "1h 30m"
  attendees: jsonb("attendees").notNull().$type<string[]>(),
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, archived
  classificationLevel: text("classification_level").notNull().default("UNCLASSIFIED"), // UNCLASSIFIED, CONFIDENTIAL, SECRET
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Meeting Minutes schema
export const meetingMinutes = pgTable("meeting_minutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  keyDiscussions: jsonb("key_discussions").notNull().$type<string[]>(),
  decisions: jsonb("decisions").notNull().$type<string[]>(),
  attendeesPresent: jsonb("attendees_present").notNull().$type<string[]>(),
  processingStatus: text("processing_status").notNull().default("pending"), // pending, transcribing, generating, completed, failed
  sharepointUrl: text("sharepoint_url"),
  docxUrl: text("docx_url"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Action Items schema
export const actionItems = pgTable("action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  minutesId: varchar("minutes_id").notNull().references(() => meetingMinutes.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  assignee: text("assignee").notNull(),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"), // high, medium, low
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});

export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
});

// Types
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type InsertMeetingMinutes = z.infer<typeof insertMeetingMinutesSchema>;

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;

// Extended types for frontend
export type MeetingWithMinutes = Meeting & {
  minutes?: MeetingMinutes;
  actionItems?: ActionItem[];
};
