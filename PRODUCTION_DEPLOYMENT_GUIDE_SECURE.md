# Production Deployment Guide - Secure Method

## Overview

This guide deploys production credentials using **Azure Container Apps secrets** for enhanced security. Secrets are encrypted and not exposed in command history or logs.

---

## Deployment Method: Two-Step Secure Approach

### Why This Method?

Instead of passing secrets as inline environment variables (which exposes them in logs), we:
1. Store secrets securely in Container App's secret store
2. Reference them via environment variables

**Security Benefits**:
- ✅ Secrets encrypted at rest in Azure
- ✅ Not visible in command history
- ✅ Not exposed in application logs
- ✅ Can be rotated independently

---

## Step 1: Open Azure Cloud Shell

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Cloud Shell** icon (>_) at top right
3. Select **Bash**

---

## Step 2: Set Container App Secrets

Run these commands **one at a time**, replacing placeholder values with your actual secrets:

```bash
# Set Azure AD Graph secret
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets graph-client-secret="<PASTE_YOUR_GRAPH_CLIENT_SECRET_HERE>"

# Set Teams Bot secret
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets bot-app-password="<PASTE_YOUR_BOT_APP_PASSWORD_HERE>"

# Set Azure OpenAI API key
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets azure-openai-api-key="<PASTE_YOUR_AZURE_OPENAI_API_KEY_HERE>"

# Set Database password
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets db-password="<PASTE_YOUR_POSTGRESQL_PASSWORD_HERE>"

# Set Session secret
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets session-secret="<PASTE_YOUR_SESSION_SECRET_HERE>"
```

**⚠️ Replace each `<PASTE_YOUR_..._HERE>` with the actual secret value!**

After running all 5 commands, you should see:
```
✅ Successfully set secret 'graph-client-secret'
✅ Successfully set secret 'bot-app-password'
✅ Successfully set secret 'azure-openai-api-key'
✅ Successfully set secret 'db-password'
✅ Successfully set secret 'session-secret'
```

---

## Step 3: Update Container App Configuration

Now update the Container App to use these secrets and add non-sensitive configuration:

```bash
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars \
    "NODE_ENV=production" \
    "PORT=8080" \
    "AZURE_TENANT_ID=e6ba87bd-8d65-4db7-bdb8-708b31b9d985" \
    "GRAPH_CLIENT_ID=71383692-c5b6-40cc-94cf-96c970e414dc" \
    "BOT_APP_ID=5ea1c494-6869-4879-8dc2-16c7b57da3e3" \
    "AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=teams-minutes-demo" \
    "SHAREPOINT_SITE_URL=https://chrisbecraft.sharepoint.com" \
    "SHAREPOINT_LIBRARY_NAME=Documents" \
    "GRAPH_SENDER_EMAIL=ChristopherBecraft@ChrisBecraft.onmicrosoft.com" \
  --secrets-env-vars \
    "GRAPH_CLIENT_SECRET=secretref:graph-client-secret" \
    "BOT_APP_PASSWORD=secretref:bot-app-password" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key" \
    "SESSION_SECRET=secretref:session-secret" \
    "DATABASE_URL=secretref:db-password"
```

**Wait!** We need to construct the DATABASE_URL differently. Let me provide a corrected approach:

```bash
# First, set the full DATABASE_URL as a secret
az containerapp secret set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --secrets database-url="postgresql://adminuser:<YOUR_DB_PASSWORD>@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require"
```

Replace `<YOUR_DB_PASSWORD>` with your actual PostgreSQL password.

**Then run the update command**:

```bash
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars \
    "NODE_ENV=production" \
    "PORT=8080" \
    "AZURE_TENANT_ID=e6ba87bd-8d65-4db7-bdb8-708b31b9d985" \
    "GRAPH_CLIENT_ID=71383692-c5b6-40cc-94cf-96c970e414dc" \
    "BOT_APP_ID=5ea1c494-6869-4879-8dc2-16c7b57da3e3" \
    "AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=teams-minutes-demo" \
    "SHAREPOINT_SITE_URL=https://chrisbecraft.sharepoint.com" \
    "SHAREPOINT_LIBRARY_NAME=Documents" \
    "GRAPH_SENDER_EMAIL=ChristopherBecraft@ChrisBecraft.onmicrosoft.com" \
  --secrets-env-vars \
    "GRAPH_CLIENT_SECRET=secretref:graph-client-secret" \
    "BOT_APP_PASSWORD=secretref:bot-app-password" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key" \
    "SESSION_SECRET=secretref:session-secret" \
    "DATABASE_URL=secretref:database-url"
```

---

## Step 4: Monitor Deployment (60-90 seconds)

```bash
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table
```

Wait for the new revision to show as "Active" and "Running".

---

## Step 5: Verify Logs

```bash
az containerapp logs tail \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow
```

**Look for**:
```
✅ Configuration valid for PRODUCTION MODE
   All Microsoft 365 integrations enabled
```

---

## Step 6: Test Health Endpoint

```bash
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
```

Expected:
```json
{"status":"healthy","timestamp":"2025-11-25T...","version":"1.0.0"}
```

---

## What Changed?

### Before (Insecure):
```bash
--set-env-vars "GRAPH_CLIENT_SECRET=abc123xyz..."  # ❌ Exposed in logs
```

### After (Secure):
```bash
az containerapp secret set ... --secrets graph-client-secret="abc123xyz..."  # ✅ Encrypted
--secrets-env-vars "GRAPH_CLIENT_SECRET=secretref:graph-client-secret"      # ✅ Reference only
```

---

## Production Features Enabled ✅

1. **Microsoft Graph** - Meeting capture, email, SharePoint
2. **Azure OpenAI** - GPT-4o minutes generation  
3. **SharePoint** - Document archival to `chrisbecraft.sharepoint.com/Documents`
4. **Email** - Automated distribution from `ChristopherBecraft@ChrisBecraft.onmicrosoft.com`

---

## Troubleshooting

### Verify secrets are set:
```bash
az containerapp secret list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table
```

### Check environment variables:
```bash
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env" \
  --output json
```

---

## Security Best Practices ✅

- ✅ Secrets stored encrypted in Azure
- ✅ Not visible in command history (after initial `secret set`)
- ✅ Not exposed in application logs
- ✅ Can be rotated without redeployment
- ✅ Follows Azure security recommendations

---

## Next Steps

1. **Configure Teams Bot messaging endpoint**
2. **Set up Graph webhook subscriptions** (automatic)
3. **Test end-to-end workflow** with a Teams meeting

**Your application is now running in full production mode with Microsoft 365 integration!** 🎉
