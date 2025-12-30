# Demo User Setup Guide

**Last Updated:** December 30, 2025  
**Version:** 1.0.24

This guide explains how to set up demo participants as internal tenant members for the Meeting Minutes application demo.

## Overview

For demo participants to have full access to the Meeting Minutes app (including seeing pinned apps in the Teams sidebar), they must be set up as **internal tenant members** rather than B2B guests. This approach provides:

- Full Teams app visibility (pinned apps appear in sidebar)
- Complete SharePoint and email access
- Consistent authentication experience
- No guest-related limitations

## Prerequisites

- Global Administrator access to Microsoft 365 Admin Center
- Microsoft 365 Business Basic licenses (minimum $6/user/month) or higher
- Access to Azure Portal for user management

## Method 1: Create New Internal User (Recommended for New Participants)

### Step 1: Create User in Microsoft 365 Admin Center

1. Go to **Microsoft 365 Admin Center**: https://admin.microsoft.com
2. Navigate to **Users** → **Active users**
3. Click **Add a user**
4. Fill in the user details:
   - **First name:** [User's first name]
   - **Last name:** [User's last name]
   - **Display name:** [Full name]
   - **Username:** [username]@ChrisBecraft.onmicrosoft.com
5. Under **Product licenses**, assign **Microsoft 365 Business Basic**
6. Set a temporary password
7. Click **Finish adding**

### Step 2: Record Credentials

Save the following for each user:
- Sign-in email: `username@ChrisBecraft.onmicrosoft.com`
- Temporary password: [auto-generated or custom]

## Method 2: Convert B2B Guest to Internal User (For Existing Guests)

If you previously invited users as B2B guests, convert them to internal members:

### Step 1: Open Azure Portal

1. Go to **Azure Portal**: https://portal.azure.com
2. Navigate to **Microsoft Entra ID** → **Users**
3. Find and click on the guest user

### Step 2: Convert User

1. In the user's profile, look for **B2B collaboration** section
2. Click **Convert to internal user**
3. Enter a new user principal name (e.g., `firstname.lastname`)
4. Domain will be `@ChrisBecraft.onmicrosoft.com`
5. Check **Auto-generate password**
6. Click **Convert**
7. **Save the generated password** to send to the user

### Step 3: Assign License

After conversion:
1. Go to **Microsoft 365 Admin Center**
2. Find the converted user under **Active users**
3. Click on the user → **Licenses and apps**
4. Assign **Microsoft 365 Business Basic** license
5. Save changes

## License Requirements

| License | Price | Suitable for Demo? |
|---------|-------|-------------------|
| Microsoft 365 Business Basic | ~$6/user/month | ✅ Yes (recommended) |
| Microsoft 365 Business Standard | ~$12/user/month | ✅ Yes |
| Microsoft 365 E3/E5 | $36+/user/month | ✅ Yes |

**Microsoft 365 Business Basic** provides everything needed:
- Microsoft Teams access
- Exchange email
- SharePoint access
- Web versions of Office apps

## Onboarding Demo Users via Teams Chat

Send the following message to each demo user via Teams Chat:

```
Hi [First Name]!

You're all set for the Meeting Minutes demo. Here are your new account details:

📧 Sign-in: [username]@ChrisBecraft.onmicrosoft.com
🔑 Password: [password]

Quick setup:
1. Sign out of Teams
2. Sign back in with the credentials above
3. Change your password when prompted
4. Look for "Meeting Minutes" in your left sidebar (or click "..." to find it)

💡 Tip: Use Teams Desktop for the best experience. If using web, just click "Show the app anyway" if you see a warning.

Let me know once you're in and I'll walk you through a quick demo!
```

### Follow-up Message (if they need help finding the app)

```
Can't find the app? Try this:
1. Click the "..." (More apps) in your sidebar
2. Search for "Meeting Minutes"
3. Right-click and select "Pin" to keep it visible

If it's still not showing, the app policy may still be syncing - can take up to 24 hours. Let me know and we can try again later.
```

### Welcome Message (once they're in)

```
Great, you're in! Here's what you'll see:
• Dashboard - Overview of your meetings
• Meetings - List of captured meetings with AI-generated minutes
• Archive - Approved minutes stored in SharePoint

Try clicking on a meeting to see the AI-generated minutes. You can review, edit, approve, and export to Word/PDF.

Any questions as you explore?
```

## App Pinning (Admin Setup)

To ensure the app appears in users' sidebars automatically:

1. Go to **Teams Admin Center**: https://admin.teams.microsoft.com
2. Navigate to **Teams apps** → **Setup policies**
3. Edit **Global (Org-wide default)** policy
4. Under **Pinned apps**, click **+ Add apps**
5. Search for "Meeting Minutes" and add it
6. Move it to the desired position in the sidebar
7. Save changes

**Note:** Policy propagation takes 2-24 hours.

## Scheduling Demo Meetings

### Enable Transcription

For meetings to be processed by the app, transcription must be enabled:

1. Schedule a Teams meeting
2. Open **Meeting options** before or during the meeting
3. Enable **Transcription** under "Record and transcribe"
4. Save

### During the Demo Meeting

1. Start the meeting - All participants join
2. Verify transcription is active (you'll see "Transcription has started")
3. Conduct discussion - Cover agenda items, make decisions
4. End the meeting - This triggers automatic processing

### After the Meeting

Processing timeline:
- **5-10 minutes:** Meeting detected and transcript fetched
- **10-15 minutes:** AI generates meeting minutes
- **Available in app:** View, review, approve, and export

## Troubleshooting

### User Can't See the App in Sidebar

| Cause | Solution |
|-------|----------|
| Policy not yet propagated | Wait up to 24 hours after policy change |
| User not internal member | Convert from guest to internal user |
| License not assigned | Assign Microsoft 365 Business Basic |
| App not pinned | Check Teams Admin Center setup policy |

**Workaround:** User can click "..." → search for "Meeting Minutes"

### "This app may have issues in web version" Warning

This is a known Microsoft warning for custom Teams apps in the web client.

**Solutions:**
- Click **"Show the app anyway"** - the app works fine
- Use **Teams Desktop** for the best experience

### User Can't Sign In

| Error | Solution |
|-------|----------|
| Invalid credentials | Verify username includes full domain |
| Account disabled | Enable in Microsoft 365 Admin Center |
| License expired | Renew or reassign license |

### Meetings Not Appearing

| Cause | Solution |
|-------|----------|
| Meeting still processing | Wait 5-15 minutes after meeting ends |
| Transcription not enabled | Enable transcription in meeting options |
| User not attendee | User must be meeting organizer or attendee |

## Quick Setup Checklist

- [ ] Demo users created as internal tenant members
- [ ] Microsoft 365 Business Basic licenses assigned
- [ ] Meeting Minutes app pinned in Teams Admin Center (allow 24h propagation)
- [ ] Credentials sent to users via Teams Chat
- [ ] Test sign-in verified with at least one user
- [ ] Demo meeting scheduled with transcription enabled

## Reference Information

| Item | Value |
|------|-------|
| App Name | Meeting Minutes |
| App ID | 6d94baf3-1ed6-4d34-8401-71c724305571 |
| App Version | 1.0.24 |
| Tenant Domain | ChrisBecraft.onmicrosoft.com |
| Production URL | https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io |
| Teams Deep Link | https://teams.microsoft.com/l/app/6d94baf3-1ed6-4d34-8401-71c724305571 |

---

**Document Control**

| Version | Date | Changes |
|---------|------|---------|
| 1.0.24 | Dec 30, 2025 | Complete rewrite for internal tenant member approach |
| 1.0.21 | Dec 2025 | Original B2B guest approach (deprecated) |
