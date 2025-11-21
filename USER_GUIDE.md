# Teams Meeting Minutes - User Guide

## Overview

This guide explains how to use the Teams Meeting Minutes application based on your assigned role. Your role and clearance level are automatically determined by your Azure AD group membership.

**Last Updated:** November 21, 2025  
**Version:** 1.0 (Production-ready for NAVY ERP deployment)

---

## Table of Contents

1. [Understanding Roles and Clearances](#understanding-roles-and-clearances)
2. [Getting Started](#getting-started)
3. [Admin Guide](#admin-guide)
4. [Approver Guide](#approver-guide)
5. [Auditor Guide](#auditor-guide)
6. [Viewer Guide](#viewer-guide)
7. [Common Tasks (All Roles)](#common-tasks-all-roles)
8. [Troubleshooting](#troubleshooting)
9. [Quick Reference](#quick-reference)

---

## Understanding Roles and Clearances

### Your Role Determines What You Can Do

The application has **4 roles**, each with different capabilities:

| Role | Primary Purpose | Key Capabilities |
|------|----------------|------------------|
| **Admin** | System administration | Full access to all features including Settings |
| **Approver** | Meeting minutes review | Can approve or reject AI-generated minutes |
| **Auditor** | Compliance monitoring | View-only access to all meetings for oversight |
| **Viewer** | Regular user | Can view and download minutes from attended meetings |

### Your Clearance Level Determines What You Can See

The application supports **4 classification levels**:

| Clearance Level | Can Access |
|----------------|------------|
| **UNCLASSIFIED** | Only UNCLASSIFIED meetings |
| **CONFIDENTIAL** | CONFIDENTIAL and UNCLASSIFIED |
| **SECRET** | SECRET, CONFIDENTIAL, and UNCLASSIFIED |
| **TOP SECRET** | All meetings (TOP SECRET, SECRET, CONFIDENTIAL, UNCLASSIFIED) |

**Important:** Even if your role grants access to all meetings (Admin/Auditor), you can only see meetings at or below your clearance level.

### Complete Permissions Matrix

| Permission | Admin | Approver | Auditor | Viewer |
|------------|:-----:|:--------:|:-------:|:------:|
| **Viewing** |
| View meetings you attended | ✅ | ✅ | ✅ | ✅ |
| View ALL meetings (within clearance) | ✅ | ❌ | ✅ | ❌ |
| Search full archive | ✅ | ✅ | ✅ | ✅ |
| View meeting details | ✅ | ✅ | ✅ | ✅ |
| **Documents** |
| Download DOCX (editable) | ✅ | ✅ | ✅ | ✅ |
| Download PDF (archival) | ✅ | ✅ | ✅ | ✅ |
| **Approval Workflow** |
| Approve meeting minutes | ✅ | ✅ | ❌ | ❌ |
| Reject meeting minutes | ✅ | ✅ | ❌ | ❌ |
| View approval status | ✅ | ✅ | ✅ | ✅ |
| **Administration** |
| Access Settings page | ✅ | ❌ | ❌ | ❌ |
| Configure approval workflow | ✅ | ❌ | ❌ | ❌ |
| Toggle distribution channels | ✅ | ❌ | ❌ | ❌ |
| View system statistics | ✅ | ❌ | ❌ | ❌ |

### How Roles Are Assigned

Your role and clearance are determined by **Azure AD group membership**:

**Role Groups:**
- `DOD-Role-Admin` → Admin role
- `DOD-Role-Approver` → Approver role
- `DOD-Role-Auditor` → Auditor role
- `DOD-Role-Viewer` → Viewer role

**Clearance Groups:**
- `DOD-Clearance-TOP_SECRET` → TOP SECRET clearance
- `DOD-Clearance-SECRET` → SECRET clearance
- `DOD-Clearance-CONFIDENTIAL` → CONFIDENTIAL clearance
- `DOD-Clearance-UNCLASSIFIED` → UNCLASSIFIED clearance

**To change your role or clearance**, contact your system administrator. Changes take effect within 15 minutes (cache refresh).

---

## Getting Started

### Accessing the Application

**In Microsoft Teams:**
1. Click the **Meeting Minutes** app icon in your Teams sidebar
2. The app loads automatically in the main Teams window
3. You're authenticated automatically via Teams SSO (no separate login needed)

**First-Time Setup:**
- No setup required! The app automatically detects your role and clearance from Azure AD
- You'll see a dashboard showing meetings relevant to your role

### Understanding the Interface

**Main Navigation (Left Sidebar):**
- **Dashboard** - Overview of recent meetings and statistics
- **Meetings** - Full list of meetings you can access
- **Search** - Search the meeting archive
- **Settings** - Admin-only configuration (only visible to Admins)

**Header Bar:**
- **Classification Badge** - Shows current classification context (always UNCLASSIFIED in header)
- **Theme Toggle** - Switch between light and dark mode
- **User Switcher** - (Development only) Not visible in production

---

## Admin Guide

### Overview

As an **Admin**, you have full access to all application features. Your primary responsibilities include:
- Configuring approval workflow settings
- Managing distribution channels (email, SharePoint, Teams cards)
- Monitoring system usage
- Viewing all meetings within your clearance level

### Key Admin Tasks

#### 1. Access the Settings Page

**Steps:**
1. Click **Settings** in the left navigation
2. You'll see the Settings dashboard with configuration cards

**What you see:**
- **Workflow Settings** card - Configure approval and distribution
- System information and status

**If Settings is not visible:**
- Check your Azure AD groups - you must be in `DOD-Role-Admin`
- Contact your Azure AD administrator to verify group membership

#### 2. Configure Approval Workflow

The approval workflow determines whether meeting minutes require manual approval before distribution.

**Steps:**
1. Go to **Settings** → **Workflow Settings** card
2. Find the **"Require Approval for Minutes"** toggle
3. Click the toggle to enable/disable approval requirement

**When Enabled (Default):**
- AI-generated minutes are marked as "Pending Review"
- Approvers must manually approve or reject
- Distribution occurs ONLY after approval

**When Disabled:**
- AI-generated minutes are automatically marked as "Approved"
- Distribution happens immediately (if channels enabled)
- No manual review required

**Use Cases:**
- **Enable** for sensitive meetings requiring human oversight
- **Disable** for routine meetings or testing environments

#### 3. Configure Distribution Channels

Control how approved meeting minutes are distributed to attendees.

**Available Channels:**

**Email Distribution:**
- **When Enabled:** Attendees receive email with minutes summary and document links
- **When Disabled:** No emails sent (silent approval)
- **Toggle:** "Enable Email Distribution"

**SharePoint Archival:**
- **When Enabled:** Minutes uploaded to SharePoint document library for long-term archival
- **When Disabled:** Minutes stored only in database
- **Toggle:** "Enable SharePoint Archival"

**Teams Card Notifications:**
- **When Enabled:** Attendees receive Adaptive Cards in Teams chat
- **When Disabled:** No Teams notifications
- **Toggle:** "Enable Teams Card Notifications"

**Steps to Configure:**
1. Go to **Settings** → **Workflow Settings** card
2. Toggle each channel on/off based on your needs
3. Changes are saved immediately
4. Success notification confirms the change

**Recommended Configurations:**

**Production Environment:**
- ✅ Require Approval: ON
- ✅ Email Distribution: ON
- ✅ SharePoint Archival: ON
- ✅ Teams Cards: ON

**Testing Environment:**
- ❌ Require Approval: OFF (faster testing)
- ✅ Email Distribution: OFF (avoid spam)
- ❌ SharePoint Archival: OFF (avoid clutter)
- ✅ Teams Cards: ON (test UI)

#### 4. View System Statistics

Monitor application usage and meeting processing status.

**Dashboard Statistics:**
- **Total Meetings** - All captured meetings in the system
- **Pending Minutes** - Meetings awaiting AI generation or approval
- **Completed Minutes** - Fully processed and approved meetings
- **Success Rate** - Percentage of successfully processed meetings

**Meeting List:**
- As an Admin, you see **ALL meetings** within your clearance level
- Not filtered to just meetings you attended
- Useful for monitoring system-wide activity

#### 5. Approve/Reject Minutes (Admin Can Also Approve)

Admins have the same approval capabilities as Approvers.

**See [Approver Guide](#approver-guide)** for detailed approval instructions.

### Admin Troubleshooting

**Problem: Settings page not visible**
- **Cause:** Not in `DOD-Role-Admin` Azure AD group
- **Solution:** Contact Azure AD administrator to add you to admin group
- **Verification:** Wait 15 minutes for cache refresh, or log out/in

**Problem: Changes to settings don't take effect**
- **Cause:** Browser cache or session issue
- **Solution:** Refresh the page (F5) or clear browser cache
- **Verification:** Check for success notification after toggle

**Problem: Can't see all meetings**
- **Cause:** Clearance level restriction
- **Solution:** You can only see meetings at or below your clearance level
- **Verification:** Check your clearance in Azure AD groups (e.g., `DOD-Clearance-SECRET`)

---

## Approver Guide

### Overview

As an **Approver**, your primary responsibility is to review and approve AI-generated meeting minutes before they're distributed to attendees. You ensure accuracy, completeness, and appropriateness of the minutes.

### Key Approver Tasks

#### 1. Find Pending Minutes

**Dashboard View:**
1. Go to **Dashboard**
2. Look for the **"Pending Minutes"** stat card
3. Click the number to see all pending minutes

**Meetings View:**
1. Go to **Meetings** in the left navigation
2. Look for meetings with status badge **"Pending Review"**
3. These are AI-generated minutes awaiting your approval

**What you see:**
- Meeting title and date
- Status badge: "Pending Review" (yellow/orange)
- Classification level badge
- Number of attendees

#### 2. Review Meeting Minutes

**Steps:**
1. Click on a meeting with **"Pending Review"** status
2. The meeting details modal opens
3. Review the following tabs:

**Overview Tab:**
- Meeting title, date, time, duration
- Attendee list
- Classification level
- Meeting organizer

**Minutes Tab:**
- **Summary** - High-level overview of the meeting
- **Key Discussions** - Main topics covered
- **Decisions Made** - Action items and conclusions
- **Action Items** - Assigned tasks with due dates
- Review each section for accuracy and completeness

**Attachments Tab:**
- Download preview documents (DOCX/PDF)
- Review formatting and completeness

#### 3. Approve Minutes

When the minutes are accurate and complete:

**Steps:**
1. In the meeting details modal (Minutes tab)
2. Click the **"Approve"** button (green)
3. Confirm the action if prompted
4. Success notification appears

**What happens after approval:**
- Meeting status changes to **"Approved"**
- If distribution channels are enabled:
  - ✅ Attendees receive email with minutes
  - ✅ Documents uploaded to SharePoint
  - ✅ Teams cards sent to attendees
- If distribution disabled: Minutes stored in database only

#### 4. Reject Minutes

When the minutes are inaccurate, incomplete, or inappropriate:

**Steps:**
1. In the meeting details modal (Minutes tab)
2. Click the **"Reject"** button (red)
3. (Optional) Provide feedback in the rejection dialog
4. Confirm the action

**What happens after rejection:**
- Meeting status changes to **"Rejected"**
- Minutes are NOT distributed to attendees
- System administrators are notified
- Minutes may be manually regenerated or edited

**When to reject:**
- Factual inaccuracies in discussions or decisions
- Missing critical information or attendees
- Inappropriate content or classification level
- AI hallucinations or fabricated details
- Sensitive information that should not be distributed

#### 5. Monitor Your Approval Queue

**Dashboard Statistics:**
- **Pending Minutes** count shows your approval queue
- Click the number to see all pending items

**Best Practices:**
- Review pending minutes within 24 hours of generation
- Prioritize high-classification meetings
- Use rejection sparingly - provide feedback when rejecting

### Approver Troubleshooting

**Problem: No pending minutes visible**
- **Cause:** No new meetings processed, or you're not an attendee
- **Solution:** Wait for new meetings to be captured and processed
- **Note:** Approvers only see meetings they attended (unless Admin/Auditor)

**Problem: Can't approve/reject (buttons grayed out)**
- **Cause:** Not in `DOD-Role-Approver` or `DOD-Role-Admin` group
- **Solution:** Contact Azure AD administrator
- **Verification:** Check your role in the user profile

**Problem: Approved minutes not distributed**
- **Cause:** Distribution channels disabled in Settings
- **Solution:** Contact Admin to enable email/SharePoint/Teams cards
- **Verification:** Check Settings page (Admin only)

---

## Auditor Guide

### Overview

As an **Auditor**, you have **view-only access** to all meetings within your clearance level. Your role is designed for compliance monitoring, oversight, and record-keeping. You cannot approve/reject minutes or modify any data.

### Key Auditor Tasks

#### 1. View All Meetings (Read-Only)

Unlike Viewers, you can see **all meetings** in the system, not just those you attended.

**Steps:**
1. Go to **Meetings** in the left navigation
2. You see ALL meetings within your clearance level
3. Meetings you didn't attend are still visible

**What you see:**
- All meetings regardless of attendance
- Full meeting details, minutes, and documents
- Approval status and history
- No ability to approve/reject or modify

#### 2. Search the Meeting Archive

Auditors commonly need to find specific meetings for compliance review.

**Steps:**
1. Go to **Search** in the left navigation
2. Use search filters:
   - **Keywords** - Search meeting titles, summaries, discussions
   - **Date Range** - Filter by meeting date
   - **Classification** - Filter by classification level (within your clearance)
   - **Status** - Filter by approval status (pending, approved, rejected)
3. Click **Search** to view results
4. Click any meeting to view full details

**Advanced Search Tips:**
- Use date ranges for compliance audits (e.g., "Last quarter")
- Filter by classification to review sensitive meetings
- Search for specific topics or keywords in discussions

#### 3. Download Meeting Documents

You can download DOCX and PDF versions of approved meeting minutes.

**Steps:**
1. Click on a meeting from the Meetings or Search page
2. Go to the **Attachments** tab
3. Click **Download DOCX** (editable) or **Download PDF** (archival)
4. Documents are saved to your Downloads folder

**Document Contents:**
- Title page with meeting metadata
- Attendee list
- Complete meeting minutes (summary, discussions, decisions)
- Action items with assignments
- Generated timestamp

#### 4. Monitor Approval Status

Track which meetings have been reviewed and approved.

**Status Badges:**
- **Pending Review** (Yellow) - Awaiting approver review
- **Approved** (Green) - Reviewed and approved
- **Rejected** (Red) - Rejected by approver
- **Processing** (Blue) - AI generation in progress

**Common Audit Tasks:**
- Verify all high-classification meetings are approved
- Check for rejected minutes (potential issues)
- Monitor processing delays

#### 5. Generate Compliance Reports

Use the search and filter features to generate ad-hoc compliance reports.

**Example Scenarios:**

**Quarterly Compliance Report:**
1. Go to **Search**
2. Set date range to last quarter (e.g., "Jan 1 - Mar 31")
3. Filter by classification: SECRET
4. Export results (manually document findings)

**Rejected Minutes Review:**
1. Go to **Meetings**
2. Filter by status: Rejected
3. Review rejection reasons
4. Document patterns or issues

### Auditor Troubleshooting

**Problem: Can't see all meetings**
- **Cause:** Clearance level restriction
- **Solution:** You can only see meetings at or below your clearance
- **Verification:** Check your clearance group (e.g., `DOD-Clearance-SECRET`)

**Problem: Can't approve/reject minutes**
- **Expected:** Auditors have read-only access
- **Solution:** This is correct - Auditors cannot modify data
- **Workaround:** Contact an Approver or Admin if action needed

**Problem: Download buttons not working**
- **Cause:** Meeting minutes not yet generated or approved
- **Solution:** Wait for approval process to complete
- **Verification:** Check meeting status badge

---

## Viewer Guide

### Overview

As a **Viewer**, you can view and download meeting minutes for meetings you attended. This is the default role for most users. You cannot approve/reject minutes or access Settings.

### Key Viewer Tasks

#### 1. View Your Meetings

You can only see meetings where you were listed as an attendee.

**Steps:**
1. Go to **Dashboard** or **Meetings**
2. You see only meetings you attended
3. Meetings are filtered automatically based on:
   - Your email in the attendee list
   - Your clearance level

**What you see:**
- Meeting title, date, time
- Attendee list (you're always included)
- Classification level badge
- Approval status

**What you DON'T see:**
- Meetings you didn't attend
- Meetings above your clearance level
- System-wide statistics

#### 2. Read Meeting Minutes

Review the AI-generated minutes for your attended meetings.

**Steps:**
1. Click on a meeting from the Meetings list
2. The meeting details modal opens
3. Navigate through the tabs:

**Overview Tab:**
- Meeting metadata (title, date, duration)
- Attendee list
- Classification level

**Minutes Tab:**
- **Summary** - High-level overview
- **Key Discussions** - Topics covered
- **Decisions Made** - Conclusions and action items
- **Action Items** - Assigned tasks (may include your assignments)

**Attachments Tab:**
- Download documents (DOCX/PDF)

#### 3. Download Meeting Documents

Download editable (DOCX) or archival (PDF) versions of the minutes.

**Steps:**
1. Open a meeting with status **"Approved"**
2. Go to the **Attachments** tab
3. Click **Download DOCX** (editable Word document)
   - OR -
4. Click **Download PDF** (read-only archival format)

**When to use DOCX:**
- You need to add personal notes
- Collaborative editing with teammates
- Extract content for reports

**When to use PDF:**
- Archival or official records
- Sharing with external parties
- Printing

#### 4. Search Your Meeting History

Find specific meetings from your attendance history.

**Steps:**
1. Go to **Search** in the left navigation
2. Enter keywords (meeting title, topics, attendees)
3. (Optional) Set date range filter
4. Click **Search**
5. Results show only meetings you attended

**Search Tips:**
- Search by attendee names to find meetings with specific colleagues
- Use date ranges for recent meetings (e.g., "Last 30 days")
- Search discussion topics or keywords from minutes

#### 5. Track Action Items

Monitor action items assigned to you from meetings.

**Steps:**
1. Open a meeting with approved minutes
2. Go to the **Minutes** tab
3. Scroll to **Action Items** section
4. Look for items assigned to your email

**Action Item Details:**
- Task description
- Assignee (your email)
- Due date
- Status (if tracked)

**Best Practice:**
- Review action items immediately after approval
- Add to your personal task tracker
- Follow up before due dates

### Viewer Troubleshooting

**Problem: Can't see a meeting I attended**
- **Cause 1:** Meeting classification above your clearance level
  - **Solution:** Request clearance upgrade from security office
- **Cause 2:** Your email not listed in attendee list
  - **Solution:** Contact meeting organizer to verify attendance
- **Cause 3:** Meeting not yet processed by AI
  - **Solution:** Wait 5-10 minutes after meeting ends

**Problem: Minutes showing "Pending Review"**
- **Cause:** Approval workflow enabled, waiting for approver
- **Solution:** Wait for approver to review and approve
- **Timeline:** Usually within 24-48 hours

**Problem: Download buttons grayed out**
- **Cause:** Minutes not yet approved
- **Solution:** Wait for approval process to complete
- **Verification:** Check status badge - must be "Approved"

---

## Common Tasks (All Roles)

### Understanding Meeting Status

Every meeting has a status badge indicating its current state:

| Status | Badge Color | Meaning | What's Next |
|--------|------------|---------|-------------|
| **Scheduled** | Gray | Meeting scheduled but not yet occurred | Wait for meeting to complete |
| **Processing** | Blue | AI is generating minutes from recording | Wait 5-10 minutes |
| **Pending Review** | Yellow/Orange | Minutes generated, awaiting approval | Approver must review |
| **Approved** | Green | Minutes approved and distributed | Download documents |
| **Rejected** | Red | Minutes rejected by approver | Admin will regenerate |
| **Failed** | Red | AI generation failed | Contact administrator |

### Understanding Classification Badges

Every meeting has a classification level that determines who can access it:

| Classification | Badge Color | Access |
|---------------|-------------|--------|
| **UNCLASSIFIED** | Green | All users |
| **CONFIDENTIAL** | Yellow | CONFIDENTIAL clearance and above |
| **SECRET** | Orange | SECRET clearance and above |
| **TOP SECRET** | Red | TOP SECRET clearance only |

**Your clearance level is shown in your user profile** (visible in header when clicked).

### Switching Between Light and Dark Mode

**Steps:**
1. Click the **Theme Toggle** icon in the header (sun/moon icon)
2. Theme switches immediately
3. Preference is saved automatically

**Dark Mode Benefits:**
- Reduced eye strain in low-light environments
- Better battery life on mobile devices
- Preferred by many users for long reading sessions

### Navigating the Teams Iframe

The app runs inside Microsoft Teams as an embedded iframe.

**Best Practices:**
- Click the **Meeting Minutes** icon in Teams sidebar to return to the app
- App maintains state when switching between Teams sections
- No need to refresh - app updates automatically
- If app freezes, click sidebar icon again to reload

### Providing Feedback

**For Issues or Bugs:**
- Contact your system administrator
- Provide screenshot and description
- Include meeting ID if relevant

**For Feature Requests:**
- Submit through your organization's IT ticketing system
- Provide use case and business justification

---

## Troubleshooting

### Common Issues (All Roles)

#### App Won't Load in Teams

**Symptoms:** Blank screen, loading forever, error message

**Solutions:**
1. Refresh Teams (Ctrl+R or Cmd+R)
2. Clear Teams cache: Settings → Privacy → Clear cache
3. Try different browser (Edge, Chrome, Firefox)
4. Check internet connection
5. Contact IT if issue persists

#### Can't See Expected Meetings

**Symptoms:** Meeting list is empty or incomplete

**Possible Causes & Solutions:**

**Clearance Level:**
- You can only see meetings at or below your clearance
- **Solution:** Check your clearance group in Azure AD

**Role Restriction (Viewers):**
- Viewers only see meetings they attended
- **Solution:** Verify you were listed as attendee

**Classification Filter:**
- Meeting might be above your clearance level
- **Solution:** Request clearance upgrade if justified

**Processing Delay:**
- Meeting just ended, minutes still generating
- **Solution:** Wait 5-10 minutes, refresh page

#### Authentication Errors

**Symptoms:** "Not authenticated" or "Session expired" messages

**Solutions:**
1. Log out of Teams completely
2. Close all Teams windows
3. Log back in to Teams
4. Reopen Meeting Minutes app
5. If issue persists, clear browser cache

#### Download Buttons Not Working

**Symptoms:** Can't download DOCX/PDF, buttons grayed out

**Possible Causes:**
- Minutes not yet approved (status must be "Approved")
- Document generation in progress (wait 30 seconds)
- Browser popup blocker (disable for Teams domain)
- Network connectivity issue

**Solutions:**
1. Check meeting status badge - must be "Approved"
2. Wait 30 seconds after approval
3. Disable popup blocker
4. Try different browser
5. Contact administrator if issue persists

#### Slow Performance

**Symptoms:** App is slow, pages take long to load

**Solutions:**
1. Close other browser tabs/apps
2. Check internet connection speed
3. Clear browser cache
4. Use wired connection instead of Wi-Fi
5. Contact IT if issue persists

### Role-Specific Issues

**Admin: Can't access Settings**
- Verify you're in `DOD-Role-Admin` Azure AD group
- Wait 15 minutes for cache refresh after group change
- Log out and log back in

**Approver: Can't approve/reject**
- Verify you're in `DOD-Role-Approver` group
- Check meeting status - must be "Pending Review"
- Verify you have appropriate clearance for the meeting

**Auditor: Can't see all meetings**
- You can only see meetings within your clearance level
- Request clearance upgrade if needed for compliance duties

**Viewer: No action items visible**
- Action items only visible for approved meetings
- Check if any items were assigned to you
- Contact meeting organizer if you expect assignments

---

## End-to-End Workflow Walkthroughs

This section provides complete walkthrough examples showing how different scenarios flow through the system, including how approval toggles affect the process.

---

### Workflow 1: Standard Meeting with Approval Required

**Scenario:** NAVY personnel conduct a SECRET-level meeting. Approval workflow is **enabled**.

**Step 1: Meeting Ends**
- Users conduct Teams meeting with recording enabled
- Meeting ends and recording stops
- **Automatic:** Microsoft Graph webhook notifies application within 1 minute

**Step 2: Background Processing (3-5 minutes)**
- **Automatic:** Job queue fetches recording and transcript from Microsoft Graph
- **Automatic:** Azure OpenAI GPT-4o analyzes transcript
- **Automatic:** AI generates meeting minutes with summary, discussions, decisions, action items
- **Result:** Meeting status changes to **"Pending Review"** (yellow badge)
- **Notification:** Teams Adaptive Card sent to approvers (if enabled)

**Step 3: Approver Review**
- Approver opens **Meetings** page and sees "Pending Review" meeting
- Approver clicks meeting to open details modal
- Approver reviews **Minutes** tab for accuracy
- Approver downloads preview documents (DOCX/PDF) from **Attachments** tab

**Step 4: Approval Decision**
- **If Approved:**
  - Approver clicks **"Approve"** button (green)
  - Status changes to **"Approved"** (green badge)
  - Distribution begins automatically
- **If Rejected:**
  - Approver clicks **"Reject"** button (red)
  - Status changes to **"Rejected"** (red badge)
  - No distribution occurs
  - System admin notified

**Step 5: Distribution (if approved + channels enabled)**
- **Email Distribution (if enabled):**
  - All attendees receive email with:
    - Meeting minutes summary
    - Links to download DOCX/PDF documents
    - Action items assigned to them
- **SharePoint Archival (if enabled):**
  - Documents uploaded to `Meeting Minutes` library
  - Organized by date and classification level
- **Teams Cards (if enabled):**
  - Attendees receive Adaptive Card in Teams chat
  - Card shows summary and quick actions

**Total Time:** 5-10 minutes from meeting end to distribution

---

### Workflow 2: Auto-Approval Enabled (Faster Testing)

**Scenario:** Testing environment with approval workflow **disabled**.

**Step 1: Meeting Ends**
- Same as Workflow 1

**Step 2: Background Processing (3-5 minutes)**
- Same AI generation as Workflow 1
- **DIFFERENT:** Status automatically set to **"Approved"** (no manual review)
- **Result:** Meeting status is **"Approved"** immediately (green badge)

**Step 3: Automatic Distribution**
- Distribution begins immediately (no approval step)
- Email, SharePoint, Teams cards sent (if channels enabled)
- **No human intervention required**

**Step 4: Post-Processing**
- Users can still view minutes on dashboard
- Admins can still monitor in Meetings page
- Documents available for download

**Total Time:** 3-5 minutes from meeting end to distribution (faster)

**Use Cases for Auto-Approval:**
- ✅ Testing and development environments
- ✅ Routine UNCLASSIFIED meetings
- ✅ Time-sensitive meeting summaries
- ❌ Classified meetings (should use manual approval)

---

### Workflow 3: Distribution Channels Disabled

**Scenario:** Admin wants to capture minutes but NOT distribute them (silent mode).

**Admin Configuration:**
1. Go to **Settings** → **Workflow Settings**
2. Set toggles:
   - ✅ Require Approval: ON
   - ❌ Email Distribution: OFF
   - ❌ SharePoint Archival: OFF
   - ❌ Teams Card Notifications: OFF

**What Happens:**
- Meeting captured and AI generates minutes (normal)
- Approver reviews and approves minutes (normal)
- **DIFFERENT:** No distribution occurs
- Minutes stored in database only
- Users can access via dashboard/search
- Documents available for manual download

**Use Cases:**
- 📝 Internal record-keeping only
- 📝 Draft minutes for later review
- 📝 Testing without sending notifications
- 📝 Highly sensitive meetings

---

### Workflow 4: Clearance-Based Access Control

**Scenario:** Understanding what different users see based on clearance levels.

**Meeting Classification:** SECRET

**User 1: Admin with TOP SECRET clearance**
- ✅ Sees this SECRET meeting (clearance allows)
- ✅ Can view, approve, download
- ✅ Sees ALL meetings (admin role + sufficient clearance)

**User 2: Approver with CONFIDENTIAL clearance**
- ❌ **Cannot see** this SECRET meeting (clearance insufficient)
- Reason: CONFIDENTIAL clearance only grants access to CONFIDENTIAL and UNCLASSIFIED
- Meeting does not appear in their Meetings list or Dashboard

**User 3: Viewer with SECRET clearance who attended meeting**
- ✅ Sees this SECRET meeting (clearance allows + attended)
- ✅ Can view and download
- ❌ Cannot approve (role restriction)

**User 4: Auditor with SECRET clearance who did NOT attend**
- ✅ Sees this SECRET meeting (clearance allows + auditor role)
- ✅ Can view and download
- ❌ Cannot approve (role restriction)

**Key Principle:** Clearance acts as a filter BEFORE role permissions apply.

---

### Workflow 5: Rejected Minutes Recovery

**Scenario:** Approver rejects minutes due to inaccuracy. What happens next?

**Step 1: Rejection**
- Approver reviews minutes and finds errors
- Approver clicks **"Reject"** button
- Optional: Provides rejection reason
- Status changes to **"Rejected"** (red badge)

**Step 2: Admin Notification**
- System admin receives notification of rejection
- Admin views rejected meeting in **Meetings** page
- Admin investigates rejection reason

**Step 3: Recovery Options**

**Option A: Manual Regeneration**
- Admin can trigger AI regeneration (if feature available)
- New minutes generated with different AI parameters
- Status resets to **"Pending Review"**
- Approver reviews new version

**Option B: Manual Editing (Future Feature)**
- Admin manually edits minutes in database
- Corrections made directly
- Approver reviews edited version

**Option C: Leave Rejected**
- If minutes are fundamentally flawed
- Keep status as "Rejected"
- Meeting remains in system for audit trail
- No distribution occurs

**Current Implementation:** Option C is default (rejected minutes remain rejected)

---

## Permission Troubleshooting Scenarios

This section provides specific troubleshooting guidance for common permission-related issues.

---

### Scenario 1: "Why can't I see a specific meeting?"

**Symptom:** You know a meeting exists, but it doesn't appear in your Meetings list or Dashboard.

**Possible Causes and Solutions:**

**Cause 1: Clearance Level Restriction**
- **Check:** What is the meeting's classification level?
- **Check:** What is your clearance level?
- **Solution:** You need clearance **equal to or higher** than the meeting classification
  - If meeting is SECRET, you need SECRET or TOP SECRET clearance
  - If meeting is CONFIDENTIAL, you need CONFIDENTIAL, SECRET, or TOP SECRET clearance

**How to verify your clearance:**
1. Ask your Azure AD administrator
2. Check your Azure AD group memberships (e.g., `DOD-Clearance-SECRET`)
3. If insufficient, request clearance upgrade (requires security review)

**Cause 2: Role Restriction (Viewer)**
- **Check:** Are you a Viewer?
- **Check:** Did you attend the meeting?
- **Solution:** Viewers can ONLY see meetings they attended
  - If you didn't attend, you cannot see it (even with correct clearance)
  - Admins and Auditors can see ALL meetings (within clearance)

**How to verify your role:**
1. Check which pages you can access in left navigation
2. If only **Dashboard**, **Meetings**, **Search** → You are a Viewer or Approver
3. If you also see **Settings** → You are an Admin

**Cause 3: Meeting Not Yet Processed**
- **Check:** Did the meeting just end?
- **Solution:** Wait 3-5 minutes for background processing to complete
- **Verification:** Check Dashboard for "Processing" or "Pending" status

---

### Scenario 2: "Why can't I approve meeting minutes?"

**Symptom:** You see a meeting with "Pending Review" status, but no Approve/Reject buttons appear.

**Possible Causes and Solutions:**

**Cause 1: Role Restriction**
- **Check:** What is your role?
- **Solution:** Only **Admin** and **Approver** roles can approve minutes
  - **Auditor** and **Viewer** roles are read-only
  - Contact your Azure AD administrator to add you to `DOD-Role-Approver` group

**How to verify:**
1. Open a meeting with "Pending Review" status
2. Go to **Minutes** tab
3. If you see Approve/Reject buttons → You have approval permissions
4. If you only see "Status: Pending Review" text → You are Auditor/Viewer

**Cause 2: Meeting Already Approved/Rejected**
- **Check:** Meeting status badge color
  - Green badge "Approved" → Already approved (no action needed)
  - Red badge "Rejected" → Already rejected (cannot re-approve)
- **Solution:** Once approved or rejected, status cannot be changed (by design)

**Cause 3: Clearance Level Insufficient**
- **Check:** Meeting classification vs. your clearance
- **Solution:** Even Approvers need appropriate clearance to approve
  - Cannot approve SECRET meetings with only CONFIDENTIAL clearance
  - Request clearance upgrade if needed

---

### Scenario 3: "Why is the Settings page not visible?"

**Symptom:** Left navigation only shows Dashboard, Meetings, Search. No Settings option.

**Possible Causes and Solutions:**

**Cause 1: Not an Admin**
- **Check:** Settings page is **Admin-only**
- **Solution:** Only users in `DOD-Role-Admin` Azure AD group can access Settings
- **How to get admin access:**
  1. Contact your Azure AD administrator
  2. Request addition to `DOD-Role-Admin` group
  3. Justify business need for admin access
  4. Wait 15 minutes for cache refresh after group change

**Cause 2: Cache Not Refreshed**
- **Check:** Were you recently added to admin group?
- **Solution:** Azure AD group cache refreshes every 15 minutes
- **Workaround:** Log out and log back in to force immediate cache refresh

**Verification:**
1. Ask your Azure AD admin to verify you're in `DOD-Role-Admin` group
2. Wait 15 minutes or log out/in
3. Refresh the page (F5)
4. Settings should appear in left navigation

---

### Scenario 4: "Why don't I see all meetings?"

**Symptom:** You are an Admin or Auditor, but you don't see all system meetings.

**Possible Causes and Solutions:**

**Cause 1: Clearance Level Filter**
- **Fact:** Even Admins/Auditors are restricted by clearance level
- **Example:** Admin with SECRET clearance cannot see TOP SECRET meetings
- **Solution:** If you need to see higher-classified meetings:
  1. Request clearance upgrade from security officer
  2. Requires security investigation and approval
  3. Not granted for convenience—legitimate need required

**Cause 2: Meetings Not Yet Captured**
- **Check:** Are there active Teams meetings with recording enabled?
- **Solution:** Application only captures meetings that:
  - Have recording enabled during the meeting
  - Are hosted by users in your tenant
  - Have webhook subscriptions active

**Cause 3: Webhook Subscription Expired**
- **Check:** Have webhooks expired (app down >48 hours)?
- **Solution:** Restart application to re-create webhook subscriptions
- **Admin Action Required:** Check Application Insights for webhook errors

---

### Scenario 5: "Why didn't attendees receive email/Teams cards?"

**Symptom:** Minutes approved, but attendees report not receiving notifications.

**Possible Causes and Solutions:**

**Cause 1: Distribution Channels Disabled**
- **Check:** Go to **Settings** → **Workflow Settings**
- **Verify:**
  - Is "Enable Email Distribution" toggled ON?
  - Is "Enable Teams Card Notifications" toggled ON?
- **Solution:** Enable the desired distribution channels
- **Note:** Changes only affect NEW approvals (not retroactive)

**Cause 2: Approval Workflow Disabled**
- **Check:** Is "Require Approval for Minutes" toggled OFF?
- **Scenario:** Auto-approval might send cards before you manually approved
- **Solution:** This is expected behavior when approval is disabled

**Cause 3: Email Delivery Failure**
- **Check:** Exchange Online service health
- **Check:** Application Insights logs for email send errors
- **Solution:** Verify SMTP configuration and Exchange permissions

**Cause 4: Teams Card Delivery Failure**
- **Check:** Application Insights logs for Teams Bot API errors
- **Common Issues:**
  - Tenant permissions not granted for bot
  - User does not have Teams app installed
  - Network/firewall blocking Teams API calls
- **Solution:** Contact system administrator to review logs

---

### Scenario 6: "Why can't I download documents?"

**Symptom:** Download buttons (DOCX/PDF) don't work or return errors.

**Possible Causes and Solutions:**

**Cause 1: Documents Not Generated Yet**
- **Check:** Meeting status
  - If status is "Processing" or "Pending Review" → Documents still generating
  - Wait for status to become "Approved" or "Pending Review" with preview available
- **Solution:** Wait 30-60 seconds for document generation to complete

**Cause 2: Browser Pop-up Blocker**
- **Check:** Browser console for blocked pop-up warnings
- **Solution:** Allow pop-ups for this domain in browser settings
- **Verification:** Try download again after allowing pop-ups

**Cause 3: SharePoint Permissions (if using SharePoint links)**
- **Check:** If documents are served from SharePoint
- **Solution:** Verify you have Read permissions on SharePoint library
- **Contact:** SharePoint administrator to grant access

---

### Scenario 7: "How do I change my role or clearance?"

**Symptom:** You need different permissions or access to higher-classified meetings.

**Process:**

**To Change Role:**
1. Contact your **Azure AD administrator**
2. Explain which role you need (Admin, Approver, Auditor, Viewer)
3. Provide business justification
4. Admin updates your Azure AD group membership
5. Wait 15 minutes for cache refresh (or log out/in)

**Azure AD Groups:**
- `DOD-Role-Admin` → Admin role
- `DOD-Role-Approver` → Approver role
- `DOD-Role-Auditor` → Auditor role
- `DOD-Role-Viewer` → Viewer role

**To Change Clearance:**
1. Contact your **Information Security Officer** or **Security Manager**
2. Submit clearance upgrade request
3. Undergo security investigation (if required)
4. Receive clearance approval
5. Security officer updates Azure AD group membership
6. Wait 15 minutes for cache refresh

**Azure AD Groups:**
- `DOD-Clearance-TOP_SECRET` → TOP SECRET clearance
- `DOD-Clearance-SECRET` → SECRET clearance
- `DOD-Clearance-CONFIDENTIAL` → CONFIDENTIAL clearance
- `DOD-Clearance-UNCLASSIFIED` → UNCLASSIFIED clearance

**Important:** Clearance changes require official approval and cannot be granted for convenience.

---

## Quick Reference

### Role Comparison at a Glance

| Feature | Admin | Approver | Auditor | Viewer |
|---------|:-----:|:--------:|:-------:|:------:|
| View own meetings | ✅ | ✅ | ✅ | ✅ |
| View all meetings | ✅ | ❌ | ✅ | ❌ |
| Approve/reject | ✅ | ✅ | ❌ | ❌ |
| Download docs | ✅ | ✅ | ✅ | ✅ |
| Access Settings | ✅ | ❌ | ❌ | ❌ |
| Configure workflow | ✅ | ❌ | ❌ | ❌ |

### Status Badge Quick Reference

| Badge | Meaning | User Action |
|-------|---------|-------------|
| 🔵 Processing | AI generating minutes | Wait 5-10 minutes |
| 🟡 Pending Review | Awaiting approval | Approver should review |
| 🟢 Approved | Ready to use | Download documents |
| 🔴 Rejected | Needs attention | Contact administrator |

### Clearance Level Quick Reference

| Your Clearance | Can Access |
|----------------|------------|
| UNCLASSIFIED | UNCLASSIFIED only |
| CONFIDENTIAL | CONFIDENTIAL, UNCLASSIFIED |
| SECRET | SECRET, CONFIDENTIAL, UNCLASSIFIED |
| TOP SECRET | All meetings |

### Contact Information

**For Technical Issues:**
- Contact your IT Help Desk
- Provide meeting ID and screenshot if applicable

**For Role/Clearance Changes:**
- Contact your Azure AD administrator
- Request specific group membership changes

**For Security Concerns:**
- Contact your Information Security Officer
- Do not share sensitive information via email

---

## Appendix: Approval Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Meeting Ends in Teams                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          Webhook Triggers Background Processing              │
│  • Fetch recording and transcript from Microsoft Graph       │
│  • Extract attendees and metadata                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Generates Meeting Minutes                    │
│  • Azure OpenAI GPT-4o processes transcript                  │
│  • Extracts summary, discussions, decisions, action items    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
              ┌──────┴──────┐
              │  Approval   │
              │  Required?  │
              └──────┬──────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    YES  │                       │  NO
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Status:         │    │ Status:         │
│ Pending Review  │    │ Approved        │
│                 │    │ (auto-approved) │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      │
┌─────────────────┐             │
│ Approver        │             │
│ Reviews Minutes │             │
└────────┬────────┘             │
         │                      │
    ┌────┴────┐                 │
    │         │                 │
Approve    Reject               │
    │         │                 │
    │         ▼                 │
    │  ┌─────────────┐          │
    │  │ Status:     │          │
    │  │ Rejected    │          │
    │  │ (no dist.)  │          │
    │  └─────────────┘          │
    │                           │
    └───────────┬───────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Distribution (if channels enabled)              │
│  ✅ Email to attendees (if enabled)                          │
│  ✅ Upload to SharePoint (if enabled)                        │
│  ✅ Teams Adaptive Cards (if enabled)                        │
└─────────────────────────────────────────────────────────────┘
```

---

**End of User Guide**

For deployment and technical documentation, see:
- `AZURE_DEPLOYMENT_GUIDE.md` - Azure deployment procedures
- `DEPLOYMENT_ARCHITECTURE.md` - Technical architecture
- `20_USER_PILOT_TESTING_GUIDE.md` - Testing procedures
