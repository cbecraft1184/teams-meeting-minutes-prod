# Teams Meeting Minutes - Azure Deployment Runbook
## Commercial Azure Demo Deployment

**Version:** 1.0  
**Target Environment:** Commercial Azure (East US)  
**Estimated Total Time:** 4-6 hours  
**Difficulty:** Intermediate

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Phase 1: Azure Infrastructure Deployment](#phase-1-azure-infrastructure-deployment)
3. [Phase 2: Azure AD App Registrations](#phase-2-azure-ad-app-registrations)
4. [Phase 3: Configure Secrets](#phase-3-configure-secrets)
5. [Phase 4: Deploy Application Code](#phase-4-deploy-application-code)
6. [Phase 5: Initialize Database](#phase-5-initialize-database)
7. [Phase 6: Microsoft Teams Integration](#phase-6-microsoft-teams-integration)
8. [Phase 7: Azure OpenAI Setup](#phase-7-azure-openai-setup)
9. [Phase 8: SharePoint Integration](#phase-8-sharepoint-integration)
10. [Phase 9: Validation & Testing](#phase-9-validation--testing)
11. [Phase 10: Monitoring & Operations](#phase-10-monitoring--operations)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
✅ **Check each item before proceeding:**

- [ ] **Azure CLI** (v2.50+)
  ```bash
  az --version
  # If not installed: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
  ```

- [ ] **Bicep CLI** (auto-installed with Azure CLI)
  ```bash
  az bicep version
  ```

- [ ] **perl** (required for parameter substitution)
  ```bash
  perl --version
  # macOS: pre-installed
  # Ubuntu/Debian: sudo apt-get install perl
  ```

- [ ] **jq** (optional but recommended)
  ```bash
  jq --version
  # macOS: brew install jq
  # Ubuntu/Debian: sudo apt-get install jq
  ```

- [ ] **Node.js** (v18+)
  ```bash
  node --version
  npm --version
  ```

### Required Access & Information

- [ ] **Azure Subscription**
  - Subscription ID: `_______________________`
  - Subscription Name: `_______________________`
  - Required Roles: **Contributor** + **User Access Administrator**

- [ ] **Microsoft 365 Tenant**
  - Tenant ID: `_______________________`
  - Tenant Domain: `_______________________.onmicrosoft.com`
  - Required Roles: **Global Administrator** or **Application Administrator**

- [ ] **Contact Information**
  - Admin Email (for alerts): `_______________________`
  - Operations Contact: `_______________________`

### Pre-Deployment Checklist

- [ ] Azure CLI logged in and verified
- [ ] Correct subscription selected
- [ ] M365 tenant admin access confirmed
- [ ] All tools installed and versions verified
- [ ] Network connectivity to Azure Portal
- [ ] Estimated cost reviewed (~$750-850/month)

---

## Phase 1: Azure Infrastructure Deployment

**Objective:** Deploy all Azure resources using Infrastructure-as-Code  
**Time Estimate:** 20-30 minutes  
**Dependencies:** None

### Step 1.1: Login to Azure

```bash
# Login to Azure
az login

# List available subscriptions
az account list --output table

# Set the correct subscription
az account set --subscription "<your-subscription-id>"

# Verify
az account show --output table
```

**Expected Output:**
```
Name                     CloudName    SubscriptionId                        State    IsDefault
-----------------------  -----------  ------------------------------------  -------  -----------
Your Subscription Name   AzureCloud   12345678-1234-1234-1234-123456789012  Enabled  True
```

### Step 1.2: Navigate to Infrastructure Directory

```bash
cd azure-infrastructure
```

### Step 1.3: Review Parameter File

```bash
cat parameters/demo.bicepparam
```

**Verify these values will be auto-populated:**
- `azureAdTenantId` → Auto-filled from `az account show`
- `adminEmail` → You'll be prompted during deployment

### Step 1.4: Execute Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

**Interactive Prompts:**
1. **Confirm subscription:** Type `yes` when prompted
2. **Enter admin email:** Provide email for Azure Monitor alerts
   - Supports special characters: `admin+alerts@example.com`, `o'connor@example.mil`

**Deployment Progress:**
```
[INFO] Starting deployment: tmm-demo-20231118-143022
[INFO] This may take 15-30 minutes. Please be patient...

Creating resource group...
Deploying managed identity...
Deploying virtual network...
Deploying PostgreSQL database... (longest step)
Deploying Azure OpenAI...
Deploying App Service...
Deploying Front Door...
Deploying Key Vault...
Deploying monitoring resources...

✓ Deployment completed successfully
```

### Step 1.5: Capture Deployment Outputs

**If jq is installed:**
```
═══════════════════════════════════════════════════════════════
  Deployment Outputs
═══════════════════════════════════════════════════════════════
Resource Group:       tmm-demo-eastus
App Service:          tmm-app-demo
App Service URL:      https://tmm-app-demo.azurewebsites.net
Front Door Endpoint:  https://tmm-demo-xyz.azurefd.net
Key Vault:            tmm-kv-demo-xyz
Database Host:        tmm-pg-demo.postgres.database.azure.com
OpenAI Endpoint:      https://tmm-openai-demo.openai.azure.com
App Insights:         tmm-ai-demo
═══════════════════════════════════════════════════════════════
```

**Copy these values to your notes:**
- Resource Group: `_______________________`
- App Service Name: `_______________________`
- Front Door Endpoint: `_______________________`
- Key Vault Name: `_______________________`
- Database Host: `_______________________`
- OpenAI Endpoint: `_______________________`

**If jq is NOT installed:**
```bash
# Manually retrieve outputs
DEPLOYMENT_NAME="tmm-demo-YYYYMMDD-HHMMSS"  # Use actual name from output
az deployment sub show --name $DEPLOYMENT_NAME --query properties.outputs --output table
```

### Step 1.6: Verify Deployment

```bash
RESOURCE_GROUP="tmm-demo-eastus"

# List all deployed resources
az resource list --resource-group $RESOURCE_GROUP --output table

# Verify App Service
az webapp show --name tmm-app-demo --resource-group $RESOURCE_GROUP --query "{name:name,state:state,hostNames:defaultHostName}" --output table

# Verify PostgreSQL
az postgres flexible-server show --name tmm-pg-demo --resource-group $RESOURCE_GROUP --query "{name:name,state:state,version:version}" --output table

# Verify Azure OpenAI
az cognitiveservices account show --name tmm-openai-demo --resource-group $RESOURCE_GROUP --query "{name:name,kind:kind,location:location}" --output table
```

**Expected State:** All resources should show as "Succeeded" or "Running"

### Phase 1 Completion Checklist

- [ ] Deployment completed without errors
- [ ] All resources visible in Azure Portal
- [ ] `deployment-info.txt` file created
- [ ] Outputs captured and documented
- [ ] Resources verified via Azure CLI

**Troubleshooting Phase 1:**
- **Deployment fails at PostgreSQL:** Check quota limits in subscription
- **Key Vault access denied:** Verify User Access Administrator role
- **Timeout errors:** Re-run `./deploy.sh` (idempotent)

---

## Phase 2: Azure AD App Registrations

**Objective:** Create Azure AD applications for authentication and Microsoft Graph access  
**Time Estimate:** 15-20 minutes  
**Dependencies:** Phase 1 complete

### Step 2.1: Create Frontend SPA Registration

```bash
# Set variables
FRONT_DOOR_ENDPOINT="<your-frontdoor-endpoint>"  # From Phase 1 outputs

# Create SPA app registration
FRONTEND_APP_ID=$(az ad app create \
  --display-name "Teams Minutes - Frontend SPA" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://${FRONT_DOOR_ENDPOINT}/auth/callback" "http://localhost:5000/auth/callback" \
  --enable-id-token-issuance true \
  --query appId -o tsv)

echo "Frontend App ID: $FRONTEND_APP_ID"
```

**Save this value:**
- Frontend App (Client) ID: `_______________________`

### Step 2.2: Create Backend API Registration

```bash
# Create API app registration
BACKEND_APP_ID=$(az ad app create \
  --display-name "Teams Minutes - Backend API" \
  --sign-in-audience "AzureADMyOrg" \
  --query appId -o tsv)

echo "Backend App ID: $BACKEND_APP_ID"
```

**Save this value:**
- Backend App (Client) ID: `_______________________`

### Step 2.3: Expose Backend API

```bash
# Generate API URI
API_URI="api://${BACKEND_APP_ID}"

# Expose API scope
az ad app update \
  --id $BACKEND_APP_ID \
  --identifier-uris $API_URI

# Add API scope
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope
```

### Step 2.4: Grant Microsoft Graph Permissions

**Required permissions for the backend API:**

```bash
# Microsoft Graph API permissions
# OnlineMeetings.ReadWrite.All (Application)
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    3b55498e-47ec-484f-8136-9013221c06a=Role

# Calendars.Read (Delegated)
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    465a38f9-76ea-45b9-9f34-9e8b0d4b0b3a=Scope

# Sites.Selected (Application) - for SharePoint
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    883ea226-0bf2-4a8f-9f9d-92c9162a727d=Role

# Mail.Send (Application) - for email distribution
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    b633e1c5-b582-4048-a93e-9f11b44c7e96=Role

# User.Read (Delegated)
az ad app permission add \
  --id $BACKEND_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope
```

### Step 2.5: Grant Admin Consent

**IMPORTANT:** This requires Global Administrator or Privileged Role Administrator

```bash
# Grant admin consent for all permissions
az ad app permission admin-consent --id $BACKEND_APP_ID
```

**Alternative via Azure Portal:**
1. Navigate to: Azure Portal → Azure Active Directory → App registrations
2. Select "Teams Minutes - Backend API"
3. Click "API permissions"
4. Click "Grant admin consent for [Your Organization]"
5. Confirm

### Step 2.6: Create Client Secret

```bash
# Create client secret (valid for 12 months)
BACKEND_CLIENT_SECRET=$(az ad app credential reset \
  --id $BACKEND_APP_ID \
  --years 1 \
  --query password -o tsv)

echo "Backend Client Secret: $BACKEND_CLIENT_SECRET"
echo "⚠️  SAVE THIS SECRET - IT WILL NOT BE SHOWN AGAIN"
```

**Save this value immediately:**
- Backend Client Secret: `_______________________`

### Phase 2 Completion Checklist

- [ ] Frontend app registration created
- [ ] Backend app registration created
- [ ] API exposed with correct URI
- [ ] All Graph API permissions added
- [ ] Admin consent granted (verified in Portal)
- [ ] Client secret created and saved
- [ ] All App IDs documented

**Verification:**
```bash
# Verify permissions granted
az ad app permission list --id $BACKEND_APP_ID --output table
```

---

## Phase 3: Configure Secrets

**Objective:** Populate Azure Key Vault with all application secrets  
**Time Estimate:** 10-15 minutes  
**Dependencies:** Phase 1, Phase 2 complete

### Step 3.1: Set Variables

```bash
KEY_VAULT_NAME="<from-phase-1-outputs>"  # Example: tmm-kv-demo-xyz
RESOURCE_GROUP="tmm-demo-eastus"
DATABASE_HOST="<from-phase-1-outputs>"  # Example: tmm-pg-demo.postgres.database.azure.com
OPENAI_ENDPOINT="<from-phase-1-outputs>"  # Example: https://tmm-openai-demo.openai.azure.com
TENANT_ID=$(az account show --query tenantId -o tsv)

# From Phase 2
FRONTEND_APP_ID="<saved-from-phase-2>"
BACKEND_APP_ID="<saved-from-phase-2>"
BACKEND_CLIENT_SECRET="<saved-from-phase-2>"
```

### Step 3.2: Database Connection String

```bash
# Construct PostgreSQL connection string
DB_USER="tmm_admin"
DB_NAME="meetings_db"
DB_PASSWORD="<generate-strong-password>"  # Generate a secure password

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DATABASE_HOST}/${DB_NAME}?sslmode=require"

# Store in Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name database-url \
  --value "$DATABASE_URL"
```

### Step 3.3: Session Secret

```bash
# Generate secure session secret
SESSION_SECRET=$(openssl rand -base64 32)

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name session-secret \
  --value "$SESSION_SECRET"
```

### Step 3.4: Azure AD Credentials

```bash
# Frontend App ID
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-ad-client-id \
  --value "$FRONTEND_APP_ID"

# Backend App ID (for Graph API calls)
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name graph-client-id \
  --value "$BACKEND_APP_ID"

# Backend Client Secret
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name graph-client-secret \
  --value "$BACKEND_CLIENT_SECRET"

# Tenant ID
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-ad-tenant-id \
  --value "$TENANT_ID"
```

### Step 3.5: Azure OpenAI Credentials

```bash
# Get OpenAI API key
OPENAI_API_KEY=$(az cognitiveservices account keys list \
  --name tmm-openai-demo \
  --resource-group $RESOURCE_GROUP \
  --query key1 -o tsv)

# Store OpenAI secrets
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-openai-endpoint \
  --value "$OPENAI_ENDPOINT"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-openai-api-key \
  --value "$OPENAI_API_KEY"

# Deployment names (as configured in Bicep)
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-openai-deployment \
  --value "gpt-4o"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-openai-whisper-deployment \
  --value "whisper"
```

### Step 3.6: SharePoint Configuration (Placeholder)

```bash
# These will be populated in Phase 8
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name sharepoint-site-url \
  --value "https://yourtenant.sharepoint.com/sites/TeamsMeetingMinutes"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name sharepoint-library \
  --value "Meeting Minutes"
```

### Step 3.7: Grant App Service Access to Key Vault

```bash
# Get App Service managed identity principal ID
APP_SERVICE_PRINCIPAL_ID=$(az webapp identity show \
  --name tmm-app-demo \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant "Key Vault Secrets User" role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $APP_SERVICE_PRINCIPAL_ID \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${KEY_VAULT_NAME}"
```

### Step 3.8: Verify Secrets

```bash
# List all secrets
az keyvault secret list --vault-name $KEY_VAULT_NAME --query "[].name" --output table
```

**Expected secrets:**
```
Name
----------------------------
database-url
session-secret
azure-ad-client-id
azure-ad-tenant-id
graph-client-id
graph-client-secret
azure-openai-endpoint
azure-openai-api-key
azure-openai-deployment
azure-openai-whisper-deployment
sharepoint-site-url
sharepoint-library
```

### Phase 3 Completion Checklist

- [ ] Database connection string stored
- [ ] Session secret generated and stored
- [ ] Azure AD credentials stored
- [ ] Azure OpenAI credentials stored
- [ ] SharePoint placeholders created
- [ ] App Service granted Key Vault access
- [ ] All secrets verified

---

## Phase 4: Deploy Application Code

**Objective:** Build and deploy the Node.js application to Azure App Service  
**Time Estimate:** 10-15 minutes  
**Dependencies:** Phase 1, Phase 2, Phase 3 complete

### Step 4.1: Build Application

```bash
# Navigate to project root
cd ..  # Exit azure-infrastructure directory

# Install dependencies
npm install

# Build application
npm run build
```

**Expected output:**
```
vite v5.x.x building for production...
✓ xxx modules transformed.
dist/client/index.html  x.xx kB
dist/client/assets/...
✓ built in xxxms
```

### Step 4.2: Package Application

```bash
# Create deployment package
zip -r deploy.zip \
  dist/ \
  server/ \
  shared/ \
  package.json \
  package-lock.json \
  drizzle.config.ts \
  node_modules/
```

**Alternative (exclude node_modules, faster):**
```bash
zip -r deploy.zip \
  dist/ \
  server/ \
  shared/ \
  package.json \
  package-lock.json \
  drizzle.config.ts

# Azure will run npm install automatically
```

### Step 4.3: Deploy to App Service

```bash
RESOURCE_GROUP="tmm-demo-eastus"
APP_SERVICE_NAME="tmm-app-demo"

# Deploy package
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --src deploy.zip
```

**Expected output:**
```
Getting scm site credentials for zip deployment
Starting zip deployment. This operation can take a while to complete ...
Deployment endpoint responded with status code 202
```

### Step 4.4: Configure Application Settings

```bash
KEY_VAULT_URI="https://${KEY_VAULT_NAME}.vault.azure.net/"
FRONT_DOOR_ENDPOINT="<from-phase-1-outputs>"

# Configure app settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings \
    USE_MOCK_SERVICES=false \
    NODE_ENV=production \
    KEY_VAULT_URI=$KEY_VAULT_URI \
    FRONTDOOR_ENDPOINT=$FRONT_DOOR_ENDPOINT \
    PORT=8080
```

### Step 4.5: Verify Deployment

```bash
# Check deployment status
az webapp deployment list \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --output table

# View application logs
az webapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME
```

**Look for:**
```
✅ Configuration valid for PRODUCTION MODE
✅ Connected to Azure PostgreSQL
✅ Azure OpenAI client initialized
Server listening on port 8080
```

### Step 4.6: Test Health Endpoint

```bash
APP_URL="https://tmm-app-demo.azurewebsites.net"

# Test health endpoint
curl $APP_URL/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-11-18T20:30:00.000Z",
  "version": "1.0.0"
}
```

### Phase 4 Completion Checklist

- [ ] Application built successfully
- [ ] Deployment package created
- [ ] Code deployed to App Service
- [ ] Application settings configured
- [ ] Health endpoint responding
- [ ] Logs show successful startup
- [ ] No errors in Application Insights

---

## Phase 5: Initialize Database

**Objective:** Create database schema and seed initial data  
**Time Estimate:** 5-10 minutes  
**Dependencies:** Phase 3, Phase 4 complete

### Step 5.1: Retrieve Database Credentials

```bash
# Get database URL from Key Vault
DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name database-url \
  --query value -o tsv)

export DATABASE_URL
```

### Step 5.2: Run Database Migration

**Option A: From Azure Cloud Shell**

```bash
# In Cloud Shell, clone your repo
git clone <your-repo-url>
cd <repo-name>

# Install dependencies
npm install

# Push schema to database
npm run db:push
```

**Option B: From Local Machine (if database allows public access)**

```bash
# Enable temporary firewall rule
YOUR_IP=$(curl -s ifconfig.me)

az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name tmm-pg-demo \
  --rule-name AllowLocalDev \
  --start-ip-address $YOUR_IP \
  --end-ip-address $YOUR_IP

# Run migration
npm run db:push

# Remove firewall rule after migration
az postgres flexible-server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --name tmm-pg-demo \
  --rule-name AllowLocalDev --yes
```

**Expected output:**
```
✓ Applying changes...
✓ Created table: meetings
✓ Created table: meeting_minutes
✓ Created table: action_items
✓ Created table: meeting_templates
✓ Created table: users
✓ Created table: graph_webhook_subscriptions
✓ Created table: user_group_cache
✓ Created table: job_queue
```

### Step 5.3: Verify Database Schema

```bash
# Connect to database and verify tables
az postgres flexible-server execute \
  --name tmm-pg-demo \
  --admin-user tmm_admin \
  --admin-password "<your-db-password>" \
  --database-name meetings_db \
  --querytext "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

### Phase 5 Completion Checklist

- [ ] Database schema created
- [ ] All tables present
- [ ] No migration errors
- [ ] Database accessible from App Service

---

## Phase 6: Microsoft Teams Integration

**Objective:** Configure Teams webhook subscriptions and meeting bot  
**Time Estimate:** 20-30 minutes  
**Dependencies:** Phase 2, Phase 4 complete

### Step 6.1: Register Webhook Subscription

```bash
# Webhook endpoint
WEBHOOK_URL="https://${FRONT_DOOR_ENDPOINT}/api/webhooks/teams"

# Generate client state (validation secret)
CLIENT_STATE=$(openssl rand -base64 16)

# Register subscription for online meetings
az rest \
  --method POST \
  --uri "https://graph.microsoft.com/v1.0/subscriptions" \
  --headers "Content-Type=application/json" \
  --body "{
    \"changeType\": \"created,updated\",
    \"notificationUrl\": \"${WEBHOOK_URL}\",
    \"resource\": \"/communications/onlineMeetings\",
    \"expirationDateTime\": \"$(date -u -d '+3 days' +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"clientState\": \"${CLIENT_STATE}\"
  }"
```

**Save subscription ID from response:**
- Subscription ID: `_______________________`

### Step 6.2: Store Client State

```bash
# Store validation secret in Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name webhook-client-state \
  --value "$CLIENT_STATE"
```

### Step 6.3: Verify Webhook Endpoint

```bash
# Check Application Insights for webhook validation
az monitor app-insights query \
  --app tmm-ai-demo \
  --resource-group $RESOURCE_GROUP \
  --analytics-query "traces | where message contains 'webhook' | order by timestamp desc | take 10"
```

### Step 6.4: Test with Sample Meeting

**Via Microsoft Graph Explorer:**
1. Go to: https://developer.microsoft.com/graph/graph-explorer
2. Sign in with admin account
3. Run: `POST /me/onlineMeetings`
4. Body:
```json
{
  "startDateTime": "2023-11-20T14:00:00Z",
  "endDateTime": "2023-11-20T15:00:00Z",
  "subject": "Test Meeting - Teams Minutes Demo"
}
```

**Verify webhook received:**
```bash
# Check App Insights for meeting created event
az monitor app-insights query \
  --app tmm-ai-demo \
  --resource-group $RESOURCE_GROUP \
  --analytics-query "traces | where message contains 'Meeting created' | order by timestamp desc | take 5"
```

### Phase 6 Completion Checklist

- [ ] Webhook subscription created
- [ ] Client state stored in Key Vault
- [ ] Webhook endpoint receiving events
- [ ] Test meeting triggered notification
- [ ] Webhook validation logged in App Insights

---

## Phase 7: Azure OpenAI Setup

**Objective:** Verify model deployments and test AI minute generation  
**Time Estimate:** 10-15 minutes  
**Dependencies:** Phase 3, Phase 4 complete

### Step 7.1: Verify Model Deployments

```bash
# List all deployed models
az cognitiveservices account deployment list \
  --name tmm-openai-demo \
  --resource-group $RESOURCE_GROUP \
  --output table
```

**Expected deployments:**
```
Name         Model       Version    Capacity
-----------  ----------  ---------  --------
gpt-4o       gpt-4o      2024-05    10
gpt-4o-mini  gpt-4o-mini 2024-07    10
whisper      whisper     001        5
```

### Step 7.2: Test OpenAI Connection

```bash
# Test via application health endpoint
curl "https://${FRONT_DOOR_ENDPOINT}/api/verify/openai"
```

**Expected response:**
```json
{
  "status": "healthy",
  "models": ["gpt-4o", "gpt-4o-mini", "whisper"],
  "endpoint": "https://tmm-openai-demo.openai.azure.com"
}
```

### Step 7.3: Test Minute Generation

**Via Azure Portal:**
1. Navigate to App Service → SSH console
2. Run test script:
```bash
node server/scripts/test-openai.js
```

**Expected output:**
```
✓ Connected to Azure OpenAI
✓ Generated test summary
✓ Extracted action items
```

### Phase 7 Completion Checklist

- [ ] All models deployed (gpt-4o, gpt-4o-mini, whisper)
- [ ] OpenAI endpoint accessible
- [ ] Test generation successful
- [ ] No API errors in logs

---

## Phase 8: SharePoint Integration

**Objective:** Configure SharePoint site and document library for archival  
**Time Estimate:** 15-20 minutes  
**Dependencies:** Phase 2 complete

### Step 8.1: Create SharePoint Site

**Via SharePoint Admin Center:**
1. Navigate to: https://admin.microsoft.com/sharepoint
2. Click "Active sites" → "Create"
3. Select "Team site"
4. Site name: `Teams Meeting Minutes`
5. Site address: `/sites/TeamsMeetingMinutes`
6. Privacy: `Private`
7. Click "Finish"

### Step 8.2: Create Document Library

**In SharePoint site:**
1. Navigate to: https://yourtenant.sharepoint.com/sites/TeamsMeetingMinutes
2. Click "New" → "Document library"
3. Name: `Meeting Minutes`
4. Click "Create"

### Step 8.3: Grant App Permission

**Via PnP PowerShell:**

```powershell
# Install PnP PowerShell (if not already installed)
Install-Module -Name PnP.PowerShell

# Connect to SharePoint
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/TeamsMeetingMinutes" -Interactive

# Grant Sites.Selected permission to app
Grant-PnPAzureADAppSitePermission `
  -AppId $BACKEND_APP_ID `
  -DisplayName "Teams Minutes - Backend API" `
  -Site "https://yourtenant.sharepoint.com/sites/TeamsMeetingMinutes" `
  -Permissions Write
```

### Step 8.4: Update Key Vault Secrets

```bash
SHAREPOINT_SITE_URL="https://yourtenant.sharepoint.com/sites/TeamsMeetingMinutes"

# Update SharePoint site URL
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name sharepoint-site-url \
  --value "$SHAREPOINT_SITE_URL"

# Update library name (already set in Phase 3)
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name sharepoint-library \
  --value "Meeting Minutes"
```

### Step 8.5: Test SharePoint Upload

```bash
# Trigger test upload via API
curl -X POST "https://${FRONT_DOOR_ENDPOINT}/api/test/sharepoint" \
  -H "Authorization: Bearer <your-token>"
```

### Phase 8 Completion Checklist

- [ ] SharePoint site created
- [ ] Document library created
- [ ] App granted Sites.Selected permission
- [ ] Secrets updated in Key Vault
- [ ] Test upload successful

---

## Phase 9: Validation & Testing

**Objective:** End-to-end validation of all integrations  
**Time Estimate:** 30-45 minutes  
**Dependencies:** All previous phases complete

### Step 9.1: Health Check

```bash
# Application health
curl "https://${FRONT_DOOR_ENDPOINT}/health"

# Database health
curl "https://${FRONT_DOOR_ENDPOINT}/api/health/database"

# Azure OpenAI health
curl "https://${FRONT_DOOR_ENDPOINT}/api/health/openai"

# SharePoint health
curl "https://${FRONT_DOOR_ENDPOINT}/api/health/sharepoint"
```

**All should return `"status": "healthy"`**

### Step 9.2: User Login Test

1. Navigate to: `https://${FRONT_DOOR_ENDPOINT}`
2. Click "Sign in with Microsoft"
3. Authenticate with Azure AD account
4. Verify dashboard loads

**Expected:**
- Successful Azure AD SSO login
- Dashboard displays with stats
- No console errors

### Step 9.3: End-to-End Meeting Flow

**Create test meeting in Teams:**
1. Open Microsoft Teams
2. Schedule new meeting
3. Add attendees
4. Start meeting
5. Record meeting (if testing transcription)
6. End meeting

**Verify in application:**
1. Wait 1-2 minutes for webhook processing
2. Refresh dashboard
3. Verify meeting appears in list
4. Click meeting → View details
5. Verify meeting metadata captured

### Step 9.4: AI Minute Generation Test

**In application:**
1. Select a completed meeting
2. Click "Generate Minutes"
3. Wait for processing (~30-60 seconds)
4. Verify AI-generated summary appears
5. Check action items extracted

### Step 9.5: Approval Workflow Test

1. Review generated minutes
2. Click "Approve"
3. Verify status changes to "Approved"
4. Check email sent to attendees
5. Verify SharePoint archival

### Step 9.6: SharePoint Verification

1. Navigate to SharePoint library
2. Verify meeting minutes document uploaded
3. Check metadata (classification, date, attendees)
4. Verify DOCX and PDF versions

### Step 9.7: Access Control Test

**Test classification-based access:**
1. Login as user with UNCLASSIFIED clearance
2. Verify can only see UNCLASSIFIED meetings
3. Attempt to access CONFIDENTIAL meeting
4. Verify access denied (403 error)

### Step 9.8: Application Insights Review

```bash
# Query for errors
az monitor app-insights query \
  --app tmm-ai-demo \
  --resource-group $RESOURCE_GROUP \
  --analytics-query "traces | where severityLevel >= 3 | order by timestamp desc | take 20"

# Query for performance
az monitor app-insights query \
  --app tmm-ai-demo \
  --resource-group $RESOURCE_GROUP \
  --analytics-query "requests | summarize avg(duration), count() by name | order by count_ desc"
```

### Phase 9 Completion Checklist

- [ ] All health endpoints green
- [ ] User login successful
- [ ] Meeting webhook captured
- [ ] AI minutes generated
- [ ] Approval workflow completed
- [ ] Email distribution sent
- [ ] SharePoint archival confirmed
- [ ] Access control enforced
- [ ] No errors in Application Insights

---

## Phase 10: Monitoring & Operations

**Objective:** Configure ongoing monitoring and operational alerts  
**Time Estimate:** 20-30 minutes  
**Dependencies:** Phase 9 complete

### Step 10.1: Configure Alert Rules

```bash
# HTTP 5xx errors alert
az monitor metrics alert create \
  --name "HTTP-5xx-Errors" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/tmm-app-demo" \
  --condition "count Http5xx > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>

# CPU usage alert
az monitor metrics alert create \
  --name "High-CPU-Usage" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/tmm-app-demo" \
  --condition "avg Percentage CPU > 75" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>

# Database connection errors
az monitor metrics alert create \
  --name "Database-Connection-Errors" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DBforPostgreSQL/flexibleServers/tmm-pg-demo" \
  --condition "count failed_connections > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>
```

### Step 10.2: Enable Diagnostic Settings

```bash
# App Service diagnostics
az monitor diagnostic-settings create \
  --name AppServiceLogs \
  --resource "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/tmm-app-demo" \
  --logs '[{"category":"AppServiceHTTPLogs","enabled":true},{"category":"AppServiceConsoleLogs","enabled":true},{"category":"AppServiceAppLogs","enabled":true}]' \
  --workspace "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.OperationalInsights/workspaces/tmm-log-demo"

# PostgreSQL diagnostics
az monitor diagnostic-settings create \
  --name PostgreSQLLogs \
  --resource "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DBforPostgreSQL/flexibleServers/tmm-pg-demo" \
  --logs '[{"category":"PostgreSQLLogs","enabled":true}]' \
  --workspace "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.OperationalInsights/workspaces/tmm-log-demo"
```

### Step 10.3: Configure Database Backups

```bash
# Verify automated backups enabled
az postgres flexible-server show \
  --name tmm-pg-demo \
  --resource-group $RESOURCE_GROUP \
  --query "{backupRetention:backup.backupRetentionDays,geoRedundant:backup.geoRedundantBackup}"

# Create on-demand backup
az postgres flexible-server backup create \
  --name tmm-pg-demo \
  --resource-group $RESOURCE_GROUP \
  --backup-name "manual-backup-$(date +%Y%m%d)"
```

### Step 10.4: Create Application Dashboard

**In Azure Portal:**
1. Navigate to: Azure Portal → Dashboards → New dashboard
2. Name: `Teams Meeting Minutes - Operations`
3. Add tiles:
   - App Service metrics (requests, response time, errors)
   - Database metrics (connections, CPU, storage)
   - Application Insights (availability, failures, performance)
   - Front Door metrics (request count, latency)

### Step 10.5: Set Up Cost Alerts

```bash
# Create budget alert at 80% of estimated monthly cost
az consumption budget create \
  --budget-name "tmm-monthly-budget" \
  --amount 850 \
  --time-grain Monthly \
  --start-date "$(date +%Y-%m-01)" \
  --end-date "2024-12-31" \
  --resource-group $RESOURCE_GROUP \
  --notifications "{\"Actual_GreaterThan_80_Percent\":{\"enabled\":true,\"operator\":\"GreaterThan\",\"threshold\":80,\"contactEmails\":[\"$ADMIN_EMAIL\"]}}"
```

### Phase 10 Completion Checklist

- [ ] Alert rules configured (5xx, CPU, DB)
- [ ] Diagnostic settings enabled
- [ ] Database backups verified
- [ ] Operations dashboard created
- [ ] Cost alerts configured
- [ ] Runbook documented for operations team

---

## Troubleshooting

### Common Issues

#### Issue: Deployment fails at database creation
**Solution:**
```bash
# Check quota limits
az postgres flexible-server list-skus --location eastus

# Verify service availability
az provider show --namespace Microsoft.DBforPostgreSQL --query "resourceTypes[?resourceType=='flexibleServers'].locations"
```

#### Issue: App Service shows "Service Unavailable"
**Solution:**
```bash
# Check app logs
az webapp log tail --name tmm-app-demo --resource-group $RESOURCE_GROUP

# Restart app service
az webapp restart --name tmm-app-demo --resource-group $RESOURCE_GROUP

# Verify Key Vault access
az keyvault secret show --vault-name $KEY_VAULT_NAME --name database-url
```

#### Issue: Webhook subscription fails validation
**Solution:**
```bash
# Verify webhook endpoint is publicly accessible
curl "https://${FRONT_DOOR_ENDPOINT}/api/webhooks/teams"

# Check App Insights for validation errors
az monitor app-insights query --app tmm-ai-demo --analytics-query "exceptions | where timestamp > ago(1h)"
```

#### Issue: SharePoint upload fails with 403
**Solution:**
- Verify Sites.Selected permission granted via PnP PowerShell
- Check app ID matches in SharePoint and Azure AD
- Ensure client secret not expired

---

## Success Criteria

✅ **Deployment is successful when:**

- [ ] All Azure resources deployed and healthy
- [ ] Application accessible via Front Door endpoint
- [ ] Users can login with Azure AD
- [ ] Teams meetings automatically captured via webhook
- [ ] AI minute generation working
- [ ] Approval workflow functional
- [ ] SharePoint archival confirmed
- [ ] Email distribution sending
- [ ] Access control enforcing classification levels
- [ ] No critical errors in Application Insights
- [ ] All health endpoints returning green
- [ ] Operations dashboard configured

---

## Next Steps After Deployment

1. **User Training:** Conduct walkthrough with end users
2. **Documentation:** Update internal wiki with endpoints and processes
3. **Backup Verification:** Test restore from backup
4. **Disaster Recovery:** Document DR procedures
5. **Scale Testing:** Test with higher meeting volumes
6. **Security Review:** Conduct penetration testing
7. **Compliance Audit:** Verify DOD security requirements

---

## Support Contacts

- **Azure Support:** https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- **Microsoft Graph API:** https://developer.microsoft.com/graph/support
- **Application Issues:** [Your internal support contact]

---

**Document Version:** 1.0  
**Last Updated:** 2023-11-18  
**Maintained By:** DevOps Team
