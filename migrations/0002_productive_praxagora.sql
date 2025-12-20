CREATE TYPE "public"."archival_status" AS ENUM('pending', 'uploading', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."detail_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TYPE "public"."meeting_event_type" ADD VALUE 'minutes_edited' BEFORE 'email_sent';--> statement-breakpoint
CREATE TABLE "dismissed_meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"meeting_id" varchar NOT NULL,
	"user_email" text NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL,
	"restored_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "share_link_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_link_id" varchar NOT NULL,
	"meeting_id" varchar NOT NULL,
	"tenant_id" text NOT NULL,
	"accessor_email" text,
	"accessor_name" text,
	"accessor_tenant_id" text,
	"accessor_clearance_level" "classification_level",
	"ip_address" text,
	"user_agent" text,
	"access_granted" boolean NOT NULL,
	"denial_reason" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"meeting_id" varchar NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_email" text NOT NULL,
	"created_by_name" text,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"required_clearance_level" "classification_level" DEFAULT 'UNCLASSIFIED',
	"revoked_at" timestamp,
	"revoked_by" text,
	"revoke_reason" text,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"last_accessed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_graph_event_id_unique";--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_ical_uid_unique";--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_online_meeting_id_unique";--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "assignee_email" text;--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "email_recipient_mode" text DEFAULT 'attendees_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "created_by_email" text;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_queue" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "job_queue" ADD COLUMN "meeting_id" varchar;--> statement-breakpoint
ALTER TABLE "job_queue" ADD COLUMN "dead_lettered_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_queue" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_queue" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "call_record_id" text;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "session_number" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "session_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "session_end_time" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "session_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "generated_detail_level" "detail_level" DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "archival_status" "archival_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "archival_error" text;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "archival_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "invitees" jsonb;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_content" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "parent_meeting_id" varchar;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "session_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "preferred_detail_level" "detail_level" DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "dismissed_meetings" ADD CONSTRAINT "dismissed_meetings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link_audit_log" ADD CONSTRAINT "share_link_audit_log_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dismissed_meetings_user_idx" ON "dismissed_meetings" USING btree ("tenant_id","user_email","restored_at");--> statement-breakpoint
CREATE INDEX "dismissed_meetings_meeting_idx" ON "dismissed_meetings" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "share_link_audit_link_idx" ON "share_link_audit_log" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "share_link_audit_tenant_idx" ON "share_link_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "share_link_audit_accessed_at_idx" ON "share_link_audit_log" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "share_links_meeting_idx" ON "share_links" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "share_links_tenant_idx" ON "share_links" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_parent_meeting_id_meetings_id_fk" FOREIGN KEY ("parent_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_tenant_idx" ON "action_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "job_queue_tenant_idx" ON "job_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "job_queue_status_idx" ON "job_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_queue_meeting_idx" ON "job_queue" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_minutes_tenant_idx" ON "meeting_minutes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "meeting_minutes_archival_status_idx" ON "meeting_minutes" USING btree ("archival_status");--> statement-breakpoint
CREATE INDEX "meeting_parent_idx" ON "meetings" USING btree ("parent_meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_tenant_idx" ON "meetings" USING btree ("tenant_id");