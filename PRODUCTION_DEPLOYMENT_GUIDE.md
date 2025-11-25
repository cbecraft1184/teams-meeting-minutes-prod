# Production Deployment Guide - Azure Container Apps

## Overview

This guide will help you deploy all production Microsoft 365 credentials to your Azure Container App, transitioning from mock services to full production functionality.

---

## Prerequisites ✅

You have collected all required credentials:

### Azure AD Credentials
- `AZURE_TENANT_ID=e6ba87bd-8d65-4db7-bdb8-708b31b9d985`
- `GRAPH_CLIENT_ID=71383692-c5b6-40cc-94cf-96c970e414dc`
- `GRAPH_CLIENT_SECRET=<your saved secret>`
- `BOT_APP_ID=5ea1c494-6869-4879-8dc2-16c7b57da3e3`
- `BOT_APP_PASSWORD=<your saved new secret>`

### Azure OpenAI Credentials
- `AZURE_OPENAI_API_KEY=<your saved key>`
- `AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/`
- `AZURE_OPENAI_DEPLOYMENT_NAME=teams-minutes-demo`

### SharePoint & Email Configuration
- `SHAREPOINT_SITE_URL=https://chrisbecraft.sharepoint.com`
- `SHAREPOINT_LIBRARY_NAME=Documents`
- `GRAPH_SENDER_EMAIL=ChristopherBecraft@ChrisBecraft.onmicrosoft.com`

### Existing Secrets (from current deployment)
- `DATABASE_URL` (PostgreSQL connection string with password)
- `SESSION_SECRET` (existing session secret)

---

## Deployment Steps

### Step 1: Open Azure Cloud Shell

1. Go to [Azure Portal](https://portal.azure.com)
2. Click the **Cloud Shell icon** (>_) at the top right
3. Select **Bash** if prompted

---

### Step 2: Prepare Environment Variables

In Cloud Shell, create environment variables with your secret values:

```bash
# Azure AD Secrets (replace with your actual values)
export GRAPH_CLIENT_SECRET="<paste your Graph client secret>"
export BOT_APP_PASSWORD="<paste your Bot password>"

# Azure OpenAI Secret (replace with your actual value)
export AZURE_OPENAI_API_KEY="<paste your Azure OpenAI API key>"

# Database Password (from your original deployment)
export DB_PASSWORD="<paste your PostgreSQL admin password>"

# Session Secret (from your original deployment)
export SESSION_SECRET="<paste your session secret>"
```

**⚠️ Important**: Replace the placeholder values with your actual secrets!

---

### Step 3: Deploy Production Configuration

Run this single command to update your Container App:

```bash
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars \
    "DATABASE_URL=postgresql://adminuser:${DB_PASSWORD}@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require" \
    "SESSION_SECRET=${SESSION_SECRET}" \
    "NODE_ENV=production" \
    "PORT=8080" \
    "AZURE_TENANT_ID=e6ba87bd-8d65-4db7-bdb8-708b31b9d985" \
    "GRAPH_CLIENT_ID=71383692-c5b6-40cc-94cf-96c970e414dc" \
    "GRAPH_CLIENT_SECRET=${GRAPH_CLIENT_SECRET}" \
    "BOT_APP_ID=5ea1c494-6869-4879-8dc2-16c7b57da3e3" \
    "BOT_APP_PASSWORD=${BOT_APP_PASSWORD}" \
    "AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}" \
    "AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=teams-minutes-demo" \
    "SHAREPOINT_SITE_URL=https://chrisbecraft.sharepoint.com" \
    "SHAREPOINT_LIBRARY_NAME=Documents" \
    "GRAPH_SENDER_EMAIL=ChristopherBecraft@ChrisBecraft.onmicrosoft.com"
```

**What this does**:
- Updates Container App with 15 production environment variables
- **Removes** `USE_MOCK_SERVICES` (by not including it, production mode is enabled)
- Creates a new revision with full Microsoft 365 integration
- Takes ~60-90 seconds to deploy

---

### Step 4: Monitor Deployment

Watch the deployment progress:

```bash
# Check revision status (wait for "Running" and "Active")
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table
```

Expected output:
```
Name                                   Active    Created
-------------------------------------  --------  -------------------------
teams-minutes-app--<revision-id>      True      2025-11-25T...
```

---

### Step 5: Verify Deployment

Check application logs for successful startup:

```bash
az containerapp logs tail \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow
```

**Look for these success indicators**:
```
✅ Configuration valid for PRODUCTION MODE
   All Microsoft 365 integrations enabled
   
[express] serving on port 8080
✅ [JobWorker] Worker lock acquired
[JobWorker] Starting job processing loop...
```

---

### Step 6: Test Health Endpoint

```bash
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2025-11-25T...","version":"1.0.0"}
```

---

## Production Features Now Active ✅

After successful deployment:

1. **Microsoft Graph Integration** ✅
   - Capture Teams meeting recordings via webhooks
   - Access user calendars and meeting details
   - Send emails via Graph API

2. **Azure OpenAI Integration** ✅
   - GPT-4o for intelligent meeting minutes generation
   - Whisper for audio transcription
   - Structured output (summaries, decisions, action items)

3. **SharePoint Integration** ✅
   - Automatic archival to `https://chrisbecraft.sharepoint.com/Documents`
   - DOCX and PDF exports
   - Organized folder structure by date

4. **Email Distribution** ✅
   - Automated email notifications
   - PDF/DOCX attachments
   - Sent from: `ChristopherBecraft@ChrisBecraft.onmicrosoft.com`

---

## Troubleshooting

### Issue: Deployment fails with "Unhealthy"

**Check logs**:
```bash
az containerapp logs tail --name teams-minutes-app --resource-group rg-teams-minutes-demo
```

**Common causes**:
- Invalid secret value (check for typos)
- Missing environment variable
- Database connection failure

**Solution**: Re-run deployment with corrected values

---

### Issue: Application starts but errors in logs

**Verify configuration**:
```bash
# Check environment variables are set correctly
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env" \
  --output json
```

---

### Issue: Graph API permissions errors

**Verify admin consent**:
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Click on "Teams-Minutes-Graph-Daemon"
3. Go to "API permissions"
4. Ensure all permissions show green checkmarks (admin consent granted)

**Re-grant consent if needed**:
```
Click "Grant admin consent for [tenant]"
```

---

## Rollback Procedure

If deployment fails and you need to rollback:

```bash
# List revisions
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table

# Activate previous revision (replace <previous-revision-name>)
az containerapp revision activate \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --revision <previous-revision-name>
```

---

## Next Steps After Successful Deployment

1. **Configure Teams Bot Messaging Endpoint**
   - Go to Azure Bot Service configuration
   - Set messaging endpoint to: `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/messages`

2. **Set up Graph Webhook Subscriptions**
   - Application will automatically create webhooks for meeting events
   - Test by scheduling a Teams meeting

3. **Test End-to-End Workflow**
   - Schedule test meeting
   - Verify capture and AI generation
   - Check SharePoint archival
   - Confirm email delivery

---

## Support

**Deployment Issues**: Check logs and verify all secrets are correct

**Microsoft 365 Integration Issues**: Verify app registration permissions and admin consent

**Application Issues**: Review Container App logs for detailed error messages
