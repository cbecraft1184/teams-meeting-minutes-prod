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
Azure Commercial (East US)
├── Resource Group: rg-teams-minutes-demo
├── App Service Plan: asp-teams-minutes (B1 tier)
├── App Service: app-teams-minutes-demo
├── PostgreSQL Flexible Server: psql-teams-minutes-demo
├── Azure OpenAI: openai-teams-minutes-demo
├── Application Insights: appi-teams-minutes-demo
├── Bot Service: bot-teams-minutes-demo
└── Key Vault: kv-teams-minutes-demo (optional)
```

### Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Azure Resources** | 1-2 hours | Create resource group, database, OpenAI, App Service |
| **Phase 2: Azure AD Setup** | 1 hour | App registrations, permissions, consent |
| **Phase 3: Code Deployment** | 1 hour | Build app, configure environment, deploy |
| **Phase 4: Teams Integration** | 30 min | Bot registration, Teams app manifest |
| **Phase 5: Testing** | 2-4 hours | Create test meeting, verify end-to-end flow |

---

## Prerequisites

### Required Accounts and Access

**Azure Commercial:**
- Azure subscription with Contributor or Owner role
- Ability to create resources in East US region
- Azure CLI installed locally
- **Estimated cost:** $150-200/month

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

## Phase 1: Create Azure Resources

### Step 1.1: Set Environment Variables (Local Terminal)

```bash
# Resource naming (change to your preferred names)
export RESOURCE_GROUP="rg-teams-minutes-demo"
export LOCATION="eastus"
export APP_SERVICE_PLAN="asp-teams-minutes"
export APP_SERVICE_NAME="app-teams-minutes-demo"  # Must be globally unique
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
  --name $OPENAI_ACCOUNT \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-name Standard \
  --sku-capacity 100

echo "✓ GPT-4o model deployed"

# Deploy Whisper model (if available in your region)
az cognitiveservices account deployment create \
  --resource-group $RESOURCE_GROUP \
  --name $OPENAI_ACCOUNT \
  --deployment-name whisper \
  --model-name whisper \
  --model-version "001" \
  --model-format OpenAI \
  --sku-name Standard \
  --sku-capacity 10

echo "✓ Whisper model deployed (if available)"

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

### Step 1.6: Create App Service Plan and App Service

```bash
# Create App Service Plan (Basic B1 for demo)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku B1

echo "✓ App Service Plan created"

# Create App Service
az webapp create \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:18-lts"

echo "✓ App Service created"

# Enable HTTPS only
az webapp update \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --https-only true

# Configure startup command
az webapp config set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --startup-file "node server/index.js"

echo "✓ App Service configured"
```

### Step 1.7: Create Key Vault (Optional but Recommended)

```bash
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enabled-for-deployment true \
  --sku standard

echo "✓ Key Vault created"

# Grant App Service access to Key Vault
WEBAPP_PRINCIPAL_ID=$(az webapp identity assign \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "principalId" -o tsv)

az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $WEBAPP_PRINCIPAL_ID \
  --secret-permissions get list

echo "✓ App Service granted Key Vault access"
```

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

1. Go to Bot **Configuration**
2. Set **Messaging endpoint:** `https://<APP_SERVICE_NAME>.azurewebsites.net/api/webhooks/bot`
3. Click **Apply**

**Enable Teams Channel:**

1. Go to **Channels**
2. Click **Microsoft Teams** icon
3. Accept terms → **Save**

---

## Phase 3: Configure and Deploy Application

### Step 3.1: Prepare Application Code

```bash
# Navigate to project directory
cd /path/to/teams-meeting-minutes

# Install dependencies
npm install

# Build frontend
cd client
npm install
npm run build
cd ..

# Verify build output
ls -la client/dist
```

### Step 3.2: Set Environment Variables in App Service

```bash
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="$DATABASE_URL" \
    SESSION_SECRET="$SESSION_SECRET" \
    GRAPH_CLIENT_ID="$GRAPH_CLIENT_ID" \
    GRAPH_CLIENT_SECRET="$GRAPH_CLIENT_SECRET" \
    GRAPH_TENANT_ID="$GRAPH_TENANT_ID" \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY="$AZURE_OPENAI_API_KEY" \
    AZURE_OPENAI_DEPLOYMENT="gpt-4o" \
    MICROSOFT_APP_ID="$MICROSOFT_APP_ID" \
    MICROSOFT_APP_PASSWORD="$MICROSOFT_APP_PASSWORD" \
    SHAREPOINT_SITE_URL="<Your SharePoint site URL>" \
    SHAREPOINT_LIBRARY="Shared Documents" \
    APPINSIGHTS_INSTRUMENTATIONKEY="$APPINSIGHTS_INSTRUMENTATIONKEY" \
    USE_MOCK_SERVICES=false

echo "✓ Environment variables configured"
```

**Replace `<Your SharePoint site URL>`** with your SharePoint site (e.g., `https://contoso.sharepoint.com/sites/TeamSite`)

### Step 3.3: Initialize Database Schema

```bash
# Run migrations locally (requires DATABASE_URL env var)
export DATABASE_URL="<your connection string from Step 1.3>"

npm run db:push

echo "✓ Database schema initialized"
```

### Step 3.4: Deploy Application to App Service

**Option A: Direct Deployment (Azure CLI)**

```bash
# Create deployment package
npm run build  # If not already built
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log"

# Deploy
az webapp deploy \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --src-path deploy.zip \
  --type zip

echo "✓ Application deployed"

# Restart app
az webapp restart \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP

echo "✓ App Service restarted"
```

**Option B: GitHub Actions (Recommended for Continuous Deployment)**

1. **Get publish profile:**
   ```bash
   az webapp deployment list-publishing-profiles \
     --name $APP_SERVICE_NAME \
     --resource-group $RESOURCE_GROUP \
     --xml
   ```

2. **Add to GitHub Secrets:**
   - Repository → Settings → Secrets → Actions
   - Create secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Paste the XML content

3. **Create `.github/workflows/azure-deploy.yml`:**
   ```yaml
   name: Deploy to Azure App Service

   on:
     push:
       branches: [main]

   env:
     AZURE_WEBAPP_NAME: app-teams-minutes-demo
     NODE_VERSION: '18.x'

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: ${{ env.NODE_VERSION }}
             cache: 'npm'
         
         - name: Install dependencies
           run: npm ci
         
         - name: Build frontend
           run: |
             cd client
             npm ci
             npm run build
             cd ..
         
         - name: Upload artifact
           uses: actions/upload-artifact@v4
           with:
             name: node-app
             path: .

     deploy:
       runs-on: ubuntu-latest
       needs: build
       steps:
         - name: Download artifact
           uses: actions/download-artifact@v4
           with:
             name: node-app
         
         - name: Deploy to Azure
           uses: azure/webapps-deploy@v2
           with:
             app-name: ${{ env.AZURE_WEBAPP_NAME }}
             publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
             package: .
   ```

4. **Push to GitHub:**
   ```bash
   git add .github/workflows/azure-deploy.yml
   git commit -m "Add Azure deployment workflow"
   git push origin main
   ```

### Step 3.5: Verify Deployment

```bash
# Check app logs
az webapp log tail \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP

# Test health endpoint
curl https://$APP_SERVICE_NAME.azurewebsites.net/health
```

**Expected response:**
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
      "configurationUrl": "https://<APP_SERVICE_NAME>.azurewebsites.net/config",
      "scopes": ["team", "groupchat"]
    }
  ],
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://<APP_SERVICE_NAME>.azurewebsites.net",
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
    "<APP_SERVICE_NAME>.azurewebsites.net"
  ],
  "webApplicationInfo": {
    "id": "<GRAPH_CLIENT_ID>",
    "resource": "https://graph.microsoft.com"
  }
}
```

**Replace placeholders:**
- `<MICROSOFT_APP_ID>`: Bot app ID from Step 2.3
- `<APP_SERVICE_NAME>`: Your App Service name
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
az webapp log tail \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP

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
  curl -X POST https://$APP_SERVICE_NAME.azurewebsites.net/api/meetings \
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

# Alert: High error rate
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$APP_SERVICE_NAME" \
  --condition "count Http5xx > 10" \
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
curl https://$APP_SERVICE_NAME.azurewebsites.net/api/webhooks/subscriptions

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

# Should be: https://<APP_SERVICE_NAME>.azurewebsites.net/api/webhooks/bot

# Check bot logs
az webapp log tail --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP | grep -i "bot"
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
az webapp config appsettings list \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?name=='SHAREPOINT_SITE_URL' || name=='SHAREPOINT_LIBRARY']"
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
| **App Service Plan** | Basic B1 | 1 instance | $13/month | $13 |
| **PostgreSQL Flexible Server** | Burstable B2s | 1 server | $30/month | $30 |
| **PostgreSQL Storage** | 32 GB SSD | 32 GB | $0.12/GB | $4 |
| **Azure OpenAI** | GPT-4o | 500K tokens/month | $0.015/1K tokens | $8 |
| **Azure OpenAI** | Whisper | 50 hours/month | $0.006/minute | $18 |
| **Application Insights** | Standard | 2 GB/month | $2.30/GB | $5 |
| **Bot Service** | Free tier | 10K messages | Free | $0 |
| **Data Transfer** | Standard | 5 GB/month | $0.087/GB | $0.50 |
| | | | **TOTAL (Demo):** | **$78.50/month** |

### Monthly Costs (Production - 100 Users)

| Service | SKU | Quantity | Monthly Cost |
|---------|-----|----------|--------------|
| **App Service Plan** | Standard S1 | 2 instances (avg) | $140 |
| **PostgreSQL** | General Purpose D2s_v3 | 1 server | $120 |
| **PostgreSQL Storage** | 64 GB SSD | 64 GB | $8 |
| **Azure OpenAI** | GPT-4o + Whisper | 5M tokens + 250 hours | $90 |
| **Application Insights** | Standard | 10 GB/month | $23 |
| **Data Transfer** | Standard | 25 GB/month | $2 |
| | | **TOTAL (Production):** | **$383/month** |

### Cost Optimization Tips

1. **Auto-scaling:** Configure App Service to scale down during non-business hours (6 PM - 6 AM)
   - **Savings:** ~$40/month (30% reduction)

2. **Reserved Instances (1-3 year):**
   - **App Service:** 20-40% savings
   - **PostgreSQL:** 40-60% savings
   - **Estimated savings:** $80-120/month for production

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
# Option 1: Restore previous deployment slot (if using slots)
az webapp deployment slot swap \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --slot staging \
  --target-slot production \
  --action swap

# Option 2: Redeploy previous version from Git
git checkout <previous-working-commit>
npm run build
az webapp deploy \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --src-path deploy.zip \
  --type zip

# Restart app
az webapp restart \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP
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

# Update App Service to use restored database
# (Update DATABASE_URL connection string)
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
   az webapp config appsettings set \
     --name $APP_SERVICE_NAME \
     --resource-group $RESOURCE_GROUP \
     --settings ENABLE_WEBHOOKS=false
   ```

2. **Stop job worker** (prevents background processing):
   ```bash
   az webapp config appsettings set \
     --name $APP_SERVICE_NAME \
     --resource-group $RESOURCE_GROUP \
     --settings ENABLE_JOB_WORKER=false
   
   az webapp restart --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP
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
# Delete App Service Plan (keeps database)
az appservice plan delete \
  --name $APP_SERVICE_PLAN \
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

- **Application:** `https://<APP_SERVICE_NAME>.azurewebsites.net`
- **Health Check:** `https://<APP_SERVICE_NAME>.azurewebsites.net/health`
- **Azure Portal:** `https://portal.azure.com`
- **Teams Admin Center:** `https://admin.teams.microsoft.com`
- **Application Insights:** `https://portal.azure.com → Resource Group → App Insights`

### Common Commands

```bash
# View logs
az webapp log tail --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP

# Restart app
az webapp restart --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP

# Check database
psql "$DATABASE_URL"

# SSH into App Service
az webapp ssh --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP

# View environment variables
az webapp config appsettings list --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP
```

### Support Contacts

- **Azure Support:** https://portal.azure.com → Support
- **Microsoft 365 Support:** https://admin.microsoft.com → Support
- **Teams Developer Support:** https://developer.microsoft.com/microsoft-teams

---

## Document Control

- **Version:** 2.0
- **Date:** November 21, 2024
- **Purpose:** Azure Commercial deployment guide
- **Target:** Demonstration and production environments
- **Cost:** $79/month (demo), $383/month (100 users production)
