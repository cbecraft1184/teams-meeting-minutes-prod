# Commercial Demo Deployment Guide

## Purpose

This guide provides step-by-step instructions to deploy the Teams Meeting Minutes system to **Azure Commercial** for demonstration and production use.

**Target Audience:** Azure administrators, deployment engineers  
**Prerequisites:** Basic Azure and Teams administration knowledge  
**Timeline:** 4-6 hours for initial deployment, 1-2 days for complete testing

---

## Deployment Overview

### Deployment Architecture

```
Azure Commercial (East US 2)
├── Resource Group: rg-teams-minutes-demo
├── Azure Container Registry: teamminutesacr
├── Container Apps Environment: teams-minutes-env
├── Container App: teams-minutes-app
├── PostgreSQL Flexible Server: psql-teams-minutes-demo
├── Azure OpenAI: openai-teams-minutes-demo
├── Application Insights: appi-teams-minutes-demo
├── Bot Service: bot-teams-minutes-demo
└── Key Vault: kv-teams-min-demo (optional, 24 char max)
```

**Note:** This deployment uses Azure Container Apps instead of App Service for better scalability and simplified container management.

### Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Azure Resources** | 1-2 hours | Create resource group, database, OpenAI, Container Registry, Container Apps Env |
| **Phase 2: Azure AD Setup** | 1 hour | App registrations, permissions, consent |
| **Phase 3: Code Deployment** | 1 hour | Build container image, deploy to Container Apps |
| **Phase 4: Teams Integration** | 30 min | Bot registration, Teams app manifest |
| **Phase 5: Testing** | 2-4 hours | Create test meeting, verify end-to-end flow |

---

## Prerequisites

### Required Accounts and Access

**Azure Commercial:**
- Azure subscription with Contributor or Owner role
- Ability to create resources in East US region
- Azure CLI installed locally
- **Estimated cost:** $85/month (demo), $463/month (production 100 users)

**Microsoft 365:**
- Microsoft 365 E3 or E5 tenant (commercial)
- Global Administrator access (for initial setup)
- Teams Administrator access
- SharePoint Administrator access
- Minimum 5 test user accounts

**Development Tools:**
- Node.js 18.x LTS installed
- npm 9.x or later
- Git installed
- Code editor (VS Code recommended)
- Azure CLI 2.50+ installed

**Optional:**
- GitHub account (for CI/CD)
- Postman or similar (for API testing)

### Pre-Deployment Checklist

- [ ] Azure subscription access verified
- [ ] Microsoft 365 tenant access verified
- [ ] Azure CLI logged in (`az login`)
- [ ] Repository cloned locally
- [ ] Node.js 18.x verified (`node --version`)
- [ ] SharePoint document library created for archival
- [ ] Test users created in M365 tenant

---

## Understanding Tenant Requirements for Demo Users

### ⚠️ CRITICAL: All Demo Users Must Be in Your Office 365 Tenant

**Custom Teams apps are tenant-scoped and can only be used by users within the same Office 365 organization where the app is uploaded.**

### Why This Matters

❌ **This will NOT work:**
- Demo users have their own Office 365 accounts (different tenant)
- You upload the app to your tenant
- Demo users try to use the app from their tenant
- **Result:** Users cannot see or use the app

✅ **This WILL work:**
- You create user accounts in YOUR Office 365 tenant
- You upload the app to your tenant
- Demo users sign in with accounts you created
- **Result:** Users can see and use the app

### What About Guest Users?

Even if you invite external users as **guests** to your tenant:
- Custom apps are only visible when guests **switch** their Teams client to your tenant
- Guests often get "You don't have access to this app" errors with custom apps
- This creates a confusing user experience for demos

**Recommendation:** Do not rely on guest access for demos. Create dedicated accounts.

---

## Demo User Setup Options

### Option 1: Microsoft 365 Developer Program (FREE - Recommended)

**Best for:** 20-user demos, proof-of-concepts, testing

**What you get:**
- FREE Microsoft 365 E5 licenses (25 users)
- 90-day renewable subscription (renews automatically if actively used)
- Separate demo tenant (e.g., `yourcompany-demo.onmicrosoft.com`)
- Full admin access
- All features: Teams, SharePoint, Exchange, Azure AD

**Setup steps:**

1. **Sign up for Developer Program:**
   ```
   Visit: https://developer.microsoft.com/microsoft-365/dev-program
   Click: Join now
   Sign in with personal Microsoft account
   ```

2. **Create instant sandbox:**
   - Choose: "Instant sandbox"
   - Provide admin email: `admin@yourcompany-demo.onmicrosoft.com`
   - Set admin password
   - Wait 2-3 minutes for provisioning

3. **Create demo user accounts:**
   ```
   1. Sign in to Microsoft 365 Admin Center:
      https://admin.microsoft.com
   
   2. Go to: Users → Active users → Add a user
   
   3. Create 20 accounts:
      - demo.user1@yourcompany-demo.onmicrosoft.com
      - demo.user2@yourcompany-demo.onmicrosoft.com
      - ... (up to demo.user20)
   
   4. Set passwords (or auto-generate)
   
   5. Assign licenses: Microsoft 365 E5 Developer
   ```

4. **Share credentials with demo users:**
   ```
   Email: demo.user1@yourcompany-demo.onmicrosoft.com
   Password: [password you set]
   Teams URL: https://teams.microsoft.com
   ```

**Cost:** $0 (FREE for 90 days, renewable)

**Pros:**
- ✅ No cost for demo period
- ✅ 25 E5 licenses (more than 20-user need)
- ✅ Completely separate from production
- ✅ Can be renewed if actively used

**Cons:**
- ⚠️ Expires after 90 days of inactivity
- ⚠️ Demo users must use provided credentials (not their own)

---

### Option 2: Create Accounts in Your Existing Tenant

**Best for:** Long-term demos, integration with existing infrastructure

**Setup steps:**

1. **Purchase licenses** (if needed):
   ```
   Microsoft 365 Admin Center → Billing → Purchase services
   
   Options:
   - Microsoft 365 Business Basic: $6/user/month
   - Microsoft 365 E3: $36/user/month
   - Microsoft 365 E5: $57/user/month
   ```

2. **Create user accounts:**
   ```
   Admin Center → Users → Active users → Add users
   
   Create 20 accounts:
   - demo1@yourcompany.com
   - demo2@yourcompany.com
   - ... (etc.)
   ```

3. **Assign licenses** to each account

4. **Share credentials** with demo users

**Monthly cost for 20 users:**
- Business Basic: $120/month
- E3: $720/month
- E5: $1,140/month

**Pros:**
- ✅ No expiration
- ✅ Integrated with your existing tenant
- ✅ Can use custom domain

**Cons:**
- ❌ Requires paid licenses
- ⚠️ Mixed with production users (less isolation)

---

### Option 3: Each User Uploads to Their Own Tenant (NOT RECOMMENDED)

This approach requires each demo user to:
- Have admin access to their own tenant
- Upload the app package themselves
- Configure Azure AD app registrations
- Deploy the backend to their own Azure subscription

**Why this doesn't work:**
- ❌ Not scalable (20 separate deployments)
- ❌ Most users don't have tenant admin access
- ❌ Your backend can't easily handle 20 different tenants
- ❌ Not a cohesive demo experience

**Do not use this approach for demos.**

---

## Recommended Setup for 20-User Demo

### Step 1: Use Microsoft 365 Developer Program

1. Sign up: https://developer.microsoft.com/microsoft-365/dev-program
2. Create instant sandbox (2-3 minutes)
3. Note your new tenant domain: `yourcompany-demo.onmicrosoft.com`

### Step 2: Create 20 Demo Accounts

Use Microsoft 365 Admin Center or bulk CSV import:

**Bulk CSV method:**
```csv
User Name,First Name,Last Name,Display Name,Job Title,Department,Office Number,Office Phone,Mobile Phone,Fax,Address,City,State or Province,ZIP or Postal Code,Country or Region
demo.user1,Demo,User1,Demo User 1,Tester,IT,,,,,,,,,US
demo.user2,Demo,User2,Demo User 2,Tester,IT,,,,,,,,,US
...
demo.user20,Demo,User20,Demo User 20,Tester,IT,,,,,,,,,US
```

Upload via: Admin Center → Users → Active users → Add multiple users

### Step 3: Assign Licenses

All accounts automatically get E5 Developer licenses (included free).

### Step 4: Configure Azure Resources

**IMPORTANT:** Use the demo tenant for Azure AD app registrations:
- When creating Azure AD apps in Phase 2, sign in with `admin@yourcompany-demo.onmicrosoft.com`
- This ensures apps are registered in the demo tenant

### Step 5: Distribute Credentials

Send demo users their login information:

```
Subject: Teams Meeting Minutes Demo - Login Credentials

Welcome to the Teams Meeting Minutes demo!

Sign in to Microsoft Teams with these credentials:
- Email: demo.user1@yourcompany-demo.onmicrosoft.com
- Password: [password]
- Teams URL: https://teams.microsoft.com

After signing in:
1. Click "Apps" in the left sidebar
2. Search for "Meeting Minutes"
3. Click "Add" to install

The app will appear in your Teams sidebar.
```

---

## Cost Comparison

| Approach | Setup Time | Monthly Cost | Duration | Best For |
|----------|-----------|--------------|----------|----------|
| **Developer Program** | 10 minutes | **$0** | 90 days (renewable) | ✅ **Demos & POCs** |
| **Existing Tenant (Basic)** | 30 minutes | $120 | Unlimited | Long-term testing |
| **Existing Tenant (E3)** | 30 minutes | $720 | Unlimited | Production pilots |
| **Existing Tenant (E5)** | 30 minutes | $1,140 | Unlimited | Full feature testing |

---

## Checklist: Before Proceeding with Deployment

- [ ] Decided on tenant approach (Developer Program recommended)
- [ ] Created demo Office 365 tenant (if using Developer Program)
- [ ] Created 20+ user accounts in the tenant
- [ ] Assigned licenses to all accounts
- [ ] Documented credentials for demo users
- [ ] Verified admin access to the tenant
- [ ] Ready to proceed with Azure deployment

---

## Phase 1: Create Azure Resources

### Step 1.1: Set Environment Variables (Local Terminal)

```bash
# Resource naming (change to your preferred names)
export RESOURCE_GROUP="rg-teams-minutes-demo"
export LOCATION="eastus2"  # Use eastus2 for better availability
export ACR_NAME="teamminutesacr"  # Azure Container Registry (globally unique)
export CONTAINER_ENV="teams-minutes-env"  # Container Apps Environment
export CONTAINER_APP="teams-minutes-app"  # Container App name
export POSTGRES_SERVER="psql-teams-minutes-demo"  # Must be globally unique
export OPENAI_ACCOUNT="openai-teams-minutes-demo"  # Must be globally unique
export APP_INSIGHTS="appi-teams-minutes-demo"
export BOT_NAME="bot-teams-minutes-demo"  # Must be globally unique
export KEY_VAULT_NAME="kv-teams-min-demo"  # Must be globally unique (24 chars max)

# Credentials (generate secure passwords)
export POSTGRES_ADMIN_USER="adminuser"
export POSTGRES_ADMIN_PASSWORD="SecureP@ssw0rd123!"  # Change this!
export SESSION_SECRET=$(openssl rand -base64 32)

echo "Environment variables set. Verify uniqueness of names before proceeding."
```

### Step 1.2: Create Resource Group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

echo "✓ Resource group created: $RESOURCE_GROUP"
```

### Step 1.3: Create PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user $POSTGRES_ADMIN_USER \
  --admin-password "$POSTGRES_ADMIN_PASSWORD" \
  --sku-name Standard_B2s \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0-255.255.255.255 \
  --high-availability Disabled \
  --backup-retention 7

echo "✓ PostgreSQL server created. Creating database..."

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name meetings

echo "✓ Database 'meetings' created"

# Get connection string
export DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_SERVER}.postgres.database.azure.com:5432/meetings?sslmode=require"

echo "DATABASE_URL: $DATABASE_URL"
```

**Note:** For production, restrict `--public-access` to specific IP ranges or use VNet integration.

### Step 1.4: Create Azure OpenAI Service

```bash
az cognitiveservices account create \
  --name $OPENAI_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location eastus \
  --kind OpenAI \
  --sku S0 \
  --yes

echo "✓ Azure OpenAI account created. Deploying models..."

# Deploy GPT-4o model
az cognitiveservices account deployment create \
  --resource-group $RESOURCE_GROUP \
  --account-name $OPENAI_ACCOUNT \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 100 \
  --sku-name "Standard"

echo "✓ GPT-4o model deployed"

# Deploy Whisper model (for audio transcription)
# Note: Whisper may not be available in all regions - this step may fail
az cognitiveservices account deployment create \
  --resource-group $RESOURCE_GROUP \
  --account-name $OPENAI_ACCOUNT \
  --deployment-name whisper \
  --model-name whisper \
  --model-version "001" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name "Standard" 2>/dev/null || echo "⚠ Whisper not available in this region (optional)"

# Get OpenAI endpoint and key
export AZURE_OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name $OPENAI_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "properties.endpoint" -o tsv)

export AZURE_OPENAI_API_KEY=$(az cognitiveservices account keys list \
  --name $OPENAI_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "key1" -o tsv)

echo "AZURE_OPENAI_ENDPOINT: $AZURE_OPENAI_ENDPOINT"
echo "AZURE_OPENAI_API_KEY: [hidden]"
```

**Note:** GPT-4o availability varies by region. Check [model availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models) if deployment fails.

### Step 1.5: Create Application Insights

```bash
az monitor app-insights component create \
  --app $APP_INSIGHTS \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web

echo "✓ Application Insights created"

# Get instrumentation key
export APPINSIGHTS_INSTRUMENTATIONKEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --query "instrumentationKey" -o tsv)

echo "APPINSIGHTS_INSTRUMENTATIONKEY: $APPINSIGHTS_INSTRUMENTATIONKEY"
```

### Step 1.6: Create Azure Container Registry

```bash
# Create Azure Container Registry
az acr create \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Basic \
  --admin-enabled true

echo "✓ Azure Container Registry created"

# Get ACR credentials for later use
ACR_USERNAME=$ACR_NAME
ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query "passwords[0].value" -o tsv)

echo "ACR Username: $ACR_USERNAME"
echo "ACR Password: [hidden]"
```

### Step 1.7: Create Container Apps Environment

```bash
# Create Container Apps Environment
az containerapp env create \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

echo "✓ Container Apps Environment created"
```

### Step 1.8: Create Key Vault (Optional but Recommended)

```bash
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enabled-for-deployment true \
  --sku standard

echo "✓ Key Vault created"
```

**Note:** You'll grant Container App access to Key Vault after deploying in Phase 3.4.

---

## Phase 2: Azure AD App Registrations

### Step 2.1: Register Microsoft Graph API App

**Via Azure Portal:**

1. Navigate to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Click **+ New registration**
3. Fill in:
   - **Name:** `Teams Minutes Graph API`
   - **Supported account types:** Single tenant
   - **Redirect URI:** Leave blank (server-to-server)
4. Click **Register**
5. **Copy Application (client) ID and Directory (tenant) ID**

**Grant API Permissions:**

1. Go to **API permissions** → **+ Add a permission**
2. Select **Microsoft Graph** → **Application permissions**
3. Add the following permissions:
   - `OnlineMeetings.ReadWrite.All`
   - `OnlineMeetingTranscript.Read.All`
   - `OnlineMeetingRecording.Read.All`
   - `User.Read.All`
   - `Mail.Send`
   - `Sites.ReadWrite.All`
   - `Calendars.ReadWrite`
4. Click **Grant admin consent** (requires Global Admin)

**Create Client Secret:**

1. Go to **Certificates & secrets** → **+ New client secret**
2. Description: `Demo deployment secret`
3. Expires: 6 months (for demo)
4. Click **Add**
5. **Copy the secret value immediately** (won't be shown again)

**Save these values:**
```bash
export GRAPH_CLIENT_ID="<Application (client) ID>"
export GRAPH_CLIENT_SECRET="<Client secret value>"
export GRAPH_TENANT_ID="<Directory (tenant) ID>"

# Note: These will be set in Container App with _PROD suffix (Step 3.4)
```

### Step 2.2: Configure Application Access Policy (PowerShell)

**Install Teams PowerShell Module:**

```powershell
Install-Module -Name MicrosoftTeams -Force
Connect-MicrosoftTeams
```

**Create Application Access Policy:**

```powershell
# Replace with your Graph API app client ID
$AppId = "<GRAPH_CLIENT_ID from Step 2.1>"

# Create policy
New-CsApplicationAccessPolicy `
  -Identity "Teams-Minutes-Demo-Policy" `
  -AppIds $AppId `
  -Description "Allow Teams Minutes app to access meeting data"

# Grant to all users (for demo)
Grant-CsApplicationAccessPolicy `
  -PolicyName "Teams-Minutes-Demo-Policy" `
  -Global

# Verify
Get-CsApplicationAccessPolicy -Identity "Teams-Minutes-Demo-Policy"
```

**Wait 30 minutes** for policy to propagate globally.

### Step 2.3: Register Teams Bot

**Via Azure Portal:**

1. Search for **Azure Bot** in Create a resource
2. Click **Create**
3. Fill in:
   - **Bot handle:** `bot-teams-minutes-demo` (globally unique)
   - **Subscription:** Your subscription
   - **Resource group:** `rg-teams-minutes-demo`
   - **Pricing tier:** F0 (Free - 10K messages/month)
   - **Type of App:** Multi Tenant
   - **Microsoft App ID:** Create new
4. Click **Create**

**After creation:**

1. Go to **Configuration** → Note the **Microsoft App ID**
2. Go to **Certificates & secrets** (left menu)
3. Create new client secret
4. **Copy the secret value**

**Save these values:**
```bash
export MICROSOFT_APP_ID="<Bot Microsoft App ID>"
export MICROSOFT_APP_PASSWORD="<Bot client secret>"
```

**Configure Messaging Endpoint:**

*Note: Leave this blank for now. You'll update it after deploying the Container App in Phase 3.*

**Enable Teams Channel:**

1. Go to **Channels**
2. Click **Microsoft Teams** icon
3. Accept terms → **Save**

---

## Phase 3: Build and Deploy Container App

### Step 3.1: Create Dockerfile

Ensure you have a `Dockerfile` in your project root. Here's the production-ready multi-stage build:

```dockerfile
# See Dockerfile in project root for the complete implementation
# Key features:
# - Multi-stage build (builder + runtime)
# - Alpine Linux base (minimal size)
# - Build tools cleanup after npm install
# - Health check endpoint at /health
```

### Step 3.2: Initialize Database Schema

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_SERVER}.postgres.database.azure.com:5432/meetings?sslmode=require"

# Push schema to database (Drizzle ORM)
npm run db:push

echo "✓ Database schema initialized with 12 tables"
```

### Step 3.3: Build and Push Container Image

```bash
# Upload code to Azure Cloud Shell or use Azure CLI locally
# If using Cloud Shell: Upload a ZIP of your code, then unzip
# unzip -q teams-minutes-app.zip -d app
# cd app

# Build and push image using Azure ACR Build (builds in Azure)
az acr build \
  --registry $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --image teams-minutes:latest \
  .

echo "✓ Container image built and pushed to ACR"
```

**Alternative: Build locally and push:**
```bash
# Build image locally
docker build -t $ACR_NAME.azurecr.io/teams-minutes:latest .

# Login to ACR
az acr login --name $ACR_NAME

# Push image
docker push $ACR_NAME.azurecr.io/teams-minutes:latest

echo "✓ Container image pushed to ACR"
```

### Step 3.4: Deploy Container App

```bash
# Get PostgreSQL connection string
POSTGRES_HOST=$(az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --query "fullyQualifiedDomainName" -o tsv)

DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/meetings?sslmode=require"

# Get ACR password
ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query "passwords[0].value" -o tsv)

# Create Container App with managed identity
az containerapp create \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_ENV \
  --image ${ACR_NAME}.azurecr.io/teams-minutes:latest \
  --target-port 5000 \
  --ingress external \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASSWORD" \
  --system-assigned \
  --env-vars \
    NODE_ENV=production \
    DATABASE_URL="$DATABASE_URL" \
    SESSION_SECRET="$SESSION_SECRET" \
    GRAPH_CLIENT_ID_PROD="$GRAPH_CLIENT_ID" \
    GRAPH_CLIENT_SECRET_PROD="$GRAPH_CLIENT_SECRET" \
    GRAPH_TENANT_ID_PROD="$GRAPH_TENANT_ID" \
    GRAPH_SENDER_EMAIL="<Your sender email>" \
    AZURE_OPENAI_ENDPOINT_PROD="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY_PROD="$AZURE_OPENAI_API_KEY" \
    AZURE_OPENAI_DEPLOYMENT_PROD="gpt-4o" \
    AZURE_OPENAI_API_VERSION_PROD="2024-02-15-preview" \
    MICROSOFT_APP_ID="$MICROSOFT_APP_ID" \
    MICROSOFT_APP_PASSWORD="$MICROSOFT_APP_PASSWORD" \
    SHAREPOINT_TENANT_ID="$GRAPH_TENANT_ID" \
    SHAREPOINT_SITE_URL="<Your SharePoint site URL>" \
    SHAREPOINT_LIBRARY="Meeting Minutes" \
    SHAREPOINT_CLIENT_ID="$GRAPH_CLIENT_ID" \
    SHAREPOINT_CLIENT_SECRET="$GRAPH_CLIENT_SECRET" \
    APPINSIGHTS_INSTRUMENTATIONKEY="$APPINSIGHTS_INSTRUMENTATIONKEY" \
    USE_MOCK_SERVICES=false \
    PORT=5000

echo "✓ Container App deployed"

# Get Container App URL and managed identity
CONTAINER_APP_URL=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

CONTAINER_APP_IDENTITY=$(az containerapp identity show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "principalId" -o tsv)

echo "Container App URL: https://$CONTAINER_APP_URL"
echo "Managed Identity: $CONTAINER_APP_IDENTITY"
```

**Replace placeholders:**
- `<Your sender email>` with email for sending (e.g., `noreply@yourdomain.com`)
- `<Your SharePoint site URL>` with your SharePoint site (e.g., `https://contoso.sharepoint.com/sites/TeamSite`)

**Grant Key Vault Access (if using Key Vault):**
```bash
# Grant Container App managed identity access to Key Vault
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $CONTAINER_APP_IDENTITY \
  --secret-permissions get list

echo "✓ Container App granted Key Vault access"
```

### Step 3.5: Update Bot Messaging Endpoint

```bash
# Update Bot with Container App URL
az bot update \
  --name $BOT_NAME \
  --resource-group $RESOURCE_GROUP \
  --endpoint "https://${CONTAINER_APP_URL}/api/teams/messages"

echo "✓ Bot messaging endpoint updated"
```

### Step 3.6: Verify Deployment

```bash
# Test health endpoint
curl https://$CONTAINER_APP_URL/health

# Check container logs
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow
```

**Expected health response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "jobWorker": "active",
  "uptime": 123
}
```

---

## Phase 4: Teams Integration

### Step 4.1: Create Teams App Manifest

Create `teams-app/manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "<MICROSOFT_APP_ID>",
  "packageName": "com.yourcompany.teamsminutes",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://yourcompany.com",
    "privacyUrl": "https://yourcompany.com/privacy",
    "termsOfUseUrl": "https://yourcompany.com/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "AI-Powered Meeting Minutes for Teams"
  },
  "description": {
    "short": "Automatically generate meeting minutes with AI",
    "full": "Capture Teams meetings, transcribe audio, and generate AI-powered minutes with action items, decisions, and summaries."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#3F487F",
  "configurableTabs": [
    {
      "configurationUrl": "https://<CONTAINER_APP_URL>/config",
      "scopes": ["team", "groupchat"]
    }
  ],
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://<CONTAINER_APP_URL>",
      "scopes": ["personal"]
    }
  ],
  "bots": [
    {
      "botId": "<MICROSOFT_APP_ID>",
      "scopes": ["personal", "team", "groupchat"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "<CONTAINER_APP_URL>"
  ],
  "webApplicationInfo": {
    "id": "<GRAPH_CLIENT_ID>",
    "resource": "https://graph.microsoft.com"
  }
}
```

**Replace placeholders:**
- `<MICROSOFT_APP_ID>`: Bot app ID from Step 2.3
- `<CONTAINER_APP_URL>`: Your Container App FQDN (e.g., `teams-minutes-app.orangemushroom-xxx.eastus2.azurecontainerapps.io`)
- `<GRAPH_CLIENT_ID>`: Graph API app ID from Step 2.1

### Step 4.2: Create App Icons

Create two PNG files in `teams-app/` directory:

- **`color.png`:** 192x192 px, color icon with transparent background
- **`outline.png`:** 32x32 px, white icon with transparent background

**Quick creation (if you have ImageMagick):**
```bash
# Create simple placeholder icons
convert -size 192x192 xc:blue -fill white -pointsize 72 -gravity center \
  -annotate +0+0 "MM" teams-app/color.png

convert -size 32x32 xc:transparent -fill white -pointsize 18 -gravity center \
  -annotate +0+0 "M" teams-app/outline.png
```

### Step 4.3: Package Teams App

```bash
cd teams-app
zip -r teams-minutes-app.zip manifest.json color.png outline.png
cd ..

echo "✓ Teams app package created: teams-app/teams-minutes-app.zip"
```

### Step 4.4: Upload to Teams

**Via Teams Admin Center (for organization-wide deployment):**

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. **Teams apps** → **Manage apps** → **Upload new app**
3. Upload `teams-minutes-app.zip`
4. **Publish** to make available to organization

**Via Teams Client (for testing):**

1. Open Microsoft Teams
2. Click **Apps** (left sidebar)
3. Click **Manage your apps** → **Upload an app**
4. Select **Upload a custom app**
5. Choose `teams-minutes-app.zip`
6. Click **Add** to install for yourself

---

## Phase 5: Testing and Validation

### Step 5.1: Create Test Meeting

1. **Create a Teams meeting:**
   - Schedule a meeting with 2-3 test users
   - Enable **Recording** and **Transcription** in meeting options
   - Start the meeting and record for 2-3 minutes
   - End the meeting

2. **Wait for processing:**
   - Recording upload: 5-10 minutes
   - Webhook notification: Near real-time
   - Minutes generation: 2-5 minutes

### Step 5.2: Verify Backend Processing

```bash
# Check application logs
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow

# Look for:
# - "Webhook received: meeting created"
# - "Job enqueued: enrich_meeting"
# - "Job completed: generate_minutes"
```

**Check database:**

```bash
# Connect to PostgreSQL
psql "$DATABASE_URL"

# Check meetings
SELECT id, title, status, enrichment_status FROM meetings;

# Check minutes
SELECT id, meeting_id, processing_status, approval_status FROM meeting_minutes;

# Check job queue
SELECT id, job_type, status, attempt_count FROM job_queue WHERE status != 'completed';

\q
```

### Step 5.3: Verify Frontend

1. **Access app in Teams:**
   - Open Teams app
   - Navigate to Dashboard tab
   - Verify meeting appears in list

2. **Review meeting details:**
   - Click on meeting card
   - Verify minutes are displayed
   - Check action items
   - Review attendees

3. **Test approval workflow:**
   - Click **Approve** button
   - Verify status changes to "Approved"

4. **Test document export:**
   - Click **Export DOCX**
   - Verify file downloads
   - Click **Export PDF**
   - Verify file downloads

### Step 5.4: Verify Distribution (Approved Minutes)

**After approving minutes, check:**

1. **Email distribution:**
   - All attendees receive email with minutes
   - DOCX and PDF attachments included

2. **SharePoint archival:**
   - Navigate to SharePoint library
   - Verify DOCX file uploaded
   - Check file metadata (meeting date, title)

3. **Teams Adaptive Card:**
   - Check meeting chat in Teams
   - Verify bot posted Adaptive Card with summary

### Step 5.5: Performance Testing

**Check Application Insights:**

1. Navigate to Azure Portal → Application Insights
2. **Performance** tab:
   - API response times < 500ms (95th percentile)
   - Database queries < 200ms
3. **Failures** tab:
   - Zero failed requests expected
4. **Live Metrics**:
   - Monitor real-time requests

**Load test (optional):**

```bash
# Create 10 test meetings via API
for i in {1..10}; do
  curl -X POST https://$CONTAINER_APP_URL/api/meetings \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TEST_TOKEN>" \
    -d '{
      "title": "Test Meeting '$i'",
      "scheduledAt": "2024-12-01T14:00:00Z",
      "duration": "PT1H",
      "attendees": ["test1@contoso.com", "test2@contoso.com"]
    }'
done
```

---

## Phase 6: Monitoring and Maintenance

### Step 6.1: Configure Alerts

```bash
# Create action group for email notifications
az monitor action-group create \
  --name "TeamsMinutesAlerts" \
  --resource-group $RESOURCE_GROUP \
  --short-name "TMAlerts" \
  --email-receiver "Admin Email" admin@contoso.com

# Alert: High error rate (Container Apps)
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/containerApps/$CONTAINER_APP" \
  --condition "count Requests > 100" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "TeamsMinutesAlerts"

# Alert: Database connection failures
az monitor metrics alert create \
  --name "Database Connection Failed" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DBforPostgreSQL/flexibleServers/$POSTGRES_SERVER" \
  --condition "count active_connections < 1" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "TeamsMinutesAlerts"
```

### Step 6.2: Enable Backup and Disaster Recovery

**Database Backups:**
- Automated backups: 7-day retention (default)
- Point-in-time restore available

**App Service Backup (Optional):**

```bash
# Create storage account for backups
az storage account create \
  --name "<unique-storage-name>" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Configure backup (via Azure Portal)
# App Service → Backups → Configure
# - Frequency: Daily
# - Retention: 7 days
# - Partial backup: Include database
```

### Step 6.3: Cost Monitoring

**Set up budget alerts:**

1. Azure Portal → Cost Management → Budgets
2. Create budget:
   - Scope: Resource group `rg-teams-minutes-demo`
   - Amount: $200/month
   - Alert threshold: 80%, 100%
   - Email: admin@contoso.com

**Check current costs:**

```bash
az consumption usage list \
  --start-date "2024-11-01" \
  --end-date "2024-11-30" \
  --query "[?contains(instanceName, 'teams-minutes')]" \
  -o table
```

---

## Troubleshooting

### Issue: Meetings not appearing in app

**Possible causes:**
1. Webhook subscription expired (48-hour lifetime)
2. Application access policy not propagated (wait 30 min)
3. Graph API permissions not granted

**Resolution:**
```bash
# Check webhook subscriptions
curl https://$CONTAINER_APP_URL/api/webhooks/subscriptions

# Renew subscription (automatic background job runs every 12 hours)
# Or manually trigger via API endpoint
```

### Issue: Minutes generation fails

**Possible causes:**
1. Azure OpenAI rate limit exceeded
2. Transcript not available yet
3. OpenAI deployment name mismatch

**Resolution:**
```bash
# Check job queue for errors
psql "$DATABASE_URL" -c "SELECT * FROM job_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5;"

# Check OpenAI deployment name
az cognitiveservices account deployment list \
  --resource-group $RESOURCE_GROUP \
  --name $OPENAI_ACCOUNT \
  -o table

# Verify AZURE_OPENAI_DEPLOYMENT env var matches deployment name
```

### Issue: Bot not responding in Teams

**Possible causes:**
1. Messaging endpoint incorrect
2. App ID/password mismatch
3. Bot not installed in Teams

**Resolution:**
```bash
# Verify messaging endpoint
az bot show --name $BOT_NAME --resource-group $RESOURCE_GROUP \
  --query "properties.endpoint" -o tsv

# Should be: https://<CONTAINER_APP_URL>/api/teams/messages

# Check bot logs
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow | grep -i "bot"
```

### Issue: SharePoint upload fails

**Possible causes:**
1. Graph API permission `Sites.ReadWrite.All` not granted
2. SharePoint site URL incorrect
3. Document library name incorrect

**Resolution:**
```bash
# Test SharePoint access via Graph API
curl -X GET "https://graph.microsoft.com/v1.0/sites/<SITE_ID>/drive" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Verify SHAREPOINT_SITE_URL and SHAREPOINT_LIBRARY env vars
az containerapp env show \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP

# Or check Container App environment variables directly
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env" -o table
```

---

## Post-Deployment Checklist

- [ ] All Azure resources created successfully
- [ ] Database schema initialized
- [ ] Application deployed and running
- [ ] Health endpoint returns 200 OK
- [ ] Teams app uploaded and installed
- [ ] Test meeting created and processed end-to-end
- [ ] Minutes generated and approved
- [ ] Email distribution working
- [ ] SharePoint upload working
- [ ] Adaptive Cards sent to Teams
- [ ] Application Insights collecting telemetry
- [ ] Alerts configured
- [ ] Budget alerts set up
- [ ] Documentation updated with deployment-specific details

---

## Cost Estimates

### Monthly Costs (Demo/Pilot - 20 Users)

| Service | SKU | Quantity | Unit Cost | Monthly Cost |
|---------|-----|----------|-----------|--------------|
| **Container Apps** | Consumption | 0.25 vCPU, 0.5 GB | $0.000024/vCPU-sec | $15 |
| **Container Registry** | Basic | 10 GB storage | $5/month | $5 |
| **PostgreSQL Flexible Server** | Burstable B2s | 1 server | $30/month | $30 |
| **PostgreSQL Storage** | 32 GB SSD | 32 GB | $0.12/GB | $4 |
| **Azure OpenAI** | GPT-4o | 500K tokens/month | $0.015/1K tokens | $8 |
| **Azure OpenAI** | Whisper | 50 hours/month | $0.006/minute | $18 |
| **Application Insights** | Standard | 2 GB/month | $2.30/GB | $5 |
| **Bot Service** | Free tier | 10K messages | Free | $0 |
| **Data Transfer** | Standard | 5 GB/month | $0.087/GB | $0.50 |
| | | | **TOTAL (Demo):** | **$85.50/month** |

### Monthly Costs (Production - 100 Users)

| Service | SKU | Quantity | Monthly Cost |
|---------|-----|----------|--------------|
| **Container Apps** | Dedicated (D4) | 4 vCPU, 8 GB, 2 replicas | $200 |
| **Container Registry** | Standard | 100 GB storage | $20 |
| **PostgreSQL** | General Purpose D2s_v3 | 1 server | $120 |
| **PostgreSQL Storage** | 64 GB SSD | 64 GB | $8 |
| **Azure OpenAI** | GPT-4o + Whisper | 5M tokens + 250 hours | $90 |
| **Application Insights** | Standard | 10 GB/month | $23 |
| **Data Transfer** | Standard | 25 GB/month | $2 |
| | | **TOTAL (Production):** | **$463/month** |

### Cost Optimization Tips

1. **Auto-scaling:** Configure Container App to scale to zero during non-business hours (6 PM - 6 AM)
   - **Savings:** ~$50/month (25% reduction)

2. **Reserved Instances (1-3 year):**
   - **Container Apps (Dedicated plan):** 20-30% savings
   - **PostgreSQL:** 40-60% savings
   - **Estimated savings:** $90-140/month for production

3. **Budget Alerts:**
   ```bash
   # Set up budget alert at 80% of monthly estimate
   az consumption budget create \
     --budget-name "teams-minutes-demo-budget" \
     --amount 100 \
     --time-grain Monthly \
     --category Cost \
     --resource-group $RESOURCE_GROUP
   ```

---

## Rollback Procedures

### Rollback Application Deployment

**If deployment fails or introduces issues:**

```bash
# Option 1: Deploy previous container image version
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image ${ACR_NAME}.azurecr.io/teams-minutes:<previous-tag>

# Option 2: Rebuild and redeploy from previous Git commit
git checkout <previous-working-commit>
npm run build

# Build and push previous version
az acr build \
  --registry $ACR_NAME \
  --image teams-minutes:rollback-$(date +%Y%m%d-%H%M%S) \
  --file Dockerfile .

# Update Container App
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image ${ACR_NAME}.azurecr.io/teams-minutes:rollback-<tag>

# Container App restarts automatically after update
```

### Rollback Database Changes

**Point-in-time restore (up to 7 days):**

```bash
# Restore database to specific point in time
az postgres flexible-server restore \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER-restored \
  --source-server $POSTGRES_SERVER \
  --restore-time "2024-11-20T14:30:00Z"

# Update Container App to use restored database
NEW_DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_SERVER}-restored.postgres.database.azure.com:5432/meetings?sslmode=require"

az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars DATABASE_URL="$NEW_DATABASE_URL"
```

**Schema rollback:**

```bash
# If schema migration failed, restore from backup
psql "$DATABASE_URL" < backup-before-migration.sql
```

### Emergency Procedures

**If application is completely broken:**

1. **Disable webhook subscriptions** (stop new meetings from triggering jobs):
   ```bash
   # Set env var to disable webhooks temporarily
   az containerapp update \
     --name $CONTAINER_APP \
     --resource-group $RESOURCE_GROUP \
     --set-env-vars ENABLE_WEBHOOKS=false
   ```

2. **Stop job worker** (prevents background processing):
   ```bash
   az containerapp update \
     --name $CONTAINER_APP \
     --resource-group $RESOURCE_GROUP \
     --set-env-vars ENABLE_JOB_WORKER=false
   
   # Container App restarts automatically
   ```

3. **Restore from last known good state:**
   - Redeploy previous working version (see above)
   - Restore database if needed
   - Re-enable webhooks and job worker

---

## Clean Up (Demo Decommission)

**To delete all resources:**

```bash
az group delete \
  --name $RESOURCE_GROUP \
  --yes \
  --no-wait

echo "Resource group deletion initiated. This may take 10-15 minutes."
```

**To preserve database and delete compute only:**

```bash
# Delete Container App (keeps database and ACR)
az containerapp delete \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --yes

# Scale down database to save costs
az postgres flexible-server update \
  --name $POSTGRES_SERVER \
  --resource-group $RESOURCE_GROUP \
  --tier Burstable \
  --sku-name Standard_B1ms
```

---

## Appendix: Quick Reference

### Important URLs

- **Application:** `https://<CONTAINER_APP_URL>` (from deployment output)
- **Health Check:** `https://<CONTAINER_APP_URL>/health`
- **Azure Portal:** `https://portal.azure.com`
- **Teams Admin Center:** `https://admin.teams.microsoft.com`
- **Application Insights:** `https://portal.azure.com → Resource Group → App Insights`

### Common Commands

```bash
# View logs
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow

# Restart app (updates trigger automatic restart)
az containerapp revision restart \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP

# Check database
psql "$DATABASE_URL"

# Exec into Container App (for debugging)
az containerapp exec \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP

# View environment variables
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env" -o table
```

### Support Contacts

- **Azure Support:** https://portal.azure.com → Support
- **Microsoft 365 Support:** https://admin.microsoft.com → Support
- **Teams Developer Support:** https://developer.microsoft.com/microsoft-teams

---

## Document Control

- **Version:** 3.0
- **Date:** November 23, 2025
- **Purpose:** Azure Commercial deployment guide (Container Apps)
- **Target:** Demonstration and production environments
- **Cost:** $85/month (demo), $463/month (100 users production)
