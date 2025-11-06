import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Postgres ENUMs for data integrity and type safety
export const classificationLevelEnum = pgEnum("classification_level", [
  "UNCLASSIFIED",
  "CONFIDENTIAL",
  "SECRET",
  "TOP_SECRET"
]);

export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "in_progress",
  "completed",
  "archived"
]);

export const graphSyncStatusEnum = pgEnum("graph_sync_status", [
  "pending",
  "synced",
  "enriched",
  "failed",
  "archived"
]);

export const enrichmentStatusEnum = pgEnum("enrichment_status", [
  "pending",
  "enriching",
  "enriched",
  "failed"
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "transcribing",
  "generating",
  "completed",
  "failed"
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending_review",
  "approved",
  "rejected",
  "revision_requested"
]);

export const priorityEnum = pgEnum("priority", [
  "high",
  "medium",
  "low"
]);

export const actionItemStatusEnum = pgEnum("action_item_status", [
  "pending",
  "in_progress",
  "completed"
]);

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "approver",
  "auditor",
  "viewer"
]);

export const templateTypeEnum = pgEnum("template_type", [
  "briefing",
  "planning",
  "status_review",
  "emergency_response",
  "custom"
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "expired",
  "failed",
  "disabled"
]);

// Meeting schema
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: text("duration").notNull(), // e.g., "1h 30m"
  attendees: jsonb("attendees").notNull().$type<string[]>(),
  status: meetingStatusEnum("status").notNull().default("scheduled"),
  classificationLevel: classificationLevelEnum("classification_level").notNull().default("UNCLASSIFIED"),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  
  // Microsoft Graph Integration
  onlineMeetingId: text("online_meeting_id").unique(), // Teams online meeting ID from Graph API
  organizerAadId: text("organizer_aad_id"), // Azure AD object ID of meeting organizer
  teamsJoinLink: text("teams_join_link"), // Teams meeting join URL
  callRecordId: text("call_record_id"), // Call record ID for post-meeting enrichment
  graphSyncStatus: graphSyncStatusEnum("graph_sync_status").default("pending"),
  
  // Post-meeting enrichment tracking (callRecord, recordings, transcripts)
  enrichmentStatus: enrichmentStatusEnum("enrichment_status").default("pending"),
  enrichmentAttempts: integer("enrichment_attempts").default(0), // Number of enrichment attempts
  lastEnrichmentAt: timestamp("last_enrichment_at"), // Last enrichment attempt timestamp
  callRecordRetryAt: timestamp("call_record_retry_at"), // When to retry enrichment (exponential backoff)
  
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
  processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending_review"),
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
  priority: priorityEnum("priority").notNull().default("medium"),
  status: actionItemStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Meeting Templates schema
export const meetingTemplates = pgTable("meeting_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: templateTypeEnum("type").notNull(),
  defaultDuration: text("default_duration").notNull(), // e.g., "1h 30m"
  defaultClassification: classificationLevelEnum("default_classification").notNull().default("UNCLASSIFIED"),
  suggestedAttendees: jsonb("suggested_attendees").$type<string[]>(),
  agendaItems: jsonb("agenda_items").$type<string[]>(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users schema for access control
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  clearanceLevel: classificationLevelEnum("clearance_level").notNull().default("UNCLASSIFIED"),
  role: userRoleEnum("role").notNull().default("viewer"),
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

// Graph Webhook Subscriptions schema
export const graphWebhookSubscriptions = pgTable("graph_webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Microsoft Graph subscription details
  subscriptionId: text("subscription_id").notNull().unique(), // Graph API subscription ID
  resource: text("resource").notNull(), // Graph resource path (e.g., "/communications/onlineMeetings")
  changeType: text("change_type").notNull(), // created, updated, deleted
  notificationUrl: text("notification_url").notNull(), // Webhook callback URL
  clientState: text("client_state").notNull(), // Secret for validation
  
  // Subscription lifecycle
  expirationDateTime: timestamp("expiration_date_time").notNull(), // When subscription expires (max 3 days for onlineMeetings)
  createdDateTime: timestamp("created_date_time").defaultNow().notNull(), // When subscription was created
  lastRenewedAt: timestamp("last_renewed_at"), // Last successful renewal
  
  // Status tracking
  status: webhookStatusEnum("status").notNull().default("active"),
  lastFailureReason: text("last_failure_reason"), // Error message from last failure
  failureCount: integer("failure_count").default(0), // Number of consecutive failures
  
  // Metadata
  tenantId: text("tenant_id"), // Azure AD tenant (for multi-tenant scenarios)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Group Cache schema (Azure AD group membership with TTL)
export const userGroupCache = pgTable("user_group_cache", {
  azureAdId: text("azure_ad_id").primaryKey(), // Azure AD object ID
  
  // Raw Azure AD groups from Microsoft Graph API
  groupNames: jsonb("group_names").notNull().$type<string[]>(), // Raw group display names
  
  // Normalized clearance level and role (extracted from groups)
  clearanceLevel: classificationLevelEnum("clearance_level").notNull().default("UNCLASSIFIED"),
  role: userRoleEnum("role").notNull().default("viewer"),
  
  // TTL tracking (15-minute cache)
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(), // When groups were fetched
  expiresAt: timestamp("expires_at").notNull(), // When cache expires (fetchedAt + 15min)
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

export const insertGraphWebhookSubscriptionSchema = createInsertSchema(graphWebhookSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGroupCacheSchema = createInsertSchema(userGroupCache).omit({
  fetchedAt: true,
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

export type GraphWebhookSubscription = typeof graphWebhookSubscriptions.$inferSelect;
export type InsertGraphWebhookSubscription = z.infer<typeof insertGraphWebhookSubscriptionSchema>;

export type UserGroupCache = typeof userGroupCache.$inferSelect;
export type InsertUserGroupCache = z.infer<typeof insertUserGroupCacheSchema>;

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
