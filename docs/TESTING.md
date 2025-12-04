# Testing Documentation

## Overview

This document outlines the testing requirements, test cases, and quality assurance process for the Teams Meeting Minutes application.

## Pre-Deployment Quality Gate

**No deployment recommendation should be made until ALL of the following are completed:**

1. All automated tests pass
2. Manual smoke test checklist completed
3. Visual verification in browser
4. Test evidence captured (screenshots/logs)
5. Known issues documented with waivers if proceeding

---

## Automated Test Suites

### End-to-End Tests (Playwright)

Run before every deployment recommendation:

```
npm run test:e2e
```

### API Tests

```
npm run test:api
```

---

## Manual Smoke Test Checklist

### Dashboard (/)

- [ ] Page loads without errors
- [ ] Stats cards display correct counts (Total Meetings, Pending, Completed, Archived)
- [ ] Recent meetings list displays meeting cards
- [ ] Search box filters meetings correctly
- [ ] Settings button navigates to /settings

### Meeting Details Modal

- [ ] "View Details" button opens modal
- [ ] Modal displays with correct dimensions (not blank/collapsed)
- [ ] Modal title shows meeting name
- [ ] Status and Classification badges visible
- [ ] All 5 tabs are visible and clickable

#### Overview Tab
- [ ] Date, Duration, Attendees metadata displayed
- [ ] Processing status shown if minutes exist
- [ ] Attendees list visible

#### Minutes Tab
- [ ] Summary section displays content
- [ ] Key Discussions section displays
- [ ] Decisions section displays
- [ ] Approve/Reject buttons visible when status is pending_review
- [ ] Approve action triggers confirmation dialog
- [ ] Reject action triggers rejection form
- [ ] Toast notifications appear after actions

#### Action Items Tab
- [ ] Action items list displays (or empty state)
- [ ] Status dropdown works for each item
- [ ] Status change persists after refresh
- [ ] Event logged in History tab after status change

#### Attachments Tab
- [ ] Download DOCX button works
- [ ] Download PDF button works
- [ ] Buttons disabled when minutes not completed

#### History Tab
- [ ] Timeline displays events (or empty state)
- [ ] Events show title, description, timestamp, actor
- [ ] Icons match event types

### Authentication

- [ ] Mock user switcher works in development
- [ ] User info displays in header
- [ ] Access control respects classification levels

### Workflow Processing

- [ ] Minutes generation creates event in History
- [ ] Approval triggers email/SharePoint jobs
- [ ] Job status can be monitored

---

## Feature Test Cases

### Meeting Events Audit Trail

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Event created on approval | Approve minutes | "minutes_approved" event logged with actor info |
| Event created on rejection | Reject minutes with reason | "minutes_rejected" event logged with rejection reason |
| Event created on status change | Change action item status | "action_item_updated" event logged with old/new status |
| Events display in History | Open History tab | Timeline shows events in chronological order |
| Empty state displays | Open History for new meeting | "No event history recorded" message shown |
| Actor metadata captured | Perform any action | Event includes actor email, name, AAD ID |

### Action Item Management

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Status dropdown displays | Open Action Items tab | Each item has status dropdown |
| Change to In Progress | Select "In Progress" | Status updates, toast shown |
| Change to Completed | Select "Completed" | Status updates, toast shown |
| Change persists | Refresh page | Status remains changed |
| Event logged | Change status | Event appears in History tab |

### Document Export

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| DOCX download | Click Download DOCX | File downloads with meeting content |
| PDF download | Click Download PDF | File downloads with meeting content |
| Buttons disabled | View meeting without completed minutes | Buttons are disabled |

---

## Regression Test Scenarios

### CSS/Layout Regressions

- [ ] Modal displays content (not blank)
- [ ] Flexbox layouts work in Teams context
- [ ] Scrolling works in all tabs
- [ ] Responsive layout on different screen sizes
- [ ] Dark/light theme compatibility

### Data Flow Regressions

- [ ] Meeting data loads from API
- [ ] Minutes data loads with meeting
- [ ] Action items load correctly
- [ ] Events load in History tab
- [ ] Mutations update cache correctly

### Authentication Regressions

- [ ] JWT validation works
- [ ] Mock auth works in development
- [ ] Tenant isolation enforced
- [ ] Classification access control works

---

## Test Environment Requirements

### Development
- Mock authentication enabled
- Mock services for Graph API
- Development database

### Production Verification
- Azure AD authentication
- Real Graph API integration
- Production database (read-only verification)

---

## Test Evidence Template

Before deployment, capture:

```
Date: YYYY-MM-DD
Tester: [Name]
Environment: [Dev/Staging/Prod]
Build: [Git commit hash]

Smoke Test Results:
- Dashboard: PASS/FAIL
- Modal Opens: PASS/FAIL
- All Tabs Work: PASS/FAIL
- Actions Function: PASS/FAIL

Screenshots Attached: Yes/No
Logs Reviewed: Yes/No
Known Issues: [List or None]
Waivers: [List or None]

Sign-off: [Name] approved for deployment
```

---

## Help System Test Cases

### Help Page Navigation and Search

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Navigate to Help | Click menu > Help | Help page opens at /help |
| User Guide tab active | Load Help page | User Guide tab selected by default |
| Search functionality | Enter "action items" in search | Articles filtered to show action item content |
| Case-insensitive search | Enter "ACTION" | Same results as lowercase |
| No results state | Enter "xyznonexistent" | "No articles match your search" message |
| Clear search | Clear search input | All articles displayed again |

### Contact Support Form

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Form displays | Click Contact Support tab | Subject, Category, Description fields visible |
| Submit disabled initially | Load Contact Support tab | Submit button is disabled |
| Validation - Subject | Enter < 3 chars | Submit remains disabled |
| Validation - Description | Enter < 10 chars | Submit remains disabled |
| Submit enabled | Fill all required fields | Submit button becomes enabled |
| Successful submission | Submit valid form | Success message displayed |
| Rate limiting | Submit 6 requests in 1 hour | 429 error on 6th request |

### Security Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Auth required | Call API without auth | 401 Unauthorized |
| HTML stripped | Submit `<script>alert(1)</script>` | Tags removed from stored/emailed content |
| Length limits - Subject | Submit > 200 char subject | 400 Bad Request |
| Length limits - Description | Submit > 4000 char description | 400 Bad Request |
| Invalid category | Submit category "hacker" | Defaults to "general" |
| Rate limit enforced | Exceed 5 requests/hour | 429 Too Many Requests |

---

## Test Evidence Log

### Help System Implementation - December 2024

```
Date: 2024-12-04
Tester: Automated E2E (Playwright)
Environment: Development
Build: Help System Implementation

Test Execution:
1. [PASS] Navigation to Help page via header menu
2. [PASS] Help Center heading displayed
3. [PASS] Two tabs visible: User Guide, Contact Support
4. [PASS] Search input field present
5. [PASS] Search "action items" filters content correctly
6. [PASS] Contact Support tab displays form
7. [PASS] Form fields: Subject, Category dropdown, Description
8. [PASS] Submit button disabled until form valid
9. [PASS] Fill Subject: "Test Support Request"
10. [PASS] Fill Description: "This is a test support request..."
11. [PASS] Submit button enabled after validation
12. [PASS] Click Submit - success message displayed
13. [PASS] API POST /api/help/request returned {success: true}

Security Verification:
- Rate limiting: 5 requests/hour per user
- Input validation: Length limits enforced
- HTML sanitization: Tags stripped
- Category validation: Allowed list only
- Authentication: Required for API access

Architect Review: PASSED
- Reviewed by: Architect Agent
- Date: 2024-12-04
- Verdict: "Pass - The Help system implementation meets the stated 
  functional and security requirements for release."

Sign-off: Approved for Git commit
```

---

## Known Issues and Waivers

Document any known issues that are accepted for deployment:

| Issue | Impact | Waiver Reason | Approved By |
|-------|--------|---------------|-------------|
| Teams SDK timeout in standalone | Expected behavior outside Teams | Works correctly inside Teams | - |
| AUTH_HEADER_MISSING console warning | Transient warning in dev mode | Dev-only, no functional impact | Architect |

---

## Continuous Improvement

After each production issue:
1. Add regression test case
2. Update smoke test checklist
3. Review and improve this document
