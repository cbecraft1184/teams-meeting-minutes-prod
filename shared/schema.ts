import { sql, relations } from "drizzle-orm";
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
  approvalStatus: text("approval_status").notNull().default("pending_review"), // pending_review, approved, rejected, revision_requested
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
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

// Meeting Templates schema
export const meetingTemplates = pgTable("meeting_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // briefing, planning, status_review, emergency_response
  defaultDuration: text("default_duration").notNull(), // e.g., "1h 30m"
  defaultClassification: text("default_classification").notNull().default("UNCLASSIFIED"),
  suggestedAttendees: jsonb("suggested_attendees").$type<string[]>(),
  agendaItems: jsonb("agenda_items").$type<string[]>(),
  isSystem: text("is_system").notNull().default("false"), // true for default templates, false for custom
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users schema for access control
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  clearanceLevel: text("clearance_level").notNull().default("UNCLASSIFIED"), // UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET
  role: text("role").notNull().default("viewer"), // admin, approver, auditor, viewer
  department: text("department"),
  organizationalUnit: text("organizational_unit"),
  
  // Azure AD Integration
  azureAdId: text("azure_ad_id").unique(), // Azure AD object ID (canonical identifier)
  azureUserPrincipalName: text("azure_user_principal_name"), // UPN from Azure AD (e.g., user@domain.com)
  tenantId: text("tenant_id"), // Azure AD tenant ID
  refreshTokenVersion: text("refresh_token_version"), // Token version for invalidation
  lastGraphSync: timestamp("last_graph_sync"), // Last Azure AD group sync timestamp
  
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertMeetingTemplateSchema = createInsertSchema(meetingTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

// Types
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type InsertMeetingMinutes = z.infer<typeof insertMeetingMinutesSchema>;

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;

export type MeetingTemplate = typeof meetingTemplates.$inferSelect;
export type InsertMeetingTemplate = z.infer<typeof insertMeetingTemplateSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Relations
export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  minutes: one(meetingMinutes, {
    fields: [meetings.id],
    references: [meetingMinutes.meetingId],
  }),
  actionItems: many(actionItems),
}));

export const meetingMinutesRelations = relations(meetingMinutes, ({ one, many }) => ({
  meeting: one(meetings, {
    fields: [meetingMinutes.meetingId],
    references: [meetings.id],
  }),
  actionItems: many(actionItems),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, {
    fields: [actionItems.meetingId],
    references: [meetings.id],
  }),
  minutes: one(meetingMinutes, {
    fields: [actionItems.minutesId],
    references: [meetingMinutes.id],
  }),
}));

// Extended types for frontend
export type MeetingWithMinutes = Meeting & {
  minutes?: MeetingMinutes;
  actionItems?: ActionItem[];
};
