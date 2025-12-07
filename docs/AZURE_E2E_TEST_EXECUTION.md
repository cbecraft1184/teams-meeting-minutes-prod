# Azure E2E Test Execution Guide

## Email Distribution and SharePoint Archive Testing

**Document Version**: 1.0  
**Last Updated**: December 7, 2025  
**Environment**: Azure Commercial (East US 2)

---

## Overview

This document provides step-by-step instructions for executing E2E tests for Email Distribution and SharePoint Archive features directly in the Azure production environment. Testing in Replit is not suitable because mock services cannot validate real Microsoft Graph and SharePoint API integrations.

---

## Prerequisites

### Azure Resources Verified

| Resource | Name | Status |
|----------|------|--------|
| Container App | `teams-minutes-app` | [ ] Running |
| Resource Group | `rg-teams-minutes-demo` | [ ] Exists |
| Container Registry | `teamminutesacr.azurecr.io` | [ ] Accessible |
| Azure Database for PostgreSQL | [configured via DATABASE_URL] | [ ] Connected |

### Environment Variables in Azure Container App

| Variable | Purpose | Configured |
|----------|---------|------------|
| `AZURE_CLIENT_ID` | Azure AD app client ID | [ ] |
| `AZURE_CLIENT_SECRET` | Azure AD app secret | [ ] |
| `AZURE_TENANT_ID` | Azure AD tenant | [ ] |
| `GRAPH_SENDER_EMAIL` | Email sender address | [ ] |
| `SHAREPOINT_SITE_URL` | SharePoint site URL | [ ] |
| `SHAREPOINT_LIBRARY` | Document library name | [ ] |
| `USE_MOCK_SERVICES` | Must be `false` | [ ] |

### Azure AD App Permissions

| Permission | Type | Admin Consent |
|------------|------|---------------|
| `Mail.Send` | Application | [ ] Granted |
| `Sites.ReadWrite.All` or `Sites.Selected` | Application | [ ] Granted |
| `CallRecords.Read.All` | Application | [ ] Granted |
| `OnlineMeetings.Read.All` | Application | [ ] Granted |

---

## Test Environment Isolation

### Create Dedicated Test Cohort

To avoid impacting production users:

1. **Create test meeting(s)** with title prefix: `[E2E Test]`
2. **Use test participants** - internal test accounts only
3. **Schedule test window** during low-usage hours
4. **Disable background jobs** temporarily if needed (optional)

### Test Account Requirements

| Role | Email | Purpose |
|------|-------|---------|
| Meeting Organizer | [test-organizer@yourdomain.com] | Creates test meetings |
| Attendee 1 | [test-attendee1@yourdomain.com] | Receives email distribution |
| Attendee 2 | [test-attendee2@yourdomain.com] | Receives email distribution |
| Admin | [test-admin@yourdomain.com] | Approves minutes |

---

## Test Execution Steps

### Phase 1: Enable Feature Toggles

1. **Access Azure Container App**
   ```
   URL: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
   ```

2. **Login as Admin user**
   - Use Azure AD authentication
   - Verify admin role assigned

3. **Navigate to Settings**
   - Click Settings in navigation
   - Locate "Distribution Settings" section

4. **Enable Email Distribution**
   - Toggle "Enable Email Distribution" to ON
   - Click Save
   - Verify toast notification confirms save

5. **Enable SharePoint Archival**
   - Toggle "Enable SharePoint Archival" to ON
   - Click Save
   - Verify toast notification confirms save

**Evidence Collection**:
- [ ] Screenshot of Settings page with toggles enabled
- [ ] Database verification:
  ```sql
  SELECT enable_email_distribution, enable_sharepoint_archival 
  FROM app_settings WHERE id = 'default';
  ```

---

### Phase 2: Create Test Meeting with Minutes

1. **Identify or create test meeting**
   - Use existing meeting with approved minutes, OR
   - Create new test meeting via Teams

2. **Verify meeting has minutes**
   ```sql
   SELECT m.id, m.title, m.status, mm.approval_status
   FROM meetings m
   JOIN meeting_minutes mm ON m.id = mm.meeting_id
   WHERE m.title LIKE '[E2E Test]%' OR mm.approval_status = 'approved'
   ORDER BY m.created_at DESC LIMIT 5;
   ```

3. **Record meeting ID for testing**
   ```
   Meeting ID: ________________________________
   Meeting Title: ____________________________
   ```

---

### Phase 3: Execute Email Distribution Test

#### Test Case: TC-EMAIL-002 - Happy Path Email Send

1. **Navigate to meeting details**
   - Go to Meetings page
   - Find test meeting
   - Click "View Details"

2. **Approve minutes (if not already approved)**
   - Go to Minutes tab
   - Click "Approve" button
   - Confirm approval

3. **Monitor job queue**
   ```sql
   -- Check for email job creation
   SELECT id, job_type, status, created_at, last_error
   FROM job_queue
   WHERE job_type = 'send_email'
   ORDER BY created_at DESC LIMIT 5;
   ```

4. **Wait for job completion** (up to 60 seconds)
   ```sql
   -- Verify job completed
   SELECT id, status, processed_at
   FROM job_queue
   WHERE job_type = 'send_email' AND status = 'completed'
   ORDER BY processed_at DESC LIMIT 1;
   ```

5. **Verify email delivery**
   - [ ] Check recipient inbox for email
   - [ ] Verify subject: "Meeting Minutes: [Title]"
   - [ ] Verify DOCX attachment present
   - [ ] Verify PDF attachment present
   - [ ] Verify HTML body contains classification banner

**Evidence Collection**:
- [ ] Screenshot of received email
- [ ] Screenshot of email attachments
- [ ] Database job_queue record
- [ ] Application Insights logs (if configured)

#### Alternative Evidence: Microsoft 365 Audit Log

1. Navigate to: Microsoft 365 Admin Center > Audit
2. Search for: Activity = "Send" 
3. Filter by sender: [GRAPH_SENDER_EMAIL]
4. Verify send event logged

---

### Phase 4: Execute SharePoint Archive Test

#### Test Case: TC-SP-002 - Happy Path SharePoint Upload

1. **Verify meeting triggered SharePoint job**
   ```sql
   -- Check for SharePoint job
   SELECT id, job_type, status, created_at, last_error
   FROM job_queue
   WHERE job_type = 'upload_sharepoint'
   ORDER BY created_at DESC LIMIT 5;
   ```

2. **Wait for job completion** (up to 60 seconds)
   ```sql
   -- Verify job completed
   SELECT id, status, processed_at
   FROM job_queue
   WHERE job_type = 'upload_sharepoint' AND status = 'completed'
   ORDER BY processed_at DESC LIMIT 1;
   ```

3. **Verify SharePoint URL in database**
   ```sql
   -- Check meeting has SharePoint URL
   SELECT id, title, sharepoint_url
   FROM meetings
   WHERE id = '[MEETING_ID]';
   ```

4. **Navigate to SharePoint site**
   - Open: [SHAREPOINT_SITE_URL]
   - Navigate to document library: [SHAREPOINT_LIBRARY]
   - Verify folder structure: `YYYY/MM-Month/Classification/`

5. **Verify document**
   - [ ] Document exists in expected folder
   - [ ] File name matches pattern
   - [ ] Document opens correctly

6. **Verify metadata**
   - Open document properties in SharePoint
   - [ ] Classification field populated
   - [ ] MeetingDate field populated
   - [ ] AttendeeCount field populated
   - [ ] MeetingID field populated

**Evidence Collection**:
- [ ] Screenshot of SharePoint folder structure
- [ ] Screenshot of document in library
- [ ] Screenshot of document properties/metadata
- [ ] Database meeting record with sharepoint_url

---

### Phase 5: Failure Scenario Testing

#### Test Case: TC-EMAIL-005 - Token Failure (Optional)

**WARNING**: Only execute during scheduled maintenance window.

1. Temporarily revoke or rotate `AZURE_CLIENT_SECRET`
2. Trigger email distribution
3. Verify job enters retry state
4. Verify error logged: "Failed to acquire access token"
5. Restore correct credentials
6. Verify job succeeds on retry

#### Test Case: TC-SP-005 - Permission Denied (Optional)

**WARNING**: Only execute during scheduled maintenance window.

1. Temporarily revoke SharePoint permissions
2. Trigger SharePoint archive
3. Verify job enters retry state
4. Verify error logged: "403" or permission error
5. Restore permissions
6. Verify job succeeds on retry

---

## Evidence Collection Checklist

### Email Distribution Evidence

| Evidence | Collected | Notes |
|----------|-----------|-------|
| Settings page screenshot (toggle ON) | [ ] | |
| job_queue record (send_email completed) | [ ] | |
| Received email screenshot | [ ] | |
| Email attachments (DOCX, PDF) | [ ] | |
| Email body HTML screenshot | [ ] | |
| Application Insights log (optional) | [ ] | |
| M365 Audit log entry (optional) | [ ] | |

### SharePoint Archive Evidence

| Evidence | Collected | Notes |
|----------|-----------|-------|
| Settings page screenshot (toggle ON) | [ ] | |
| job_queue record (upload_sharepoint completed) | [ ] | |
| Meeting record with sharepoint_url | [ ] | |
| SharePoint folder structure screenshot | [ ] | |
| Document in library screenshot | [ ] | |
| Document metadata screenshot | [ ] | |
| Document download test | [ ] | |

---

## Test Results Summary

### Email Distribution

| Test Case | Result | Evidence | Notes |
|-----------|--------|----------|-------|
| TC-EMAIL-001: Feature Toggle | | | |
| TC-EMAIL-002: Happy Path | | | |
| TC-EMAIL-003: Content Verification | | | |
| TC-EMAIL-004: Attachment Verification | | | |
| TC-EMAIL-005: Token Failure | | | |
| TC-EMAIL-006: Approval Notification | | | |
| TC-EMAIL-007: Multiple Recipients | | | |
| TC-EMAIL-008: Mock Mode | N/A | N/A | Not applicable in Azure |

### SharePoint Archive

| Test Case | Result | Evidence | Notes |
|-----------|--------|----------|-------|
| TC-SP-001: Feature Toggle | | | |
| TC-SP-002: Happy Path | | | |
| TC-SP-003: Folder Structure | | | |
| TC-SP-004: Metadata | | | |
| TC-SP-005: Permission Denied | | | |
| TC-SP-006: Large Document | | | |
| TC-SP-007: Mock Mode | N/A | N/A | Not applicable in Azure |
| TC-SP-008: Library Selection | | | |

---

## Post-Test Cleanup

1. **Review test meetings**
   - Consider archiving or deleting E2E test meetings

2. **Verify feature toggles**
   - Confirm settings are in desired production state

3. **Check job queue**
   - Verify no stuck jobs remain

4. **Document any issues**
   - Log any anomalies in test report

---

## Azure CLI Commands (Optional)

### Check Container App Logs
```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 100
```

### Check Container App Status
```bash
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "{Status:properties.runningStatus,Revision:properties.latestRevisionName}"
```

### Query Azure PostgreSQL
```bash
# Use Azure Data Studio or psql with DATABASE_URL connection string
psql "$DATABASE_URL" -c "SELECT * FROM job_queue ORDER BY created_at DESC LIMIT 10;"
```

---

## Sign-Off

| Role | Name | Date | Result | Signature |
|------|------|------|--------|-----------|
| QA Tester | | | PASS / FAIL | |
| Developer | | | PASS / FAIL | |
| Architect | | | PASS / FAIL | |
| Product Owner | | | APPROVED | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-07 | Agent | Initial Azure test execution guide |
