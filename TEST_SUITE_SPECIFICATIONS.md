# DOD Teams Meeting Minutes - Comprehensive Test Suite Specifications

**Date**: November 6, 2025  
**System**: Microsoft Teams Meeting Minutes Management (300K user DOD deployment)  
**Purpose**: Document required test coverage for production deployment  
**Status**: ⚠️ Specifications documented, implementation pending

---

## Overview

This document specifies the 6 comprehensive test suites required to validate the DOD Teams Meeting Minutes system before production deployment. Each test suite uses Playwright for end-to-end browser-based testing to verify user-facing workflows.

**Total Estimated Testing Effort**: ~80 hours

---

## Test Suite #1: Authentication & Access Control

**Priority**: CRITICAL  
**Estimated Effort**: ~16 hours  
**Technology**: Playwright E2E + API testing

### Purpose
Validate fail-closed Azure AD authentication, role-based access control, and clearance-level filtering.

### Test Cases

#### TC-1.1: Azure AD Group-Based Login
```
GIVEN a user exists in Azure AD with groups
WHEN they access the application
THEN they should be authenticated via Teams SSO
AND their clearance level should be derived from Azure AD groups
AND their role should be derived from Azure AD groups
```

**Scenarios**:
- User in `DOD-Clearance-UNCLASSIFIED` → clearanceLevel: "UNCLASSIFIED"
- User in `DOD-Clearance-SECRET` → clearanceLevel: "SECRET"
- User in `DOD-Role-Approver` → role: "approver"
- User in `DOD-Role-Admin` → role: "admin"

#### TC-1.2: Fail-Closed Authentication
```
GIVEN Azure AD is unavailable
WHEN a user tries to access the application
THEN they should receive a 503 Service Unavailable error
AND access should be denied
AND no database fallback should occur (production mode)
```

#### TC-1.3: Session Cache Validation
```
GIVEN a user has authenticated successfully
WHEN their session is active (< 15 minutes)
THEN subsequent requests should use cached Azure AD groups
AND no additional Graph API calls should be made
```

#### TC-1.4: Session Expiration
```
GIVEN a user's session cache has expired (> 15 minutes)
WHEN they make a request
THEN the system should fetch fresh Azure AD groups
AND update the session cache
AND update the database cache
```

#### TC-1.5: Clearance-Based Meeting Filtering
```
GIVEN user has CONFIDENTIAL clearance
AND meetings exist with various classifications
WHEN user views All Meetings page
THEN they should see UNCLASSIFIED meetings
AND CONFIDENTIAL meetings
AND NOT see SECRET meetings
AND NOT see TOP_SECRET meetings
```

#### TC-1.6: Role-Based Action Authorization
```
SCENARIO: Viewer Role
GIVEN user has viewer role
WHEN they attempt to approve a meeting
THEN they should receive 403 Forbidden

SCENARIO: Approver Role
GIVEN user has approver role
WHEN they attempt to approve a meeting they attended
THEN the approval should succeed

SCENARIO: Auditor Role
GIVEN user has auditor role
WHEN they view All Meetings
THEN they should see ALL meetings in organization
AND meetings should be filtered by their clearance level

SCENARIO: Admin Role
GIVEN user has admin role
WHEN they access Settings page
THEN they should see user management options
```

#### TC-1.7: Attendance-Based Access
```
GIVEN user has SECRET clearance
AND meeting is UNCLASSIFIED
AND user did NOT attend the meeting
WHEN user tries to view meeting details
THEN they should receive "Access Denied" (unless auditor/admin)
```

### Test Data Requirements
- Mock Azure AD users with various group memberships
- Mock meetings with different classification levels
- Mock attendance lists

---

## Test Suite #2: Meeting CRUD & Dashboard

**Priority**: HIGH  
**Estimated Effort**: ~12 hours  
**Technology**: Playwright E2E

### Purpose
Validate meeting creation, viewing, filtering, and dashboard statistics.

### Test Cases

#### TC-2.1: Dashboard Statistics
```
GIVEN user is authenticated
WHEN they navigate to the Dashboard
THEN they should see total meetings count
AND upcoming meetings count
AND minutes pending review count
AND recent activity list
```

#### TC-2.2: Create Meeting (Manual)
```
GIVEN user is authenticated
WHEN they create a new meeting with:
  - Title: "Logistics Planning Session"
  - Classification: CONFIDENTIAL
  - Scheduled: Tomorrow 2PM
  - Attendees: ["john.doe@dod.gov", "jane.smith@dod.gov"]
THEN the meeting should be created
AND appear in All Meetings list
AND status should be "scheduled"
```

#### TC-2.3: View Meeting Details
```
GIVEN user attended a meeting
WHEN they click on the meeting card
THEN a modal should open
AND show Overview tab (title, classification, attendees, status)
AND show Minutes tab (summary, discussions, decisions)
AND show Action Items tab (tasks, assignees, due dates)
AND show Attachments tab (DOCX, PDF links)
```

#### TC-2.4: Filter Meetings by Status
```
GIVEN multiple meetings exist with different statuses
WHEN user selects "completed" filter
THEN only completed meetings should be displayed
```

#### TC-2.5: Filter Meetings by Classification
```
GIVEN user has SECRET clearance
AND meetings exist: 5 UNCLASSIFIED, 3 CONFIDENTIAL, 2 SECRET
WHEN user selects "CONFIDENTIAL" filter
THEN they should see 3 CONFIDENTIAL meetings
AND NOT see UNCLASSIFIED or SECRET meetings
```

#### TC-2.6: Search Meetings by Title
```
GIVEN meetings exist with various titles
WHEN user searches for "planning"
THEN only meetings with "planning" in title should appear
```

#### TC-2.7: Recent Meetings Widget
```
GIVEN user attended 10 meetings
WHEN they view Dashboard
THEN they should see 5 most recent meetings
AND each should show title, date, status badge
```

### Test Data Requirements
- 20+ meetings with varying statuses, classifications, dates
- Multiple attendees per meeting
- Mix of past and future scheduled meetings

---

## Test Suite #3: Approval Workflow

**Priority**: CRITICAL  
**Estimated Effort**: ~16 hours  
**Technology**: Playwright E2E + Email verification

### Purpose
Validate meeting minutes approval/rejection workflow and email distribution.

### Test Cases

#### TC-3.1: View Pending Minutes
```
GIVEN user is an approver
AND meeting minutes are in "pending_review" status
WHEN they navigate to All Meetings
THEN they should see a badge indicating "Pending Review"
AND a "Review Minutes" button should be visible
```

#### TC-3.2: Approve Minutes - Success Path
```
GIVEN user is an approver
AND user attended the meeting
AND minutes are in "pending_review"
WHEN user clicks "Approve"
AND confirms approval
THEN approvalStatus should change to "approved"
AND email should be sent to all attendees
AND documents should be uploaded to SharePoint
AND success message should appear
```

#### TC-3.3: Approve Minutes - Email Failure
```
GIVEN email service is unavailable
WHEN user approves minutes
THEN the system should:
  - Set status to "needs_attention"
  - Show warning: "Approved but email failed"
  - Log error for admin review
  - NOT change to "approved" status
```

#### TC-3.4: Approve Minutes - SharePoint Failure
```
GIVEN SharePoint is unavailable
WHEN user approves minutes
THEN the system should:
  - Set status to "needs_attention"
  - Show warning: "Approved but archival failed"
  - Log error for admin review
  - Allow retry of archival
```

#### TC-3.5: Reject Minutes
```
GIVEN user is an approver
AND minutes are in "pending_review"
WHEN user clicks "Reject"
AND provides reason: "Missing key decisions"
THEN approvalStatus should change to "rejected"
AND meeting organizer should be notified
AND no email distribution should occur
```

#### TC-3.6: Unauthorized Approval Attempt
```
GIVEN user is a viewer (not approver)
WHEN they attempt to approve minutes
THEN they should receive 403 Forbidden
AND approval status should NOT change
```

#### TC-3.7: Email Distribution Verification
```
GIVEN minutes are approved
WHEN email distribution completes
THEN all attendees should receive email with:
  - Subject: "[Classification] Meeting Minutes - [Title]"
  - Body: Meeting summary
  - Attachments: DOCX and PDF files
  - Classification header/footer
```

#### TC-3.8: Document Export Verification
```
GIVEN minutes are approved
WHEN DOCX is generated
THEN it should contain:
  - Classification header (centered, bold)
  - Meeting title and date
  - Attendees list
  - Summary section
  - Key Discussions (bullet list)
  - Decisions Made (numbered list)
  - Action Items table (task, assignee, due date, priority)
  - Classification footer

WHEN PDF is generated
THEN it should contain same content as DOCX
```

### Test Data Requirements
- Meetings in various approval states
- Multiple approvers with different clearances
- Mock email service responses
- Mock SharePoint service responses

---

## Test Suite #4: Search & Archive

**Priority**: MEDIUM  
**Estimated Effort**: ~10 hours  
**Technology**: Playwright E2E

### Purpose
Validate search functionality, archive access, and date range filtering.

### Test Cases

#### TC-4.1: Search by Date Range
```
GIVEN meetings exist from Jan 2025 to Dec 2025
WHEN user searches:
  - Start Date: March 1, 2025
  - End Date: June 30, 2025
THEN only meetings within that range should appear
```

#### TC-4.2: Search by Classification
```
GIVEN user has SECRET clearance
WHEN user selects "CONFIDENTIAL" classification filter
THEN only CONFIDENTIAL meetings should appear
AND user should NOT see SECRET meetings
```

#### TC-4.3: Search by Keyword
```
GIVEN meetings with titles:
  - "Q1 Logistics Review"
  - "Q2 Planning Session"
  - "Logistics Team Standup"
WHEN user searches keyword "logistics"
THEN 2 meetings should appear
AND search should be case-insensitive
```

#### TC-4.4: Combined Filters
```
GIVEN user searches with:
  - Date: Jan 1 - Mar 31, 2025
  - Classification: UNCLASSIFIED
  - Keyword: "planning"
THEN results should match ALL criteria
```

#### TC-4.5: Empty Search Results
```
GIVEN no meetings match search criteria
WHEN user submits search
THEN "No meetings found" message should appear
AND filters should remain active for refinement
```

#### TC-4.6: Archive Access - Regular User
```
GIVEN user is NOT an auditor
WHEN they access Search Archive
THEN they should only see meetings they attended
AND filtered by their clearance level
```

#### TC-4.7: Archive Access - Auditor
```
GIVEN user is an auditor
WHEN they access Search Archive
THEN they should see ALL meetings in organization
AND filtered by their clearance level only
```

#### TC-4.8: Download Archived Documents
```
GIVEN meeting minutes are approved
WHEN user clicks "Download DOCX"
THEN DOCX file should download
AND file should open successfully

WHEN user clicks "Download PDF"
THEN PDF file should download
AND file should open successfully
```

### Test Data Requirements
- 50+ meetings spanning multiple months
- Various classifications and keywords
- Mix of attended/non-attended meetings

---

## Test Suite #5: UI/UX Interactions

**Priority**: HIGH  
**Estimated Effort**: ~12 hours  
**Technology**: Playwright E2E + Accessibility testing

### Purpose
Validate UI interactions, responsive design, accessibility, and dual-theme system.

### Test Cases

#### TC-5.1: Dual-Theme System
```
SCENARIO: Switch to Microsoft Teams Theme
GIVEN user is on Dashboard
WHEN they open Settings
AND select "Microsoft Teams" theme
THEN UI should use Microsoft Fluent design tokens
AND components should have Teams-style appearance

SCENARIO: Switch to IBM Carbon Theme
WHEN they select "IBM Carbon" theme
THEN UI should use IBM Carbon design tokens
AND components should have Carbon-style appearance
```

#### TC-5.2: Dark Mode Toggle
```
GIVEN user is in light mode
WHEN they toggle to dark mode
THEN all components should use dark theme colors
AND text should be readable
AND classification badges should maintain visibility
```

#### TC-5.3: Classification Badge Visibility
```
GIVEN user is viewing a SECRET meeting
THEN classification badge should be:
  - Highly visible (red background)
  - Present in header
  - Present in meeting card
  - Present in modal header
  - Present in exported documents
```

#### TC-5.4: Modal Interactions
```
GIVEN user opens meeting details modal
WHEN they click "Minutes" tab
THEN Minutes content should display
AND other tabs should be hidden

WHEN they press ESC key
THEN modal should close

WHEN they click outside modal
THEN modal should close
```

#### TC-5.5: Form Validation
```
GIVEN user is creating a new meeting
WHEN they submit without required fields
THEN validation errors should appear
AND focus should move to first error
AND submit should be prevented

WHEN they correct errors
THEN validation messages should clear
```

#### TC-5.6: Loading States
```
GIVEN data is loading
WHEN page renders
THEN skeleton loaders should appear
AND loading spinners should be visible
AND user should understand loading is in progress
```

#### TC-5.7: Error States
```
GIVEN API returns 500 error
WHEN user attempts action
THEN user-friendly error message should appear
AND NO stack traces should be visible
AND user should have option to retry
```

#### TC-5.8: Responsive Design
```
SCENARIO: Mobile View (375px width)
THEN sidebar should collapse to hamburger menu
AND cards should stack vertically
AND modals should be full-screen

SCENARIO: Tablet View (768px width)
THEN sidebar should be collapsible
AND 2-column card layout

SCENARIO: Desktop View (1920px width)
THEN sidebar should be expanded by default
AND 3-column card layout
```

#### TC-5.9: Keyboard Navigation
```
GIVEN user is on All Meetings page
WHEN they press TAB
THEN focus should move through:
  1. Sidebar navigation items
  2. Filter dropdowns
  3. Meeting cards
  4. Action buttons

WHEN they press ENTER on meeting card
THEN modal should open

WHEN they press ESC in modal
THEN modal should close
```

#### TC-5.10: WCAG 2.1 AA Compliance
```
TEST: Color Contrast
THEN all text should have >= 4.5:1 contrast ratio
AND UI components should have >= 3:1 contrast

TEST: Keyboard Accessibility
THEN all interactive elements should be keyboard accessible
AND focus indicators should be visible

TEST: Screen Reader
THEN all images should have alt text
AND form fields should have labels
AND ARIA roles should be correct
```

### Test Data Requirements
- Various UI states (loading, error, empty, populated)
- Multiple devices/screen sizes
- Screen reader software (JAWS, NVDA)

---

## Test Suite #6: Classification-Based Security

**Priority**: CRITICAL  
**Estimated Effort**: ~14 hours  
**Technology**: Playwright E2E + Security testing

### Purpose
Validate that classification-based access controls prevent unauthorized data access.

### Test Cases

#### TC-6.1: Meeting Visibility by Clearance
```
SCENARIO: UNCLASSIFIED User
GIVEN user has UNCLASSIFIED clearance
WHEN they view All Meetings
THEN they should see UNCLASSIFIED meetings only
AND NOT see CONFIDENTIAL, SECRET, or TOP_SECRET meetings

SCENARIO: CONFIDENTIAL User
GIVEN user has CONFIDENTIAL clearance
THEN they should see UNCLASSIFIED + CONFIDENTIAL
AND NOT see SECRET or TOP_SECRET

SCENARIO: SECRET User
GIVEN user has SECRET clearance
THEN they should see UNCLASSIFIED + CONFIDENTIAL + SECRET
AND NOT see TOP_SECRET

SCENARIO: TOP_SECRET User
GIVEN user has TOP_SECRET clearance
THEN they should see ALL meetings
```

#### TC-6.2: API Endpoint Authorization
```
SCENARIO: Direct API Access
GIVEN user has UNCLASSIFIED clearance
WHEN they make GET request to /api/meetings/{secret-meeting-id}
THEN they should receive 403 Forbidden
AND no meeting data should be returned
```

#### TC-6.3: Search Results Filtering
```
GIVEN user has CONFIDENTIAL clearance
AND search returns 10 UNCLASSIFIED, 5 CONFIDENTIAL, 3 SECRET meetings
WHEN user views search results
THEN they should see 15 meetings (UNCLASSIFIED + CONFIDENTIAL)
AND NOT see 3 SECRET meetings
AND no indication SECRET meetings exist
```

#### TC-6.4: Classification Upgrade Scenario
```
SCENARIO: User clearance upgraded
GIVEN user initially has CONFIDENTIAL clearance
AND has active session (< 15 min)
WHEN Azure AD groups are updated to SECRET clearance
AND user's session expires
AND user makes next request
THEN fresh Azure AD groups should be fetched
AND user should now see SECRET meetings
```

#### TC-6.5: Classification Downgrade Scenario
```
SCENARIO: User clearance downgraded
GIVEN user has SECRET clearance
AND is viewing a SECRET meeting
WHEN their clearance is downgraded to CONFIDENTIAL (Azure AD)
AND their session expires
THEN they should no longer see SECRET meetings
AND should receive access denied if they try to access SECRET meeting
```

#### TC-6.6: Document Export Security
```
GIVEN meeting is CONFIDENTIAL
WHEN DOCX is generated
THEN document should have:
  - "CONFIDENTIAL" header on every page
  - "CONFIDENTIAL" footer on every page
  - Classification banner in red background

GIVEN meeting is SECRET
THEN document should have SECRET markings
```

#### TC-6.7: Email Distribution Security
```
GIVEN meeting is CONFIDENTIAL
WHEN approved minutes are emailed
THEN email subject should start with "[CONFIDENTIAL]"
AND email body should have classification warning
AND only attendees should receive email
AND no unauthorized recipients
```

#### TC-6.8: SharePoint Archival Security
```
GIVEN meeting is SECRET
WHEN uploaded to SharePoint
THEN folder structure should be: YYYY/MM-Month/SECRET/
AND metadata should include classification: "SECRET"
AND SharePoint permissions should match classification level
```

#### TC-6.9: Audit Trail Verification
```
GIVEN user attempts to access restricted meeting
WHEN access is denied
THEN access attempt should be logged with:
  - User ID
  - Meeting ID
  - Attempted action
  - Denial reason
  - Timestamp
```

#### TC-6.10: SQL Injection Prevention
```
GIVEN user enters SQL in search field: "'; DROP TABLE meetings; --"
WHEN search is executed
THEN no SQL should execute
AND search should return 0 results
AND database should remain intact
```

#### TC-6.11: XSS Prevention
```
GIVEN user creates meeting with title: "<script>alert('XSS')</script>"
WHEN meeting is displayed
THEN script should NOT execute
AND title should be HTML-escaped
```

### Test Data Requirements
- Users with all 4 clearance levels (UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET)
- Meetings at all classification levels
- Malicious input samples (SQL injection, XSS)
- Audit log verification queries

---

## Test Execution Strategy

### Environment Setup
1. **Development Environment**:
   - Mock Azure AD with configurable user groups
   - Mock Microsoft Graph API responses
   - Mock email service (capture sent emails)
   - Mock SharePoint service
   - PostgreSQL test database

2. **DOD Test Environment**:
   - Real Azure AD (test tenant)
   - Real Microsoft Graph API
   - Real SharePoint (test site)
   - Real email service (test mailboxes)
   - Isolated PostgreSQL database

### Test Data Management
```typescript
// config/testData.ts
export const TEST_USERS = {
  unclassified_viewer: {
    email: "viewer.unc@dod.test",
    clearance: "UNCLASSIFIED",
    role: "viewer",
    azureAdGroups: ["DOD-Clearance-UNCLASSIFIED", "DOD-Role-Viewer"]
  },
  confidential_approver: {
    email: "approver.conf@dod.test",
    clearance: "CONFIDENTIAL",
    role: "approver",
    azureAdGroups: ["DOD-Clearance-CONFIDENTIAL", "DOD-Role-Approver"]
  },
  secret_auditor: {
    email: "auditor.secret@dod.test",
    clearance: "SECRET",
    role: "auditor",
    azureAdGroups: ["DOD-Clearance-SECRET", "DOD-Role-Auditor"]
  },
  topsecret_admin: {
    email: "admin.ts@dod.test",
    clearance: "TOP_SECRET",
    role: "admin",
    azureAdGroups: ["DOD-Clearance-TOP_SECRET", "DOD-Role-Admin"]
  }
};

export const TEST_MEETINGS = {
  unc_scheduled: {
    title: "Unclassified Logistics Review",
    classification: "UNCLASSIFIED",
    status: "scheduled",
    scheduledAt: new Date("2025-12-01T14:00:00Z")
  },
  conf_completed: {
    title: "Confidential Planning Session",
    classification: "CONFIDENTIAL",
    status: "completed",
    scheduledAt: new Date("2025-11-15T10:00:00Z")
  }
  // ... more test meetings
};
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Comprehensive Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
      - name: Install dependencies
        run: npm ci
      - name: Run Test Suite #1 - Authentication
        run: npm run test:auth
      - name: Run Test Suite #2 - Meeting CRUD
        run: npm run test:meetings
      - name: Run Test Suite #3 - Approval Workflow
        run: npm run test:approval
      - name: Run Test Suite #4 - Search & Archive
        run: npm run test:search
      - name: Run Test Suite #5 - UI/UX
        run: npm run test:ui
      - name: Run Test Suite #6 - Classification Security
        run: npm run test:security
      - name: Generate Coverage Report
        run: npm run test:coverage
```

### Test Coverage Goals
- **Unit Tests**: 80% code coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: All user workflows
- **Security Tests**: All classification scenarios
- **Accessibility Tests**: WCAG 2.1 AA compliance

---

## Test Implementation Checklist

### Infrastructure Setup (~8 hours)
- [ ] Configure Playwright test framework
- [ ] Setup mock Azure AD authentication
- [ ] Setup mock Microsoft Graph API
- [ ] Setup mock email service
- [ ] Setup mock SharePoint service
- [ ] Create test database seeding scripts
- [ ] Configure test data factories

### Test Suite Implementation (~72 hours)
- [ ] Test Suite #1: Authentication & Access Control (~16 hours)
- [ ] Test Suite #2: Meeting CRUD & Dashboard (~12 hours)
- [ ] Test Suite #3: Approval Workflow (~16 hours)
- [ ] Test Suite #4: Search & Archive (~10 hours)
- [ ] Test Suite #5: UI/UX Interactions (~12 hours)
- [ ] Test Suite #6: Classification-Based Security (~14 hours)

### CI/CD Integration (~4 hours)
- [ ] GitHub Actions workflow configuration
- [ ] Test reporting setup
- [ ] Coverage tracking
- [ ] Automated test execution on PR

### Documentation (~4 hours)
- [ ] Test execution guide
- [ ] Test data management guide
- [ ] Troubleshooting guide
- [ ] Test results interpretation

**Total Estimated Effort**: ~88 hours

---

## Success Criteria

Before proceeding to DOD production deployment, ALL test suites must:
1. ✅ Pass 100% of test cases
2. ✅ Achieve >= 80% code coverage
3. ✅ Complete security penetration testing
4. ✅ Complete WCAG 2.1 AA accessibility audit
5. ✅ Complete performance testing (300K user load)
6. ✅ Complete disaster recovery testing

---

## Conclusion

These comprehensive test suites provide the necessary validation coverage for production deployment. Implementation of these tests will ensure system reliability, security, and compliance with DOD standards.

**Next Steps**:
1. Complete core implementation gaps (see GAPS_ANALYSIS.md)
2. Implement test infrastructure
3. Execute all 6 test suites
4. Address any failures
5. Proceed to DOD testing environment
