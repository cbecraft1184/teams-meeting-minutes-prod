# Demo Guest Invitation Guide

This guide explains how to invite external users (with any email address) to participate in a Meeting Minutes demo.

## Overview

The Meeting Minutes app now supports **multi-tenant authentication**, allowing users from:
- Your organization (user@ChrisBecraft.onmicrosoft.com)
- Other Microsoft 365 organizations (user@company.com)
- Personal Microsoft accounts (user@gmail.com, user@outlook.com)
- Azure AD B2B guests

## Step 1: Invite Demo Participants as Guests

For users with non-organizational emails (like Gmail), invite them as Azure AD B2B guests:

### Method A: Direct Invitation via Azure Portal

1. Go to **Azure Portal** → **Microsoft Entra ID** → **Users**
2. Click **+ New user** → **Invite external user**
3. Fill in the **Basics** tab:
   - **Email**: Enter their email address (e.g., `john@gmail.com`)
   - **Display name**: Enter their name
4. Click **Properties** tab (optional) - add any additional info
5. Click **Assignments** tab (optional) - assign to groups if needed
6. Click **Review + invite**
7. **Important**: On the review page, ensure **Send invite message** is checked
8. Click **Invite**

The user will receive an email invitation from Microsoft. When they click **Accept invitation**, Azure creates a guest account for them.

**If the guest didn't receive an email:**
- Check their spam/junk folder for email from "Microsoft Invitations"
- Resend: Go to **Users** → find the guest → click **Resend invite**
- Alternative: Copy the **Redemption URL** from the guest's profile and send it manually

### Method B: Invite via Teams Meeting

1. Schedule a Teams meeting
2. Add external email addresses as attendees
3. When they join the meeting for the first time, they'll be prompted to create/link a Microsoft account

## Step 2: Grant App Access to Guests

### Option A: Enable Guest Access Org-Wide

1. Go to **Teams Admin Center** → **Users** → **Guest access**
2. Toggle **Allow guest access in Teams** to **On**
3. Under **Calling**, **Meeting**, and **Messaging**, configure allowed actions

### Option B: App Permission Policy for Guests

1. Go to **Teams Admin Center** → **Teams apps** → **Permission policies**
2. Select **Global (Org-wide default)** or create a custom policy
3. Under **Third-party apps** or **Custom apps**, ensure the Meeting Minutes app is allowed
4. Assign the policy to guest users if using a custom policy

## Step 3: Pre-Install the App for Demo Users

### For Organizational Users

1. Go to **Teams Admin Center** → **Teams apps** → **Setup policies**
2. Edit **Global (Org-wide default)** policy
3. Under **Installed apps**, click **+ Add apps**
4. Search for "Meeting Minutes" and add it
5. Under **Pinned apps**, add "Meeting Minutes" to pin it to the sidebar
6. Save changes (takes 2-24 hours to propagate)

### For Guest Users

Guest users can manually install the app:
1. Open Teams
2. Click **Apps** (... icon) in the sidebar
3. Search for "Meeting Minutes"
4. Click **Add**
5. Right-click the app → **Pin**

## Step 4: Schedule the Demo Meeting

1. Open Microsoft Teams
2. Go to **Calendar** → **New meeting**
3. Add all participants (org users and guests)
4. **Enable transcription** in meeting options:
   - Click **Meeting options** → **Record and transcribe**
   - Enable **Transcription**
5. Save the meeting

## Step 5: During the Demo

1. **Start the meeting** - All participants join
2. **Enable transcription** if not auto-started (click ••• → Start transcription)
3. **Conduct the meeting** - Discuss agenda items, make decisions
4. **End the meeting** - This triggers the Meeting Minutes app

## Step 6: After the Meeting

1. The Meeting Minutes app automatically:
   - Detects the meeting ended (via callRecords webhook)
   - Fetches the transcript from Microsoft Graph
   - Generates AI-powered minutes using Azure OpenAI
   - Creates the meeting record in the app

2. **Participants access minutes:**
   - Open the Meeting Minutes app in Teams
   - View their meetings in the dashboard
   - Review/approve/reject the generated minutes

## Access Control

| User Type | What They See |
|-----------|---------------|
| Regular user | Only meetings they created or were invited to |
| Admin/Auditor | All meetings (subject to clearance level) |
| Guest user | Only meetings they were invited to |

## Troubleshooting

### Guest Can't See the App
- Verify guest access is enabled in Teams Admin Center
- Check app permission policies allow guests
- Have guest manually install via Teams Apps

### Guest Can't See Meetings
- Ensure guest was invited to the Teams meeting
- Guest must use the same email they were invited with
- Check if guest account is properly created in Azure AD

### Authentication Errors
- Have user sign out and sign back in
- Clear browser cache if using Teams web
- Verify Azure AD app is set to multi-tenant (signInAudience: AzureADMultipleOrgs)

## Quick Checklist for 10-Person Demo

- [ ] Azure AD app set to multi-tenant (done via manifest)
- [ ] App v1.0.21 deployed with multi-tenant code
- [ ] Guest access enabled in Teams Admin Center
- [ ] 10 participants invited (org users or B2B guests)
- [ ] Teams meeting scheduled with transcription enabled
- [ ] Meeting Minutes app installed/pinned for users
- [ ] Test sign-in with one guest before the demo
