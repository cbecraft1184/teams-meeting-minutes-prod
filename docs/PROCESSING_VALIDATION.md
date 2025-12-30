# Processing Validation

## Overview

This document describes the processing validation system that prevents unnecessary AI processing costs for meetings that don't meet minimum content thresholds. These safeguards apply to all deployments.

## Problem Statement

Without validation checks, the system would:
1. Process "accidental meeting opens" where someone clicks join/leave quickly
2. Waste AI credits on meetings with no meaningful transcription content
3. Generate empty or low-value meeting minutes

## Solution: Processing Thresholds

The system validates two criteria before triggering AI processing:

### Minimum Duration Threshold
- **Threshold**: 2 minutes (120 seconds)
- **Rationale**: Meetings under 2 minutes are typically accidental opens or test connections
- **Behavior**: Meetings shorter than 2 minutes are auto-skipped from AI processing

### Minimum Content Threshold
- **Threshold**: 25 words in transcript
- **Rationale**: Meetings with minimal spoken content don't produce meaningful minutes
- **Behavior**: Transcripts with fewer than 25 words are auto-skipped from AI processing

### Transcript Availability Check
- **Requirement**: Transcript must be available
- **Rationale**: Cannot generate minutes without transcription content
- **Behavior**: Meetings without transcripts are auto-skipped from AI processing

## Processing Decision Values

The `processingDecision` field in the meetings table tracks the validation outcome:

| Decision | Description |
|----------|-------------|
| `pending` | Validation not yet performed |
| `processed` | Met all thresholds, AI processing completed |
| `skipped_duration` | Duration below minimum threshold |
| `skipped_content` | Transcript word count below minimum threshold |
| `skipped_no_transcript` | No transcript available |
| `manual_override` | Admin manually triggered processing despite thresholds |

## Audit Fields

Each meeting record tracks:
- `actualDurationSeconds`: Actual call duration from Graph API call record
- `transcriptWordCount`: Number of words in the transcript content
- `processingDecision`: Decision type (see table above)
- `processingDecisionReason`: Human-readable explanation of the decision
- `processingDecisionAt`: Timestamp when decision was made

## Admin Override API

Administrators can manually trigger processing for skipped meetings using the API:

### Force Process Endpoint
```
POST /api/admin/meetings/:id/force-process
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer requested manual processing for this brief meeting"
}
```

**Requirements**:
- User must have `admin` role
- Reason must be at least 10 characters (for audit trail)
- Meeting must not already be processed or manually overridden

**Response**:
```json
{
  "success": true,
  "message": "Manual processing triggered successfully. Minutes generation started.",
  "meetingId": "meeting-123",
  "overrideBy": "admin@contoso.com",
  "overrideReason": "Customer requested manual processing for this brief meeting"
}
```

### Get Processing Status Endpoint
```
GET /api/admin/meetings/:id/processing-status
Authorization: Bearer <token>
```

**Response**:
```json
{
  "meeting": {
    "id": "meeting-123",
    "title": "Quick Sync",
    "status": "completed",
    "enrichmentStatus": "enriched"
  },
  "processingValidation": {
    "decision": "skipped_duration",
    "reason": "Meeting duration (90s) below minimum threshold (120s)",
    "decisionAt": "2025-12-01T18:30:00Z",
    "actualDurationSeconds": 90,
    "actualDurationMinutes": 1.5,
    "transcriptWordCount": 15
  },
  "thresholds": {
    "minDurationSeconds": 120,
    "minDurationMinutes": 2,
    "minTranscriptWords": 25
  },
  "canForceProcess": true
}
```

## Configuration

Thresholds are defined in `server/services/processingValidation.ts`:

```typescript
export const PROCESSING_THRESHOLDS = {
  MIN_DURATION_SECONDS: 2 * 60,  // 2 minutes
  MIN_TRANSCRIPT_WORDS: 25       // 25 words
};
```

Thresholds can also be set via environment variables:
- `MIN_MEETING_DURATION_SECONDS` (default: 120)
- `MIN_TRANSCRIPT_WORDS` (default: 25)

To adjust thresholds, modify these values or set environment variables and restart the application.

## Logging

All processing decisions are logged with clear console output:

```
📊 [Enrichment] Fetching call record details for duration...
   Duration: 180s (3m)
   Transcript words: 75
📝 [Validation] Meeting abc123: skipped_duration - Meeting duration (90s) below minimum threshold (120s)
⏭️ [Enrichment] Skipping AI processing: Meeting duration (90s) below minimum threshold (120s)
```

For manual overrides:
```
🔧 [Admin API] Force process request for meeting abc123 by admin@contoso.com
🔧 [Manual Override] Admin admin@contoso.com forcing processing for meeting abc123
   Reason: Customer requested manual processing for this brief meeting
```

## Test Scenarios

### Scenario 1: Normal Meeting (Passes All Thresholds)
- Duration: 30 minutes
- Transcript: 500 words
- Expected: `processed` - AI minutes generated

### Scenario 2: Accidental Open (Fails Duration)
- Duration: 1 minute
- Transcript: 40 words
- Expected: `skipped_duration` - No AI processing

### Scenario 3: Silent Meeting (Fails Content)
- Duration: 15 minutes
- Transcript: 20 words
- Expected: `skipped_content` - No AI processing

### Scenario 4: No Transcription Enabled
- Duration: 30 minutes
- Transcript: null
- Expected: `skipped_no_transcript` - No AI processing

### Scenario 5: Admin Override
- Duration: 3 minutes (below threshold)
- Transcript: 80 words
- Admin action: Force process
- Expected: `manual_override` - AI minutes generated

## Compliance Notes

- All processing decisions are audited with timestamps and reasons
- Manual overrides record the admin user ID and justification
- These safeguards apply to all deployments
- Thresholds can be adjusted per deployment requirements
