# Installation Manual

## Teams Meeting Minutes Application

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Audience:** IT Administrators, DevOps Engineers  
**Platform:** Azure Commercial Cloud (Not applicable to Azure Government or other sovereign clouds)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Pre-Installation Checklist](#pre-installation-checklist)
4. [Azure Resource Provisioning](#azure-resource-provisioning)
5. [Azure AD App Registration](#azure-ad-app-registration)
6. [Database Setup](#database-setup)
7. [Application Deployment](#application-deployment)
8. [Teams App Configuration](#teams-app-configuration)
9. [Post-Installation Verification](#post-installation-verification)
10. [Rollback Procedures](#rollback-procedures)

---

## 1. Introduction

### Purpose

This Installation Manual provides step-by-step instructions for deploying the Teams Meeting Minutes application to Azure Commercial Cloud. Follow these instructions carefully to ensure a successful deployment.

### Scope

This manual covers:

- Azure resource provisioning
- Application deployment to Azure Container Apps
- Microsoft 365 integration configuration
- Teams app deployment

### Deployment Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Architecture                       │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Azure Container │    │ Azure Database  │                     │
│  │ Registry        │───>│ for PostgreSQL  │                     │
│  └─────────────────┘    └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Azure Container │───>│ Azure OpenAI    │                     │
│  │ Apps            │    │ Service         │                     │
│  └─────────────────┘    └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Microsoft Teams │                                            │
│  │ (End Users)     │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Estimated Time

| Phase | Duration |
|-------|----------|
| Azure resource provisioning | 30-45 minutes |
| App registration and configuration | 30 minutes |
| Application deployment | 15-30 minutes |
| Teams app deployment | 15 minutes |
| Verification and testing | 30 minutes |
| **Total** | **2-3 hours** |

---

## 2. Prerequisites

### Azure Subscription Requirements

| Requirement | Details |
|-------------|---------|
| Subscription type | Azure Commercial (Pay-As-You-Go or Enterprise) |
| Role | Contributor or Owner on subscription |
| Azure AD role | Application Administrator (for app registration) |
| Resource providers | Microsoft.App, Microsoft.CognitiveServices registered |

### Microsoft 365 Requirements

| Requirement | Details |
|-------------|---------|
| Tenant type | Microsoft 365 Commercial |
| License | Microsoft 365 E3/E5 or Teams Premium |
| Admin role | Global Administrator (initial setup) |
| Teams admin role | Teams Administrator |

### Azure OpenAI Access

Azure OpenAI requires application approval. Ensure you have:

1. Applied for Azure OpenAI access at https://aka.ms/oai/access
2. Received approval confirmation
3. Created Azure OpenAI resource in supported region

### Required Tools

Install on your workstation:

| Tool | Version | Download URL |
|------|---------|--------------|
| Azure CLI | Latest | https://docs.microsoft.com/cli/azure/install-azure-cli |
| Node.js | 18.x LTS | https://nodejs.org |
| Git | Latest | https://git-scm.com |
| Docker | Latest | https://docker.com (optional for local builds) |

Verify installations:

```bash
az --version
node --version
git --version
docker --version  # optional
```

---

## 3. Pre-Installation Checklist

Complete all items before proceeding:

### Azure Setup

- [ ] Azure subscription is active with billing enabled
- [ ] Logged in to Azure CLI: `az login`
- [ ] Selected correct subscription: `az account show`
- [ ] Azure OpenAI access approved

### Microsoft 365 Setup

- [ ] Global Administrator credentials available
- [ ] Teams Administrator credentials available
- [ ] Microsoft 365 tenant ID noted

### Information to Gather

Collect and record the following before installation:

| Item | Value | Notes |
|------|-------|-------|
| Azure Subscription ID | | `az account show --query id` |
| Azure Tenant ID | | `az account show --query tenantId` |
| Deployment Region | East US 2 | Recommended for Azure OpenAI |
| Application URL | | Will be assigned during deployment |
| Database admin password | | Create secure password |
| Session secret | | Generate random 32+ character string |

---

## 4. Azure Resource Provisioning

### Step 4.1: Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="rg-teams-minutes-prod"
LOCATION="eastus2"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

### Step 4.2: Create Azure Database for PostgreSQL

```bash
# Set database variables
DB_SERVER_NAME="teams-minutes-db-prod"
DB_ADMIN_USER="tmadmin"
DB_ADMIN_PASSWORD="YourSecurePassword123!"  # Change this!
DB_NAME="teams_minutes"

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME
```

Note the connection string:
```
postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require
```

### Step 4.3: Create Azure Container Registry

```bash
ACR_NAME="teamsminutesacrprod"

az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

### Step 4.4: Create Azure Container Apps Environment

```bash
ENVIRONMENT_NAME="teams-minutes-env-prod"

az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

### Step 4.5: Create Azure OpenAI Resource

```bash
OPENAI_NAME="teams-minutes-openai-prod"

az cognitiveservices account create \
  --name $OPENAI_NAME \
  --resource-group $RESOURCE_GROUP \
  --kind OpenAI \
  --sku S0 \
  --location $LOCATION
```

After creation, deploy GPT-4o model:

1. Open Azure Portal > Azure OpenAI resource
2. Go to Model deployments
3. Click Create new deployment
4. Select gpt-4o model
5. Name the deployment (e.g., "gpt-4o")
6. Set capacity as needed

Note the endpoint and key:
```bash
# Get endpoint
az cognitiveservices account show \
  --name $OPENAI_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.endpoint -o tsv

# Get key
az cognitiveservices account keys list \
  --name $OPENAI_NAME \
  --resource-group $RESOURCE_GROUP \
  --query key1 -o tsv
```

---

## 5. Azure AD App Registration

### Step 5.1: Create App Registration

1. Open Azure Portal > Azure Active Directory > App registrations
2. Click **New registration**
3. Enter:
   - Name: `Teams Meeting Minutes`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: Leave blank for now
4. Click **Register**
5. Note the **Application (client) ID** and **Directory (tenant) ID**

### Step 5.2: Create Client Secret

1. In app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Enter description: "Production Secret"
4. Select expiration: 24 months (set calendar reminder for rotation)
5. Click **Add**
6. **Immediately copy the secret value** (it won't be shown again)

### Step 5.3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Add the following Microsoft Graph permissions:

**Delegated permissions:**
- User.Read
- Calendars.Read
- OnlineMeetings.Read

**Application permissions:**
- CallRecords.Read.All

4. Click **Grant admin consent for [Your Tenant]**

### Step 5.4: Configure Expose an API

1. Go to **Expose an API**
2. Click **Set** next to Application ID URI
3. Accept the default or set: `api://{your-app-url}/{client-id}`
4. Click **Add a scope**:
   - Scope name: `access_as_user`
   - Who can consent: Admins and users
   - Admin consent display name: `Access Meeting Minutes`
   - Admin consent description: `Allows the app to access meeting minutes on behalf of the user`
   - State: Enabled
5. Click **Add scope**

### Step 5.5: Authorize Teams Clients

1. Still in **Expose an API**, click **Add a client application**
2. Add each Teams client ID:

| Client ID | Description |
|-----------|-------------|
| `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Teams desktop/mobile |
| `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` | Teams web |

3. Select the `access_as_user` scope for each

---

## 6. Database Setup

### Step 6.1: Configure Firewall

Allow Azure services to access the database:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 6.2: Initialize Schema

From your development machine with the source code:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"

# Push schema to database
npm run db:push
```

Verify tables were created:

```bash
psql "$DATABASE_URL" -c "\dt"
```

Expected tables:
- users
- meetings
- meeting_minutes
- action_items
- meeting_events
- job_queue
- attendees
- graph_webhook_subscriptions

---

## 7. Application Deployment

### Step 7.1: Build Container Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push image
docker build -t $ACR_NAME.azurecr.io/teams-minutes:latest .
docker push $ACR_NAME.azurecr.io/teams-minutes:latest
```

Or use ACR Tasks:

```bash
az acr build \
  --registry $ACR_NAME \
  --image teams-minutes:latest \
  .
```

### Step 7.2: Deploy to Container Apps

```bash
# Get ACR credentials
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Create Container App
az containerapp create \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/teams-minutes:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 5000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi
```

### Step 7.3: Configure Environment Variables

```bash
# Get values from earlier steps
CLIENT_ID="your-client-id"
CLIENT_SECRET="your-client-secret"
TENANT_ID="your-tenant-id"
OPENAI_ENDPOINT="https://your-openai.openai.azure.com"
OPENAI_KEY="your-openai-key"
SESSION_SECRET=$(openssl rand -hex 32)

az containerapp update \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "DATABASE_URL=$DATABASE_URL" \
    "AZURE_TENANT_ID=$TENANT_ID" \
    "AZURE_CLIENT_ID=$CLIENT_ID" \
    "AZURE_CLIENT_SECRET=$CLIENT_SECRET" \
    "AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT" \
    "AZURE_OPENAI_API_KEY=$OPENAI_KEY" \
    "AZURE_OPENAI_DEPLOYMENT=gpt-4o" \
    "SESSION_SECRET=$SESSION_SECRET" \
    "NODE_ENV=production" \
    "ENABLE_JOB_WORKER=true" \
    "ENABLE_GRAPH_WEBHOOKS=true"
```

### Step 7.4: Get Application URL

```bash
APP_URL=$(az containerapp show \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Application URL: https://$APP_URL"
```

### Step 7.5: Update App Registration

Update the Azure AD app registration with the actual URL:

1. Go to Azure Portal > App registrations > Teams Meeting Minutes
2. Update **Expose an API** > Application ID URI:
   ```
   api://{APP_URL}/{CLIENT_ID}
   ```
3. Add redirect URI if needed

---

## 8. Teams App Configuration

### Step 8.1: Update Manifest

Edit `teams-app/manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "{CLIENT_ID}",
  "packageName": "com.company.meetingminutes",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://{APP_URL}",
    "privacyUrl": "https://{APP_URL}/privacy",
    "termsOfUseUrl": "https://{APP_URL}/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "AI-Powered Meeting Minutes"
  },
  "description": {
    "short": "Automatic meeting minutes generation",
    "full": "AI-powered application that automatically captures Teams meetings and generates professional meeting minutes."
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "accentColor": "#0078D4",
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://{APP_URL}",
      "scopes": ["personal"]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["{APP_URL}"],
  "webApplicationInfo": {
    "id": "{CLIENT_ID}",
    "resource": "api://{APP_URL}/{CLIENT_ID}"
  }
}
```

Replace all `{APP_URL}` and `{CLIENT_ID}` placeholders.

### Step 8.2: Create App Package

```bash
cd teams-app

# Create ZIP package
zip -r teams-minutes-app.zip manifest.json color.png outline.png
```

### Step 8.3: Upload to Teams Admin Center

1. Go to https://admin.teams.microsoft.com
2. Navigate to **Teams apps** > **Manage apps**
3. Click **Upload new app** > **Upload**
4. Select the ZIP file
5. Review app details and click **Add**

### Step 8.4: Set App Policies

1. In Teams Admin Center, go to **Teams apps** > **Setup policies**
2. Select or create a policy
3. Under **Pinned apps**, click **Add apps**
4. Search for "Meeting Minutes" and add it
5. Assign the policy to target users

---

## 9. Post-Installation Verification

### Verification Checklist

Complete each verification step:

- [ ] **Health Check**
  ```bash
  curl https://{APP_URL}/health
  # Expected: 200 OK
  ```

- [ ] **Database Connection**
  ```bash
  curl https://{APP_URL}/api/health
  # Expected: JSON with database status
  ```

- [ ] **Teams App Visible**
  - Open Teams
  - Check left sidebar for Meeting Minutes app
  - Click to open

- [ ] **Authentication Works**
  - App should load dashboard
  - User name displayed in header
  - No error messages

- [ ] **Dashboard Loads**
  - Stats cards visible
  - No JavaScript errors in console

### Smoke Test

1. Open Teams
2. Launch Meeting Minutes app from sidebar
3. Verify dashboard displays
4. Check that your role is correctly shown
5. Navigate to Settings page
6. Navigate to Help page

### Log Verification

Check application logs for errors:

```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP \
  --follow
```

Look for:
- Successful startup messages
- No connection errors
- Webhook registration (if enabled)

---

## 10. Rollback Procedures

### Rollback Application

To revert to a previous version:

```bash
# List revisions
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP

# Activate previous revision
az containerapp revision activate \
  --name teams-minutes-app \
  --resource-group $RESOURCE_GROUP \
  --revision {previous-revision-name}
```

### Rollback Database

For database issues, restore from backup:

1. Azure Portal > PostgreSQL server
2. Click **Restore**
3. Select restore point (time-based)
4. Create new server with restored data
5. Update application's DATABASE_URL

### Complete Rollback

If installation fails completely:

```bash
# Delete all resources
az group delete --name $RESOURCE_GROUP --yes

# Remove Teams app from admin center manually
```

---

## Appendix A: Resource Naming Conventions

| Resource | Naming Pattern | Example |
|----------|----------------|---------|
| Resource Group | `rg-{app}-{env}` | `rg-teams-minutes-prod` |
| Container App | `{app}-app` | `teams-minutes-app` |
| Container Registry | `{app}acr{env}` | `teamsminutesacrprod` |
| PostgreSQL Server | `{app}-db-{env}` | `teams-minutes-db-prod` |
| OpenAI Resource | `{app}-openai-{env}` | `teams-minutes-openai-prod` |

## Appendix B: Required Ports and URLs

| Service | Port | URL Pattern |
|---------|------|-------------|
| Application | 443 | `https://{app}.{region}.azurecontainerapps.io` |
| PostgreSQL | 5432 | `{server}.postgres.database.azure.com` |
| Azure OpenAI | 443 | `https://{resource}.openai.azure.com` |
| Microsoft Graph | 443 | `https://graph.microsoft.com` |
| Azure AD | 443 | `https://login.microsoftonline.com` |

## Appendix C: Cost Estimation

| Resource | SKU | Estimated Monthly Cost |
|----------|-----|------------------------|
| Container Apps | 0.5 vCPU, 1 GB | ~$20-50 |
| PostgreSQL Flexible | B1ms | ~$15-25 |
| Azure OpenAI | S0 + usage | ~$50-200 (varies) |
| Container Registry | Basic | ~$5 |
| **Total** | | **~$90-280/month** |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 4, 2025 | System | Initial release |

---

*This document contains sensitive deployment information. Handle according to your organization's security policies.*
