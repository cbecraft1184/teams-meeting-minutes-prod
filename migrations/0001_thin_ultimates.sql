CREATE TYPE "public"."meeting_event_type" AS ENUM('meeting_created', 'meeting_updated', 'meeting_completed', 'transcript_received', 'processing_started', 'processing_completed', 'processing_skipped', 'minutes_generated', 'minutes_approved', 'minutes_rejected', 'minutes_regenerated', 'email_sent', 'sharepoint_uploaded', 'action_item_created', 'action_item_updated', 'action_item_completed', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."meeting_source" AS ENUM('graph_calendar', 'graph_webhook', 'manual', 'bot');--> statement-breakpoint
CREATE TYPE "public"."processing_decision" AS ENUM('pending', 'processed', 'skipped_duration', 'skipped_content', 'skipped_no_transcript', 'manual_override');--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_worker_leases" (
	"worker_name" varchar(100) PRIMARY KEY NOT NULL,
	"instance_id" varchar(100) NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"tenant_id" text,
	"event_type" "meeting_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"actor_email" text,
	"actor_name" text,
	"actor_aad_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "end_time" timestamp;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "graph_event_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "ical_uid" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "is_online_meeting" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "organizer_email" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "start_time_zone" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "end_time_zone" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "source_type" "meeting_source" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "last_graph_sync" timestamp;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "graph_change_key" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "actual_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_word_count" integer;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "processing_decision" "processing_decision" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "processing_decision_reason" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "processing_decision_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting_events" ADD CONSTRAINT "meeting_events_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_events_meeting_id_idx" ON "meeting_events" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_events_type_idx" ON "meeting_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "meeting_events_occurred_at_idx" ON "meeting_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "meeting_events_tenant_id_idx" ON "meeting_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "meeting_graph_event_idx" ON "meetings" USING btree ("graph_event_id");--> statement-breakpoint
CREATE INDEX "meeting_ical_uid_idx" ON "meetings" USING btree ("ical_uid");--> statement-breakpoint
CREATE INDEX "meeting_organizer_idx" ON "meetings" USING btree ("organizer_email");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_graph_event_id_unique" UNIQUE("graph_event_id");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_ical_uid_unique" UNIQUE("ical_uid");