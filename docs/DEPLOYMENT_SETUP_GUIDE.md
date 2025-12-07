# Deployment Setup Guide

## Step-by-Step Instructions for Email & SharePoint Configuration

This guide walks you through setting up the Email Distribution and SharePoint Archive features using your Office 365 Business account.

---

## Step 1: Configure GRAPH_SENDER_EMAIL

The sender email is the "From" address that will appear when meeting minutes are sent. You can use any licensed mailbox in your Office 365 tenant.

### Option A: Use Your Own Email (Simplest)

Use your Office 365 Business email address (e.g., `yourname@yourcompany.com`).

**Pros**: Quick to set up, no additional configuration
**Cons**: Emails appear to come from you personally

### Option B: Create a Shared Mailbox (Recommended for Production)

1. Go to **Microsoft 365 Admin Center**: https://admin.microsoft.com
2. Click **Teams & groups** > **Shared mailboxes**
3. Click **Add a shared mailbox**
4. Enter:
   - **Name**: Meeting Minutes System
   - **Email**: `meetingminutes@yourcompany.com` (or similar)
5. Click **Add**
6. Wait a few minutes for the mailbox to be created

**Pros**: Professional appearance, separates system emails from personal emails
**Cons**: Takes a few extra minutes to set up

### What to Put in Azure

Once you've decided which email to use:

```
GRAPH_SENDER_EMAIL = yourname@yourcompany.com
```
or
```
GRAPH_SENDER_EMAIL = meetingminutes@yourcompany.com
```

---

## Step 2: Configure SharePoint Site and Library

### 2A: Find Your SharePoint Site URL

1. Go to **SharePoint** in your Office 365: https://yourtenant.sharepoint.com
2. Navigate to the site where you want to store meeting minutes
   - This could be an existing team site or a new site
3. Copy the URL from your browser's address bar
   - It should look like: `https://yourcompany.sharepoint.com/sites/MeetingMinutes`

### 2B: Choose or Create a Document Library

1. In your SharePoint site, click **Documents** in the left sidebar (or create a new library)
2. Note the library name (usually "Documents" or a custom name you created)
3. (Optional) Add custom columns for metadata:
   - Click the gear icon > **Library settings** > **Create column**
   - Add these columns:
     - **Classification** (Single line of text)
     - **MeetingDate** (Date and Time)
     - **AttendeeCount** (Number)
     - **MeetingID** (Single line of text)

### What to Put in Azure

```
SHAREPOINT_SITE_URL = https://yourcompany.sharepoint.com/sites/MeetingMinutes
SHAREPOINT_LIBRARY = Documents
```

---

## Step 3: Grant Azure AD App Permissions

Your Azure AD app needs permission to send emails and upload to SharePoint.

### 3A: Navigate to Azure Portal

1. Go to **Azure Portal**: https://portal.azure.com
2. Search for **App registrations** in the search bar
3. Find your app (search for "teams-minutes" or similar)
4. Click on your app to open it

### 3B: Add Mail.Send Permission

1. Click **API permissions** in the left menu
2. Click **Add a permission**
3. Click **Microsoft Graph**
4. Click **Application permissions** (not Delegated)
5. Search for `Mail.Send`
6. Check the box next to **Mail.Send**
7. Click **Add permissions**

### 3C: Add SharePoint Permission

1. Still in **API permissions**, click **Add a permission** again
2. Click **Microsoft Graph**
3. Click **Application permissions**
4. Search for `Sites.ReadWrite.All`
5. Check the box next to **Sites.ReadWrite.All**
6. Click **Add permissions**

### 3D: Grant Admin Consent

1. After adding both permissions, you'll see them listed with a warning icon
2. Click the button **Grant admin consent for [Your Organization]**
3. Click **Yes** to confirm
4. The warning icons should turn to green checkmarks

### Permission Summary

After completing this step, your app should have:

| Permission | Type | Status |
|------------|------|--------|
| Mail.Send | Application | Granted |
| Sites.ReadWrite.All | Application | Granted |
| (plus your existing permissions) | | |

---

## Step 4: Add Environment Variables to Azure Container App

### 4A: Navigate to Your Container App

1. Go to **Azure Portal**: https://portal.azure.com
2. Search for **Container Apps**
3. Find and click on your container app (e.g., `teams-minutes-app`)

### 4B: Add the Environment Variables

1. Click **Secrets** in the left menu under Settings
2. Add new secrets (click **+ Add**):

| Name | Value |
|------|-------|
| `GRAPH_SENDER_EMAIL` | Your sender email (from Step 1) |
| `SHAREPOINT_SITE_URL` | Your SharePoint URL (from Step 2) |
| `SHAREPOINT_LIBRARY` | Your library name (from Step 2) |

3. Click **Save**

4. Then go to **Containers** > **Environment variables**
5. Add the secrets as environment variables:
   - For each secret, add a reference like: `secretref:graph-sender-email`

6. Click **Save** at the top

### 4C: Restart the Container

1. Go to **Overview** in the left menu
2. Click **Restart** to apply the new environment variables
3. Wait for the app to restart (usually 1-2 minutes)

---

## Step 5: Verify Configuration

### 5A: Check App Health

1. Open your app's URL in a browser
2. Log in with your Microsoft account
3. Go to **Settings** page

### 5B: Enable Email Distribution

1. In Settings, find **Email Distribution**
2. Toggle it **ON**
3. Enter a test meeting ID to verify

### 5C: Enable SharePoint Archival

1. In Settings, find **SharePoint Archival**
2. Toggle it **ON**
3. Verify the site URL and library are correct

---

## Step 6: Run a Test

### 6A: Find a Test Meeting

1. Go to the **Meetings** page
2. Find a meeting with approved minutes
3. Click on the meeting to open details

### 6B: Trigger Email Distribution

1. In the meeting details, find the **Distribute** button
2. Click it to send the email
3. Check your inbox for the email

### 6C: Trigger SharePoint Archive

1. In the meeting details, find the **Archive** button
2. Click it to upload to SharePoint
3. Go to your SharePoint site to verify the document was uploaded

---

## Troubleshooting

### Email Not Sending

- **Check**: Is the sender email a valid, licensed mailbox?
- **Check**: Is the Mail.Send permission granted with admin consent?
- **Check**: Is GRAPH_SENDER_EMAIL set correctly in Azure?

### SharePoint Upload Failing

- **Check**: Is the site URL correct? (include https://)
- **Check**: Is the library name spelled exactly right?
- **Check**: Is Sites.ReadWrite.All permission granted?
- **Check**: Does the app have access to that specific site?

### Permission Denied Errors

- **Check**: Did you grant admin consent after adding permissions?
- **Check**: Are you using Application permissions (not Delegated)?

---

## Quick Reference

| Setting | Example Value |
|---------|---------------|
| GRAPH_SENDER_EMAIL | `meetingminutes@yourcompany.com` |
| SHAREPOINT_SITE_URL | `https://yourcompany.sharepoint.com/sites/MeetingMinutes` |
| SHAREPOINT_LIBRARY | `Documents` |

---

## Need Help?

If you encounter issues:

1. Check the **job_queue** table in your database for error messages
2. Check Application Insights logs in Azure Portal
3. Verify all permissions are granted in Azure AD
4. Ensure environment variables are correctly set

---

## Summary Checklist

- [ ] GRAPH_SENDER_EMAIL configured (valid mailbox)
- [ ] SHAREPOINT_SITE_URL configured (full URL with https://)
- [ ] SHAREPOINT_LIBRARY configured (exact library name)
- [ ] Mail.Send permission added and admin consent granted
- [ ] Sites.ReadWrite.All permission added and admin consent granted
- [ ] Azure Container App restarted
- [ ] Test email sent successfully
- [ ] Test document uploaded to SharePoint successfully
