-- Migration: Add Multi-Session Meeting Support
-- Purpose: Enable multiple call sessions per scheduled meeting
-- Strategy: Parent/child relationship with partial unique indexes
-- 
-- IMPORTANT: This migration only ADDS columns and indexes
-- It does NOT modify or delete any existing data

-- Step 1: Add new columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS parent_meeting_id VARCHAR REFERENCES meetings(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS session_number INTEGER NOT NULL DEFAULT 1;

-- Step 2: Create index on parent_meeting_id for efficient queries
CREATE INDEX IF NOT EXISTS meeting_parent_idx ON meetings(parent_meeting_id);

-- Step 3: Drop existing unique constraints that prevent multi-session inserts
-- (These will be replaced with partial unique indexes)
-- Note: Using DROP CONSTRAINT because these were created as table constraints, not standalone indexes
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_graph_event_id_key;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_ical_uid_key;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_online_meeting_id_unique;
-- Also try dropping as indexes in case they were created differently in some environments
DROP INDEX IF EXISTS meetings_graph_event_id_key;
DROP INDEX IF EXISTS meetings_ical_uid_key;
DROP INDEX IF EXISTS meetings_online_meeting_id_unique;

-- Step 4: Create partial unique indexes that only apply to canonical meetings (parent_meeting_id IS NULL)
-- This allows child sessions to inherit the same Graph identifiers while keeping canonical meetings unique
CREATE UNIQUE INDEX IF NOT EXISTS meetings_graph_event_canonical_idx 
ON meetings(graph_event_id) 
WHERE parent_meeting_id IS NULL AND graph_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_ical_uid_canonical_idx 
ON meetings(ical_uid) 
WHERE parent_meeting_id IS NULL AND ical_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_online_meeting_id_canonical_idx 
ON meetings(online_meeting_id) 
WHERE parent_meeting_id IS NULL AND online_meeting_id IS NOT NULL;

-- Step 5: Create unique index to prevent duplicate sessions for same parent
CREATE UNIQUE INDEX IF NOT EXISTS meetings_parent_session_unique_idx 
ON meetings(parent_meeting_id, session_number) 
WHERE parent_meeting_id IS NOT NULL;

-- Step 6: Create unique index on call_record_id to prevent duplicate session ingestion
CREATE UNIQUE INDEX IF NOT EXISTS meetings_call_record_unique_idx 
ON meetings(call_record_id) 
WHERE call_record_id IS NOT NULL;

-- Verification queries (run manually to confirm success):
-- SELECT COUNT(*) FROM meetings WHERE parent_meeting_id IS NULL; -- All existing meetings should have NULL parent
-- SELECT COUNT(*) FROM meetings WHERE session_number = 1; -- All existing meetings should be session 1
