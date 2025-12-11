-- Migration: Add assignee_email column to action_items table
-- Purpose: Enable email-based permission checks for action item updates
-- Date: 2025-12-11

-- Add assignee_email column (nullable for legacy/unassigned items)
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS assignee_email TEXT;

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_action_items_assignee_email ON action_items(assignee_email) WHERE assignee_email IS NOT NULL;

-- Note: Existing action items will have NULL assignee_email
-- New action items will populate assignee_email when the assignee is matched to a meeting attendee
