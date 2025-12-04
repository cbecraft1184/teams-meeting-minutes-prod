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

## Known Issues and Waivers

Document any known issues that are accepted for deployment:

| Issue | Impact | Waiver Reason | Approved By |
|-------|--------|---------------|-------------|
| Teams SDK timeout in standalone | Expected behavior outside Teams | Works correctly inside Teams | - |

---

## Continuous Improvement

After each production issue:
1. Add regression test case
2. Update smoke test checklist
3. Review and improve this document
