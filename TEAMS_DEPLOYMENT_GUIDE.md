# Microsoft Teams Deployment Guide
## Teams Meeting Minutes Application

**Current Version:** Phase 2 (Production Microsoft 365 Integration)  
**Deployment URL:** https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io  
**Status:** Ready for Teams Admin Center deployment

---

## Understanding the Application

### What This Is:
A **Microsoft Teams Plugin App** that:
- Appears in the Teams left sidebar under Apps
- Provides three tabs: Dashboard, Meetings, Archive
- Automatically captures ALL recorded Teams meetings in your tenant
- Generates AI-powered minutes using Azure OpenAI
- Requires human approval before distribution
- Distributes approved minutes via email and SharePoint

### Current Behavior (Important):
⚠️ **The application currently processes ALL meetings with cloud recording enabled**  
- No opt-in/opt-out mechanism yet (documented in FUTURE_FEATURE_MEETING_OPTIN.md)
- When deployed, it will capture every recorded meeting in your tenant
- Users do NOT need to add the app to individual meetings
- The app runs automatically in the background

### How Users Access:
1. Admin deploys app via Teams Admin Center
2. App appears in users' left sidebar (Apps section)
3. Users click "Meeting Minutes" icon to view dashboard
4. Users can see meetings, approve minutes, and search archive
5. **No user action needed** for the app to capture meetings

---

## Prerequisites Verification

Before deploying to Teams, verify these are configured:

### Azure Resources (Already Deployed)
- ✅ Azure Container App running (revision 0000015)
- ✅ PostgreSQL database connected
- ✅ Azure OpenAI configured
- ✅ Production services enabled (USE_MOCK_SERVICES=false)

### Azure AD App Registrations
Run these commands to verify:

```bash
# 1. Verify Graph API App
az ad app show --id 71383692-c5b6-40cc-94cf-96c970e414dc \
  --query "{name:displayName, appId:appId}" --output table

# 2. Verify Bot App
az ad app show --id 5ea1c494-6869-4879-8dc2-16c7b57da3e3 \
  --query "{name:displayName, appId:appId}" --output table

# 3. Check Graph API permissions were granted
az ad app permission list --id 71383692-c5b6-40cc-94cf-96c970e414dc --output json
```

**Expected Output:**
- Graph API app exists with application permissions (OnlineMeetings.Read.All, Files.Read.All, etc.)
- Bot app exists
- Admin consent granted for all permissions

---

## Step 1: Prepare Teams App Package

### A. Update Manifest with Your Values

The manifest is located at `teams-app/manifest.json` and needs these values configured:

| Placeholder | Your Value | Location |
|-------------|------------|----------|
| `{{TEAMS_APP_ID}}` | `6d94baf3-1ed6-4d34-8401-71c724305571` | Line 5 |
| `{{AZURE_AD_APP_ID}}` | `71383692-c5b6-40cc-94cf-96c970e414dc` | Lines 86, 87 |
| `{{MICROSOFT_APP_ID}}` | `5ea1c494-6869-4879-8dc2-16c7b57da3e3` | Lines 51, 61 |
| `{{TAB_ENDPOINT}}` | `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io` | Lines 30, 31, 37, 38, 44, 45 |
| `{{TAB_DOMAIN}}` | `teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io` | Lines 87, 90 |

**Quick replace script (run from project root):**

```bash
cd teams-app

# Create configured manifest
sed 's/{{TEAMS_APP_ID}}/6d94baf3-1ed6-4d34-8401-71c724305571/g' manifest.json | \
sed 's/{{AZURE_AD_APP_ID}}/71383692-c5b6-40cc-94cf-96c970e414dc/g' | \
sed 's/{{MICROSOFT_APP_ID}}/5ea1c494-6869-4879-8dc2-16c7b57da3e3/g' | \
sed 's|{{TAB_ENDPOINT}}|https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io|g' | \
sed 's/{{TAB_DOMAIN}}/teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/g' \
> manifest-configured.json

mv manifest-configured.json manifest.json
```

### B. Create App Icons

**Required Icons:**
1. **color.png** - 192x192px full color icon
2. **outline.png** - 32x32px transparent outline icon

**Option 1: Use Image Editor**
- Create PNG files with your branding
- Save to `teams-app/icons/` directory

**Option 2: Use Placeholder Icons (For Testing)**

Create simple placeholder icons with PowerShell (Windows):

```powershell
# Install required PowerShell module
Install-Module -Name PowerShellGraphical -Force

# Create color icon (192x192)
$colorBitmap = New-Object System.Drawing.Bitmap 192, 192
$graphics = [System.Drawing.Graphics]::FromImage($colorBitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(68, 100, 238))  # Blue color
$colorBitmap.Save("teams-app/icons/color.png")

# Create outline icon (32x32)
$outlineBitmap = New-Object System.Drawing.Bitmap 32, 32
$graphics = [System.Drawing.Graphics]::FromImage($outlineBitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
$graphics.DrawRectangle($pen, 8, 8, 16, 16)
$outlineBitmap.Save("teams-app/icons/outline.png")
```

Or download placeholder icons from:
- https://placeholder.com/192x192 (rename to color.png)
- https://placeholder.com/32x32 (rename to outline.png)

### C. Create ZIP Package

**CRITICAL:** Icons must be in the ZIP root, not in a subfolder.

**Windows (PowerShell):**
```powershell
cd teams-app

# Copy icons to root level temporarily
Copy-Item icons/color.png .
Copy-Item icons/outline.png .

# Create ZIP
Compress-Archive -Path manifest.json,color.png,outline.png -DestinationPath ../teams-minutes-app.zip -Force

# Clean up
Remove-Item color.png
Remove-Item outline.png

cd ..
```

**macOS/Linux:**
```bash
cd teams-app

# Copy icons to root
cp icons/color.png .
cp icons/outline.png .

# Create ZIP
zip -r ../teams-minutes-app.zip manifest.json color.png outline.png

# Clean up
rm color.png outline.png

cd ..
```

**Verify Package:**
```bash
unzip -l teams-minutes-app.zip
```

Expected output:
```
Archive:  teams-minutes-app.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
     3456  11-26-2025 10:00   manifest.json
    12345  11-26-2025 10:00   color.png
     5678  11-26-2025 10:00   outline.png
```

---

## Step 2: Upload to Teams Admin Center

### A. Access Teams Admin Center

1. Navigate to: https://admin.teams.microsoft.com
2. Sign in with **Global Administrator** or **Teams Administrator** account
3. Wait for dashboard to load

### B. Upload Custom App

1. **Left sidebar** → **Teams apps** → **Manage apps**
2. Click **Upload** or **Upload new app** (top-right corner)
3. Click **Upload** button in dialog
4. Select `teams-minutes-app.zip`
5. Click **Open**

### C. Review App Details

Teams will validate the manifest and show app details:

- **Name:** Meeting Minutes
- **Version:** 1.0.0
- **Developer:** Christopher Becraft (from manifest)
- **Permissions:** 
  - identity (SSO)
  - messageTeamMembers (bot)

**Review the information:**
- ✅ Verify app name is correct
- ✅ Check permissions are acceptable
- ✅ Confirm icons display properly

### D. Publish App

1. Click **Publish** (or **Add** depending on Teams admin interface)
2. **Status changes** from "Submitted" → "Published"
3. **App is now available** in your organization's app catalog

**Approval Time:** Immediate (custom app upload)

---

## Step 3: Deploy to Users

You have two deployment options:

### Option A: Make Available for Self-Installation

Users can find and install the app themselves.

**Steps:**
1. Teams Admin Center → **Teams apps** → **Setup policies**
2. Select **Global (Org-wide default)** or create custom policy
3. Under **Installed apps** section:
   - Click **Add apps**
   - Search for "Meeting Minutes"
   - Click **Add**
   - Click **Save**

**User Experience:**
- Users go to Teams → Apps
- Search for "Meeting Minutes"
- Click **Add** to install
- App appears in left sidebar

### Option B: Pre-Install for All Users (Recommended)

App automatically appears in every user's Teams.

**Steps:**
1. Teams Admin Center → **Teams apps** → **Setup policies**
2. Select **Global (Org-wide default)**
3. **Installed apps** section:
   - Click **Add apps**
   - Search for "Meeting Minutes"
   - Click **Add**
   - Click **Save**
4. **Pinned apps** section (optional - auto-pin in sidebar):
   - Click **Add apps**
   - Search for "Meeting Minutes"
   - Click **Add**
   - Drag to desired position in list
   - Click **Save**

**Propagation Time:** Up to 24 hours  
**User Experience:**
- App automatically appears in left sidebar
- No user action required
- Click icon to access dashboard

---

## Step 4: Verify Deployment

### A. Test as End User

1. **Open Microsoft Teams** (desktop or web)
2. **Check left sidebar:**
   - Look for "Meeting Minutes" icon (if pinned)
   - Or click **Apps** → Search "Meeting Minutes"
3. **Click app icon**
4. **Expected behavior:**
   - App opens in Teams
   - Shows three tabs: Dashboard, Meetings, Archive
   - Dashboard loads with statistics
   - Azure AD SSO should work automatically (no separate login)

### B. Verify Backend Connection

1. Open app in Teams
2. **Dashboard should show:**
   - Total Meetings: (number)
   - Pending Minutes: (number)
   - Recent Meetings: (list or "No recent meetings")

3. **If you see errors:**
   - Check browser console (F12 → Console tab)
   - Look for authentication or API errors

### C. Check Azure Logs

```bash
# Verify Teams SSO authentication
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50 | grep -i "teams\|sso\|auth"
```

**Expected log entries:**
- "Teams SSO token received"
- "User authenticated via Azure AD"
- No "401 Unauthorized" errors

---

## Step 5: Test Complete Workflow

### Schedule a Test Meeting

1. **Open Teams Calendar**
2. **Create new meeting:**
   - Title: "Test - AI Minutes Demo"
   - Add 1-2 test attendees
   - Date/Time: 15-20 minutes from now
   - **Meeting options:**
     - ✅ Record automatically (CRITICAL)
     - ✅ Transcription: ON (REQUIRED)
   - Click **Save**

### Conduct Meeting

1. **Join meeting** when scheduled
2. **Start recording** (if not auto-started)
   - Click "..." → **Recording and transcription** → **Start recording**
3. **Have brief discussion** (2-3 minutes minimum)
   - Clearly state action items: "John will complete the report by Friday"
   - Make decisions: "We decided to proceed with Option A"
4. **Stop recording**
5. **End meeting**

### Wait for Processing

**Timeline:**
- Recording upload: 5-10 minutes
- Transcript generation: 10-30 minutes
- AI minutes generation: 5-15 minutes after transcript

**Total time:** 20-55 minutes from meeting end to draft minutes ready

### Verify in App

1. **Open Meeting Minutes app** in Teams
2. **Dashboard:**
   - Total Meetings should increase by 1
   - Wait for "Pending Minutes" to increase by 1
3. **Click "Meetings" tab:**
   - Your test meeting should appear
   - Status: Scheduled → Completed → Enriched → Draft Generated
4. **Click meeting:**
   - Review AI-generated minutes
   - Verify summary, discussions, decisions, action items
5. **Click "Approve"**
6. **Check email:** 
   - Attendees should receive email with DOCX/PDF attachments
   - From: ChristopherBecraft@ChrisBecraft.onmicrosoft.com
7. **Check SharePoint:**
   - Navigate to: https://chrisbecraft.sharepoint.com
   - Documents library should have new file

---

## Troubleshooting

### Issue: App doesn't appear in left sidebar

**Causes:**
- Setup policy not assigned correctly
- Policy propagation not complete (wait 24 hours)
- User needs to restart Teams

**Fix:**
1. Verify setup policy includes app
2. Check policy is assigned to user/group
3. Ask user to sign out and sign back into Teams
4. Check Teams Admin Center → Users → Search user → Policies assigned

### Issue: App shows "Authentication required" error

**Causes:**
- Azure AD app registration not configured correctly
- SSO configuration missing in manifest
- User not in correct tenant

**Fix:**
1. Verify `webApplicationInfo` in manifest matches Azure AD app ID
2. Check Azure AD app has redirect URIs:
   - `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/auth/callback`
   - `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/silent-auth`
3. Verify user is in ChrisBecraft.onmicrosoft.com tenant
4. Check Container App logs for authentication errors

### Issue: Meeting not captured

**Causes:**
- Recording not to cloud (recorded locally instead)
- Transcription not enabled
- Graph webhook subscription not active
- Meeting in different tenant

**Fix:**
1. Verify meeting options: "Record to cloud" enabled
2. Check transcription is ON in meeting options
3. Verify Graph webhook subscription:
   ```bash
   az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes-demo --tail 100 | grep "webhook subscription"
   ```
4. Ensure meeting is in same tenant as deployed app

### Issue: AI minutes not generated

**Causes:**
- Azure OpenAI credentials invalid
- Job worker disabled
- Transcript not available

**Fix:**
1. Check job worker enabled:
   ```bash
   az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes-demo --tail 20 | grep "Job worker"
   ```
   Expected: "Job worker ENABLED"

2. Verify Azure OpenAI:
   ```bash
   az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes-demo --tail 50 | grep "Azure OpenAI"
   ```
   Look for API key errors

3. Check transcript exists in Teams chat

### Issue: Email not sent

**Causes:**
- Mail.Send permission not granted
- GRAPH_SENDER_EMAIL invalid
- Sender doesn't have mailbox

**Fix:**
1. Verify Graph permissions:
   ```bash
   az ad app permission list --id 71383692-c5b6-40cc-94cf-96c970e414dc | grep Mail.Send
   ```

2. Re-grant admin consent:
   ```bash
   az ad app permission admin-consent --id 71383692-c5b6-40cc-94cf-96c970e414dc
   ```

3. Verify sender email exists:
   - ChristopherBecraft@ChrisBecraft.onmicrosoft.com should have a mailbox

### Issue: SharePoint upload failed

**Causes:**
- SharePoint site URL incorrect
- Library doesn't exist
- Graph app missing Sites permissions

**Fix:**
1. Verify SharePoint site accessible:
   - Navigate to https://chrisbecraft.sharepoint.com in browser
   - Confirm you can access it

2. Check library exists:
   - Environment variable: SHAREPOINT_LIBRARY_NAME
   - Should match actual library name (case-sensitive)

3. Verify Sites permissions granted to Graph app

---

## User Training

### For End Users

**What users need to know:**

1. **App Location:**
   - Left sidebar → Apps → "Meeting Minutes"
   - Or search "Meeting Minutes" in Teams

2. **What it does:**
   - Automatically captures recorded Teams meetings
   - Generates AI-powered meeting minutes
   - Shows pending minutes for approval
   - Provides searchable archive

3. **Required for capture:**
   - Meeting must be recorded to cloud
   - Transcription must be enabled
   - Recording happens automatically if "Record automatically" was toggled

4. **Approval workflow:**
   - Draft minutes appear in "Meetings" tab
   - Click meeting → Review minutes → Click "Approve"
   - Approved minutes distributed via email
   - Archived in SharePoint

5. **Search archive:**
   - "Archive" tab
   - Search by meeting title, date, or content
   - Download DOCX or PDF

### For Approvers

**Who can approve:**
- Users with "Approver" or "Admin" role
- Configured in Azure AD groups

**Approval process:**
1. Open Meeting Minutes app
2. Click "Meetings" tab
3. Meetings with "Pending Review" status appear
4. Click meeting
5. Review generated content
6. Click "Approve" or "Reject"
7. If rejected, provide reason

**After approval:**
- Status changes to "Approved"
- Email sent to all attendees
- Document uploaded to SharePoint
- Meeting archived automatically

---

## Monitoring & Maintenance

### Check Application Health

```bash
# Overall health
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/health

# Check recent errors
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 100 | grep -i error

# Monitor job queue
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50 | grep -i "job queue\|processing"
```

### Update Teams App

When you need to update the app:

1. Update `version` in manifest.json (e.g., "1.0.0" → "1.0.1")
2. Make your changes
3. Create new ZIP package
4. Teams Admin Center → Manage apps → Find "Meeting Minutes" → Click **Update**
5. Upload new ZIP
6. Users will receive update within 24 hours (auto-update)

### Database Maintenance

Automatic cleanup runs daily at 2:00 AM:
- Archives old meetings
- Removes expired webhook subscriptions
- Cleans up failed jobs

Check cleanup logs:
```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50 | grep -i cleanup
```

---

## Next Steps

1. ✅ **Complete this deployment**
2. ✅ **Test with pilot group** (5-10 users)
3. ✅ **Collect feedback** (1-2 weeks)
4. ✅ **Monitor performance** (processing times, errors)
5. ⏳ **Implement opt-in feature** (see FUTURE_FEATURE_MEETING_OPTIN.md)
6. ⏳ **Roll out to full organization**

---

## Support Resources

- **Teams Admin Center:** https://admin.teams.microsoft.com
- **Azure Portal:** https://portal.azure.com
- **Application Logs:** Container App → Log stream
- **SharePoint Site:** https://chrisbecraft.sharepoint.com
- **Application URL:** https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io

---

**End of Deployment Guide**
