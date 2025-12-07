# Email Distribution and SharePoint Archive E2E Test Plan

## Overview

This document provides comprehensive end-to-end test plans for the Email Distribution and SharePoint Archive features of the Teams Meeting Minutes application. These features handle the automated distribution of approved meeting minutes to attendees and the archival of documents to SharePoint.

**Document Version**: 1.0  
**Last Updated**: December 7, 2025  
**Reviewer**: Architect Agent (3x code review completed)

---

## Table of Contents

1. [Email Distribution E2E Test Plan](#email-distribution-e2e-test-plan)
2. [SharePoint Archive E2E Test Plan](#sharepoint-archive-e2e-test-plan)
3. [Dependencies Checklist](#dependencies-checklist)
4. [Gap Analysis](#gap-analysis)
5. [Configuration Documentation](#configuration-documentation)
6. [Test Execution Log](#test-execution-log)

---

## Email Distribution E2E Test Plan

### Preconditions

Before executing email distribution tests, ensure:

| Precondition | Verification Method | Status |
|--------------|---------------------|--------|
| Minutes approved and in `approved` status | Database query | [ ] |
| `GRAPH_SENDER_EMAIL` configured | Environment check | [ ] |
| Azure AD app has `Mail.Send` permission | Azure Portal | [ ] |
| Admin consent granted for Mail.Send | Azure Portal | [ ] |
| Durable queue worker running | Logs/status endpoint | [ ] |
| `enableEmailDistribution` setting = true | Settings UI or database | [ ] |

### Test Cases

#### TC-EMAIL-001: Feature Toggle Validation

**Objective**: Verify email distribution respects the feature toggle setting.

**Steps**:
1. Navigate to Settings page
2. Set "Enable Email Distribution" to OFF
3. Approve a meeting's minutes
4. Check job queue for email jobs
5. Set "Enable Email Distribution" to ON
6. Approve another meeting's minutes
7. Check job queue for email jobs

**Expected Results**:
- Step 4: No `send_email` job should be created
- Step 7: `send_email` job should be created with correct payload

**SQL Verification**:
```sql
-- Check for email jobs
SELECT * FROM job_queue 
WHERE job_type = 'send_email' 
ORDER BY created_at DESC LIMIT 5;
```

---

#### TC-EMAIL-002: Happy Path - Email Sent via Graph API

**Objective**: Verify complete email flow from approval to delivery.

**Preconditions**:
- `USE_MOCK_SERVICES=false` (production mode)
- All Azure permissions configured

**Steps**:
1. Ensure a meeting has approved minutes with attendees
2. Trigger the approval workflow (approve minutes)
3. Monitor job queue for `send_email` job creation
4. Monitor job completion
5. Verify email received by attendees
6. Verify audit log entry created

**Expected Results**:
- Email job created within 5 seconds of approval
- Job status transitions: `pending` → `processing` → `completed`
- All attendees receive email with:
  - Correct subject: "Meeting Minutes: [Meeting Title]"
  - HTML body with classification banner
  - DOCX attachment
  - PDF attachment
- Meeting event logged: `email_distributed`

**Log Verification**:
```
📧 [Email Service] Sending email via Microsoft Graph API
   From: [GRAPH_SENDER_EMAIL]
   To: [list of attendees]
   Subject: Meeting Minutes: [Meeting Title]
   Attachments: 2
✅ [Email Service] Email sent successfully to X recipient(s)
```

**Database Verification**:
```sql
-- Check job completed
SELECT id, job_type, status, completed_at, error_message 
FROM job_queue 
WHERE job_type = 'send_email' 
AND payload->>'meetingId' = '[MEETING_ID]';

-- Check audit event
SELECT * FROM meeting_events 
WHERE meeting_id = '[MEETING_ID]' 
AND event_type = 'email_distributed';
```

---

#### TC-EMAIL-003: Email Content Verification

**Objective**: Verify email HTML body contains all required sections.

**Steps**:
1. Enable mock mode (`USE_MOCK_SERVICES=true`)
2. Approve meeting minutes
3. Check console logs for email content

**Expected Email Body Sections**:
- [ ] Classification banner (top and bottom)
- [ ] Meeting header (title, date, duration)
- [ ] Executive Summary section
- [ ] Key Discussions section (bulleted list)
- [ ] Decisions Made section (bulleted list)
- [ ] Action Items section (if applicable)
- [ ] Footer with automation disclaimer

**Verification**:
Console output should show:
```
================================================================================
📧 EMAIL DISTRIBUTION (Development Mode - Not Actually Sent)
================================================================================
To: [attendee emails]
Subject: Meeting Minutes: [Title]
--------------------------------------------------------------------------------
[HTML content]
--------------------------------------------------------------------------------
Attachments: meeting-minutes.docx, meeting-minutes.pdf
================================================================================
```

---

#### TC-EMAIL-004: Attachment Verification

**Objective**: Verify DOCX and PDF attachments are correctly generated and attached.

**Steps**:
1. Approve meeting minutes
2. Intercept email before sending (via mock mode or test recipient)
3. Download and verify attachments

**Expected Results**:
- DOCX file opens correctly in Microsoft Word
- PDF file opens correctly in PDF reader
- Both documents contain:
  - Classification header/footer
  - Meeting metadata
  - All sections matching the approved minutes
  - Page numbers (if configured in template)

---

#### TC-EMAIL-005: Failure Injection - Token Acquisition Failure

**Objective**: Verify retry behavior and error handling when Graph API token fails.

**Preconditions**:
- Temporarily invalidate Azure AD credentials or simulate token failure

**Steps**:
1. Corrupt `AZURE_CLIENT_SECRET` temporarily
2. Approve meeting minutes
3. Monitor job retries
4. Restore correct credentials
5. Check if job eventually succeeds

**Expected Results**:
- Job fails with descriptive error
- Job retries up to 3 times (per `maxRetries` setting)
- Error logged: "Failed to acquire access token"
- After credentials restored: job succeeds on retry

**Database Verification**:
```sql
SELECT id, status, attempts, error_message, next_retry_at 
FROM job_queue 
WHERE job_type = 'send_email' 
ORDER BY created_at DESC LIMIT 1;
```

---

#### TC-EMAIL-006: Approval Notification Email

**Objective**: Verify approval notification emails are sent correctly.

**Steps**:
1. Configure approval workflow to require approval
2. Generate minutes for a meeting
3. Monitor for approval notification email
4. Verify notification reaches approver

**Expected Results**:
- Subject: "Action Required: Approve Meeting Minutes - [Title]"
- Body contains action required banner
- Body contains meeting details
- Body contains instructions for review

---

#### TC-EMAIL-007: Multiple Recipients

**Objective**: Verify emails are sent to all meeting attendees.

**Steps**:
1. Create meeting with 5+ attendees
2. Generate and approve minutes
3. Verify all attendees receive email

**Expected Results**:
- All attendees in `toRecipients` list
- No duplicate emails sent
- Job marked complete only after all recipients processed

---

#### TC-EMAIL-008: Mock Mode Regression

**Objective**: Verify mock mode logs emails without sending.

**Preconditions**:
- `USE_MOCK_SERVICES=true`

**Steps**:
1. Approve meeting minutes
2. Check console logs

**Expected Results**:
- Console shows complete email details
- Message indicates "(Development Mode - Not Actually Sent)"
- No actual emails sent
- Job marked as completed

---

## SharePoint Archive E2E Test Plan

### Preconditions

Before executing SharePoint archive tests, ensure:

| Precondition | Verification Method | Status |
|--------------|---------------------|--------|
| `SHAREPOINT_SITE_URL` configured | Environment check | [ ] |
| `SHAREPOINT_LIBRARY` configured | Environment check | [ ] |
| SharePoint connector tokens valid | Connector status | [ ] |
| Azure AD app has SharePoint permissions | Azure Portal | [ ] |
| Durable queue worker running | Logs/status endpoint | [ ] |
| `enableSharePointArchival` setting = true | Settings UI or database | [ ] |

### Test Cases

#### TC-SP-001: Feature Toggle Validation

**Objective**: Verify SharePoint archival respects the feature toggle setting.

**Steps**:
1. Navigate to Settings page
2. Set "Enable SharePoint Archival" to OFF
3. Approve a meeting's minutes
4. Check job queue for SharePoint jobs
5. Set "Enable SharePoint Archival" to ON
6. Approve another meeting's minutes
7. Check job queue for SharePoint jobs

**Expected Results**:
- Step 4: No `upload_sharepoint` job should be created
- Step 7: `upload_sharepoint` job should be created with correct payload

**SQL Verification**:
```sql
SELECT * FROM job_queue 
WHERE job_type = 'upload_sharepoint' 
ORDER BY created_at DESC LIMIT 5;
```

---

#### TC-SP-002: Happy Path - Document Uploaded to SharePoint

**Objective**: Verify complete archive flow from approval to SharePoint upload.

**Preconditions**:
- `USE_MOCK_SERVICES=false` (production mode)
- SharePoint site and library configured

**Steps**:
1. Ensure a meeting has approved minutes
2. Trigger the approval workflow (approve minutes)
3. Monitor job queue for `upload_sharepoint` job creation
4. Monitor job completion
5. Verify document in SharePoint
6. Verify meeting status updated to `archived`
7. Verify SharePoint URL stored in database

**Expected Results**:
- Job created within 5 seconds of approval
- Job status transitions: `pending` → `processing` → `completed`
- Document uploaded to correct folder path
- Meeting status = `archived`
- `sharepoint_url` populated in meetings table

**Log Verification**:
```
[SharePoint] Uploading document: [filename]
[SharePoint] Upload successful: [webUrl]
```

**Database Verification**:
```sql
SELECT id, title, status, sharepoint_url 
FROM meetings 
WHERE id = '[MEETING_ID]';

-- Verify archived status
SELECT * FROM meeting_minutes 
WHERE meeting_id = '[MEETING_ID]';
```

---

#### TC-SP-003: Folder Path Structure

**Objective**: Verify documents are uploaded to correct folder hierarchy.

**Steps**:
1. Approve minutes for a meeting dated December 7, 2025 with classification "UNCLASSIFIED"
2. Check SharePoint folder structure

**Expected Folder Path**:
```
[SHAREPOINT_LIBRARY]/
  └── 2025/
      └── 12-December/
          └── UNCLASSIFIED/
              └── [meeting-title]-[id].docx
```

**Verification**:
Navigate to SharePoint and verify folder exists at expected path.

---

#### TC-SP-004: Metadata Verification

**Objective**: Verify document metadata is correctly set in SharePoint.

**Steps**:
1. Upload a document via the archive workflow
2. Open document properties in SharePoint

**Expected Metadata**:
| Field | Expected Value |
|-------|----------------|
| Classification | Meeting's classification level |
| MeetingDate | Meeting scheduled date (ISO format) |
| AttendeeCount | Number of attendees |
| MeetingID | Meeting's database ID |

**SharePoint Verification**:
1. Navigate to document in SharePoint library
2. View item properties/columns
3. Verify all metadata fields match expected values

---

#### TC-SP-005: Failure Injection - Permission Denied

**Objective**: Verify behavior when SharePoint upload fails due to permissions.

**Steps**:
1. Temporarily revoke SharePoint write permissions
2. Approve meeting minutes
3. Monitor job failures
4. Restore permissions
5. Manually retry job or wait for auto-retry

**Expected Results**:
- Job fails with 403 error
- Error message logged: "Failed to upload to SharePoint"
- Job retries up to 3 times
- After permissions restored: job succeeds

---

#### TC-SP-006: Large Document Upload

**Objective**: Verify large documents upload successfully.

**Steps**:
1. Create meeting with extensive transcript/minutes (100+ pages equivalent)
2. Approve minutes
3. Verify upload completes

**Expected Results**:
- Upload completes without timeout
- Document accessible in SharePoint
- No truncation of content

---

#### TC-SP-007: Mock Mode Regression

**Objective**: Verify mock mode returns mock URL without calling SharePoint.

**Preconditions**:
- `USE_MOCK_SERVICES=true`

**Steps**:
1. Approve meeting minutes
2. Check console logs
3. Verify mock URL returned

**Expected Results**:
- Console shows: "🔧 [SharePoint] Mock mode - simulating upload: [filename]"
- Mock URL returned: `https://mock-sharepoint.example.com/sites/meetings/Documents/[filename]`
- No actual SharePoint API calls made
- Job marked as completed

---

#### TC-SP-008: Document Library Selection

**Objective**: Verify documents upload to the configured library.

**Steps**:
1. Configure `SHAREPOINT_LIBRARY=Meeting Minutes`
2. Upload a document
3. Verify document appears in correct library

**Expected Results**:
- Document in "Meeting Minutes" library, not "Documents"
- Folder structure maintained within library

---

## Dependencies Checklist

### Environment Variables

| Variable | Required For | Production Value Required |
|----------|--------------|---------------------------|
| `GRAPH_SENDER_EMAIL` | Email Distribution | Yes - licensed mailbox |
| `AZURE_CLIENT_ID` | Both | Yes |
| `AZURE_CLIENT_SECRET` | Both | Yes |
| `AZURE_TENANT_ID` | Both | Yes |
| `SHAREPOINT_SITE_URL` | SharePoint Archive | Yes - full URL |
| `SHAREPOINT_LIBRARY` | SharePoint Archive | Yes - library name |
| `USE_MOCK_SERVICES` | Both | `false` for production |
| `ENABLE_EMAIL_DISTRIBUTION` | Email Distribution | `true` to enable |
| `ENABLE_SHAREPOINT_ARCHIVAL` | SharePoint Archive | `true` to enable |

### Azure AD Permissions

| Permission | Type | Required For |
|------------|------|--------------|
| `Mail.Send` | Application | Email Distribution |
| `Sites.ReadWrite.All` | Application | SharePoint Archive |
| `Sites.Selected` | Application | SharePoint Archive (preferred) |

### Service Dependencies

| Service | Dependency | Health Check |
|---------|------------|--------------|
| Durable Queue Worker | Job processing | GET /api/admin/worker/status |
| Microsoft Graph API | Email/SharePoint | Token acquisition test |
| Azure OpenAI | Document generation | GET /api/admin/health |
| PostgreSQL | Job queue storage | Database connection test |

### Application Settings (Database)

| Setting | Table | Default |
|---------|-------|---------|
| `enableEmailDistribution` | app_settings | false |
| `enableSharePointArchival` | app_settings | false |
| `requireApprovalForMinutes` | app_settings | true |

---

## Gap Analysis

### Identified Gaps

| Gap ID | Description | Impact | Recommendation |
|--------|-------------|--------|----------------|
| GAP-001 | No automated Graph API contract tests | Medium | Add integration tests with mocked Graph responses |
| GAP-002 | Limited monitoring for Graph API throttling (429 responses) | High | Implement exponential backoff with jitter |
| GAP-003 | No explicit SLA for durable queue recovery | Medium | Document expected recovery time (15 seconds) |
| GAP-004 | Settings UI lacks validation for SharePoint library names | Low | Add library existence check before saving |
| GAP-005 | Replit SharePoint connector not suitable for Azure production | High | Use Azure-managed service principal tokens |
| GAP-006 | No email delivery confirmation tracking | Medium | Consider Graph webhooks for delivery status |
| GAP-007 | Missing audit event for failed email/archive jobs | Medium | Add failure events to meeting_events table |

### Mitigation Plans

**GAP-005 (Critical for Production)**:
The current SharePoint integration uses Replit's connector (`REPLIT_CONNECTORS_HOSTNAME`). For Azure Commercial production deployment:

1. Replace Replit connector with Azure-managed MSAL token acquisition
2. Use `@azure/msal-node` ConfidentialClientApplication
3. Acquire tokens via `acquireTokenByClientCredential()`
4. Update `getAccessToken()` in `sharepointClient.ts`

**Recommended Code Change**:
```typescript
// Production SharePoint token acquisition
import { ConfidentialClientApplication } from '@azure/msal-node';

async function getAzureSharePointToken(): Promise<string> {
  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
    }
  };
  
  const cca = new ConfidentialClientApplication(msalConfig);
  const result = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  
  return result?.accessToken || '';
}
```

---

## Configuration Documentation

### Email Distribution Configuration

#### 1. Azure AD App Registration

1. Navigate to Azure Portal > App registrations
2. Select your Teams Minutes app
3. Go to API permissions
4. Add permission: Microsoft Graph > Application > `Mail.Send`
5. Grant admin consent for your organization

#### 2. Configure Sender Mailbox

1. Create or identify a mailbox for sending (e.g., `minutes@yourdomain.com`)
2. Ensure the mailbox has an Exchange Online license
3. Set environment variable: `GRAPH_SENDER_EMAIL=minutes@yourdomain.com`

#### 3. Enable Feature

Via Settings UI:
1. Navigate to Settings page
2. Toggle "Enable Email Distribution" to ON
3. Click Save

Via Database:
```sql
UPDATE app_settings 
SET enable_email_distribution = true, 
    updated_at = NOW() 
WHERE id = 'default';
```

### SharePoint Archive Configuration

#### 1. Create SharePoint Site

1. Navigate to SharePoint admin center
2. Create a new team site for meeting archives
3. Note the site URL (e.g., `https://contoso.sharepoint.com/sites/MeetingArchives`)

#### 2. Create Document Library

1. Navigate to the site
2. Create a new document library (e.g., "Meeting Minutes")
3. Add custom columns:
   - `Classification` (Choice: UNCLASSIFIED, CONFIDENTIAL, SECRET)
   - `MeetingDate` (Date and Time)
   - `AttendeeCount` (Number)
   - `MeetingID` (Single line of text)

#### 3. Configure Permissions

**Option A: Sites.Selected (Recommended)**
1. Register app with SharePoint admin
2. Grant site-specific permissions

**Option B: Sites.ReadWrite.All**
1. Add API permission in Azure AD
2. Grant admin consent

#### 4. Set Environment Variables

```bash
SHAREPOINT_SITE_URL=https://contoso.sharepoint.com/sites/MeetingArchives
SHAREPOINT_LIBRARY=Meeting Minutes
```

#### 5. Enable Feature

Via Settings UI:
1. Navigate to Settings page
2. Toggle "Enable SharePoint Archival" to ON
3. Click Save

---

## Test Execution Log

### Email Distribution Tests

| Test ID | Executed By | Date | Result | Notes |
|---------|-------------|------|--------|-------|
| TC-EMAIL-001 | | | | |
| TC-EMAIL-002 | | | | |
| TC-EMAIL-003 | | | | |
| TC-EMAIL-004 | | | | |
| TC-EMAIL-005 | | | | |
| TC-EMAIL-006 | | | | |
| TC-EMAIL-007 | | | | |
| TC-EMAIL-008 | | | | |

### SharePoint Archive Tests

| Test ID | Executed By | Date | Result | Notes |
|---------|-------------|------|--------|-------|
| TC-SP-001 | | | | |
| TC-SP-002 | | | | |
| TC-SP-003 | | | | |
| TC-SP-004 | | | | |
| TC-SP-005 | | | | |
| TC-SP-006 | | | | |
| TC-SP-007 | | | | |
| TC-SP-008 | | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Architect | | | |
| QA Lead | | | |
| Product Owner | | | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-07 | Agent | Initial document creation |
