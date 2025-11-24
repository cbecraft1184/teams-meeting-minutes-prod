# Production Enablement Plan - Teams Meeting Minutes Application

## Executive Summary

**Current Status**: Application deployed in MOCK MODE (non-functional demo state)
- ❌ Cannot capture real Teams meetings
- ❌ Cannot generate real AI minutes
- ❌ Cannot distribute via email/Teams
- ❌ Cannot archive to SharePoint
- ❌ Cannot search archived minutes

**This Document**: Step-by-step instructions to enable FULL production functionality

**Estimated Time**: 4-6 hours active work

---

## Current Deployment State

### What's Working ✅
- Container App healthy and serving traffic (revision 0000009)
- PostgreSQL database with all 12 tables created
- Web interface accessible
- Application code complete and tested

### What's NOT Working ❌
- **Microsoft Graph Integration**: Mock service active, no real meetings captured
- **Azure OpenAI**: Mock responses, no real AI transcription/minutes
- **Email Distribution**: Mock service, emails not sent
- **SharePoint Archival**: Mock service, documents not uploaded
- **Teams Bot**: Not registered, notifications disabled
- **Webhooks**: Not configured, cannot receive meeting events

### Root Cause
Environment variable `USE_MOCK_SERVICES=true` disables all production integrations.

Production requires:
- Azure AD app registrations (2 apps)
- Microsoft Graph API permissions
- Azure OpenAI deployment
- SharePoint site configuration
- Teams Bot registration
- 18 additional environment variables

---

## Phase 1: Azure AD App Registrations

### 1.1 Create Microsoft Graph Daemon App

**Purpose**: Enable application to access Microsoft Graph APIs (meetings, SharePoint, email)

**Steps**:

```bash
# 1. Navigate to Azure Portal
https://portal.azure.com → Azure Active Directory → App registrations → New registration

# 2. Configure app registration
Name: teams-minutes-graph-app
Supported account types: Single tenant (this organization only)
Redirect URI: Leave blank (daemon app)

# 3. Save the following values (you'll need them later):
Application (client) ID: ________________________________
Directory (tenant) ID: __________________________________

# 4. Create client secret
Certificates & secrets → New client secret
Description: teams-minutes-production-secret
Expires: 24 months (or per your policy)

# CRITICAL: Copy the secret VALUE immediately (it won't be shown again)
Client Secret Value: ____________________________________

# 5. Grant API permissions
API permissions → Add a permission → Microsoft Graph → Application permissions

Add ALL of the following permissions:
☑ OnlineMeetings.Read.All          # Read Teams meetings
☑ CallRecords.Read.All             # Read call records and transcripts
☑ Team.ReadBasic.All               # Read team information
☑ ChannelMessage.Send              # Send Teams notifications
☑ Files.ReadWrite.All              # Upload to SharePoint
☑ Sites.ReadWrite.All              # Access SharePoint sites
☑ Mail.Send                        # Send distribution emails
☑ offline_access                   # Maintain access tokens

# 6. Grant admin consent (REQUIRES GLOBAL ADMIN)
API permissions → Grant admin consent for [Your Organization]
Click "Yes" to confirm

# VERIFICATION: All permissions should show green checkmark "Granted for [org]"
```

**Save These Values**:
```
AZURE_TENANT_ID=<Directory tenant ID>
GRAPH_CLIENT_ID=<Application client ID>
GRAPH_CLIENT_SECRET=<Client secret value>
```

---

### 1.2 Create Teams Bot App Registration

**Purpose**: Enable Teams bot for meeting notifications and adaptive cards

**Steps**:

```bash
# 1. Create Bot Framework registration
https://portal.azure.com → Create a resource → Search "Azure Bot"
Click "Azure Bot" → Create

# 2. Configure bot
Bot handle: teams-minutes-bot
Resource group: rg-teams-minutes-demo
Region: East US 2
Pricing tier: F0 (Free - 10k messages/month)
Microsoft App ID: Create new Microsoft App ID

# 3. After creation, go to Configuration
Messaging endpoint: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/bot
  
# 4. Get credentials
Settings → Manage → Copy the following:
Microsoft App ID: ___________________________________

# 5. Create client secret
Certificates & secrets → New client secret
Description: bot-production-secret
Expires: 24 months

# CRITICAL: Copy the secret VALUE immediately
Client Secret Value: ____________________________________

# 6. Configure Teams channel
Channels → Microsoft Teams → Click to enable
Save (default settings are fine)

# 7. Install bot in Teams
Channels → Microsoft Teams → "Open in Teams"
This will open Teams app installation dialog
Click "Add" to install for yourself (or "Add to a team")
```

**Save These Values**:
```
BOT_APP_ID=<Microsoft App ID>
BOT_APP_PASSWORD=<Client secret value>
```

---

## Phase 2: Azure OpenAI Service Configuration

### 2.1 Create Azure OpenAI Resource

**Purpose**: Enable AI-powered transcription and minutes generation

**Steps**:

```bash
# 1. Create Azure OpenAI resource
https://portal.azure.com → Create a resource → Search "Azure OpenAI"
Click "Create"

# 2. Configure resource
Resource group: rg-teams-minutes-demo
Region: East US 2 (or any region with GPT-4o availability)
Name: teams-minutes-openai
Pricing tier: Standard S0

# 3. Deploy GPT-4o model
After creation: Go to resource → Model deployments → Create new deployment

Model: gpt-4o (or gpt-4o-mini for lower cost)
Deployment name: gpt-4o-deployment
Version: Latest (auto-update enabled)
Tokens per minute rate limit: 30K (adjust based on usage)

# 4. Deploy Whisper model (for transcription)
Model deployments → Create new deployment
Model: whisper
Deployment name: whisper
Version: Latest

# 5. Get credentials
Keys and Endpoint → Show Keys
Endpoint: _____________________________________________
Key 1: ________________________________________________

# Endpoint format: https://teams-minutes-openai.openai.azure.com/
```

**Save These Values**:
```
AZURE_OPENAI_ENDPOINT=<Endpoint URL>
AZURE_OPENAI_API_KEY=<Key 1>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

---

## Phase 3: SharePoint Configuration

### 3.1 Create SharePoint Document Library

**Purpose**: Archive approved meeting minutes

**Steps**:

```bash
# 1. Navigate to SharePoint site
https://[yourtenant].sharepoint.com

# 2. Create new site (or use existing)
Home → Create site → Team site
Site name: Meeting Minutes Archive
Privacy: Private
Click "Next" → "Finish"

# 3. Create document library
Site contents → New → Document library
Name: Minutes
Description: Approved meeting minutes archive
Click "Create"

# 4. Get site URL and library name
Copy the full URL from browser address bar
Example: https://contoso.sharepoint.com/sites/MeetingMinutesArchive

# The library name is: Minutes
```

**Save These Values**:
```
SHAREPOINT_SITE_URL=<Full SharePoint site URL>
SHAREPOINT_LIBRARY=Minutes
```

---

### 3.2 Get Graph Sender Email

**Purpose**: Email address used to send distribution emails via Microsoft Graph

**Requirements**:
- Must be a real mailbox in your tenant
- Graph app (from Phase 1.1) must have Mail.Send permission
- Mailbox must be accessible to the application

**Steps**:

```bash
# Option 1: Use service account
Create a shared mailbox: noreply-minutes@yourdomain.com
Or use existing service account

# Option 2: Use your own email (for demo)
your.email@yourdomain.com

# The application will send emails FROM this address
# Recipients will see this as the sender
```

**Save This Value**:
```
GRAPH_SENDER_EMAIL=<email address>
```

---

## Phase 4: Webhook Configuration

### 4.1 Generate Webhook Validation Secret

**Purpose**: Secure webhook endpoint for Microsoft Graph notifications

**Steps**:

```bash
# Generate a random validation secret
WEBHOOK_SECRET=$(openssl rand -base64 32)
echo "WEBHOOK_VALIDATION_SECRET=$WEBHOOK_SECRET"

# Example output:
# WEBHOOK_VALIDATION_SECRET=xK7mN9pQ2rS5tV8wY1zA3bC6dE9fH2jK5mN8pQ1rS4tV
```

**Save This Value**:
```
WEBHOOK_VALIDATION_SECRET=<generated secret>
```

---

## Phase 5: Container App Production Deployment

### 5.1 Prepare Environment Variables

**Collect all values from previous phases**:

```bash
# From Phase 1.1 (Graph app)
AZURE_TENANT_ID=<your-tenant-id>
GRAPH_CLIENT_ID=<graph-app-client-id>
GRAPH_CLIENT_SECRET=<graph-app-secret>

# From Phase 1.2 (Bot app)
BOT_APP_ID=<bot-app-id>
BOT_APP_PASSWORD=<bot-secret>

# From Phase 2 (Azure OpenAI)
AZURE_OPENAI_ENDPOINT=https://teams-minutes-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=<openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# From Phase 3 (SharePoint & Email)
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/MeetingMinutesArchive
SHAREPOINT_LIBRARY=Minutes
GRAPH_SENDER_EMAIL=noreply-minutes@yourdomain.com

# From Phase 4 (Webhooks)
WEBHOOK_VALIDATION_SECRET=<generated-secret>

# From existing deployment (DO NOT CHANGE)
DATABASE_URL=postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require
SESSION_SECRET=<existing-session-secret>
PORT=8080
NODE_ENV=production

# CRITICAL: Disable mock services
USE_MOCK_SERVICES=false
```

---

### 5.2 Deploy to Azure Container App

**⚠️ CRITICAL WARNING**: The `az containerapp update` command does NOT preserve existing environment variables. You MUST include ALL variables in EVERY update command.

**Steps**:

```bash
# 1. Login to Azure Cloud Shell
https://portal.azure.com → Click Cloud Shell icon (>_)
Select "Bash"

# 2. Set variables (replace with your actual values)
TENANT_ID="<your-tenant-id>"
GRAPH_CLIENT_ID="<graph-client-id>"
GRAPH_CLIENT_SECRET="<graph-client-secret>"
BOT_APP_ID="<bot-app-id>"
BOT_APP_PASSWORD="<bot-password>"
OPENAI_ENDPOINT="<openai-endpoint>"
OPENAI_KEY="<openai-key>"
SHAREPOINT_URL="<sharepoint-url>"
SENDER_EMAIL="<sender-email>"
WEBHOOK_SECRET="<webhook-secret>"
DATABASE_URL="<existing-database-url>"
SESSION_SECRET="<existing-session-secret>"

# 3. Deploy with complete environment variables
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars \
    "USE_MOCK_SERVICES=false" \
    "DATABASE_URL=${DATABASE_URL}" \
    "SESSION_SECRET=${SESSION_SECRET}" \
    "PORT=8080" \
    "NODE_ENV=production" \
    "AZURE_TENANT_ID=${TENANT_ID}" \
    "GRAPH_CLIENT_ID=${GRAPH_CLIENT_ID}" \
    "GRAPH_CLIENT_SECRET=${GRAPH_CLIENT_SECRET}" \
    "BOT_APP_ID=${BOT_APP_ID}" \
    "BOT_APP_PASSWORD=${BOT_APP_PASSWORD}" \
    "AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}" \
    "AZURE_OPENAI_API_KEY=${OPENAI_KEY}" \
    "AZURE_OPENAI_DEPLOYMENT=gpt-4o-deployment" \
    "AZURE_OPENAI_API_VERSION=2024-08-01-preview" \
    "SHAREPOINT_SITE_URL=${SHAREPOINT_URL}" \
    "SHAREPOINT_LIBRARY=Minutes" \
    "GRAPH_SENDER_EMAIL=${SENDER_EMAIL}" \
    "WEBHOOK_VALIDATION_SECRET=${WEBHOOK_SECRET}"

# 4. Monitor deployment
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table

# Wait for new revision to show "Healthy"

# 5. Watch logs for successful startup
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow

# Look for:
# ✅ Configuration valid for PRODUCTION MODE
# ✅ All Microsoft integrations enabled
# ✅ Azure OpenAI connected
# ✅ SharePoint service ready
# [express] serving on port 8080
```

---

### 5.3 Verification Checklist

**After deployment completes**:

```bash
# 1. Check health endpoint
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

# 2. Check configuration endpoint (optional)
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/config

# Should show:
# "mockServices": false
# "features": { "graphApi": true, "azureOpenAI": true, ... }

# 3. Check logs for configuration validation
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 100

# Must show:
# ✅ Configuration valid for PRODUCTION MODE
# ✅ All Microsoft integrations enabled

# 4. If you see errors, check for missing variables:
# ❌ Missing GRAPH_CLIENT_ID
# ❌ Missing AZURE_OPENAI_ENDPOINT
# etc.
```

---

## Phase 6: End-to-End Workflow Testing

### 6.1 Test Meeting Capture

**Goal**: Verify application can capture Teams meetings via Graph API webhooks

**Steps**:

```bash
# 1. Login to web interface
https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io

# 2. Navigate to Dashboard
Should show empty state: "No upcoming meetings"

# 3. Schedule a Teams meeting (in Microsoft Teams)
Open Teams → Calendar → New meeting
Title: Test Meeting - Minutes Demo
When: Tomorrow at 2 PM
Required attendees: Add yourself + 1 other person
Click "Send"

# 4. Start the meeting
At scheduled time, join the meeting in Teams
Invite at least one other participant
Have a 2-3 minute conversation

# 5. Record the meeting (CRITICAL for transcription)
In meeting controls → More options (...) → Start recording
Speak clearly for 2-3 minutes
Discuss action items: "John will prepare the Q4 report by Friday"

# 6. End the meeting
Stop recording first
End meeting for all participants

# 7. Wait 5-10 minutes for Graph webhook processing

# 8. Check application dashboard
Refresh: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
Should now show: "Test Meeting - Minutes Demo" in "Pending Minutes" section

# 9. Check logs for webhook activity
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50

# Look for:
# [GraphWebhook] Received meeting notification
# [JobQueue] Enqueued job: enrich_meeting
# [JobQueue] Processing enrich_meeting for meeting <id>
```

**Expected Results**:
- ✅ Meeting appears in dashboard within 10 minutes
- ✅ Meeting status: "Enriching" or "Ready for Minutes"
- ✅ Logs show webhook received and job queued

**If Not Working**:
- Check webhook subscription status: `/api/admin/webhooks`
- Verify Graph app permissions granted
- Check application logs for authentication errors
- Ensure meeting was recorded (required for transcription)

---

### 6.2 Test AI Minutes Generation

**Goal**: Verify Azure OpenAI can generate meeting minutes

**Prerequisites**: Meeting must be captured (from 6.1) with "Ready for Minutes" status

**Steps**:

```bash
# 1. Navigate to meeting detail page
Click on "Test Meeting - Minutes Demo" from dashboard

# 2. Click "Generate Minutes" button
Application should show: "Generating minutes..."

# 3. Monitor background job processing
# Job queue will execute:
# - Download meeting transcript from Graph API
# - Send transcript to Azure OpenAI (GPT-4o)
# - Extract summary, discussions, decisions, action items

# 4. Wait 30-60 seconds, then refresh page

# 5. Verify minutes content
Should display:
- Meeting summary (AI-generated overview)
- Discussion points (key topics discussed)
- Decisions made
- Action items (extracted from conversation)
- Attendee list

# 6. Check logs for AI processing
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50

# Look for:
# [JobQueue] Processing generate_minutes for meeting <id>
# [AzureOpenAI] Sending transcript to GPT-4o
# [AzureOpenAI] Received structured minutes response
# [JobQueue] Minutes generation complete
```

**Expected Results**:
- ✅ Minutes generated within 60 seconds
- ✅ Content includes summary, discussions, decisions, action items
- ✅ Action items extracted (e.g., "John will prepare Q4 report")
- ✅ Meeting status changed to "Pending Approval"

**If Not Working**:
- Check Azure OpenAI deployment status (should be "Succeeded")
- Verify AZURE_OPENAI_ENDPOINT and API key are correct
- Check logs for "rate limit exceeded" or authentication errors
- Ensure meeting had transcription/recording available

---

### 6.3 Test Approval Workflow

**Goal**: Verify admin can review and approve minutes

**Prerequisites**: Minutes generated (from 6.2) with "Pending Approval" status

**Steps**:

```bash
# 1. Review generated minutes
On meeting detail page, review AI-generated content

# 2. Edit if needed (optional)
Click "Edit" on any section
Make corrections to summary, add missing decisions, etc.
Click "Save"

# 3. Approve minutes
Scroll to bottom → Click "Approve Minutes" button
Confirmation dialog: "Approve these minutes for distribution?"
Click "Yes, Approve"

# 4. Verify approval
Meeting status should change to: "Approved - Ready for Distribution"
Approval timestamp displayed
Approver name shown (your username)

# 5. Check admin settings (optional)
Navigate to Settings → Admin Settings
Verify workflow configuration:
- "Require approval before distribution": ON (if enabled)
- "Auto-generate minutes": ON (recommended)
- "Enable email distribution": ON
- "Enable SharePoint archival": ON
```

**Expected Results**:
- ✅ Minutes approved successfully
- ✅ Status changed to "Approved"
- ✅ Distribution workflow triggered (if auto-distribution enabled)

**If Not Working**:
- Verify user has admin permissions
- Check application logs for validation errors
- Ensure admin settings panel accessible

---

### 6.4 Test Email Distribution

**Goal**: Verify approved minutes are distributed via email

**Prerequisites**: Minutes approved (from 6.3)

**Steps**:

```bash
# 1. Trigger distribution (if not automatic)
On meeting detail page → Click "Distribute Now" button
Or wait for automatic distribution (if enabled in settings)

# 2. Monitor distribution job
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow

# Look for:
# [JobQueue] Processing send_email job
# [EmailService] Sending email to <recipient>
# [GraphAPI] POST /users/{sender}/sendMail
# [EmailService] Email sent successfully

# 3. Check recipient inbox
Open Outlook/Gmail for meeting attendees
Look for email with subject: "Meeting Minutes: Test Meeting - Minutes Demo"

# 4. Verify email content
Email should contain:
- Meeting title and date
- Summary section
- Discussion points
- Decisions made
- Action items with assignees
- Attachments: Minutes.docx and Minutes.pdf

# 5. Download and verify attachments
Open Minutes.docx → Should be formatted Word document
Open Minutes.pdf → Should be formatted PDF document
Both should contain complete minutes content
```

**Expected Results**:
- ✅ Email received by all meeting attendees
- ✅ Email sent from GRAPH_SENDER_EMAIL address
- ✅ DOCX and PDF attachments included
- ✅ Content properly formatted

**If Not Working**:
- Verify GRAPH_SENDER_EMAIL is correct and accessible
- Check Graph app has Mail.Send permission granted
- Verify GRAPH_CLIENT_SECRET is valid
- Check logs for "401 Unauthorized" or "403 Forbidden" errors
- Test Graph API credentials:
  ```bash
  # From Cloud Shell or Postman
  curl -X POST https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token \
    -d "client_id=<GRAPH_CLIENT_ID>" \
    -d "client_secret=<GRAPH_CLIENT_SECRET>" \
    -d "scope=https://graph.microsoft.com/.default" \
    -d "grant_type=client_credentials"
  
  # Should return access token (not error)
  ```

---

### 6.5 Test SharePoint Archival

**Goal**: Verify minutes are uploaded to SharePoint document library

**Prerequisites**: Email distribution completed (from 6.4)

**Steps**:

```bash
# 1. Monitor SharePoint upload job
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow

# Look for:
# [JobQueue] Processing upload_sharepoint job
# [SharePointService] Uploading to site: <SHAREPOINT_SITE_URL>
# [SharePointService] Library: Minutes
# [SharePointService] File uploaded: Test_Meeting_Minutes_Demo_2025-11-24.pdf
# [JobQueue] SharePoint upload complete

# 2. Navigate to SharePoint site
Open browser: <SHAREPOINT_SITE_URL>
Example: https://contoso.sharepoint.com/sites/MeetingMinutesArchive

# 3. Go to Minutes library
Site contents → Minutes (or click "Minutes" in left navigation)

# 4. Verify file uploaded
Should see file: "Test_Meeting_Minutes_Demo_2025-11-24.pdf"
File size: ~50-200 KB
Modified: Today's date
Modified by: Application service account

# 5. Download and verify file
Click file → Download
Open PDF → Should match email attachment exactly

# 6. Check file metadata (optional)
Right-click file → Properties
Should include:
- Meeting title
- Meeting date
- Attendees
- Tags/keywords (if configured)
```

**Expected Results**:
- ✅ PDF file uploaded to SharePoint
- ✅ File name includes meeting title and date
- ✅ Content matches approved minutes
- ✅ File accessible to authorized users

**If Not Working**:
- Verify SHAREPOINT_SITE_URL is correct (full URL with https://)
- Verify SHAREPOINT_LIBRARY name matches exactly (case-sensitive)
- Check Graph app has Sites.ReadWrite.All and Files.ReadWrite.All permissions
- Verify admin consent granted for SharePoint permissions
- Check logs for "403 Forbidden" or "Site not found" errors
- Test Graph API access to SharePoint:
  ```bash
  # Get access token (from previous step)
  # Then test site access:
  curl -H "Authorization: Bearer <access-token>" \
    "https://graph.microsoft.com/v1.0/sites/<site-id>/drive"
  
  # Should return drive information (not error)
  ```

---

### 6.6 Test Archive Search

**Goal**: Verify users can search and retrieve archived minutes

**Prerequisites**: Minutes archived to SharePoint (from 6.5)

**Steps**:

```bash
# 1. Navigate to Archive page
https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/archive

# 2. Search by meeting title
Search box: Enter "Test Meeting"
Click "Search" or press Enter

# 3. Verify search results
Should display:
- Meeting title: "Test Meeting - Minutes Demo"
- Meeting date: Tomorrow at 2 PM
- Status: "Distributed"
- Attendees: Your name + others
- Action: "View Minutes" button

# 4. View archived minutes
Click "View Minutes" button
Should display:
- Full minutes content (read-only)
- Download buttons for DOCX and PDF
- Distribution timestamp
- Approver information

# 5. Download archived documents
Click "Download DOCX"
Click "Download PDF"
Verify files download successfully

# 6. Test additional search filters
Search by date range: Select last 7 days
Search by attendee: Enter your name
Search by status: Select "Distributed"
Each filter should return relevant results
```

**Expected Results**:
- ✅ Search returns matching meetings
- ✅ Archived minutes viewable
- ✅ Documents downloadable from archive
- ✅ Search filters work correctly

**If Not Working**:
- Check database contains meeting records
- Verify meeting status is "distributed"
- Check logs for database query errors
- Ensure SharePoint URLs stored correctly in database

---

## Phase 7: Production Readiness Checklist

### 7.1 Functional Verification

- [ ] **Meeting Capture**: Teams meetings automatically captured via webhooks
- [ ] **AI Minutes**: Minutes generated using Azure OpenAI GPT-4o
- [ ] **Transcription**: Meeting transcripts extracted via Whisper
- [ ] **Approval Workflow**: Admin can review and approve minutes
- [ ] **Email Distribution**: Approved minutes sent to attendees
- [ ] **SharePoint Archival**: Minutes uploaded to document library
- [ ] **Archive Search**: Users can search and retrieve historical minutes
- [ ] **Teams Bot**: Notifications sent via Teams bot (optional)

### 7.2 Configuration Verification

```bash
# Run configuration check
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/config

# Verify response shows:
{
  "mockServices": false,
  "features": {
    "graphApi": true,
    "azureOpenAI": true,
    "sharePoint": true,
    "email": true,
    "teamsBot": true
  },
  "version": "1.0.0"
}
```

### 7.3 Security Verification

- [ ] **Secrets Rotation**: All secrets stored securely (not in logs)
- [ ] **Admin Consent**: All Graph permissions granted by Global Admin
- [ ] **HTTPS Only**: Application accessible only via HTTPS
- [ ] **Database Encryption**: PostgreSQL using SSL (sslmode=require)
- [ ] **Authentication**: Azure AD authentication working
- [ ] **Authorization**: Role-based access control enforced

### 7.4 Performance Verification

- [ ] **Response Time**: Dashboard loads in < 2 seconds
- [ ] **Minutes Generation**: Completes in < 60 seconds
- [ ] **Email Delivery**: Sent within 5 minutes of approval
- [ ] **SharePoint Upload**: Completes within 2 minutes
- [ ] **Search Performance**: Results returned in < 1 second
- [ ] **Concurrent Users**: Handles 10+ simultaneous users

---

## Troubleshooting Guide

### Issue: "Configuration invalid - missing required variables"

**Symptoms**: Application fails to start, logs show configuration errors

**Solution**:
```bash
# Check current environment variables
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env" \
  -o table

# Compare with required variables list (Phase 5.1)
# Redeploy with missing variables using az containerapp update --set-env-vars
```

---

### Issue: "401 Unauthorized" from Microsoft Graph

**Symptoms**: Cannot access Teams meetings, SharePoint, or send emails

**Solution**:
```bash
# 1. Verify Graph app credentials
# In Azure Portal: Azure AD → App registrations → teams-minutes-graph-app
# Check client secret is not expired

# 2. Verify admin consent granted
# API permissions → Check all permissions show "Granted for [org]"

# 3. Test token acquisition
# From Cloud Shell:
curl -X POST https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token \
  -d "client_id=<GRAPH_CLIENT_ID>" \
  -d "client_secret=<GRAPH_CLIENT_SECRET>" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "grant_type=client_credentials"

# Should return access token (not error)
# If error: Regenerate client secret and redeploy
```

---

### Issue: "Azure OpenAI rate limit exceeded"

**Symptoms**: Minutes generation fails, logs show 429 errors

**Solution**:
```bash
# 1. Check current quota usage
# Azure Portal → Azure OpenAI resource → Quotas

# 2. Increase tokens per minute limit
# Model deployments → gpt-4o-deployment → Edit
# Increase "Tokens per Minute Rate Limit" to 60K or 120K

# 3. Or reduce concurrent processing
# Application automatically retries with exponential backoff
# Wait 5-10 minutes and retry
```

---

### Issue: "SharePoint site not found"

**Symptoms**: Upload jobs fail, logs show "404 Not Found"

**Solution**:
```bash
# 1. Verify SHAREPOINT_SITE_URL is complete URL
# Correct: https://contoso.sharepoint.com/sites/MeetingMinutesArchive
# Wrong: /sites/MeetingMinutesArchive
# Wrong: https://contoso.sharepoint.com

# 2. Verify site exists and is accessible
# Open URL in browser → Should load SharePoint site

# 3. Verify Graph app has access
# Site → Settings → Site permissions
# Ensure app has at least "Read" access

# 4. Redeploy with correct URL
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars SHAREPOINT_SITE_URL="<correct-url>" \
  # ... include ALL other env vars ...
```

---

### Issue: "Meeting not captured after ending Teams call"

**Symptoms**: Meeting held, but doesn't appear in dashboard

**Solution**:
```bash
# 1. Verify meeting was recorded
# Recording is REQUIRED for transcription
# Check Teams: Chat → Files → Recordings folder

# 2. Check webhook subscription status
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/admin/webhooks

# Should show active subscriptions for onlineMeetings
# If expired: Application auto-renews every 12 hours

# 3. Check logs for webhook receipt
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 100

# Look for: [GraphWebhook] Received notification
# If not present: Webhook not configured or validation failed

# 4. Manually trigger webhook subscription renewal
# From application UI: Admin → Settings → "Renew Webhooks" button
```

---

## Cost Estimate (Production Deployment)

### Monthly Costs (100 users, 50 meetings/month)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| Azure Container Apps | 1 vCPU, 2 GB RAM | $45 |
| Azure Database for PostgreSQL | Burstable B2s | $35 |
| Azure OpenAI Service | GPT-4o, ~100K tokens/day | $150 |
| Azure Bot Service | Free tier | $0 |
| Microsoft 365 | Included with existing licenses | $0 |
| SharePoint | Included with M365 | $0 |
| **Total** | | **~$230/month** |

### Cost Optimization Tips
- Use GPT-4o-mini instead of GPT-4o (reduces OpenAI cost by 60%)
- Scale Container Apps to 0 during nights/weekends
- Use PostgreSQL reserved capacity (20% savings)
- Archive old meetings to Azure Blob Storage (cheaper than PostgreSQL)

---

## Security Best Practices

### 1. Secret Management
- Store all secrets in Azure Key Vault
- Enable managed identity for Container App
- Rotate secrets every 90 days
- Never commit secrets to version control

### 2. Network Security
- Enable Azure Front Door for DDoS protection
- Configure IP restrictions for admin endpoints
- Use Private Endpoints for PostgreSQL and Key Vault
- Enable Azure AD Conditional Access policies

### 3. Data Protection
- Enable soft delete for PostgreSQL backups
- Configure geo-redundant storage for SharePoint
- Implement retention policies (delete minutes after 7 years)
- Enable audit logging for all administrative actions

### 4. Compliance
- Document data processing for GDPR compliance
- Implement data subject access requests (DSAR)
- Configure data residency (all data in East US 2)
- Enable Microsoft Purview for compliance scanning

---

## Next Steps After Production Enablement

1. **User Training**: Schedule training sessions for admins and users
2. **Monitoring Setup**: Configure Application Insights alerts
3. **Backup Verification**: Test database restore procedures
4. **Disaster Recovery**: Document failover procedures
5. **Performance Tuning**: Monitor and optimize based on usage patterns
6. **Feature Enhancements**: Collect user feedback for improvements

---

## Support Contacts

**Azure Support**: https://portal.azure.com → Help + support → New support request

**Microsoft Graph API**: https://docs.microsoft.com/en-us/graph/

**Azure OpenAI**: https://docs.microsoft.com/en-us/azure/cognitive-services/openai/

**Application Issues**: Check logs in Azure Portal → Container Apps → Log stream

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-24  
**Status**: Ready for Production Deployment
