# Teams Meeting Minutes - User Guide

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Audience:** End Users  
**Platform:** Azure Commercial Cloud (Not applicable to Azure Government or other sovereign clouds)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Managing Meetings](#managing-meetings)
5. [Viewing Meeting Minutes](#viewing-meeting-minutes)
   - [Managing Action Item Status](#managing-action-item-status)
6. [Viewing Meeting History](#viewing-meeting-history)
7. [Approving Minutes](#approving-minutes)
8. [Exporting Documents](#exporting-documents)
9. [Archive](#archive)
10. [Tips and Best Practices](#tips-and-best-practices)

---

## Introduction

Teams Meeting Minutes is an AI-powered application that automatically captures your Microsoft Teams meetings and generates professional meeting minutes. The app:

- **Automatically detects** when your Teams meetings end
- **Transcribes** the meeting audio (requires Teams transcription enabled)
- **Generates AI-powered minutes** including summary, key discussions, decisions, and action items
- **Supports approval workflows** for review before distribution
- **Exports to DOCX and PDF** formats
- **Archives to SharePoint** for long-term storage

### Who Should Use This Guide

This guide is for **end users** who will use the Teams Meeting Minutes app in their daily work. For installation and technical configuration, see the [Administrator Guide](ADMIN_GUIDE.md) and [Installation Manual](INSTALLATION_MANUAL.md).

---

## Getting Started

### Accessing the App

1. Open **Microsoft Teams** (desktop, web, or mobile)
2. Look for **"Meeting Minutes"** in the left sidebar

   ![Screenshot: Meeting Minutes app in Teams sidebar]
   *Location: Left sidebar, look for the "M" icon*

3. Click on the app to open it

### First-Time Login

When you first open the app, it will:

1. Automatically authenticate you using your Microsoft 365 account
2. Display your assigned role (Viewer, Approver, Auditor, or Admin)
3. Show meetings you have access to based on your permissions

   ![Screenshot: First login showing user role]
   *Your role determines what actions you can take*

### Understanding Your Role

| Role | Can View Meetings | Can Approve | Can Edit Settings | Can View All Meetings |
|------|-------------------|-------------|-------------------|----------------------|
| Viewer | Yes (own meetings) | No | No | No |
| Approver | Yes | Yes | No | No |
| Auditor | Yes (read-only) | No | No | Yes |
| Admin | Yes | Yes | Yes | Yes |

---

## Dashboard Overview

The Dashboard is your home screen when you open the app.

![Screenshot: Dashboard overview]

### Stats Cards

At the top, you'll see four summary cards:

| Card | Description |
|------|-------------|
| **Total Meetings** | All meetings captured by the system |
| **Pending Minutes** | Minutes waiting to be generated |
| **Completed** | Minutes that have been fully processed |
| **Archived** | Minutes stored in SharePoint |

### Recent Meetings

Below the stats, you'll see your most recent meetings with:

- **Meeting title** - The name of the meeting
- **Date and time** - When the meeting occurred
- **Duration** - How long the meeting lasted
- **Attendees** - Number of participants
- **Status badge** - Current status (Scheduled, Completed, Archived)
- **Classification** - Security classification (UNCLASSIFIED, CONFIDENTIAL, etc.)

![Screenshot: Recent meetings list]

### Pagination

Meetings are displayed **5 per page** to improve performance and readability:

- Use the **Previous** and **Next** buttons (arrow icons) to navigate between pages
- The current page indicator shows "Page X of Y"
- Page navigation is available on both the Dashboard and Meetings tabs

### Searching Meetings

Use the **Search** box to find specific meetings:

1. Click the search box (magnifying glass icon)
2. Type the meeting title or keywords
3. Results filter as you type

![Screenshot: Search functionality]

### Hiding and Restoring Meetings

You can hide meetings from your view without deleting them:

1. **To hide a meeting**: Click the **Hide** button (eye-off icon) on any meeting card
2. A notification confirms the meeting has been hidden
3. **To view hidden meetings**: Toggle the **"Show hidden"** switch in the toolbar
4. Hidden meetings appear dimmed with a "(Hidden)" label
5. **To restore a hidden meeting**: Click the **Restore** button (eye icon) on the hidden meeting
6. The meeting will return to your normal list

> **Note**: Hiding a meeting only affects your view. Other users can still see the meeting in their lists.

---

## Managing Meetings

### Viewing Meeting Details

1. From the Dashboard or Meetings tab, click on any meeting
2. The meeting detail view opens showing:
   - Full meeting information
   - Attendee list
   - Generated minutes (if available)
   - Action items

![Screenshot: Meeting detail view]

### Meeting Statuses

| Status | Meaning | Next Step |
|--------|---------|-----------|
| **Scheduled** | Meeting is planned but hasn't happened yet | Wait for meeting to occur |
| **In Progress** | Meeting is currently happening | Wait for meeting to end |
| **Completed** | Meeting ended, minutes generated | Review and approve |
| **Archived** | Stored in SharePoint | View in archive |

### Filtering Meetings

On the **Meetings** tab, you can filter by:

- **Status** - Show only completed, pending, etc.
- **Date range** - Filter by time period
- **Classification** - Filter by security level

![Screenshot: Meeting filters]

---

## Viewing Meeting Minutes

### Accessing Generated Minutes

1. Click on a meeting with status **"Completed"** or with **"Minutes available"** badge
2. Scroll down to the **Minutes** section
3. Review the generated content:

   - **Summary** - AI-generated overview of the meeting
   - **Key Discussions** - Important topics covered
   - **Decisions** - Agreements and conclusions reached
   - **Action Items** - Tasks assigned with owners and due dates

![Screenshot: Generated minutes view]

### Understanding Action Items

Action items are automatically extracted from the meeting:

| Field | Description |
|-------|-------------|
| **Task** | What needs to be done |
| **Assignee** | Who is responsible |
| **Due Date** | When it should be completed |
| **Priority** | High, Medium, or Low |
| **Status** | Pending, In Progress, or Completed |

![Screenshot: Action items list]

### Managing Action Item Status

You can update the status of action items to track their progress:

1. Open the meeting details and click the **Action Items** tab
2. Locate the action item you want to update
3. Click the **Status** dropdown on that item
4. Select the new status:
   - **Pending** - Not yet started
   - **In Progress** - Currently being worked on
   - **Completed** - Task finished

![Screenshot: Action item status dropdown]

When you change a status:
- A confirmation message appears
- The change is saved immediately
- An event is recorded in the History tab for audit purposes

---

## Viewing Meeting History

The **History** tab provides a complete audit trail of all actions taken on a meeting.

### Accessing the History Tab

1. Open any meeting's detail view
2. Click the **History** tab (clock icon)
3. View the timeline of events

### Understanding the Event Timeline

The timeline shows events in chronological order (newest first):

| Event Type | Description |
|------------|-------------|
| **Minutes Generated** | AI completed generating meeting minutes |
| **Minutes Approved** | An approver accepted the minutes |
| **Minutes Rejected** | An approver declined the minutes (includes reason) |
| **Email Sent** | Minutes were distributed via email |
| **Archived to SharePoint** | Minutes were saved to document library |
| **Action Item Updated** | Someone changed an action item's status |

### Event Details

Each event in the timeline shows:

- **Icon** - Visual indicator of the event type
- **Title** - What happened (e.g., "Minutes Approved")
- **Description** - Additional details or context
- **Timestamp** - When the event occurred
- **Actor** - Who performed the action (name and email)

![Screenshot: History timeline]

### Using History for Auditing

The History tab helps you:

- **Track who approved** minutes and when
- **See rejection reasons** if minutes were declined
- **Monitor action item progress** through status changes
- **Verify distribution** of minutes via email
- **Confirm archival** to SharePoint

---

## Approving Minutes

*Note: Only users with Approver or Admin roles can approve minutes.*

### Approval Workflow

1. Navigate to a meeting with **"Pending Review"** status
2. Review the generated minutes carefully
3. Choose one of three actions:

   - **Approve** - Accept the minutes as-is
   - **Request Revision** - Send back for changes with comments
   - **Reject** - Decline the minutes entirely

![Screenshot: Approval workflow buttons]

### Approving Minutes

1. Click the **Approve** button (green checkmark)
2. Confirm the approval in the dialog
3. Minutes status changes to **"Approved"**

![Screenshot: Approve confirmation dialog]

### Requesting Revisions

1. Click **Request Revision** button
2. Enter your comments explaining what changes are needed
3. Click **Submit**
4. The meeting organizer will be notified

![Screenshot: Revision request dialog]

### Rejecting Minutes

1. Click **Reject** button
2. Provide a reason for rejection (required)
3. Click **Submit**
4. The meeting organizer will be notified

---

## Exporting Documents

### Available Formats

| Format | Best For |
|--------|----------|
| **DOCX** | Editing, sharing for review |
| **PDF** | Final distribution, printing |

### Downloading Documents

1. Open a meeting with approved minutes
2. Look for the **Export** section or buttons
3. Click **Download DOCX** or **Download PDF**
4. The file will download to your computer

![Screenshot: Export buttons]

### Email Distribution

If configured by your administrator:

1. Click **Send via Email**
2. Select recipients or use the default attendee list
3. Add an optional message
4. Click **Send**

![Screenshot: Email distribution dialog]

---

## Archive

### Accessing Archived Minutes

1. Click the **Archive** tab in the top navigation
2. Browse or search archived meetings
3. Click on any meeting to view its archived minutes

![Screenshot: Archive tab]

### SharePoint Integration

Archived minutes are automatically stored in your organization's SharePoint:

- Minutes are saved in both DOCX and PDF format
- Original meeting metadata is preserved
- Access is controlled by SharePoint permissions

---

## Tips and Best Practices

### For Best Results

1. **Enable Teams Transcription**
   - Before the meeting starts, click the "..." menu
   - Select "Start transcription"
   - This provides the AI with the meeting content

2. **Use Clear Meeting Titles**
   - Descriptive titles help organize your meetings
   - Example: "Q4 Budget Review - Finance Team" instead of "Team Call"

3. **Identify Action Items Clearly**
   - Say "Action item: [person] will [task] by [date]"
   - The AI picks up these patterns

4. **Review Before Approving**
   - Always review AI-generated content for accuracy
   - The AI may occasionally misinterpret discussions

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Meeting not appearing | Wait 5-10 minutes after meeting ends |
| No minutes generated | Check if transcription was enabled |
| Minutes seem incomplete | Meeting may have been too short (<5 min) |
| Can't approve | Check your role permissions with admin |

### Getting Help

If you experience issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Contact your IT administrator
3. Refer to the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) for technical issues

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + F` | Open search |
| `Escape` | Close dialogs |

---

## Glossary

| Term | Definition |
|------|------------|
| **Action Item** | A task assigned to a person with a due date |
| **Approval Workflow** | Process of reviewing and accepting minutes |
| **Classification** | Security level of the meeting (UNCLASSIFIED, etc.) |
| **Enrichment** | Process of fetching transcripts after meeting ends |
| **OBO Flow** | Technical process for secure authentication |
| **Transcription** | Converting meeting audio to text |

---

*Last Updated: December 4, 2025*
*Version: 1.1*

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | Dec 4, 2025 | Added: Managing Action Item Status, Viewing Meeting History (audit trail) |
| 1.0 | Dec 3, 2025 | Initial release |
