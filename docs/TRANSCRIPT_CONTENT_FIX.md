# Transcript Content Fix - Authorized Plan

## Issue
Meeting minutes were being generated with placeholder/mock content instead of real AI-generated content from actual meeting transcripts.

## Root Cause
1. `minutesGenerator.ts` uses `generateMockTranscript()` instead of real transcript data
2. `callRecordEnrichment.ts` downloads transcript content but discards it (only saves URL)
3. `meetingOrchestrator.ts` had ad-hoc logic that was incomplete

## Authorized Fix Plan

### Step 1: Schema Update
Add `transcript_content` column to `meetings` table to persist the full transcript text.

**File:** `shared/schema.ts`
**Change:** Add `transcriptContent: text("transcript_content")` field

### Step 2: Update callRecordEnrichment.ts
Persist the downloaded transcript content to the database.

**File:** `server/services/callRecordEnrichment.ts`
**Change:** Save `transcriptContent` when updating meeting record after enrichment

### Step 3: Update minutesGenerator.ts
Remove `generateMockTranscript()` and use the persisted `transcriptContent` from the meeting record.

**File:** `server/services/minutesGenerator.ts`
**Changes:**
- Remove `generateMockTranscript()` function
- Read `meeting.transcriptContent` instead
- Validate minimum content length
- Fail with proper error if no transcript available

### Step 4: Simplify meetingOrchestrator.ts
Remove ad-hoc transcript fetching logic. The orchestrator should only call `minutesGenerator.autoGenerateMinutes()`.

**File:** `server/services/meetingOrchestrator.ts`
**Change:** Revert to calling minutesGenerator service instead of inline transcript fetching

## Verification Steps
1. Build passes with no LSP errors
2. Schema migration completes successfully
3. Enrichment job saves transcript content
4. Minutes generation uses real transcript
5. No placeholder content in generated documents

## Date Authorized
December 10, 2025
