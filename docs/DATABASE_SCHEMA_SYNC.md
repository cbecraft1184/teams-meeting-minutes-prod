# Database Schema Synchronization Guide

## Overview

This document describes how to identify and resolve database schema drift between the Drizzle ORM schema (in code) and the production PostgreSQL database.

## The Problem

When schema changes are made in `shared/schema.ts` but not applied to the production database, Drizzle ORM generates invalid SQL queries. The most common symptom is:

```sql
-- Malformed SQL (column name missing)
where ("meetings"."end_time" < $1 and is null and ...)
```

Instead of:

```sql
-- Correct SQL
where ("meetings"."end_time" < $1 and "meetings"."transcript_url" is null and ...)
```

### Root Cause

Drizzle ORM references columns defined in `shared/schema.ts`. If those columns don't exist in the production database, the generated SQL is malformed, resulting in 500 errors.

### Symptoms

- API calls returning 500 errors
- Server logs showing SQL syntax errors like `and is null` without a column name
- Dashboard and meetings list failing to load

---

## Prevention

### After Every Schema Change

When you modify `shared/schema.ts`, you MUST sync the production database:

1. **Development (Replit):** Runs automatically via `npm run db:push`
2. **Production (Azure):** Requires manual sync (see below)

### CI/CD Integration (Recommended)

Add schema sync to GitHub Actions deployment workflow:

```yaml
- name: Sync database schema
  run: |
    export DATABASE_URL="${{ secrets.PROD_DATABASE_URL }}"
    npm run db:push
```

---

## Manual Schema Sync Procedure

### Prerequisites

- Azure Cloud Shell access (or local psql client)
- Production database credentials

### Step 1: Connect to Production Database

```bash
# Set password (use single quotes to handle special characters)
export PGPASSWORD='YOUR_PASSWORD_HERE'

# Connect to database
psql -h teams-minutes-db.postgres.database.azure.com -U adminuser -d teams_minutes_db
```

**Note:** If password contains `!`, `$`, or other special characters, you MUST use single quotes.

### Step 2: Identify Missing Columns

Compare the schema in `shared/schema.ts` with the production database:

```sql
-- List all columns in meetings table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'meetings' 
ORDER BY ordinal_position;

-- List all ENUMs
SELECT typname FROM pg_type WHERE typtype = 'e';
```

### Step 3: Run Migration Script

Use the `sync-prod-schema.sql` file in the project root, or paste SQL directly:

```sql
-- Create missing ENUMs
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

-- Add missing columns (IF NOT EXISTS prevents errors for existing columns)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_url text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_time timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS graph_event_id text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ical_uid text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_online_meeting boolean DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_email text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS start_time_zone text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_time_zone text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source_type meeting_source DEFAULT 'manual';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS last_graph_sync timestamp;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS graph_change_key text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS online_meeting_id text;
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

-- Create job_worker_leases table
CREATE TABLE IF NOT EXISTS job_worker_leases (
  worker_name varchar(100) PRIMARY KEY,
  instance_id varchar(100) NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL
);
```

### Step 4: Restart the Application

After running the migration:

1. Azure Portal → Container Apps → teams-minutes-app
2. Revisions → Click `...` on active revision → Restart

### Step 5: Verify

- Open the Teams app
- Check that Dashboard loads without errors
- Verify meetings list displays correctly

---

## Troubleshooting

### "bash: !Secure@teams: event not found"

The `!` character is being interpreted by bash. Use single quotes:

```bash
# Wrong
export PGPASSWORD="Password!123"

# Correct
export PGPASSWORD='Password!123'
```

### "relation already exists, skipping"

This is normal - `IF NOT EXISTS` clauses are working correctly.

### "FATAL: password authentication failed"

1. Verify the password is correct in Azure Portal
2. Check that you're using the correct username (usually `adminuser`)
3. Ensure firewall allows your IP (Azure Portal → PostgreSQL → Networking)

### Azure Cloud Shell - File Not Found

The `sync-prod-schema.sql` file exists in Replit, not Azure Cloud Shell. Either:
- Paste the SQL directly into psql
- Upload the file to Cloud Shell using the upload button

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle ORM schema definition (source of truth) |
| `sync-prod-schema.sql` | Manual migration script for production |
| `drizzle.config.ts` | Drizzle configuration |

---

## Incident: December 3, 2025

### What Happened

Production app returned 500 errors on all API calls. Root cause was missing columns in the production database that were added to `shared/schema.ts` but never synced.

### Affected Columns

- `transcript_url`
- `processing_decision`
- `processing_decision_reason`
- `processing_decision_at`
- `actual_duration_seconds`
- `transcript_word_count`

### Resolution

1. Connected to production PostgreSQL via Azure Cloud Shell
2. Ran `sync-prod-schema.sql` to add missing ENUMs and columns
3. Restarted the Container Apps revision
4. Rotated database password (was accidentally exposed in source code)

### Time to Resolution

~30 minutes from identification to fix

### Lessons Learned

1. Always run schema sync after modifying `shared/schema.ts`
2. Add automated schema sync to CI/CD pipeline
3. Never hardcode credentials in source files
4. Use `export PGPASSWORD='...'` for passwords with special characters
