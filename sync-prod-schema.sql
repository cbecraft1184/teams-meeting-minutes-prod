-- Production Database Schema Sync Script
-- Run this against your Azure PostgreSQL database to sync schema with code
-- Generated: 2025-12-03

-- Create missing ENUMs if they don't exist
DO $$ BEGIN
    CREATE TYPE enrichment_status AS ENUM ('pending', 'enriching', 'enriched', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_decision AS ENUM ('pending', 'processed', 'skipped_duration', 'skipped_content', 'skipped_no_transcript', 'manual_override');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE graph_sync_status AS ENUM ('pending', 'synced', 'enriched', 'failed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE meeting_source AS ENUM ('graph_calendar', 'graph_webhook', 'manual', 'bot');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to meetings table (IF NOT EXISTS)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_url text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_time timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS graph_event_id text UNIQUE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ical_uid text UNIQUE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_online_meeting boolean DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_email text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS start_time_zone text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_time_zone text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source_type meeting_source DEFAULT 'manual';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS last_graph_sync timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS graph_change_key text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS online_meeting_id text UNIQUE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_aad_id text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS teams_join_link text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS call_record_id text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS graph_sync_status graph_sync_status DEFAULT 'pending';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS enrichment_status enrichment_status DEFAULT 'pending';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS enrichment_attempts integer DEFAULT 0;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS last_enrichment_at timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS call_record_retry_at timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS actual_duration_seconds integer;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_word_count integer;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_decision processing_decision DEFAULT 'pending';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_decision_reason text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_decision_at timestamp;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS meeting_graph_event_idx ON meetings(graph_event_id);
CREATE INDEX IF NOT EXISTS meeting_ical_uid_idx ON meetings(ical_uid);
CREATE INDEX IF NOT EXISTS meeting_organizer_idx ON meetings(organizer_email);

-- Create job_worker_leases table if not exists
CREATE TABLE IF NOT EXISTS job_worker_leases (
  worker_name varchar(100) PRIMARY KEY,
  instance_id varchar(100) NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL
);

-- Verify changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position;
