# 20-User Pilot Testing Guide - Teams Meeting Minutes

## Purpose

This guide provides detailed testing procedures for the 20-user pilot deployment. Validates seamless Microsoft Teams integration, per-user data isolation, and end-to-end meeting minutes workflow.

**Target:** Commercial demo (4-6 weeks) → Azure Government pilot (8-12 weeks)  
**Users:** 20 test users with Microsoft 365 E3/E5 licenses  
**Success Criteria:** 95% user satisfaction, zero critical bugs, <500ms average response time

---

## Pre-Pilot Checklist

### Infrastructure Readiness

- [ ] Azure resources deployed (App Service, PostgreSQL, OpenAI, Bot Service)
- [ ] Application deployed to Azure App Service
- [ ] Health endpoint returns 200 OK: `https://[app-name].azurewebsites.us/health`
- [ ] Database schema initialized (all tables created)
- [ ] Application Insights collecting telemetry
- [ ] Microsoft Graph API permissions granted with admin consent
- [ ] Application access policy configured (30-min propagation complete)
- [ ] Azure OpenAI models deployed (GPT-4o, Whisper)
- [ ] SharePoint document library created and accessible

### Teams Integration Readiness

- [ ] Teams app manifest created with correct App ID
- [ ] App icons created (192x192 color, 32x32 outline)
- [ ] Teams app package uploaded to Teams Admin Center
- [ ] App published to organization (or uploaded for testing)
- [ ] Bot messaging endpoint configured: `https://[app-name].azurewebsites.us/api/webhooks/bot`
- [ ] Teams channel enabled in Bot Service

### User Accounts Preparation

- [ ] 20 test users created in Microsoft 365 tenant
- [ ] All users have Teams licenses (E3 or E5)
- [ ] All users have mailboxes (Exchange Online)
- [ ] Azure AD role groups created with exact names:
  - [ ] `DOD-Role-Admin` (2 users)
  - [ ] `DOD-Role-Approver` (5 users)
  - [ ] `DOD-Role-Auditor` (3 users)
  - [ ] `DOD-Role-Viewer` (10 users)
- [ ] Azure AD clearance groups created with exact names:
  - [ ] `DOD-Clearance-TOP_SECRET`
  - [ ] `DOD-Clearance-SECRET`
  - [ ] `DOD-Clearance-CONFIDENTIAL`
  - [ ] `DOD-Clearance-UNCLASSIFIED`
- [ ] Users assigned to appropriate role AND clearance groups
- [ ] Group assignments verified: Each user in ONE role + ONE clearance group
- [ ] SharePoint permissions verified (all users can access site)

---

## Pilot Timeline

| Week | Focus Area | Activities |
|------|-----------|------------|
| **Week 1** | Onboarding + Installation | Install app, verify sidebar access, complete orientation |
| **Week 2** | Meeting Capture | Create 10+ test meetings, verify webhook capture |
| **Week 3** | AI Processing | Generate minutes, review quality, test approvals |
| **Week 4** | Distribution + Feedback | Test email/SharePoint/Teams cards, collect feedback |

---

## Phase 1: User Onboarding (Week 1)

### 1.1 App Installation (Per User - 5 minutes)

**For each of the 20 users:**

1. **Open Microsoft Teams**
   - Desktop, web, or mobile client

2. **Access Apps**
   - Click **Apps** in left sidebar
   - OR click **...** (More added apps)

3. **Install Meeting Minutes App**
   - Search for "Meeting Minutes" (if published to org)
   - OR click **Manage your apps** → **Upload a custom app** → Select `.zip` file
   - Click **Add**

4. **Verify Installation**
   - App icon appears in Teams left sidebar
   - Click app icon
   - **EXPECTED:** App loads in Teams iframe, shows "Meeting Minutes" header
   - **EXPECTED:** User sees "Loading..." then Dashboard page

5. **Verify Authentication**
   - **EXPECTED:** No login prompt (Teams SSO automatic)
   - **EXPECTED:** User's name appears in top-right (if implemented)
   - **EXPECTED:** Dashboard loads without errors

**Success Criteria:**
- [ ] App icon visible in sidebar for all 20 users
- [ ] All users can open app without errors
- [ ] All users authenticated automatically (no manual login)

### 1.2 Teams Iframe Integration Testing (Per User - 10 minutes)

**Test Scenario 1: Sidebar Navigation**

1. **User clicks Meeting Minutes icon** in sidebar
   - **EXPECTED:** App loads in Teams main area (iframe)
   - **EXPECTED:** Dashboard page displays with user's meetings

2. **User clicks Calendar** in Teams sidebar
   - **EXPECTED:** Calendar view loads (Teams switches iframe)
   - **EXPECTED:** Meeting Minutes app not visible (but still loaded)

3. **User clicks Meeting Minutes icon again**
   - **EXPECTED:** App returns immediately (no reload)
   - **EXPECTED:** User sees exact same state as before (no re-authentication)

4. **User clicks Chat** in Teams sidebar
   - **EXPECTED:** Chat view loads
   - **EXPECTED:** Meeting Minutes app hidden

5. **User clicks Meeting Minutes icon again**
   - **EXPECTED:** App returns to previous state

**Test Scenario 2: Theme Switching**

1. **User changes Teams theme:**
   - Settings → Appearance → Select **Dark** theme
   - **EXPECTED:** Meeting Minutes app switches to dark theme automatically
   - **EXPECTED:** All text remains readable

2. **User switches to High Contrast theme**
   - **EXPECTED:** App adapts to high contrast colors
   - **EXPECTED:** No visual glitches

**Test Scenario 3: Window Management**

1. **User opens Meeting Minutes app**
2. **User clicks X** to close Teams tab (or minimize window)
   - **EXPECTED:** App closes cleanly
   - **EXPECTED:** No error messages

3. **User reopens Teams and clicks Meeting Minutes**
   - **EXPECTED:** App loads fresh
   - **EXPECTED:** User authenticated automatically

**Success Criteria:**
- [ ] All 20 users can switch between app and Calendar without issues
- [ ] Theme changes apply correctly for all users
- [ ] No crashes or errors when closing/reopening

### 1.3 Per-User Data Isolation (Critical Test - 30 minutes)

**Setup:**
- Create 3 test meetings:
  - Meeting A: Attendees = User 1, User 2, User 3
  - Meeting B: Attendees = User 4, User 5, User 6
  - Meeting C: Attendees = User 1, User 5 (overlapping)

**Test Matrix:**

| User | Should See Meetings | Should NOT See |
|------|-------------------|----------------|
| User 1 | A, C | B |
| User 2 | A | B, C |
| User 3 | A | B, C |
| User 4 | B | A, C |
| User 5 | B, C | A |
| User 6 | B | A, C |

**Validation Steps:**

1. **User 1 logs in**
   - Dashboard shows: Meeting A, Meeting C (2 meetings)
   - **VERIFY:** Meeting B not visible

2. **User 4 logs in** (different user, same device)
   - Dashboard shows: Meeting B (1 meeting)
   - **VERIFY:** Meetings A and C not visible

3. **User 5 logs in**
   - Dashboard shows: Meeting B, Meeting C (2 meetings)
   - **VERIFY:** Correct meeting details displayed

**Success Criteria:**
- [ ] Each user sees ONLY their meetings (attendee list match)
- [ ] Zero cross-contamination (User A never sees User B's data)
- [ ] Switching users in Teams correctly switches data

---

## Phase 2: Meeting Capture (Week 2)

### 2.1 Meeting Creation and Webhook Testing

**Test Meeting Schedule:**
- Create 10 Teams meetings over Week 2
- Mix of: 1-on-1, small group (3-5 people), larger group (8-10 people)
- Enable recording and transcription for all meetings

**Per Meeting Test:**

1. **Create Meeting** (via Teams Calendar)
   - Include 2-5 pilot users as attendees
   - Enable: **Record automatically** + **Transcription**
   - Save meeting

2. **Verify Webhook Capture** (within 2 minutes)
   - Check Application Insights logs for "Webhook received: meeting created"
   - OR check database: `SELECT * FROM meetings WHERE title = 'Meeting Name';`
   - **EXPECTED:** Meeting appears in database with status "scheduled"

3. **Start Meeting and Record** (2-5 minutes minimum)
   - Discuss test topics (project updates, action items, decisions)
   - Mention specific dates, names, and action items
   - End meeting and stop recording

4. **Wait for Recording Upload** (5-10 minutes after meeting ends)
   - Microsoft Teams processes and uploads recording
   - Webhook notifies app when recording available

5. **Verify Enrichment** (check logs)
   - Look for: "Job completed: enrich_meeting"
   - **EXPECTED:** `recording_url` and `transcript_url` populated in database

**Success Criteria:**
- [ ] 10/10 meetings captured via webhook
- [ ] 10/10 recordings retrieved successfully
- [ ] 10/10 transcripts retrieved successfully
- [ ] Average webhook latency < 5 seconds

### 2.2 Meeting Visibility Testing

**For each created meeting:**

1. **Attendees log in** to Meeting Minutes app
   - **EXPECTED:** Meeting appears in their Dashboard
   - **EXPECTED:** Meeting status shows "In Progress" or "Completed"

2. **Non-attendees log in**
   - **EXPECTED:** Meeting NOT visible in Dashboard
   - **EXPECTED:** Direct URL access returns 403 Forbidden

3. **Admin user logs in** (elevated clearance)
   - **EXPECTED:** Can see all meetings regardless of attendee list
   - **EXPECTED:** Can create manual meetings

**Success Criteria:**
- [ ] Attendee-based filtering works 100% of the time
- [ ] Non-attendees cannot access meeting details
- [ ] Admins can view all meetings

---

## Phase 3: AI Processing (Week 3)

### 3.1 Minutes Generation Testing

**For each of the 10 recorded meetings:**

1. **Verify AI Job Triggered** (automatic after recording upload)
   - Check job_queue table: `SELECT * FROM job_queue WHERE job_type = 'generate_minutes';`
   - **EXPECTED:** Job status = "pending" or "processing"

2. **Monitor Processing Time**
   - Check logs for: "Job completed: generate_minutes"
   - Record timestamp delta (start → completion)
   - **TARGET:** < 5 minutes for 10-minute meeting

3. **Review Generated Minutes Quality**
   - Open meeting in app → View Minutes tab
   - **Verify:**
     - [ ] Summary accurately captures main topics
     - [ ] Key discussions section has 3-5 bullet points
     - [ ] Decisions clearly identified
     - [ ] Action items extracted with assignees
     - [ ] Attendee list matches actual participants

4. **Quality Scoring** (1-5 scale per meeting)
   - **5 = Excellent:** Perfect summary, all action items captured
   - **4 = Good:** Minor omissions, generally accurate
   - **3 = Acceptable:** Some errors, usable with edits
   - **2 = Poor:** Significant errors, requires major revision
   - **1 = Failed:** Unusable, no recognizable content

**Success Criteria:**
- [ ] 10/10 meetings generate minutes successfully
- [ ] Average quality score ≥ 4.0
- [ ] Zero "Failed" (score = 1) generations
- [ ] Average processing time < 5 minutes

### 3.2 Approval Workflow Testing

**Test with 3 meetings:**

**Scenario 1: Successful Approval**
1. **Approver user** logs in
2. **Navigate to meeting** with "Pending Review" status
3. **Review minutes** in Minutes tab
4. **Click "Approve" button**
   - **EXPECTED:** Status changes to "Approved"
   - **EXPECTED:** Success toast notification
   - **EXPECTED:** Approval timestamp recorded in database

**Scenario 2: Rejection with Comments**
1. **Approver user** logs in
2. **Navigate to meeting** with "Pending Review" status
3. **Click "Reject" button**
4. **Enter rejection reason:** "Missing discussion about budget"
5. **Submit rejection**
   - **EXPECTED:** Status changes to "Rejected"
   - **EXPECTED:** Rejection reason saved to database
   - **EXPECTED:** Meeting remains visible with rejection note

**Scenario 3: Non-Approver Access Denied**
1. **Viewer user** (non-approver) logs in
2. **Navigate to meeting** with "Pending Review" status
3. **Verify no Approve/Reject buttons visible**
   - **EXPECTED:** Read-only view only
   - **EXPECTED:** "Pending approval" badge displayed

**Success Criteria:**
- [ ] Approvers can approve/reject minutes
- [ ] Non-approvers cannot modify approval status
- [ ] Rejection reasons captured correctly
- [ ] All state transitions logged in database

---

## Phase 4: Distribution (Week 4)

### 4.1 Document Export Testing

**For 3 approved meetings:**

**Test DOCX Export:**
1. **Open meeting details**
2. **Navigate to Attachments tab**
3. **Click "Download DOCX" button**
   - **EXPECTED:** File downloads immediately (< 2 seconds)
   - **EXPECTED:** Filename format: `Meeting_Minutes_[Date]_[Title].docx`

4. **Open DOCX file** (Microsoft Word or equivalent)
   - **Verify:**
     - [ ] Title page with meeting details
     - [ ] Attendee list
     - [ ] Summary section
     - [ ] Key discussions as bullet points
     - [ ] Decisions section
     - [ ] Action items table (task, assignee, due date)
     - [ ] Footer with generation timestamp

**Test PDF Export:**
1. **Click "Download PDF" button**
   - **EXPECTED:** File downloads immediately (< 2 seconds)
   - **EXPECTED:** Filename format: `Meeting_Minutes_[Date]_[Title].pdf`

2. **Open PDF file**
   - **Verify:** Same content as DOCX, properly formatted
   - **Verify:** No text overflow or layout issues

**Success Criteria:**
- [ ] DOCX export works for all tested meetings
- [ ] PDF export works for all tested meetings
- [ ] Documents contain all required sections
- [ ] No formatting errors or missing data

### 4.2 Email Distribution Testing

**For 1 approved meeting with 5 attendees:**

1. **Approve meeting minutes**
2. **Wait 2-5 minutes** for distribution job to process

3. **All 5 attendees check email**
   - **EXPECTED:** Email received within 5 minutes
   - **EXPECTED:** Subject: "Meeting Minutes: [Meeting Title] - [Date]"
   - **EXPECTED:** Email body contains:
     - [ ] Meeting summary
     - [ ] Action items list
     - [ ] Link to view full minutes in Teams
     - [ ] DOCX and PDF attachments

4. **Verify attachments**
   - Click DOCX attachment → Opens correctly
   - Click PDF attachment → Opens correctly

5. **Verify "View in Teams" link**
   - Click link in email
   - **EXPECTED:** Teams app opens to meeting details
   - **EXPECTED:** Minutes displayed correctly

**Success Criteria:**
- [ ] All attendees receive email
- [ ] Email delivery within 5 minutes of approval
- [ ] Attachments open correctly
- [ ] "View in Teams" link works

### 4.3 SharePoint Archival Testing

**For 3 approved meetings:**

1. **Navigate to SharePoint site** (configured in deployment)
   - URL: `https://[tenant].sharepoint.com/sites/[site-name]`

2. **Open document library** (e.g., "Shared Documents")

3. **Verify meeting minutes DOCX uploaded**
   - **EXPECTED:** File present with correct filename
   - **EXPECTED:** File metadata populated:
     - Meeting Date
     - Classification Level
     - Organizer

4. **Open DOCX from SharePoint**
   - **VERIFY:** Content matches app-generated version
   - **VERIFY:** No corruption or encoding issues

**Success Criteria:**
- [ ] 3/3 meetings archived to SharePoint
- [ ] Files accessible by all pilot users
- [ ] Metadata correctly populated
- [ ] Documents open without errors

### 4.4 Teams Adaptive Card Testing

**For 1 approved meeting:**

1. **Approve meeting minutes**
2. **Wait 2-5 minutes** for Teams card delivery

3. **All attendees check Teams meeting chat**
   - **EXPECTED:** Bot posts Adaptive Card to meeting chat
   - **EXPECTED:** Card displays:
     - [ ] Meeting title and date
     - [ ] Summary (truncated if long)
     - [ ] Action items count
     - [ ] "View Full Minutes" button

4. **Click "View Full Minutes" button**
   - **EXPECTED:** Meeting Minutes app opens in Teams
   - **EXPECTED:** Navigates to specific meeting details

**Success Criteria:**
- [ ] Adaptive Card delivered to meeting chat
- [ ] All attendees can see card
- [ ] "View Full Minutes" button works
- [ ] Card displays correctly on desktop and mobile

---

## Phase 5: Performance and Reliability (Week 4)

### 5.1 Load Testing

**Concurrent User Test:**
1. **10 users** simultaneously open Meeting Minutes app
2. **All users navigate** to Dashboard, Meetings list, Search
3. **Monitor Application Insights** for:
   - Response times (target: 95th percentile < 500ms)
   - Error rates (target: < 0.1%)
   - Database connection pool usage

**Success Criteria:**
- [ ] No timeouts or errors with 10 concurrent users
- [ ] Response times < 500ms (95th percentile)
- [ ] Database remains responsive

### 5.2 Error Recovery Testing

**Scenario 1: Network Interruption**
1. **User opens app** in Teams
2. **Disable network** on user's device (airplane mode)
3. **User attempts to navigate** within app
   - **EXPECTED:** Graceful error message ("Connection lost")
4. **Re-enable network**
   - **EXPECTED:** App recovers automatically
   - **EXPECTED:** No data loss

**Scenario 2: Backend Restart**
1. **User has app open** in Teams
2. **Admin restarts** App Service in Azure
3. **User refreshes** app (F5 or click app icon)
   - **EXPECTED:** App reloads successfully
   - **EXPECTED:** User re-authenticated automatically

**Success Criteria:**
- [ ] Graceful error handling for network issues
- [ ] Automatic recovery after backend restart
- [ ] No permanent errors or crashes

---

## Success Metrics

### Functional Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Meeting Capture Rate** | 95% | (Captured meetings / Total meetings) × 100 |
| **Minutes Generation Success** | 100% | (Successful generations / Total attempts) × 100 |
| **Minutes Quality Score** | ≥ 4.0 | Average user rating (1-5 scale) |
| **Email Delivery Rate** | 100% | (Emails delivered / Total expected) × 100 |
| **SharePoint Upload Success** | 100% | (Files uploaded / Total approved) × 100 |

### Performance Metrics

| Metric | Target | Source |
|--------|--------|--------|
| **API Response Time (95th percentile)** | < 500ms | Application Insights |
| **Minutes Generation Time** | < 5 min | Job queue logs |
| **Document Export Time** | < 2 sec | Application Insights |
| **Email Distribution Time** | < 5 min | Job queue logs |

### User Experience Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **User Satisfaction** | ≥ 4.0/5 | Post-pilot survey |
| **Teams Integration Issues** | 0 critical | Issue tracker |
| **Authentication Failures** | < 1% | Application Insights errors |

---

## Issue Tracking Template

### Issue Report Form

**Issue ID:** [AUTO-GENERATED]  
**Reported By:** [User Name / Email]  
**Date:** [YYYY-MM-DD]  
**Severity:** Critical / High / Medium / Low  

**Category:**
- [ ] Teams Integration (iframe, sidebar, authentication)
- [ ] Meeting Capture (webhooks, recording retrieval)
- [ ] AI Processing (minutes generation, quality)
- [ ] Approval Workflow
- [ ] Distribution (email, SharePoint, Teams cards)
- [ ] Performance
- [ ] UI/UX

**Description:**
[Detailed description of the issue]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Screenshots/Logs:**
[Attach if available]

**Environment:**
- Teams Client: Desktop / Web / Mobile
- Browser (if web): Chrome / Edge / Safari / Firefox
- OS: Windows / macOS / iOS / Android

**Impact:**
- Number of users affected:
- Workaround available: Yes / No
- Blocker for pilot: Yes / No

---

## Post-Pilot Feedback Survey

**Send to all 20 users at end of Week 4:**

### Section 1: Teams Integration (1-5 scale)

1. How easy was it to install the Meeting Minutes app in Teams?
2. How seamless was the sidebar navigation experience?
3. How well did the app integrate with your Teams workflow?
4. Did you experience any authentication issues?

### Section 2: Functionality (1-5 scale)

5. How satisfied are you with the quality of AI-generated minutes?
6. How accurate were the action items extracted from meetings?
7. How easy was the approval workflow to use?
8. How useful were the DOCX/PDF exports?

### Section 3: Performance (1-5 scale)

9. How would you rate the app's responsiveness?
10. Did you experience any errors or crashes?

### Section 4: Open Feedback

11. What features did you find most valuable?
12. What improvements would you suggest?
13. Would you recommend this app to your team? (Yes/No/Maybe)
14. Additional comments:

---

## Go/No-Go Decision Criteria (Azure Government Pilot)

**Proceed to Azure Government deployment if:**

- [ ] Meeting capture rate ≥ 95%
- [ ] Minutes generation success rate = 100%
- [ ] Average minutes quality score ≥ 4.0
- [ ] Zero critical bugs unresolved
- [ ] User satisfaction ≥ 4.0/5
- [ ] All 20 users completed testing
- [ ] Performance targets met (response time, processing time)
- [ ] Teams integration issues = 0
- [ ] Distribution channels working (email, SharePoint, Teams)

**Hold deployment if:**
- Any critical bug unresolved
- User satisfaction < 3.5/5
- Minutes quality score < 3.0
- > 5 high-severity bugs

---

## Appendix: Quick Reference Commands

### Check Application Health
```bash
curl https://[app-name].azurewebsites.us/health
```

### View Recent Logs
```bash
az webapp log tail --name [app-name] --resource-group [rg-name]
```

### Check Database Meetings
```sql
SELECT id, title, status, enrichment_status, created_at 
FROM meetings 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Job Queue Status
```sql
SELECT job_type, status, COUNT(*) as count 
FROM job_queue 
GROUP BY job_type, status;
```

### Monitor Application Insights
1. Azure Portal → Application Insights
2. **Live Metrics** → Real-time monitoring
3. **Failures** → Error tracking
4. **Performance** → Response time analysis

---

## Document Control

- **Version:** 1.0
- **Date:** November 21, 2024
- **Purpose:** 20-user pilot testing for commercial demo
- **Next Phase:** Azure Government pilot (IL4) deployment
- **Estimated Duration:** 4 weeks
