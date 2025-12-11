# Meeting Attachment Capture - Implementation Plan

## Overview

This document outlines the comprehensive plan for capturing and archiving meeting attachments, including calendar files, chat files, whiteboards, and screen share content. The plan uses a hybrid approach that prioritizes source file capture over recording-based extraction.

## Phase Summary

| Phase | Capability | Effort | Dependencies |
|-------|------------|--------|--------------|
| **1** | Schema & Infrastructure | 3-4 days | None |
| **2** | Calendar Event Attachments | 3-4 days | Phase 1 |
| **3** | Meeting Chat Files | 3-4 days | Phase 1, `Chat.Read.All` |
| **4** | Whiteboard Content | 2-3 days | Phase 1, `Whiteboard.Read.All` |
| **5a** | Screen Share: Source File Capture (Primary) | 8-12 days | Phase 1, E5 licensing |
| **5b** | Screen Share: Recording Extraction (Fallback) | 5-7 days | Phase 5a, ffmpeg, Azure AI Vision |
| **6** | Distribution Integration | 2-3 days | Phases 2-5 |

**Total Effort: 26-37 days**

---

## Phase 1: Schema & Infrastructure (3-4 days)

### Objectives
- Create unified data model for all attachment types
- Set up storage abstraction layer
- Add new job types to queue system

### Schema: meeting_attachments

```typescript
export const meetingAttachments = pgTable('meeting_attachments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar('meeting_id').notNull().references(() => meetings.id),
  
  // Attachment metadata
  fileName: varchar('file_name').notNull(),
  mimeType: varchar('mime_type'),
  fileSize: integer('file_size'),
  sourceType: varchar('source_type').notNull(), // 'calendar', 'chat', 'whiteboard', 'screen_capture', 'source_file'
  
  // Origin tracking
  sourceUrl: varchar('source_url'),
  driveItemId: varchar('drive_item_id'),
  messageId: varchar('message_id'),
  
  // Storage
  sharepointUrl: varchar('sharepoint_url'),
  blobUrl: varchar('blob_url'),
  
  // Status
  status: varchar('status').default('pending'), // pending, downloaded, archived, failed
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow(),
  archivedAt: timestamp('archived_at'),
});
```

### Schema: presented_assets

```typescript
export const presentedAssets = pgTable('presented_assets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar('meeting_id').notNull().references(() => meetings.id),
  
  // File reference
  driveItemId: varchar('drive_item_id'),
  siteId: varchar('site_id'),
  fileName: varchar('file_name').notNull(),
  mimeType: varchar('mime_type'),
  fileSize: integer('file_size'),
  
  // Correlation metadata
  presenterEmail: varchar('presenter_email'),
  accessedAt: timestamp('accessed_at'),
  correlationMethod: varchar('correlation_method'), // 'powerpoint_live', 'audit_log', 'activity_api'
  confidenceScore: real('confidence_score'),        // 0.0 - 1.0
  
  // Storage
  sharepointUrl: varchar('sharepoint_url'),
  status: varchar('status').default('detected'),   // detected, confirmed, archived, rejected
  
  createdAt: timestamp('created_at').defaultNow(),
});
```

### New Job Types

| Job Type | Purpose |
|----------|---------|
| `capture_calendar_attachments` | Fetch attachments from calendar event |
| `capture_chat_attachments` | Retrieve files from meeting chat |
| `capture_whiteboard` | Export whiteboard as PNG |
| `correlate_source_files` | Match presenter activity to files |
| `extract_recording_frames` | Process recording for screen captures |

---

## Phase 2: Calendar Event Attachments (3-4 days)

### Objectives
- Fetch attachments when syncing calendar events
- Download files to staging
- Archive to SharePoint meeting folder

### Graph API Endpoint
```
GET /users/{userId}/events/{eventId}/attachments
```

### Implementation Steps
1. Extend calendar sync to check for attachments
2. Download attachment content via Graph API
3. Upload to SharePoint under meeting folder
4. Create `meeting_attachments` record

### Supported Attachment Types
- `FileAttachment` - Inline files
- `ItemAttachment` - Outlook items (emails, contacts)
- `ReferenceAttachment` - OneDrive/SharePoint links

---

## Phase 3: Meeting Chat Files (3-4 days)

### Objectives
- Retrieve chat messages from meeting chat
- Extract file attachments from messages
- Archive to SharePoint

### Graph API Endpoints
```
GET /chats/{chatId}/messages
GET /chats/{chatId}/messages/{messageId}/hostedContents/{id}/$value
```

### Required Permission
`Chat.Read.All` (Application)

### Implementation Steps
1. Get meeting chat ID from call record
2. Retrieve all messages with attachments
3. Download file content
4. Upload to SharePoint
5. Create `meeting_attachments` records

---

## Phase 4: Whiteboard Content (2-3 days)

### Objectives
- Detect whiteboards used during meeting
- Export whiteboard content as PNG
- Archive to SharePoint

### Graph API Endpoint (Beta)
```
GET /beta/whiteboard/boards/{boardId}/export
```

### Required Permission
`Whiteboard.Read.All` (Application)

### Feature Flag
`ENABLE_WHITEBOARD_CAPTURE` (default: false)

### Limitations
- Beta API - may change
- Export may not capture all content types
- Large whiteboards may timeout

---

## Phase 5a: Source File Capture - Primary (8-12 days)

### Objectives
- Correlate presenter activity with meeting timeline
- Identify source files shared during screen share
- Retrieve original documents (PPTX, DOCX, XLSX)

### Architecture

```
Meeting Ends
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Query Purview Audit Logs                │
│     - Filter by meeting time window         │
│     - Match presenter user IDs              │
│     - Find FileAccessed, PresentationStarted│
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  2. Query OneDrive/SharePoint Activity      │
│     - /sites/{siteId}/analytics             │
│     - /me/drive/recent                      │
│     - Match by presenter + time window      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  3. Detect PowerPoint Live Sessions         │
│     - Teams-specific metadata               │
│     - Direct file reference available       │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  4. Calculate Confidence Score              │
│     - Exact match (PowerPoint Live): 1.0    │
│     - Audit log + time + presenter: 0.8-0.9 │
│     - Activity API correlation: 0.6-0.7     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  5. Archive High-Confidence Files           │
│     - Score >= threshold: auto-archive      │
│     - Score < threshold: flag for review    │
└─────────────────────────────────────────────┘
```

### Required Prerequisites
- E5 Compliance licensing (for Purview audit logs)
- `AuditLog.Read.All` permission
- `Files.Read.All` permission

### Correlation Methods

| Method | Confidence | Description |
|--------|------------|-------------|
| PowerPoint Live | 1.0 | Direct file reference from Teams |
| Audit: PresentationStarted | 0.9 | Explicit presentation event |
| Audit: FileAccessed | 0.8 | File opened during meeting by presenter |
| Activity API | 0.7 | Recent file activity correlation |
| Heuristic match | 0.5-0.6 | Time-based correlation only |

### Feature Flags
- `ENABLE_SOURCE_FILE_CAPTURE` (default: false)
- `SOURCE_FILE_CONFIDENCE_THRESHOLD` (default: 0.7)

---

## Phase 5b: Recording Extraction - Fallback (5-7 days)

### Objectives
- Provide fallback for local file shares
- Extract key frames from meeting recording
- Use AI to classify and OCR screen content

### Architecture

```
Recording Available
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Check if Source Capture Complete        │
│     - Skip if all content already captured  │
│     - Proceed if gaps detected              │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  2. Download Recording                      │
│     - Stream from OneDrive                  │
│     - Chunked download for large files      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  3. Extract Frames (ffmpeg)                 │
│     - Scene detection algorithm             │
│     - 1 frame per significant change        │
│     - Target: 10-50 frames per meeting      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  4. AI Classification (Azure Vision)        │
│     - Classify: screen_share vs webcam      │
│     - OCR: extract text from slides         │
│     - Filter duplicate/similar frames       │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  5. Archive to SharePoint                   │
│     - Create /ScreenCaptures subfolder      │
│     - Name: capture_001.png, etc.           │
└─────────────────────────────────────────────┘
```

### Required Prerequisites
- `OnlineMeetingRecording.Read.All` permission
- `Files.Read.All` permission
- ffmpeg (system dependency)
- Azure Computer Vision resource

### Feature Flags
- `ENABLE_RECORDING_FALLBACK` (default: false)
- `RECORDING_FALLBACK_MODE` (auto | always | never)
- `MAX_FRAMES_PER_MEETING` (default: 50)

### Limitations
- Requires org-level recording policy enabled
- 5-60 minute delay after meeting ends
- Large files (150-400 MB/hr)
- Processing overhead

---

## Phase 6: Distribution Integration (2-3 days)

### Objectives
- Include attachments in email distribution
- Archive attachments with minutes in SharePoint
- Update distribution job to handle attachments

### Email Distribution Changes
- Attachments < 3MB: Inline as email attachments
- Attachments >= 3MB: Include SharePoint links

### SharePoint Folder Structure
```
/Meeting Minutes/{Year}/{Month}/
  └── {Meeting Title} - {Date}/
      ├── Minutes.docx
      ├── Minutes.pdf
      ├── /Attachments/
      │   ├── calendar_attachment_1.pptx
      │   ├── chat_file_1.pdf
      │   └── whiteboard.png
      └── /ScreenCaptures/
          ├── source_file_presentation.pptx
          ├── capture_001.png
          └── capture_002.png
```

---

## Permissions Summary

| Permission | Type | Phase | Purpose |
|------------|------|-------|---------|
| `Chat.Read.All` | Application | 3 | Access meeting chat messages |
| `Whiteboard.Read.All` | Application | 4 | Export whiteboard content |
| `AuditLog.Read.All` | Application | 5a | Query Purview audit logs |
| `Files.Read.All` | Application | 5a, 5b | Download files from OneDrive/SharePoint |
| `OnlineMeetingRecording.Read.All` | Application | 5b | Access meeting recordings |

---

## Azure Resources Required

| Resource | Phase | Purpose |
|----------|-------|---------|
| Azure Computer Vision | 5b | OCR + image classification |
| Azure Blob Storage (optional) | 5b | Staging large recordings |

---

## Feature Flags Summary

| Flag | Default | Phase | Purpose |
|------|---------|-------|---------|
| `ENABLE_CALENDAR_ATTACHMENTS` | true | 2 | Capture calendar event files |
| `ENABLE_CHAT_ATTACHMENTS` | true | 3 | Capture chat files |
| `ENABLE_WHITEBOARD_CAPTURE` | false | 4 | Capture whiteboard exports |
| `ENABLE_SOURCE_FILE_CAPTURE` | false | 5a | Correlate presenter files |
| `ENABLE_RECORDING_FALLBACK` | false | 5b | Extract recording frames |
| `SOURCE_FILE_CONFIDENCE_THRESHOLD` | 0.7 | 5a | Min score for auto-archive |
| `RECORDING_FALLBACK_MODE` | auto | 5b | auto, always, never |
| `MAX_FRAMES_PER_MEETING` | 50 | 5b | Limit extracted frames |

---

## Quality Comparison

| Content Type | Capture Method | Quality | Output |
|--------------|----------------|---------|--------|
| PowerPoint from OneDrive | Source file capture | Original | PPTX |
| Excel from SharePoint | Source file capture | Original | XLSX |
| Word doc from OneDrive | Source file capture | Original | DOCX |
| Local file from desktop | Recording fallback | Video frames | PNG |
| Web app / browser demo | Recording fallback | Video frames | PNG |
| Whiteboard | Whiteboard API | Export | PNG |
| Calendar attachment | Direct download | Original | Various |
| Chat file | Direct download | Original | Various |

---

## Implementation Order Recommendation

### Recommended Sequence
1. **Phase 1** - Foundation for all subsequent phases
2. **Phase 2** - Low complexity, high value
3. **Phase 3** - Medium complexity, high value
4. **Phase 6** - Can start early, evolve with each phase
5. **Phase 4** - Low complexity, beta API risk
6. **Phase 5a** - Higher complexity, requires E5
7. **Phase 5b** - Highest complexity, fallback only

### Parallel Work Opportunities
- Phases 2, 3, 4 can proceed in parallel after Phase 1
- Phase 6 can evolve incrementally with each content type
- Phase 5b can start after Phase 5a is partially complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| E5 licensing not available | Skip Phase 5a, rely on 5b only |
| Recording disabled by policy | Source file capture becomes sole method |
| Large recordings timeout | Chunked download + async processing |
| Audit log latency (~15 min) | Poll with retry, graceful fallback |
| Beta whiteboard API changes | Feature flag, monitor deprecation notices |
| Low confidence correlations | Human review queue, adjustable threshold |

---

## Future Enhancements

| Enhancement | Description | Complexity |
|-------------|-------------|------------|
| AI content summarization | Summarize extracted slides/documents | Medium |
| Duplicate detection | Identify same file shared across meetings | Medium |
| Version tracking | Track file versions across recurring meetings | Medium |
| Real-time capture bot | Application-hosted media bot for live capture | Very High |

---

## Related Documentation

- [replit.md](../replit.md) - Project overview and architecture
- [schema.ts](../shared/schema.ts) - Database schema definitions
- [Microsoft Graph API Reference](https://docs.microsoft.com/graph/api/overview)
- [Azure AI Vision Documentation](https://docs.microsoft.com/azure/cognitive-services/computer-vision/)
