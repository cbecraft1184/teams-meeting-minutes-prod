CREATE TYPE "public"."action_item_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending_review', 'approved', 'rejected', 'revision_requested');--> statement-breakpoint
CREATE TYPE "public"."classification_level" AS ENUM('UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET');--> statement-breakpoint
CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'enriching', 'enriched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."graph_sync_status" AS ENUM('pending', 'synced', 'enriched', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'in_progress', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'transcribing', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('briefing', 'planning', 'status_review', 'emergency_response', 'custom');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'approver', 'auditor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'expired', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"minutes_id" varchar NOT NULL,
	"task" text NOT NULL,
	"assignee" text NOT NULL,
	"due_date" timestamp,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "action_item_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"require_approval_for_minutes" boolean DEFAULT true NOT NULL,
	"enable_email_distribution" boolean DEFAULT true NOT NULL,
	"enable_sharepoint_archival" boolean DEFAULT true NOT NULL,
	"enable_teams_card_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "graph_webhook_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" text NOT NULL,
	"resource" text NOT NULL,
	"change_type" text NOT NULL,
	"notification_url" text NOT NULL,
	"client_state" text NOT NULL,
	"expiration_date_time" timestamp NOT NULL,
	"created_date_time" timestamp DEFAULT now() NOT NULL,
	"last_renewed_at" timestamp,
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"last_failure_reason" text,
	"failure_count" integer DEFAULT 0,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_webhook_subscriptions_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp,
	"scheduled_for" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_queue_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "meeting_minutes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"summary" text NOT NULL,
	"key_discussions" jsonb NOT NULL,
	"decisions" jsonb NOT NULL,
	"attendees_present" jsonb NOT NULL,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"approval_status" "approval_status" DEFAULT 'pending_review' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejection_reason" text,
	"sharepoint_url" text,
	"docx_url" text,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "template_type" NOT NULL,
	"default_duration" text NOT NULL,
	"default_classification" "classification_level" DEFAULT 'UNCLASSIFIED' NOT NULL,
	"suggested_attendees" jsonb,
	"agenda_items" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp NOT NULL,
	"duration" text NOT NULL,
	"attendees" jsonb NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"classification_level" "classification_level" DEFAULT 'UNCLASSIFIED' NOT NULL,
	"recording_url" text,
	"transcript_url" text,
	"online_meeting_id" text,
	"organizer_aad_id" text,
	"teams_join_link" text,
	"call_record_id" text,
	"graph_sync_status" "graph_sync_status" DEFAULT 'pending',
	"enrichment_status" "enrichment_status" DEFAULT 'pending',
	"enrichment_attempts" integer DEFAULT 0,
	"last_enrichment_at" timestamp,
	"call_record_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_online_meeting_id_unique" UNIQUE("online_meeting_id")
);
--> statement-breakpoint
CREATE TABLE "message_outbox" (
	"id" varchar PRIMARY KEY NOT NULL,
	"sent_message_id" varchar NOT NULL,
	"card_payload" jsonb NOT NULL,
	"conversation_reference" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"meeting_id" varchar NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"message_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'staged' NOT NULL,
	"sent_at" timestamp,
	"last_error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sent_messages_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "teams_conversation_references" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text NOT NULL,
	"service_url" text NOT NULL,
	"tenant_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"conversation_type" text NOT NULL,
	"team_id" text,
	"team_name" text,
	"channel_name" text,
	"conversation_reference" jsonb NOT NULL,
	"meeting_id" varchar,
	"expires_at" timestamp DEFAULT NOW() + INTERVAL '90 days' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_group_cache" (
	"azure_ad_id" text PRIMARY KEY NOT NULL,
	"group_names" jsonb NOT NULL,
	"clearance_level" "classification_level" DEFAULT 'UNCLASSIFIED' NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"clearance_level" "classification_level" DEFAULT 'UNCLASSIFIED' NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"department" text,
	"organizational_unit" text,
	"azure_ad_id" text,
	"azure_user_principal_name" text,
	"tenant_id" text,
	"refresh_token_version" text,
	"last_graph_sync" timestamp,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_azure_ad_id_unique" UNIQUE("azure_ad_id")
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_minutes_id_meeting_minutes_id_fk" FOREIGN KEY ("minutes_id") REFERENCES "public"."meeting_minutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_sent_message_id_sent_messages_id_fk" FOREIGN KEY ("sent_message_id") REFERENCES "public"."sent_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams_conversation_references" ADD CONSTRAINT "teams_conversation_references_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_tenant_idx" ON "graph_webhook_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "webhook_expiration_idx" ON "graph_webhook_subscriptions" USING btree ("expiration_date_time");--> statement-breakpoint
CREATE INDEX "webhook_subscription_id_idx" ON "graph_webhook_subscriptions" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "message_outbox_sent_message_id_idx" ON "message_outbox" USING btree ("sent_message_id");--> statement-breakpoint
CREATE INDEX "sent_messages_meeting_id_idx" ON "sent_messages" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "sent_messages_conversation_id_idx" ON "sent_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "tenant_conversation_idx" ON "teams_conversation_references" USING btree ("tenant_id","conversation_id");--> statement-breakpoint
CREATE INDEX "expires_at_idx" ON "teams_conversation_references" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "meeting_id_idx" ON "teams_conversation_references" USING btree ("meeting_id");