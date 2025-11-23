# Teams Meeting Minutes - Teams App Package

This directory contains the Microsoft Teams app package for deploying the AI-Powered Meeting Minutes application as a Teams plugin accessible from the left sidebar.

## Package Contents

- `manifest.json` - Teams app manifest (configuration)
- `icons/color.png` - Full color icon (192x192px)
- `icons/outline.png` - Transparent outline icon (32x32px)

## For IT Administrators: Deployment Guide

### Prerequisites

1. **Azure AD App Registration** (created by development team)
   - Application ID (Client ID)
   - API permissions configured for Microsoft Graph
   - SSO configured

2. **Backend Services Deployed** (hosted on Azure Container Apps)
   - API endpoint URL
   - Webhook endpoint configured
   - Database and job workers running

### Step 1: Configure the Manifest

Before packaging, replace these placeholders in `manifest.json`:

| Placeholder | Replace With | Example |
|-------------|--------------|---------|
| `{{TEAMS_APP_ID}}` | New GUID for this Teams app | `12345678-1234-1234-1234-123456789012` |
| `{{AZURE_AD_APP_ID}}` | Azure AD App Registration Client ID | Provided by dev team |
| `{{TAB_ENDPOINT}}` | Your Container App URL | `https://teams-minutes-app.orangemushroom-xxx.eastus2.azurecontainerapps.io` |
| `{{TAB_DOMAIN}}` | Just the domain (no https://) | `teams-minutes-app.orangemushroom-xxx.eastus2.azurecontainerapps.io` |

**To generate TEAMS_APP_ID:**
```powershell
# PowerShell
[guid]::NewGuid().ToString()
```

Or use an online GUID generator: https://www.guidgenerator.com/

### Step 2: Create the App Package

1. Ensure you have the required icons:
   - `icons/color.png` - 192x192px full color icon
   - `icons/outline.png` - 32x32px transparent outline

2. Create a ZIP file containing:
   ```
   teams-minutes-app.zip
   ├── manifest.json
   ├── color.png (move from icons/)
   └── outline.png (move from icons/)
   ```

   **IMPORTANT:** Icons must be in the root of the ZIP, not in a subdirectory.

**Create package (Windows PowerShell):**
```powershell
cd teams-app
Compress-Archive -Path manifest.json,icons/color.png,icons/outline.png -DestinationPath ../teams-minutes-app.zip -Force
```

**Create package (macOS/Linux):**
```bash
cd teams-app
zip -r ../teams-minutes-app.zip manifest.json icons/color.png icons/outline.png
```

### Step 3: Upload to Teams Admin Center

1. **Navigate to Teams Admin Center**
   - Go to: https://admin.teams.microsoft.com
   - Sign in with Global Admin or Teams Administrator account

2. **Manage Apps**
   - Left sidebar → **Teams apps** → **Manage apps**
   - Click **Upload new app** (top right)

3. **Upload Package**
   - Click **Upload** button
   - Select `teams-minutes-app.zip`
   - Click **Open**

4. **Review and Approve**
   - Teams will validate the manifest
   - Review app details
   - Click **Publish** to make available to organization

### Step 4: Deploy to Users

**Option A: Make Available (Users Install Themselves)**
1. Teams Admin Center → **Setup policies**
2. Create/edit policy
3. Add "Meeting Minutes" to **Pinned apps** (optional)
4. Assign policy to users/groups

**Option B: Pre-install for All Users (Recommended)**
1. Teams Admin Center → **Setup policies**
2. Select **Global (Org-wide default)** or create custom policy
3. Under **Installed apps** → Click **Add apps**
4. Search for "Meeting Minutes"
5. Click **Add** → **Save**
6. Under **Pinned apps** → Click **Add apps**
7. Add "Meeting Minutes" to auto-pin in left sidebar
8. Click **Save**

**Result:** App appears in all users' left sidebar automatically.

### Step 5: Verify Deployment

1. **User Verification**
   - Ask a test user to open Microsoft Teams
   - Check left sidebar for "Meeting Minutes" app
   - Click app → Should load the dashboard

2. **Check Logs**
   - Azure Container Apps → Log stream
   - Look for Teams SSO token exchanges
   - Verify no authentication errors

### Troubleshooting

**App doesn't appear in left sidebar:**
- Verify setup policy includes app in "Pinned apps"
- Check policy is assigned to correct users/groups
- Wait 24 hours for policy propagation (can take time)
- Users may need to restart Teams client

**"Permission denied" or SSO errors:**
- Verify `webApplicationInfo` in manifest matches Azure AD app
- Check Azure AD app has correct API permissions
- Ensure admin consent was granted for Graph permissions
- Verify `validDomains` includes your Container App domain

**App loads but shows errors:**
- Check Container App is running (Azure portal)
- Verify environment variables configured correctly
- Check Container App logs for backend errors
- Ensure database connection working

**Icons don't display:**
- Icons must be in ZIP root (not subfolder)
- Color icon: exactly 192x192px PNG
- Outline icon: exactly 32x32px PNG with transparency
- Re-package and re-upload if needed

### Update/Upgrade Process

To deploy a new version:

1. Update `version` in `manifest.json` (e.g., "1.0.0" → "1.0.1")
2. Make any other manifest changes
3. Create new ZIP package
4. Teams Admin Center → **Manage apps** → Find app → **Update**
5. Upload new ZIP
6. Users will get update within 24 hours

### Removal Process

1. Teams Admin Center → **Manage apps**
2. Find "Meeting Minutes"
3. Click app name → **Actions** → **Delete**
4. Confirm deletion
5. App removed from all users within 24 hours

---

## For Developers: Testing Before Admin Upload

### Sideload for Testing

Before giving package to IT, test it yourself:

1. **Enable sideloading** (if not already enabled)
   - Teams → Settings → **About** → Click version 5 times (enables Developer mode)
   - Or ask admin to enable via policies

2. **Upload to Teams**
   - Teams → Apps → **Manage your apps**
   - Click **Upload a custom app** → **Upload for me or my teams**
   - Select `teams-minutes-app.zip`

3. **Test functionality**
   - Verify all tabs load
   - Test SSO authentication
   - Check API calls work
   - Verify meeting data displays

4. **Remove test app**
   - Right-click app in left sidebar → **Uninstall**

---

## Architecture Overview

**User Flow:**
1. Admin uploads app package to Teams Admin Center
2. Admin deploys to users via setup policies
3. App appears in users' Teams left sidebar
4. User clicks app → Teams loads tab in iframe from Azure Container Apps
5. Tab authenticates user via Teams SSO
6. Tab calls backend API with SSO token
7. Backend exchanges token for Graph access via On-Behalf-Of flow
8. Backend processes meetings, generates minutes, stores in database

**Components:**
- **Teams Tab (Frontend)**: React app hosted on Azure Container Apps
- **Backend API**: Express server on Azure Container Apps (webhooks, jobs)
- **Database**: PostgreSQL for meetings, minutes, job queue
- **Azure AD**: SSO authentication and Graph API access
- **Microsoft Graph**: Meeting recordings, transcripts, user data
- **Azure OpenAI**: AI-powered minutes generation
- **SharePoint**: Approved minutes archival

---

## Support

For technical issues or questions:
- Development team: [contact info]
- Azure support: https://portal.azure.com
- Teams admin help: https://admin.teams.microsoft.com
