# Comprehensive End-to-End Test Plan

## Teams Meeting Minutes: From Scheduling to Archival

This document outlines the complete test scenario for the Teams Meeting Minutes application, covering every stage from meeting scheduling through final archival.

---

## Prerequisites

### Azure Configuration
- [ ] Azure AD App Registration with required permissions
- [ ] Microsoft Graph API permissions granted (admin consent):
  - `OnlineMeetings.Read.All` - Read online meetings
  - `CallRecords.Read.All` - Read call records (meeting end detection)
  - `Calendars.Read` - Read user calendars
  - `User.Read.All` - Read user profiles
  - `Mail.Send` - Send email notifications
  - `Sites.ReadWrite.All` - SharePoint archival
- [ ] Azure OpenAI deployment (`teams-minutes-demo` with GPT-4o)
- [ ] Application deployed to Azure Container Apps
- [ ] Environment variables configured:
  - `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
  - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
  - `DATABASE_URL`, `SESSION_SECRET`
  - `ENABLE_GRAPH_WEBHOOKS=true`

### Webhook Subscriptions
- [ ] Verify active subscription for `/communications/callRecords` (meeting end detection)
- [ ] Verify active subscription for `/communications/onlineMeetings` (meeting scheduled detection)

---

## Test Scenario Flow

### Phase 1: Meeting Scheduling (Webhook Detection)

**Objective**: Verify the application detects when a Teams meeting is scheduled.

#### Steps:
1. **Schedule a Teams Meeting in Outlook/Teams**
   - Open Microsoft Teams or Outlook
   - Create a new meeting with:
     - Title: "E2E Test Meeting - [timestamp]"
     - Date/Time: 15 minutes from now
     - Duration: 30 minutes
     - Attendees: At least 2 participants
     - Enable "Teams Meeting" option

2. **Verify Webhook Notification Received**
   - Check application logs for: `📅 [OnlineMeetings] Received meeting notification(s)`
   - Confirm change type: `created`

3. **Verify Meeting Persisted in Database**
   ```sql
   SELECT id, title, status, online_meeting_id, graph_sync_status 
   FROM meetings 
   WHERE title LIKE 'E2E Test Meeting%'
   ORDER BY created_at DESC LIMIT 1;
   ```
   - Status should be: `scheduled`
   - graph_sync_status should be: `synced`

**Expected Result**: Meeting appears in the application's meetings list within 30 seconds of scheduling.

---

### Phase 2: Meeting Occurs (Manual Step)

**Objective**: Conduct the actual Teams meeting with transcription enabled.

#### Steps:
1. **Join the Meeting**
   - All participants join the scheduled Teams meeting
   - Verify Teams displays the meeting title

2. **Enable Transcription**
   - Meeting organizer clicks "..." menu → "Start transcription"
   - Confirm transcription notification appears for all participants

3. **Conduct Meeting Content**
   - Discuss several topics (creates transcript content)
   - Make decisions that should appear in minutes
   - Assign action items with responsible parties
   - Example script:
     ```
     Participant 1: "Let's discuss the Q4 budget."
     Participant 2: "I propose we allocate $50,000 to marketing."
     Participant 1: "Agreed. John will prepare the budget breakdown by Friday."
     ```

4. **End the Meeting**
   - Stop transcription if manually started
   - End meeting for all participants

---

### Phase 3: Meeting End Detection (Call Record Webhook)

**Objective**: Verify the application detects meeting completion and triggers enrichment.

#### Steps:
1. **Verify Call Record Webhook Received**
   - Check logs for: `📞 [CallRecords] Received call record notification(s)`
   - Confirm call record ID is extracted

2. **Verify Meeting Updated**
   ```sql
   SELECT id, title, status, call_record_id, enrichment_status 
   FROM meetings 
   WHERE title LIKE 'E2E Test Meeting%';
   ```
   - Status should change to: `completed`
   - call_record_id should be populated

3. **Verify Enrichment Job Queued**
   - Check logs for: `🎬 [CallRecords] Triggering enrichment for meeting`
   - Verify job in queue:
   ```sql
   SELECT * FROM job_queue 
   WHERE job_type = 'enrich_meeting' 
   AND payload->>'title' LIKE 'E2E Test Meeting%';
   ```

**Expected Result**: Enrichment job created within 60 seconds of meeting end.

---

### Phase 4: Transcript Fetch & AI Minutes Generation

**Objective**: Verify transcript retrieval and AI-powered minutes generation.

#### Steps:
1. **Verify Transcript Fetch**
   - Check logs for: `📝 [Enrichment] Fetching transcript`
   - Note: May require retry due to Graph API eventual consistency (up to 15 minutes)
   - Check enrichment attempts:
   ```sql
   SELECT enrichment_status, enrichment_attempts, last_enrichment_at 
   FROM meetings 
   WHERE title LIKE 'E2E Test Meeting%';
   ```

2. **Verify AI Minutes Generation**
   - Check logs for: `🤖 [AI] Generating meeting minutes`
   - Verify meeting_minutes record created:
   ```sql
   SELECT mm.id, mm.status, mm.summary, mm.decisions, mm.action_items 
   FROM meeting_minutes mm
   JOIN meetings m ON mm.meeting_id = m.id
   WHERE m.title LIKE 'E2E Test Meeting%';
   ```
   - Summary should contain meeting discussion points
   - Decisions should include any made (e.g., budget approval)
   - Action items should include assigned tasks

3. **Verify Minutes Quality**
   - Summary accurately reflects meeting content
   - Action items have assignees and due dates
   - Classification level applied correctly

**Expected Result**: Meeting minutes generated with accurate AI summary within 20 minutes of meeting end.

---

### Phase 5: Approval Workflow (If Enabled)

**Objective**: Verify the manual approval process works correctly.

#### Prerequisites:
- `requireApprovalForMinutes` setting is `true`

#### Steps:
1. **Verify Minutes Pending Approval**
   ```sql
   SELECT status FROM meeting_minutes 
   WHERE meeting_id = (SELECT id FROM meetings WHERE title LIKE 'E2E Test Meeting%');
   ```
   - Status should be: `pending_review`

2. **Access Minutes in UI**
   - Log in as an approver (admin role)
   - Navigate to Meeting Details
   - Verify minutes are displayed with "Pending Review" badge

3. **Approve Minutes**
   - Click "Approve" button
   - Verify status changes to: `approved`
   - Verify approved_by and approved_at fields populated

4. **Verify Orchestrator Job Triggered**
   - Check logs for: `📤 [Orchestrator] Starting distribution`
   - Verify job in queue:
   ```sql
   SELECT * FROM job_queue 
   WHERE job_type = 'meeting_orchestrator' 
   AND status = 'processing';
   ```

**Expected Result**: Minutes transition to approved status and trigger distribution.

---

### Phase 6: Email Distribution

**Objective**: Verify meeting minutes are sent via email to all attendees.

#### Steps:
1. **Verify Email Job Created**
   - Check logs for: `📧 [Email] Sending meeting minutes`
   - Verify email job in queue:
   ```sql
   SELECT * FROM job_queue 
   WHERE job_type = 'send_email' 
   AND payload->>'subject' LIKE '%E2E Test Meeting%';
   ```

2. **Check Email Delivery**
   - Each attendee should receive an email containing:
     - Meeting title in subject line
     - Summary section
     - Decisions section
     - Action items with assignees
     - Download links for DOCX/PDF attachments

3. **Verify Email Record**
   ```sql
   SELECT * FROM distribution_records 
   WHERE meeting_id = (SELECT id FROM meetings WHERE title LIKE 'E2E Test Meeting%')
   AND channel = 'email';
   ```

**Expected Result**: All attendees receive formatted email with minutes within 5 minutes of approval.

---

### Phase 7: SharePoint Archival

**Objective**: Verify minutes are archived to SharePoint document library.

#### Steps:
1. **Verify SharePoint Job Created**
   - Check logs for: `📁 [SharePoint] Uploading meeting minutes`
   - Verify SharePoint job in queue:
   ```sql
   SELECT * FROM job_queue 
   WHERE job_type = 'upload_sharepoint' 
   AND payload->>'title' LIKE '%E2E Test Meeting%';
   ```

2. **Verify Document Upload**
   - Navigate to configured SharePoint site
   - Check Meeting Minutes document library
   - Verify folder structure: `YYYY/MM/Meeting-Title/`
   - Verify files uploaded:
     - `Meeting-Title_Minutes.docx`
     - `Meeting-Title_Minutes.pdf`

3. **Verify Metadata**
   - Check document properties include:
     - Meeting date
     - Organizer
     - Classification level
     - Attendees

4. **Verify Database Record**
   ```sql
   SELECT * FROM distribution_records 
   WHERE meeting_id = (SELECT id FROM meetings WHERE title LIKE 'E2E Test Meeting%')
   AND channel = 'sharepoint';
   ```

**Expected Result**: Documents archived to SharePoint with correct folder structure and metadata.

---

### Phase 8: Teams Adaptive Card Notification

**Objective**: Verify Adaptive Card is posted to meeting chat.

#### Steps:
1. **Verify Teams Notification Job**
   - Check logs for: `📣 [Teams] Posting Adaptive Card`
   - Verify notification job:
   ```sql
   SELECT * FROM job_queue 
   WHERE job_type = 'post_teams_card' 
   AND status = 'completed';
   ```

2. **Check Teams Meeting Chat**
   - Open the original Teams meeting chat
   - Verify Adaptive Card posted containing:
     - Meeting title and date
     - Summary section
     - Key decisions
     - Action items
     - "View Full Minutes" button

3. **Verify Interactive Elements**
   - Click "View Full Minutes" button
   - Should navigate to meeting details page

**Expected Result**: Adaptive Card appears in meeting chat within 5 minutes of approval.

---

### Phase 9: Final State Verification

**Objective**: Confirm all records are in expected final state.

#### Database Checks:
```sql
-- Meeting record
SELECT id, title, status, enrichment_status, graph_sync_status
FROM meetings 
WHERE title LIKE 'E2E Test Meeting%';
-- Expected: status=completed, enrichment_status=completed, graph_sync_status=synced

-- Minutes record
SELECT id, status, approved_by, approved_at, distribution_status
FROM meeting_minutes 
WHERE meeting_id = (SELECT id FROM meetings WHERE title LIKE 'E2E Test Meeting%');
-- Expected: status=approved, distribution_status=completed

-- Distribution records (should have 3: email, sharepoint, teams)
SELECT channel, status, sent_at, error_message
FROM distribution_records 
WHERE meeting_id = (SELECT id FROM meetings WHERE title LIKE 'E2E Test Meeting%');
-- Expected: All channels show status=sent with no errors

-- Job queue (all jobs completed)
SELECT job_type, status, completed_at, error_message
FROM job_queue 
WHERE payload::text LIKE '%E2E Test Meeting%'
ORDER BY created_at;
-- Expected: All jobs show status=completed
```

---

## Failure Scenarios & Recovery

### Scenario A: Webhook Subscription Expired
**Symptom**: Meetings not detected after scheduling
**Resolution**:
1. Check subscription status: `GET /api/admin/webhooks/subscriptions`
2. Renew or recreate subscriptions
3. Manually sync calendar: `POST /api/admin/calendar-sync`

### Scenario B: Transcript Not Available
**Symptom**: Enrichment retries multiple times
**Resolution**:
1. Check enrichment_attempts count
2. Wait for Graph API eventual consistency (up to 15 minutes)
3. Retry logic automatically handles with backoff (5, 15, 45 minutes)

### Scenario C: AI Generation Fails
**Symptom**: Minutes created but empty summary
**Resolution**:
1. Verify Azure OpenAI credentials
2. Check API quota limits
3. Manually trigger regeneration: `POST /api/meetings/:id/generate-minutes`

### Scenario D: Distribution Partially Fails
**Symptom**: Some channels fail (e.g., SharePoint errors)
**Resolution**:
1. Check individual job status in job_queue
2. Review error_message for specific failure
3. Retry specific channel: `POST /api/meetings/:id/distribute?channel=sharepoint`

---

## Automated Monitoring

### Health Check Endpoints
- `GET /api/health` - Overall application health
- `GET /api/admin/webhooks/status` - Webhook subscription status
- `GET /api/admin/jobs/stats` - Job queue statistics

### Key Metrics to Monitor
- Webhook notification latency (target: <5 seconds)
- Enrichment completion rate (target: >95%)
- AI generation success rate (target: >99%)
- Distribution delivery rate (target: >99%)

---

## Test Execution Checklist

| Phase | Test | Status | Timestamp | Notes |
|-------|------|--------|-----------|-------|
| 1 | Meeting scheduled in Teams | [ ] | | |
| 1 | Webhook received | [ ] | | |
| 1 | Meeting in database | [ ] | | |
| 2 | Meeting conducted | [ ] | | |
| 2 | Transcription enabled | [ ] | | |
| 3 | Call record webhook | [ ] | | |
| 3 | Enrichment triggered | [ ] | | |
| 4 | Transcript fetched | [ ] | | |
| 4 | AI minutes generated | [ ] | | |
| 5 | Minutes pending review | [ ] | | |
| 5 | Minutes approved | [ ] | | |
| 6 | Email sent | [ ] | | |
| 6 | Email received by attendees | [ ] | | |
| 7 | SharePoint upload started | [ ] | | |
| 7 | Documents in SharePoint | [ ] | | |
| 8 | Teams card posted | [ ] | | |
| 9 | Final state verified | [ ] | | |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 29, 2025 | Agent | Initial test plan |
