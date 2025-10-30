# DOD Teams Meeting Minutes - Implementation & Integration Guide

## Overview
This guide provides step-by-step instructions for deploying and testing the Microsoft Teams Meeting Minutes Management System. **This system is designed to be easy to install and use**, with automatic setup and minimal configuration required.

---

## Phase 1: Azure AD App Registration (15 minutes)

### Step 1.1: Create Azure AD App
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `DOD Teams Meeting Minutes`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Leave blank for now
5. Click **Register**
6. **Save the following values** (you'll need them later):
   - Application (client) ID
   - Directory (tenant) ID

### Step 1.2: Create Client Secret
1. In your app, go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `Teams Meeting Minutes Secret`
4. Expiration: Choose appropriate duration (recommendation: 24 months for testing)
5. Click **Add**
6. **IMMEDIATELY copy the secret value** (you can't see it again!)

### Step 1.3: Configure API Permissions
1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `User.Read` - Read user profile
   - `User.ReadBasic.All` - Read all users' basic profiles
   - `OnlineMeetings.Read` - Read Teams meeting details
   - `OnlineMeetingRecording.Read.All` - Read meeting recordings
   - `Mail.Send` - Send emails for distribution
   - `Files.ReadWrite.All` - Access SharePoint for archival
4. Click **Add permissions**
5. Click **Grant admin consent for [Your Organization]** (requires admin rights)

---

## Phase 2: Microsoft Teams App Configuration (20 minutes)

### Step 2.1: Create Teams App Manifest
Create a file called `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<YOUR_APP_CLIENT_ID>",
  "packageName": "com.dod.meetingminutes",
  "developer": {
    "name": "DOD IT Department",
    "websiteUrl": "https://your-replit-url.replit.app",
    "privacyUrl": "https://your-replit-url.replit.app/privacy",
    "termsOfUseUrl": "https://your-replit-url.replit.app/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "DOD Teams Meeting Minutes Management"
  },
  "description": {
    "short": "Automatic meeting minutes capture and distribution",
    "full": "Automatically captures, processes, and distributes Microsoft Teams meeting minutes with AI-powered transcription and action item tracking."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "configurableTabs": [
    {
      "configurationUrl": "https://your-replit-url.replit.app/config",
      "canUpdateConfiguration": true,
      "scopes": ["team", "groupchat"]
    }
  ],
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://your-replit-url.replit.app",
      "scopes": ["personal"]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "your-replit-url.replit.app"
  ],
  "webApplicationInfo": {
    "id": "<YOUR_APP_CLIENT_ID>",
    "resource": "api://your-replit-url.replit.app/<YOUR_APP_CLIENT_ID>"
  }
}
```

### Step 2.2: Create App Icons
- **color.png**: 192x192px icon with color background
- **outline.png**: 32x32px icon with transparent background

### Step 2.3: Package Teams App
1. Create a ZIP file containing:
   - `manifest.json`
   - `color.png`
   - `outline.png`
2. Name it: `dod-meeting-minutes.zip`

---

## Phase 3: Azure OpenAI Setup (10 minutes)

### For Testing (Regular Azure OpenAI)
1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Azure OpenAI** resource
   - Resource group: Create new or use existing
   - Region: Choose nearest region (for testing)
   - Name: `dod-meeting-minutes-openai`
3. After deployment, go to resource
4. Navigate to **Keys and Endpoint**
5. **Save these values**:
   - Endpoint URL
   - Key 1

### For Production (Azure OpenAI Gov Cloud)
1. Request access to Azure OpenAI in Gov Cloud
2. Deploy in Azure Government Portal
3. Follow same steps as above in Gov Cloud environment

### Deploy GPT Model
1. In Azure OpenAI resource, go to **Model deployments**
2. Click **Create new deployment**
3. Select model: **gpt-4** or **gpt-4-turbo**
4. Deployment name: `gpt-4`
5. Click **Create**

---

## Phase 4: SharePoint Configuration (15 minutes)

### Step 4.1: Create SharePoint Site
1. Go to SharePoint Admin Center
2. Create new site:
   - Type: **Team site**
   - Name: `Meeting Minutes Archive`
   - Site address: `/sites/meetingminutes`
   - Privacy: **Private** (organization-specific access)

### Step 4.2: Create Document Library
1. In the new site, create library named: `Meeting Minutes`
2. Configure folder structure:
   ```
   /Meeting Minutes
     /UNCLASSIFIED
     /CONFIDENTIAL
     /SECRET
     /TOP_SECRET (if applicable)
   ```

### Step 4.3: Configure Permissions
1. Go to site **Permissions**
2. Set up permission groups matching clearance levels:
   - UNCLASSIFIED Viewers
   - CONFIDENTIAL Viewers (includes UNCLASSIFIED access)
   - SECRET Viewers (includes CONFIDENTIAL + UNCLASSIFIED)
   - TOP_SECRET Viewers (all access)

### Step 4.4: Get SharePoint Site ID
1. Navigate to: `https://your-tenant.sharepoint.com/sites/meetingminutes/_api/site/id`
2. **Save the GUID** - you'll need this for the Replit integration

---

## Phase 5: Replit Deployment (10 minutes)

### Step 5.1: Configure Secrets
In Replit, add these secrets (Tools → Secrets):

```bash
# Microsoft Graph API
MICROSOFT_TENANT_ID=<your-tenant-id>
MICROSOFT_CLIENT_ID=<your-client-id>
MICROSOFT_CLIENT_SECRET=<your-client-secret>

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4

# SharePoint (Already configured via Replit integration)
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/meetingminutes
SHAREPOINT_LIBRARY=Meeting Minutes

# Application
NODE_ENV=production
```

### Step 5.2: Update SharePoint Integration
1. In Replit, the SharePoint connector is already installed
2. Go to Settings page in the app
3. Follow the SharePoint integration instructions to connect your site

### Step 5.3: Deploy Application
1. Click **Deploy** button in Replit
2. Choose deployment type: **Autoscale**
3. Wait for deployment to complete
4. **Copy your deployment URL**: `https://your-app.replit.app`

---

## Phase 6: Teams App Installation (5 minutes)

### Step 6.1: Upload to Teams
1. Open Microsoft Teams
2. Click **Apps** in left sidebar
3. Click **Manage your apps**
4. Click **Upload an app** → **Upload a custom app**
5. Select your `dod-meeting-minutes.zip` file
6. Click **Add**

### Step 6.2: Pin the App
1. Right-click the app in Teams sidebar
2. Click **Pin**
3. App is now accessible to all users!

---

## Phase 7: Microsoft Graph Webhooks Setup (15 minutes)

### Step 7.1: Register Webhook Subscriptions
Use this PowerShell script or REST API call:

```powershell
# Get access token
$tokenResponse = Invoke-RestMethod -Method Post `
  -Uri "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token" `
  -Body @{
    client_id = "<CLIENT_ID>"
    client_secret = "<CLIENT_SECRET>"
    scope = "https://graph.microsoft.com/.default"
    grant_type = "client_credentials"
  }

$token = $tokenResponse.access_token

# Create webhook subscription for meetings
$subscription = @{
  changeType = "created,updated"
  notificationUrl = "https://your-app.replit.app/api/webhooks/teams"
  resource = "communications/onlineMeetings"
  expirationDateTime = (Get-Date).AddDays(3).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  clientState = "SecretClientState123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://graph.microsoft.com/v1.0/subscriptions" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $subscription
```

**Important**: Webhook subscriptions expire after 3 days and must be renewed. Set up automatic renewal in production.

---

## Phase 8: User Access Configuration (10 minutes)

### Step 8.1: Create Test Users
For testing, create users with different clearance levels:

```sql
-- In Replit database viewer, run:
INSERT INTO users (email, display_name, clearance_level, role, azure_ad_id)
VALUES 
  ('admin@yourdomain.com', 'Admin User', 'TOP_SECRET', 'admin', 'azure-ad-id-1'),
  ('approver@yourdomain.com', 'Approver User', 'SECRET', 'approver', 'azure-ad-id-2'),
  ('auditor@yourdomain.com', 'Auditor User', 'SECRET', 'auditor', 'azure-ad-id-3'),
  ('viewer@yourdomain.com', 'Regular Viewer', 'CONFIDENTIAL', 'viewer', 'azure-ad-id-4');
```

### Step 8.2: Azure AD ID Mapping
1. Users will auto-provision on first login
2. Default: `viewer` role, `UNCLASSIFIED` clearance
3. Admins must update clearance levels and roles via database

---

## Phase 9: Testing Workflow (20 minutes)

### Test 1: Meeting Capture
1. Schedule a Teams meeting
2. Start the meeting and record it
3. End the meeting
4. Webhook should trigger and capture meeting to database
5. Verify in the app: Dashboard → Recent Meetings

### Test 2: AI Minutes Generation
1. In the app, select a completed meeting
2. Click **Generate Minutes**
3. AI processes the transcript
4. Review generated minutes, discussions, decisions, action items

### Test 3: Approval Workflow
1. Log in as approver/admin user
2. Navigate to meeting with pending minutes
3. Review minutes
4. Click **Approve** or **Request Revision**
5. On approval:
   - DOCX and PDF generated
   - Email sent to all attendees
   - Documents archived to SharePoint

### Test 4: Access Control
1. Log in as different user roles (viewer, approver, auditor, admin)
2. Verify role-specific access:
   - **Viewer**: Can only see meetings they attended (within clearance)
   - **Approver**: Same as viewer + can approve minutes
   - **Auditor**: Can see ALL meetings (within clearance)
   - **Admin**: Full system access + user management

### Test 5: Classification Filtering
1. Create meetings with different classifications
2. Log in as users with different clearances
3. Verify users can ONLY see meetings within their clearance:
   - UNCLASSIFIED user: sees only UNCLASSIFIED meetings
   - SECRET user: sees UNCLASSIFIED, CONFIDENTIAL, and SECRET

### Test 6: Document Export
1. Open a meeting with approved minutes
2. Click **Download DOCX** or **Download PDF**
3. Verify document includes:
   - Classification header/footer markings
   - Meeting details
   - Attendees
   - Summary and decisions
   - Action items

---

## Phase 10: Production Hardening

### Security Checklist
- [ ] All secrets stored in Replit Secrets (not in code)
- [ ] HTTPS enabled for all endpoints
- [ ] Teams SSO properly validates JWT tokens
- [ ] Access control enforced on all API routes
- [ ] Audit logging enabled and monitored
- [ ] Database backups configured
- [ ] Webhook signature validation enabled

### Monitoring Setup
1. Enable Replit monitoring
2. Set up alerts for:
   - API errors (500s)
   - Authentication failures
   - Access control violations
   - Webhook processing failures

### Scale Testing
For 300,000+ users:
1. Use Replit Autoscale deployment
2. Monitor performance under load
3. Optimize database queries as needed
4. Consider read replicas for reporting

---

## Troubleshooting

### Issue: Users cannot log in
**Solution**: 
- Verify Azure AD app permissions are granted
- Check MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID are correct
- Ensure Teams app manifest has correct webApplicationInfo

### Issue: Meetings not appearing
**Solution**:
- Verify webhook subscription is active (check expiration)
- Check webhook endpoint is accessible: `https://your-app.replit.app/api/webhooks/teams`
- Review logs for webhook processing errors

### Issue: AI minutes generation fails
**Solution**:
- Verify Azure OpenAI credentials are correct
- Check deployment name matches AZURE_OPENAI_DEPLOYMENT
- Ensure you have quota in your Azure OpenAI resource

### Issue: Email distribution fails
**Solution**:
- Verify Mail.Send permission is granted in Azure AD
- Check Graph API token has proper scopes
- Review email distribution logs

### Issue: SharePoint upload fails
**Solution**:
- Verify SharePoint connector is configured
- Check site permissions for the app
- Ensure document library exists

---

## Support & Maintenance

### Regular Maintenance Tasks
- **Weekly**: Review audit logs for security violations
- **Monthly**: Renew webhook subscriptions (if not automated)
- **Quarterly**: Review user clearance levels
- **Annually**: Rotate client secrets

### Getting Help
1. Check application logs in Replit
2. Review audit trail for access issues
3. Consult Microsoft Graph API documentation
4. Contact DOD IT support for classification questions

---

## Key Features Summary

✅ **Easy Installation**: Teams app package installs in minutes
✅ **Automatic Meeting Capture**: No manual data entry required
✅ **AI-Powered Minutes**: GPT-4 generates professional minutes
✅ **Multi-Level Access Control**: Clearance + role + attendance filtering
✅ **Auditor Support**: Full archive access for compliance teams
✅ **Classification Support**: UNCLASSIFIED through TOP SECRET
✅ **Email Distribution**: Automatic delivery to all attendees
✅ **SharePoint Archival**: Secure long-term storage
✅ **Audit Trail**: All access logged for compliance
✅ **Scalable**: Supports 300,000+ users with Replit Autoscale

---

## Next Steps

1. Complete Azure AD setup (Phase 1)
2. Configure Teams app (Phase 2)
3. Set up Azure OpenAI (Phase 3)
4. Configure SharePoint (Phase 4)
5. Deploy to Replit (Phase 5)
6. Install in Teams (Phase 6)
7. Configure webhooks (Phase 7)
8. Test thoroughly (Phase 9)
9. Go live! 🚀
