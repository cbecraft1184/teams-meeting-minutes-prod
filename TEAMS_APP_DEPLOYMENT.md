# Microsoft Teams App Deployment Guide
## Installing the Meeting Minutes App in Teams Sidebar for 300,000 Users

This guide shows you how to add the Meeting Minutes app to the Teams sidebar so all 300,000 users can click on it like any built-in Teams app.

---

## Overview

After deployment, users will see the app in their Teams left sidebar:

```
Teams Sidebar:
┌─────────────────┐
│ Activity        │
│ Chat            │
│ Teams           │
│ Calendar        │
│ Calls           │
│ Files           │
│ Meeting Minutes │ ← Your custom app appears here!
│ Apps            │
└─────────────────┘
```

---

## Prerequisites

**Required Admin Role:**
- Teams Administrator
- OR Global Administrator

**What You Need:**
1. Your custom app package (`.zip` file with manifest.json + icons)
2. App deployed and accessible via HTTPS (AWS or Replit URL)
3. Azure AD app registration completed

---

## Step 1: Create the Teams App Package (15 minutes)

### 1.1 Create App Manifest

Create a file named `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<YOUR_AZURE_AD_CLIENT_ID>",
  "packageName": "com.dod.meetingminutes",
  "developer": {
    "name": "DOD IT Department",
    "websiteUrl": "https://your-domain.com",
    "privacyUrl": "https://your-domain.com/privacy",
    "termsOfUseUrl": "https://your-domain.com/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "DOD Teams Meeting Minutes Management"
  },
  "description": {
    "short": "Automatic meeting minutes capture and distribution",
    "full": "Automatically captures, processes, and distributes Microsoft Teams meeting minutes with AI-powered transcription and action item tracking. Supports DOD classification levels and approval workflows."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://your-domain.com",
      "websiteUrl": "https://your-domain.com",
      "scopes": ["personal"]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "your-domain.com"
  ],
  "webApplicationInfo": {
    "id": "<YOUR_AZURE_AD_CLIENT_ID>",
    "resource": "api://your-domain.com/<YOUR_AZURE_AD_CLIENT_ID>"
  }
}
```

**Important Fields:**
- `id`: Must match your Azure AD Application (client) ID
- `version`: Update this when you deploy new versions
- `contentUrl`: Your AWS or Replit deployment URL
- `validDomains`: Your domain without https://

### 1.2 Create App Icons

Create two icon files:

**color.png** (192x192 pixels)
- Full-color icon with background
- Used in Teams app store
- Recommended: Use DOD seal or document icon with blue background

**outline.png** (32x32 pixels)
- White icon on transparent background
- Used in Teams sidebar when pinned
- Keep it simple and recognizable at small size

### 1.3 Package the App

1. Create a folder with these 3 files:
   - `manifest.json`
   - `color.png`
   - `outline.png`

2. Select all 3 files and create a ZIP archive:
   - **Windows**: Right-click → Send to → Compressed folder
   - **Mac**: Right-click → Compress 3 Items
   - **Linux**: `zip dod-meeting-minutes.zip manifest.json color.png outline.png`

3. Name the ZIP file: `dod-meeting-minutes.zip`

**Important**: The ZIP must contain the files directly at the root level, NOT in a subfolder.

---

## Step 2: Upload App to Teams Admin Center (10 minutes)

### 2.1 Access Teams Admin Center

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Sign in with your Teams/Global Administrator account

### 2.2 Upload Custom App

1. In left navigation, click **Teams apps** → **Manage apps**
2. Click **Upload new app** button (top right)
   - Or click **Actions** dropdown → **Upload new app**
3. Click **Upload** and select your `dod-meeting-minutes.zip` file
4. Click **Upload**
5. Review the app details and click **Publish**

**Wait Time**: App appears in your org's catalog within a few minutes

### 2.3 Verify Upload

1. In **Manage apps** page, search for "Meeting Minutes"
2. You should see your app with status **"Allowed"**
3. Note the **App ID** for later reference

---

## Step 3: Enable Custom Apps Organization-Wide (5 minutes)

### 3.1 Configure Org-Wide Settings

1. In **Teams apps** → **Manage apps**
2. Click **Actions** → **Org-wide app settings**
3. Under **Custom apps** section:
   - Toggle ON: **"Interact with custom apps"**
   - Toggle ON: **"Upload custom apps"** (if you want users to upload other custom apps)
4. Click **Save**

---

## Step 4: Deploy to All 300,000 Users (10 minutes)

### Option A: Use Global Setup Policy (Instant Org-Wide Deployment)

**This is the fastest way to deploy to all users at once.**

#### 4.1 Edit Global Setup Policy

1. Navigate to **Teams apps** → **Setup policies**
2. Click on **Global (Org-wide default)** policy
3. This policy automatically applies to ALL users who don't have a specific policy assigned

#### 4.2 Install the App for All Users

1. Under **Installed apps** section:
   - Click **+ Add apps**
   - Search for "Meeting Minutes"
   - Select your custom app
   - Click **Add**

#### 4.3 Pin the App to Sidebar

1. Under **Pinned apps** section:
   - Click **+ Add apps**
   - Search for "Meeting Minutes"
   - Select your custom app
   - Click **Add**

2. Arrange app position in sidebar:
   - Drag the "Meeting Minutes" app to desired position
   - Recommended: Place it near Calendar or Files for easy access
   - Click and hold the hamburger icon (☰) to drag

3. Configure pinning behavior:
   - **User pinning**: Allow (lets users unpin if they want)
   - **App pinning**: Default (keeps it pinned by default)

#### 4.4 Save Changes

1. Click **Save** button
2. Confirm the changes

**Rollout Time**: Changes propagate to all 300,000 users within 24-48 hours

---

### Option B: Phased Rollout (Recommended for Testing)

**For safer deployment, test with a small group first.**

#### Phase 1: Test Group (100-500 users)

1. Create a test user group in Azure AD:
   - Go to [Azure AD Portal](https://portal.azure.com)
   - **Azure Active Directory** → **Groups**
   - Create new group: "Meeting Minutes Pilot"
   - Add 100-500 test users

2. Create custom setup policy:
   - **Teams apps** → **Setup policies**
   - Click **+ Add** to create new policy
   - Name: "Meeting Minutes Pilot Policy"
   - Add and pin the Meeting Minutes app (same as Global policy)
   - Click **Save**

3. Assign policy to test group:
   - **Setup policies** → **Group policy assignment** tab
   - Click **+ Add**
   - Select your "Meeting Minutes Pilot" Azure AD group
   - Choose "Meeting Minutes Pilot Policy"
   - Set Rank: **1** (highest priority)
   - Click **Apply**

**Wait**: 2-4 hours for pilot users to receive the app

#### Phase 2: Expand to More Users (Week 2)

1. Add more users to the pilot group in Azure AD
2. OR create additional groups and assign the same policy
3. Monitor feedback and issues

#### Phase 3: Full Deployment (Week 3+)

1. Deploy to all remaining users via Global policy (Option A above)
2. OR keep using group assignments for better control

---

## Step 5: Verify Deployment (5 minutes)

### 5.1 Check Deployment Status

1. In **Teams apps** → **Manage apps**
2. Find your "Meeting Minutes" app
3. Click on it to see details
4. Check **Installation status**:
   - Shows number of users with app installed
   - May take time to update for large deployments

### 5.2 Test as a User

1. Open Microsoft Teams (desktop or web)
2. Wait for the app to appear (can take up to 24 hours)
3. Check left sidebar for "Meeting Minutes" icon
4. Click the app icon
5. App should load your web interface with Teams SSO

---

## What Users Will See

### Day 1 (Deployment)
- Admin deploys via Global setup policy

### Day 1-2 (Propagation)
- Users gradually receive the app
- Teams may show a notification: "Your admin added Meeting Minutes"

### Day 2+ (Steady State)
- App appears in left sidebar automatically
- Users click the icon to access the app
- Teams SSO logs them in automatically (no separate login!)
- App shows their personalized dashboard based on role and clearance

---

## PowerShell Alternative (For Automation)

If you prefer scripting the deployment:

```powershell
# Install Teams PowerShell module
Install-Module -Name MicrosoftTeams -Force

# Connect to Teams
Connect-MicrosoftTeams

# Upload the custom app
New-TeamsApp -Path "C:\path\to\dod-meeting-minutes.zip"

# Get the app ID
$app = Get-TeamsApp | Where-Object {$_.DisplayName -eq "Meeting Minutes"}
Write-Host "App ID: $($app.Id)"

# Add to Global setup policy
$policy = Get-CsTeamsAppSetupPolicy -Identity Global

# Add to installed apps
$installedApps = $policy.AppPresetList
$installedApps += New-CsTeamsAppPreset -Id $app.Id
Set-CsTeamsAppSetupPolicy -Identity Global -AppPresetList $installedApps

# Add to pinned apps
$pinnedApps = $policy.PinnedAppBarApps
$pinnedApps += New-CsTeamsAppPreset -Id $app.Id
Set-CsTeamsAppSetupPolicy -Identity Global -PinnedAppBarApps $pinnedApps

Write-Host "Deployment complete! App will roll out to all users within 24-48 hours."
```

---

## Monitoring & Troubleshooting

### Monitor Rollout Progress

**Teams Admin Center:**
1. **Teams apps** → **Manage apps** → Find your app
2. Click on app name → View **Installation status**
3. Check **"Total installs"** metric
4. Refresh periodically to see adoption

**Expected Timeline for 300K Users:**
- Hour 1-6: 10-20% of users
- Hour 6-12: 40-60% of users
- Hour 12-24: 80-95% of users
- Hour 24-48: 95-100% of users

### Common Issues

**Issue: App not appearing in sidebar after 48 hours**

Solution:
1. Check user has correct setup policy assigned
2. Verify app is in BOTH "Installed apps" AND "Pinned apps"
3. Ask user to:
   - Restart Teams completely (close and reopen)
   - Clear Teams cache:
     - Windows: `%appdata%\Microsoft\Teams`
     - Mac: `~/Library/Application Support/Microsoft/Teams`
   - Sign out and sign back in

**Issue: App appears but shows error when clicked**

Solution:
1. Verify app URL is accessible via HTTPS
2. Check Azure AD redirect URI is configured
3. Review app logs for authentication errors
4. Ensure `validDomains` in manifest includes your domain

**Issue: Only some users see the app**

Solution:
1. Check if multiple setup policies exist (some users may have custom policies)
2. Verify group policy assignments and ranks
3. Wait full 48 hours for propagation

**Issue: Users can't authenticate**

Solution:
1. Verify Azure AD app permissions are granted
2. Check `webApplicationInfo` in manifest matches Azure AD app
3. Ensure JWT token validation is working in your backend

---

## Updating the App

When you need to deploy a new version:

### Version Update Process

1. **Update manifest.json:**
   ```json
   "version": "1.1.0"  // Increment version number
   ```

2. **Create new ZIP package** with updated files

3. **Upload to Teams Admin Center:**
   - **Manage apps** → Find your app → **Actions** → **Update**
   - Upload the new ZIP file
   - Click **Update**

4. **Users receive update automatically** within 24 hours
   - No action needed from users
   - App updates seamlessly in background

---

## User Communication Template

Send this to your users before deployment:

---

**Subject: New Teams App: Meeting Minutes Management**

Hello,

We're excited to announce a new Microsoft Teams app that will appear in your Teams sidebar soon: **Meeting Minutes**.

**What is it?**
This app automatically captures and processes Teams meeting minutes, helping you:
- Review AI-generated meeting summaries
- Track action items and decisions
- Access past meeting records
- Download official DOD-compliant minutes

**When will I see it?**
The app will appear in your Teams left sidebar within the next 1-2 days. Look for the "Meeting Minutes" icon.

**How do I use it?**
Simply click the "Meeting Minutes" icon in your Teams sidebar. You'll be automatically signed in and can access meetings you've attended.

**Questions?**
Contact IT Support at [your-support-email]

Thank you!
IT Department

---

---

## Security Checklist

Before deploying to 300K users:

- [ ] App URL uses HTTPS (required by Teams)
- [ ] Azure AD app registration complete
- [ ] API permissions granted and consented
- [ ] Teams manifest validated (no errors)
- [ ] App tested with small pilot group
- [ ] Backend authentication working (Teams SSO)
- [ ] Access control verified (clearance levels work)
- [ ] Documentation provided to users
- [ ] Support team trained on the app
- [ ] Monitoring in place (CloudWatch/logs)

---

## Summary: Quick Deployment Checklist

✅ **Package the app** (manifest.json + 2 icons → ZIP)
✅ **Upload to Teams Admin Center** (Manage apps → Upload)
✅ **Enable custom apps** (Org-wide settings)
✅ **Add to Global policy** (Installed + Pinned apps)
✅ **Wait 24-48 hours** for rollout
✅ **Monitor adoption** (Check installation status)
✅ **Provide support** (Help desk ready)

**Total Time**: ~45 minutes of admin work + 24-48 hours rollout

---

## Next Steps

1. **Create app package** following Step 1
2. **Test with small group** (5-10 users first)
3. **Deploy organization-wide** using Global policy
4. **Communicate to users** via email/announcement
5. **Monitor and support** during rollout
6. 🚀 **All 300,000 users have easy access!**

The app will appear in the Teams sidebar just like built-in apps - users simply click and use it!
