import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, pgEnum, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";

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

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "dead_letter"
]);

// Source type for meeting origin tracking
export const meetingSourceEnum = pgEnum("meeting_source", [
  "graph_calendar", // Synced from Microsoft Graph Calendar
  "graph_webhook",  // Created via Graph webhook notification
  "manual",         // Manually created in app
  "bot"             // Created via Teams bot
]);

// Processing decision for audit logging (compliance)
export const processingDecisionEnum = pgEnum("processing_decision", [
  "pending",           // Not yet evaluated
  "processed",         // Met thresholds, AI processing triggered
  "skipped_duration",  // Duration below minimum threshold
  "skipped_content",   // Transcript content below minimum threshold
  "skipped_no_transcript", // No transcript available
  "manual_override"    // Admin manually triggered processing
]);

// Meeting schema
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  endTime: timestamp("end_time"), // End time from Graph calendar event
  duration: text("duration").notNull(), // e.g., "1h 30m"
  attendees: jsonb("attendees").notNull().$type<string[]>(),
  status: meetingStatusEnum("status").notNull().default("scheduled"),
  classificationLevel: classificationLevelEnum("classification_level").notNull().default("UNCLASSIFIED"),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  transcriptContent: text("transcript_content"), // Full transcript text for AI processing
  
  // Microsoft Graph Calendar Integration
  graphEventId: text("graph_event_id").unique(), // Graph calendar event ID (for idempotent upserts)
  iCalUid: text("ical_uid").unique(), // iCalendar UID for cross-calendar tracking
  location: text("location"), // Meeting location from Graph event
  isOnlineMeeting: boolean("is_online_meeting").default(false), // Whether it's a Teams meeting
  organizerEmail: text("organizer_email"), // Organizer email from Graph event
  startTimeZone: text("start_time_zone"), // Original timezone from Graph
  endTimeZone: text("end_time_zone"), // End timezone from Graph
  sourceType: meetingSourceEnum("source_type").default("manual"), // Where meeting came from
  lastGraphSync: timestamp("last_graph_sync"), // When last synced from Graph
  graphChangeKey: text("graph_change_key"), // ETag/changeKey for incremental sync
  
  // Microsoft Graph Online Meeting Integration
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
  
  // Processing validation audit (compliance)
  actualDurationSeconds: integer("actual_duration_seconds"), // Actual meeting duration from call record
  transcriptWordCount: integer("transcript_word_count"), // Word count from transcript for content validation
  processingDecision: processingDecisionEnum("processing_decision").default("pending"), // Processing decision for audit
  processingDecisionReason: text("processing_decision_reason"), // Human-readable explanation for audit trail
  processingDecisionAt: timestamp("processing_decision_at"), // When processing decision was made
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  graphEventIdx: index("meeting_graph_event_idx").on(table.graphEventId),
  iCalUidIdx: index("meeting_ical_uid_idx").on(table.iCalUid),
  organizerIdx: index("meeting_organizer_idx").on(table.organizerEmail),
}));

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

// Document Template Configuration Types
export interface DocumentSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export interface DocumentBranding {
  organizationName: string;
  logoEnabled: boolean;
  primaryColor: string; // Hex color
  secondaryColor: string; // Hex color
}

export interface DocumentStyling {
  fontFamily: "helvetica" | "times" | "courier";
  titleSize: number;
  headingSize: number;
  bodySize: number;
  lineSpacing: number;
}

export interface DocumentTemplateConfig {
  sections: DocumentSection[];
  branding: DocumentBranding;
  styling: DocumentStyling;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  showGeneratedDate: boolean;
}

// Document Templates schema - for visual presentation of minutes
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  config: jsonb("config").notNull().$type<DocumentTemplateConfig>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  tenantId: text("tenant_id").notNull(), // Azure AD tenant (REQUIRED for multi-tenant isolation)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Index for tenant-scoped subscription management (CRITICAL for multi-tenant isolation)
  tenantIdx: index("webhook_tenant_idx").on(table.tenantId),
  // Index for expiration monitoring and renewal jobs
  expirationIdx: index("webhook_expiration_idx").on(table.expirationDateTime),
  // Index for subscription lookup by Graph API ID
  subscriptionIdIdx: index("webhook_subscription_id_idx").on(table.subscriptionId),
}));

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

// Teams Bot Conversation References schema (for proactive messaging)
export const teamsConversationReferences = pgTable("teams_conversation_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Teams identifiers
  conversationId: text("conversation_id").notNull(), // Teams conversation/channel ID
  serviceUrl: text("service_url").notNull(), // Bot Service URL
  tenantId: text("tenant_id").notNull(), // Azure AD tenant ID
  channelId: text("channel_id").notNull(), // Always 'msteams'
  
  // Conversation type
  conversationType: text("conversation_type").notNull(), // personal, groupChat, channel
  teamId: text("team_id"), // Team ID (if channel conversation)
  teamName: text("team_name"), // Team name
  channelName: text("channel_name"), // Channel name (if channel conversation)
  
  // Full conversation reference (Bot Framework format)
  conversationReference: jsonb("conversation_reference").notNull().$type<Record<string, any>>(),
  
  // Association with meetings
  meetingId: varchar("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
  
  // TTL for automatic cleanup (conversation references expire after 90 days)
  // Database default: NOW() + 90 days
  expiresAt: timestamp("expires_at").notNull().default(sql`NOW() + INTERVAL '90 days'`),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Composite index for tenant-scoped queries (CRITICAL for multi-tenant isolation)
  tenantConversationIdx: index("tenant_conversation_idx").on(table.tenantId, table.conversationId),
  // Index for TTL-based cleanup queries
  expiresAtIdx: index("expires_at_idx").on(table.expiresAt),
  // Index for meeting association lookups
  meetingIdIdx: index("meeting_id_idx").on(table.meetingId),
}));

// ==================================================
// Proactive Message Tracking (Idempotency & Delivery)
// ==================================================

export const sentMessages = pgTable("sent_messages", {
  id: varchar("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Idempotency key: unique per meeting + recipient + message type
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull().unique(),
  
  // Message metadata
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id", { length: 255 }).notNull(),
  messageType: varchar("message_type", { length: 50 }).notNull(), // "summary", "status", "processing"
  
  // Delivery status (outbox pattern: "staged" → "sent")
  status: varchar("status", { length: 20 }).notNull().default("staged"), // "staged", "sent", "failed"
  sentAt: timestamp("sent_at"),
  lastError: text("last_error"),
  attemptCount: integer("attempt_count").notNull().default(0),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Index for cleanup queries (messages older than 30 days)
  meetingIdIdx: index("sent_messages_meeting_id_idx").on(table.meetingId),
  conversationIdIdx: index("sent_messages_conversation_id_idx").on(table.conversationId),
}));

export type SentMessage = typeof sentMessages.$inferSelect;
export type InsertSentMessage = typeof sentMessages.$inferInsert;

// Transactional Outbox for exactly-once delivery
// Messages staged here are atomically committed with sentMessages status
export const messageOutbox = pgTable("message_outbox", {
  id: varchar("id").primaryKey().$defaultFn(() => nanoid()),
  
  // Reference to sent_messages tracking record
  sentMessageId: varchar("sent_message_id").notNull().references(() => sentMessages.id, { onDelete: "cascade" }),
  
  // Payload for Bot Framework send
  cardPayload: jsonb("card_payload").notNull().$type<any>(), // Adaptive Card JSON
  conversationReference: jsonb("conversation_reference").notNull().$type<any>(), // Bot Framework conversation reference
  
  // Delivery tracking
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(), // When next retry is allowed (exponential backoff)
  lastError: text("last_error"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for outbox processor (fetch unsent messages)
  sentMessageIdIdx: index("message_outbox_sent_message_id_idx").on(table.sentMessageId),
}));

export type MessageOutbox = typeof messageOutbox.$inferSelect;
export type InsertMessageOutbox = typeof messageOutbox.$inferInsert;

// ==================================================
// Durable Job Queue schema (PostgreSQL-backed for crash recovery)
// ==================================================

export const jobQueue = pgTable("job_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Job identification
  jobType: text("job_type").notNull(), // enrich_meeting, generate_minutes, send_email, upload_sharepoint, post_teams_summary
  idempotencyKey: text("idempotency_key").notNull().unique(), // Prevents duplicate processing (e.g., "enrich:meeting-123")
  
  // Job payload
  payload: jsonb("payload").notNull().$type<Record<string, any>>(), // Job-specific data
  
  // Status tracking
  status: jobStatusEnum("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  
  // Error tracking
  lastError: text("last_error"), // Last error message
  lastAttemptAt: timestamp("last_attempt_at"), // When last attempt was made
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(), // When to process (for retry backoff)
  processedAt: timestamp("processed_at"), // When successfully completed
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================================================
// Job Worker Leases schema (distributed locking without superuser)
// ==================================================

export const jobWorkerLeases = pgTable("job_worker_leases", {
  // Worker name as primary key (e.g., "main_job_worker")
  workerName: varchar("worker_name", { length: 100 }).primaryKey(),
  
  // Instance identity (unique per container/process)
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  
  // Lease timing
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),
  leaseExpiresAt: timestamp("lease_expires_at").notNull(),
});

export type JobWorkerLease = typeof jobWorkerLeases.$inferSelect;
export type InsertJobWorkerLease = typeof jobWorkerLeases.$inferInsert;

// ==================================================
// Meeting Events schema (audit trail/event history)
// ==================================================

export const meetingEventTypeEnum = pgEnum("meeting_event_type", [
  "meeting_created",
  "meeting_updated",
  "meeting_completed",
  "transcript_received",
  "processing_started",
  "processing_completed",
  "processing_skipped",
  "minutes_generated",
  "minutes_approved",
  "minutes_rejected",
  "minutes_regenerated",
  "email_sent",
  "sharepoint_uploaded",
  "action_item_created",
  "action_item_updated",
  "action_item_completed",
  "manual_override"
]);

export const meetingEvents = pgTable("meeting_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Meeting reference
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  
  // Multi-tenant isolation
  tenantId: text("tenant_id"), // Azure AD tenant ID for multi-tenant isolation
  
  // Event details
  eventType: meetingEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Who triggered the event (null for system events)
  actorEmail: text("actor_email"),
  actorName: text("actor_name"),
  actorAadId: text("actor_aad_id"), // Azure AD object ID for traceability
  
  // Additional metadata (flexible JSON for event-specific data)
  metadata: jsonb("metadata").notNull().default({}).$type<Record<string, any>>(),
  
  // Job correlation for linking to background jobs
  correlationId: text("correlation_id"), // Optional: links to job_queue for tracing
  
  // Timestamps
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  meetingIdIdx: index("meeting_events_meeting_id_idx").on(table.meetingId),
  eventTypeIdx: index("meeting_events_type_idx").on(table.eventType),
  occurredAtIdx: index("meeting_events_occurred_at_idx").on(table.occurredAt),
  tenantIdIdx: index("meeting_events_tenant_id_idx").on(table.tenantId),
}));

export type MeetingEvent = typeof meetingEvents.$inferSelect;
export type InsertMeetingEvent = typeof meetingEvents.$inferInsert;

// ==================================================
// Application Settings schema (singleton table)
// ==================================================

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("default"), // Singleton: only one row with id='default'
  
  // Approval workflow configuration
  requireApprovalForMinutes: boolean("require_approval_for_minutes").notNull().default(true),
  
  // Email distribution settings
  enableEmailDistribution: boolean("enable_email_distribution").notNull().default(true),
  // Email recipient mode: 'attendees_only' = only people who joined, 'all_invitees' = everyone invited
  emailRecipientMode: text("email_recipient_mode").notNull().default("attendees_only"),
  
  // SharePoint archival settings
  enableSharePointArchival: boolean("enable_sharepoint_archival").notNull().default(true),
  
  // Teams card notification settings
  enableTeamsCardNotifications: boolean("enable_teams_card_notifications").notNull().default(true),
  
  // Metadata
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"), // Azure AD ID of user who last updated settings
});

// ==================================================
// Dismissed Meetings schema (per-user meeting hiding)
// ==================================================

export const dismissedMeetings = pgTable("dismissed_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Multi-tenant isolation
  tenantId: text("tenant_id").notNull(),
  
  // Meeting reference
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  
  // User who dismissed
  userEmail: text("user_email").notNull(),
  
  // Timestamps for soft-delete pattern
  dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  restoredAt: timestamp("restored_at"), // null = still dismissed, set = restored
}, (table) => ({
  // Composite index for fast lookup of dismissed meetings per user
  userDismissedIdx: index("dismissed_meetings_user_idx").on(table.tenantId, table.userEmail, table.restoredAt),
  // Index for meeting lookups
  meetingIdx: index("dismissed_meetings_meeting_idx").on(table.meetingId),
}));

export type DismissedMeeting = typeof dismissedMeetings.$inferSelect;
export type InsertDismissedMeeting = typeof dismissedMeetings.$inferInsert;

// Insert schemas with strict validation
export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
}).extend({
  // Strict validation for attendees
  attendees: z.array(z.string().email("Each attendee must be a valid email address"))
    .min(1, "At least one attendee is required")
    .max(500, "Maximum 500 attendees allowed"),
  
  // Strict validation for title
  title: z.string()
    .min(1, "Title is required")
    .max(500, "Title must be 500 characters or less")
    .trim(),
  
  // Strict validation for duration
  duration: z.string()
    .regex(/^\d+h( \d+m)?$|^\d+m$/, "Duration must be in format '1h 30m' or '30m'")
    .trim(),
  
  // Optional description validation
  description: z.string()
    .max(2000, "Description must be 2000 characters or less")
    .trim()
    .optional()
    .nullable(),
});

export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Strict validation for summary
  summary: z.string()
    .min(1, "Summary is required")
    .max(5000, "Summary must be 5000 characters or less")
    .trim(),
  
  // Strict validation for attendees present (allow 0 for solo meetings)
  attendeesPresent: z.array(z.string().email("Each attendee must be a valid email address"))
    .min(0, "Attendees must be an array")
    .max(500, "Maximum 500 attendees allowed"),
  
  // Strict validation for key discussions
  keyDiscussions: z.array(z.string().min(1).max(1000))
    .min(0, "Key discussions must be an array")
    .max(100, "Maximum 100 key discussion points allowed"),
  
  // Strict validation for decisions
  decisions: z.array(z.string().min(1).max(1000))
    .min(0, "Decisions must be an array")
    .max(100, "Maximum 100 decisions allowed"),
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
}).extend({
  // Strict validation for task
  task: z.string()
    .min(1, "Task description is required")
    .max(1000, "Task description must be 1000 characters or less")
    .trim(),
  
  // Validation for assignee (name, email, or "Unassigned")
  assignee: z.string()
    .min(1, "Assignee is required")
    .max(200, "Assignee must be 200 characters or less")
    .trim(),
  
  // Strict validation for due date (must be in future if provided)
  // Use union to handle null/undefined, then coerce and validate only when present
  dueDate: z.union([
    z.coerce.date().refine(
      (date) => date > new Date(),
      "Due date must be in the future"
    ),
    z.null(),
    z.undefined()
  ]).optional(),
  
  // Priority is already enum-validated by drizzle-zod
  // Status is already enum-validated by drizzle-zod
});

export const insertMeetingTemplateSchema = createInsertSchema(meetingTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertJobSchema = createInsertSchema(jobQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamsConversationReferenceSchema = createInsertSchema(teamsConversationReferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertMeetingEventSchema = createInsertSchema(meetingEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string()
    .min(1, "Event title is required")
    .max(500, "Event title must be 500 characters or less")
    .trim(),
  description: z.string()
    .max(2000, "Description must be 2000 characters or less")
    .trim()
    .optional()
    .nullable(),
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

export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type GraphWebhookSubscription = typeof graphWebhookSubscriptions.$inferSelect;

export type TeamsConversationReference = typeof teamsConversationReferences.$inferSelect;
export type InsertTeamsConversationReference = z.infer<typeof insertTeamsConversationReferenceSchema>;
export type InsertGraphWebhookSubscription = z.infer<typeof insertGraphWebhookSubscriptionSchema>;

export type UserGroupCache = typeof userGroupCache.$inferSelect;
export type InsertUserGroupCache = z.infer<typeof insertUserGroupCacheSchema>;

export type Job = typeof jobQueue.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

// Relations
export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  minutes: one(meetingMinutes, {
    fields: [meetings.id],
    references: [meetingMinutes.meetingId],
  }),
  actionItems: many(actionItems),
  events: many(meetingEvents),
}));

export const meetingEventsRelations = relations(meetingEvents, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingEvents.meetingId],
    references: [meetings.id],
  }),
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
