# Azure Test Environment Deployment & Validation Guide

**Purpose:** Deploy to a test Azure environment to validate all critical scenarios before production deployment. This ensures zero-tolerance for errors in production.

---

## Prerequisites

### Azure Resources Needed
- Azure subscription with Owner role
- Azure Cloud Shell access (use Cloud Shell, NOT local machine)
- Test Azure AD tenant (can use same as production)
- Test Microsoft 365 tenant for Teams integration

### Required Information
Before starting, gather:
- Azure subscription ID
- Azure AD tenant ID
- Resource group name (e.g., `rg-teams-minutes-test`)
- Location (e.g., `eastus`)
- Unique app name prefix (e.g., `teams-minutes-test`)

---

## Phase 1: Infrastructure Deployment

### Step 1: Login to Azure Cloud Shell

```bash
# Open Azure Cloud Shell in browser
# https://shell.azure.com

# Verify you're logged in with correct subscription
az account show
az account list --output table

# Set correct subscription if needed
az account set --subscription <subscription-id>
```

### Step 2: Clone Repository to Cloud Shell

```bash
# Clone your repository
git clone <your-repo-url>
cd <repo-directory>
```

### Step 3: Deploy Infrastructure

```bash
cd azure-infrastructure

# Make deployment script executable
chmod +x deploy.sh

# Deploy test environment
./deploy.sh test

# Script will prompt for:
# - Resource group name: rg-teams-minutes-test
# - Location: eastus
# - App name prefix: teams-minutes-test
# - Environment: test
```

**Expected Deployment Time:** 15-20 minutes

### Step 4: Capture Deployment Outputs

The deployment will output critical information:

```bash
# Save these values for next steps:
APP_SERVICE_URL=<url>
APP_SERVICE_NAME=<name>
KEY_VAULT_NAME=<name>
STORAGE_ACCOUNT_NAME=<name>
OPENAI_ENDPOINT=<endpoint>
DATABASE_SERVER=<server>
MANAGED_IDENTITY_CLIENT_ID=<id>
```

**IMPORTANT:** Save all outputs to a text file for reference during validation.

---

## Phase 2: Application Configuration

### Step 5: Register Azure AD Application

```bash
# This must be done manually in Azure Portal
# Navigate to: Azure Active Directory > App registrations > New registration

# Settings:
# Name: Teams Meeting Minutes (Test)
# Supported account types: Single tenant
# Redirect URI: https://<APP_SERVICE_URL>/auth/callback
```

**Capture these values:**
- Application (client) ID
- Directory (tenant) ID

### Step 6: Create Client Secret

```bash
# In your App registration:
# Certificates & secrets > New client secret
# Description: Test Environment Secret
# Expires: 3 months (test only)
```

**Capture:**
- Client secret value (shown only once!)

### Step 7: Configure API Permissions

```bash
# In your App registration:
# API permissions > Add permission > Microsoft Graph > Application permissions

# Add these permissions:
# - OnlineMeetings.Read.All
# - CallRecords.Read.All
# - User.Read.All
# - Group.Read.All
# - Sites.ReadWrite.All

# Then: Grant admin consent for <tenant>
```

### Step 8: ~~Store Secrets in Key Vault~~ (SKIPPED)

**DEPLOYMENT DECISION:** Using App Service application settings instead of Key Vault for demo pilots.

**Why:**
- ✅ Simpler deployment with fewer failure points
- ✅ Azure encrypts app settings at rest (adequate security for demo)
- ✅ Standard pattern used by most Azure applications
- ✅ Aligns with "zero tolerance for errors" requirement
- 📋 Key Vault integration can be added later for production

**This step is skipped** - all secrets will be configured as App Service application settings in Step 10.

**Note:** Key Vault infrastructure is still provisioned (for future use), but the application will not retrieve secrets from it during the demo pilot.

### Step 9: Configure Webhook Public Endpoint

**CRITICAL: Microsoft Graph requires a publicly accessible HTTPS endpoint**

```bash
# Get App Service default hostname
APP_HOSTNAME=$(az webapp show --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --query "defaultHostName" -o tsv)

# Your webhook endpoint will be:
WEBHOOK_URL="https://$APP_HOSTNAME/webhooks/graph/notifications"

echo "Webhook URL: $WEBHOOK_URL"

# IMPORTANT: Save this URL for Microsoft Graph webhook subscription
# This endpoint must be:
# 1. Publicly accessible (no VPN or private network required)
# 2. HTTPS with valid certificate (App Service provides this)
# 3. Able to respond to validation requests within 10 seconds
```

**DNS Configuration (Optional for Custom Domain):**

If you want to use a custom domain instead of `*.azurewebsites.net`:

```bash
# Add custom domain to App Service
az webapp config hostname add \
  --webapp-name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --hostname meetings.yourdomain.com

# Enable HTTPS (App Service Managed Certificate - FREE)
az webapp config ssl bind \
  --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --certificate-thumbprint auto \
  --ssl-type SNI

# Update webhook URL
WEBHOOK_URL="https://meetings.yourdomain.com/webhooks/graph/notifications"
```

### Step 10: Configure App Service Application Settings

**CRITICAL:** All configuration (including secrets) stored as App Service application settings.

Azure encrypts these at rest and controls access via RBAC.

```bash
# First, set your App Service name and gather values
APP_NAME="<APP_SERVICE_NAME>"

# Get database connection string from deployment outputs
DATABASE_URL="<from-bicep-outputs>"

# Get App Service hostname for webhook URL
APP_HOSTNAME=$(az webapp show --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --query "defaultHostName" -o tsv)

# Generate session secret (one-time)
SESSION_SECRET=$(openssl rand -base64 32)

# Generate webhook validation token (for Microsoft Graph)
WEBHOOK_TOKEN=$(openssl rand -hex 32)

# Set YOUR values for these variables:
TENANT_ID="<your-azure-ad-tenant-id>"
CLIENT_ID="<your-app-registration-client-id>"
CLIENT_SECRET="<your-app-registration-client-secret>"
OPENAI_ENDPOINT="<your-azure-openai-endpoint>"
OPENAI_KEY="<your-azure-openai-api-key>"
SHAREPOINT_SITE="https://<tenant>.sharepoint.com/sites/TeamsMeetingMinutes"

# Configure ALL application settings (secrets + configuration)
az webapp config appsettings set --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --settings \
    NODE_ENV="production" \
    PORT="8080" \
    DATABASE_URL="$DATABASE_URL" \
    SESSION_SECRET="$SESSION_SECRET" \
    \
    GRAPH_TENANT_ID_PROD="$TENANT_ID" \
    GRAPH_CLIENT_ID_PROD="$CLIENT_ID" \
    GRAPH_CLIENT_SECRET_PROD="$CLIENT_SECRET" \
    \
    AZURE_OPENAI_ENDPOINT_PROD="$OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY_PROD="$OPENAI_KEY" \
    AZURE_OPENAI_DEPLOYMENT_PROD="gpt-4o" \
    AZURE_OPENAI_API_VERSION_PROD="2024-02-15-preview" \
    \
    SHAREPOINT_SITE_URL="$SHAREPOINT_SITE" \
    SHAREPOINT_LIBRARY="Meeting Minutes" \
    \
    USE_MOCK_SERVICES="false" \
    USE_MOCK_GRAPH="false" \
    USE_MOCK_AI="false" \
    USE_MOCK_SHAREPOINT="false" \
    \
    ENABLE_GRAPH_WEBHOOKS="true" \
    ENABLE_AZURE_OPENAI="true" \
    ENABLE_SHAREPOINT_ARCHIVAL="true" \
    ENABLE_EMAIL_DISTRIBUTION="false" \
    ENABLE_AZURE_AD_SYNC="true" \
    ENABLE_AUDIT_LOGGING="true" \
    ENABLE_ROI_TRACKING="true" \
    \
    WEBHOOK_BASE_URL="https://$APP_HOSTNAME" \
    WEBHOOK_VALIDATION_TOKEN="$WEBHOOK_TOKEN" \
    WEBHOOK_RENEWAL_INTERVAL="24" \
    \
    GROUP_SYNC_INTERVAL="15" \
    GROUP_SYNC_USE_DELTA="true" \
    GROUP_CACHE_TTL="15" \
    \
    BASE_URL="https://$APP_HOSTNAME"
```

**Configuration Groups Explained:**

1. **Environment & Core**
   - `NODE_ENV=production` - Enables production mode
   - `PORT=8080` - App Service port (required)
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - Secure session encryption key

2. **Microsoft Graph (Production suffix _PROD)**
   - `GRAPH_TENANT_ID_PROD` - Your Azure AD tenant ID
   - `GRAPH_CLIENT_ID_PROD` - App registration client ID
   - `GRAPH_CLIENT_SECRET_PROD` - App registration secret

3. **Azure OpenAI (Production suffix _PROD)**
   - `AZURE_OPENAI_ENDPOINT_PROD` - OpenAI endpoint URL
   - `AZURE_OPENAI_API_KEY_PROD` - OpenAI API key
   - `AZURE_OPENAI_DEPLOYMENT_PROD` - Model deployment name (gpt-4o)

4. **SharePoint Archival**
   - `SHAREPOINT_SITE_URL` - SharePoint site for document storage
   - `SHAREPOINT_LIBRARY` - Document library name

5. **Mock Service Flags** (all false for production)
   - Disables development mock services

6. **Feature Flags**
   - `ENABLE_GRAPH_WEBHOOKS=true` - Enable meeting capture
   - `ENABLE_AZURE_OPENAI=true` - Enable AI minutes generation
   - `ENABLE_SHAREPOINT_ARCHIVAL=true` - Enable document archival
   - `ENABLE_EMAIL_DISTRIBUTION=false` - Disabled (optional feature)
   - `ENABLE_AZURE_AD_SYNC=true` - Enable group membership sync
   - `ENABLE_AUDIT_LOGGING=true` - Enable audit trail
   - `ENABLE_ROI_TRACKING=true` - Enable usage metrics

7. **Webhook Configuration**
   - `WEBHOOK_BASE_URL` - Public webhook endpoint
   - `WEBHOOK_VALIDATION_TOKEN` - Secret for webhook validation
   - `WEBHOOK_RENEWAL_INTERVAL=24` - Renew subscriptions every 24h

8. **Azure AD Group Sync**
   - `GROUP_SYNC_INTERVAL=15` - Sync every 15 minutes
   - `GROUP_SYNC_USE_DELTA=true` - Use delta queries (efficient)
   - `GROUP_CACHE_TTL=15` - Cache TTL in minutes

**Security Notes:**
- ✅ App Service encrypts all settings at rest
- ✅ Settings only accessible via Azure RBAC
- ✅ Secrets not visible in logs or diagnostics
- ✅ Equivalent security to Key Vault for demo scope

### Step 11: Deploy Application Code

```bash
# From repository root
cd ..

# Install dependencies
npm install

# Build application (creates dist/ directory)
# This runs: vite build (frontend) + esbuild server/index.ts (backend)
npm run build

# Verify build output
ls -lh dist/
# Should see: index.js (bundled server), assets/ (frontend static files)

# Create deployment package
# CRITICAL: Include all runtime dependencies
zip -r deploy.zip \
  dist/ \
  package.json \
  package-lock.json \
  drizzle/ \
  shared/

# Verify package contents
unzip -l deploy.zip | head -20

# Deploy to App Service
az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --src deploy.zip

# App Service will automatically:
# 1. Extract deploy.zip
# 2. Run: npm install --production
# 3. Start: node dist/index.js
```

**Expected Deployment Time:** 5-10 minutes

**Build Output Structure:**
```
dist/
  index.js          - Bundled Node.js server (ESM format)
  assets/           - Frontend static files (HTML, CSS, JS, images)
    index-*.js      - Frontend JavaScript bundle
    index-*.css     - Frontend CSS bundle
```

**What Gets Deployed:**
- ✅ `dist/` - Compiled application
- ✅ `package.json` + `package-lock.json` - Dependency manifests
- ✅ `drizzle/` - Database migrations (if needed)
- ✅ `shared/` - Shared TypeScript types
- ❌ `node_modules/` - Excluded (App Service installs)
- ❌ `server/` - Excluded (compiled into dist/index.js)
- ❌ `client/` - Excluded (compiled into dist/assets/)

---

## Phase 3: Validation Testing

### Test 1: Application Health Check

```bash
# Check if app is running
curl https://<APP_SERVICE_URL>/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}

# Check App Service logs
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Look for:
# ✅ "Worker lock acquired - this instance is the ACTIVE worker"
# ✅ "Configuration valid for PRODUCTION MODE"
# ✅ "Configured secrets: GRAPH_TENANT_ID_PROD, GRAPH_CLIENT_ID_PROD, ..."
# ❌ Any configuration validation errors
```

**Success Criteria:**
- [ ] Application starts without errors
- [ ] Health endpoint responds with 200 OK
- [ ] Configuration validation passes (all required settings loaded)
- [ ] Database connection established
- [ ] No authentication errors in logs

---

### Test 2: Configuration Validation

**Objective:** Verify all App Service settings loaded correctly

```bash
# Check App Service logs for configuration validation
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test | grep -i "config"

# Expected logs:
# ✅ "================================================="
# ✅ "Configuration Validation Results"
# ✅ "Environment: production"
# ✅ "Mock Services: Disabled"
# ✅ "✓ Configured secrets: [list of all secrets]"
# ✅ "Configuration valid for PRODUCTION MODE"

# Should NOT see:
# ❌ "Missing required secrets - application may not function correctly"
# ❌ "USE_MOCK_SERVICES enabled in production"
# ❌ "Configuration validation FAILED"
```

**Test Procedure:**
1. Restart App Service to force fresh configuration load
2. Monitor logs for configuration validation
3. Verify all required settings are loaded from App Service
4. Confirm production mode enabled

**Success Criteria:**
- [ ] All required settings loaded successfully
- [ ] No missing required secrets errors
- [ ] Production mode confirmed (NODE_ENV=production)
- [ ] Mock services disabled
- [ ] Database connection established

**Troubleshooting:**
If configuration validation fails:
```bash
# Check App Service settings are actually set
az webapp config appsettings list --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --query "[?name=='GRAPH_TENANT_ID_PROD']"

# Should return the setting value (Azure masks secrets in output)

# Check for typos in setting names
az webapp config appsettings list --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --query "[].name" | grep -i graph
```

---

### Test 3: Job Worker Lock & Failover

**Objective:** Verify only ONE worker processes jobs across multiple instances

#### Part A: Single Instance Lock Acquisition

```bash
# Check logs for worker lock
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test | grep "JobWorker"

# Expected:
# ✅ "[JobWorker] Attempting to acquire worker lock..."
# ✅ "Worker lock acquired - this instance is the ACTIVE worker"
# ✅ "[JobWorker] Starting job processing loop..."
```

**Success Criteria:**
- [ ] Worker acquires lock successfully
- [ ] No error messages about lock acquisition
- [ ] Job processing starts

#### Part B: Multi-Instance Standby Mode

```bash
# Scale out to 2 instances
az appservice plan update --name <plan-name> \
  --resource-group rg-teams-minutes-test \
  --number-of-workers 2

# Wait 30 seconds for new instance to start

# Check logs from BOTH instances
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Expected from Instance 1 (active):
# ✅ "Worker lock acquired - this instance is the ACTIVE worker"
# ✅ "[JobWorker] Stats: { pending: X, processing: Y, ... }"

# Expected from Instance 2 (standby):
# ✅ "Another instance holds the lock - entering STANDBY mode"
# ✅ "Will retry lock acquisition every 30 seconds for failover..."
# ❌ Should NOT see job processing stats
```

**Success Criteria:**
- [ ] Only ONE instance shows "ACTIVE worker"
- [ ] Second instance enters STANDBY mode
- [ ] Standby logs "retry every 30 seconds" message
- [ ] No duplicate job processing

#### Part C: Failover Testing

```bash
# Restart the ACTIVE instance to simulate crash
# First, identify which instance is active (from logs)

# Restart App Service (simulates crash)
az webapp restart --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Monitor logs for failover
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test | grep "JobWorker"

# Expected sequence:
# 1. Instance 1: "Stopped and lock released"
# 2. Instance 2: "Worker lock acquired - this instance is the ACTIVE worker"
# 3. Instance 2: "Starting job processing loop..."

# Timing: Should take < 60 seconds (30s retry interval + startup time)
```

**Success Criteria:**
- [ ] Active instance releases lock on shutdown
- [ ] Standby instance acquires lock within 60 seconds
- [ ] New active instance starts processing jobs
- [ ] No gap in job processing (verify with test job)

**Troubleshooting:**
If standby never acquires lock:
```bash
# Check for stranded locks in database
# Connect to PostgreSQL
az postgres flexible-server execute --name <db-server> \
  --admin-user <admin> \
  --admin-password <password> \
  --database-name meeting_minutes \
  --query-string "SELECT * FROM pg_locks WHERE locktype='advisory';"

# If lock is stranded, it will show here
# This indicates the try/finally lock release failed
```

---

### Test 4: Webhook Callback Authentication

**Objective:** Verify Microsoft Graph can POST to webhook endpoints without auth failures

#### Part A: Webhook Registration

```bash
# Use your test Teams account to create a meeting
# This will trigger webhook subscription creation

# Check logs for webhook registration
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test | grep "webhook"

# Expected:
# ✅ "POST /api/admin/webhooks/subscribe 201" (authenticated endpoint)
# ✅ "Webhook subscription created: <subscription-id>"
```

#### Part B: Manual Webhook Subscription

**IMPORTANT:** Webhook subscriptions must be created through the application UI or API.

**Option 1: Using Admin UI (Recommended)**

1. Navigate to: `https://<APP_SERVICE_URL>/admin/webhooks`
2. Click "Create Subscription"
3. Select resource type: "Online Meetings"
4. System will automatically register with Microsoft Graph

**Option 2: Using API (Advanced)**

```bash
# Get auth token (requires admin login)
TOKEN="<your-bearer-token>"

# Create webhook subscription
curl -X POST https://<APP_SERVICE_URL>/api/admin/webhooks/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "/communications/onlineMeetings",
    "changeType": "created,updated"
  }'

# Expected response:
# {
#   "id": "<subscription-id>",
#   "resource": "/communications/onlineMeetings",
#   "notificationUrl": "https://<app>/webhooks/graph/notifications",
#   "expirationDateTime": "..."
# }
```

**Validation Callback Test:**

Microsoft Graph immediately sends a validation request:

```bash
# Monitor for validation callback
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Expected:
# ✅ "POST /webhooks/graph/notifications?validationToken=..." (PUBLIC endpoint)
# ✅ "Webhook validation successful - responding with token"
# ❌ Should NOT see: "Authentication required" or 401 errors
```

**Success Criteria:**
- [ ] Subscription created successfully
- [ ] Validation request received at `/webhooks/graph/notifications`
- [ ] No authentication errors (webhook endpoint is public)
- [ ] Subscription confirmed active (check Graph API or database)

#### Part C: Live Notification Test

**Create a test Teams meeting to trigger webhook:**

1. Schedule a Teams meeting with 2+ participants
2. Start and record the meeting (1+ minutes)
3. End the meeting
4. Wait 5-10 minutes for recording processing

```bash
# Monitor webhook notifications
az webapp log tail --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Expected sequence:
# 1. "POST /webhooks/graph/notifications" (meeting created)
# 2. "POST /webhooks/graph/notifications" (meeting started)
# 3. "POST /webhooks/graph/notifications" (recording available)
# 4. "Job enqueued: enrich_meeting"
# 5. "Job enqueued: generate_minutes"

# Should NOT see:
# ❌ "401 Unauthorized" on webhook endpoint
# ❌ "clientState validation failed"
# ❌ "Authentication required"
```

**Success Criteria:**
- [ ] Webhook notifications received at public endpoint
- [ ] No authentication errors
- [ ] Jobs enqueued for meeting processing
- [ ] clientState validation passes

**Troubleshooting:**
If webhooks return 401:
```bash
# Verify endpoint is NOT behind auth middleware
curl -X POST https://<APP_SERVICE_URL>/webhooks/graph/notifications \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'

# Should return 200 or 400 (not 401)
```

---

### Test 5: End-to-End Meeting Minutes Flow

**Objective:** Validate complete workflow from meeting → transcription → minutes → approval

#### Test Procedure:

1. **Create Test Meeting**
   ```bash
   # Schedule Teams meeting via Microsoft Teams
   # - Title: "Test Meeting - Azure Validation"
   # - Duration: 5 minutes minimum
   # - Enable recording
   # - Add 2+ test participants
   ```

2. **Conduct Meeting**
   - Start meeting
   - Enable recording
   - Have participants speak clearly for 1-2 minutes
   - End meeting and stop recording

3. **Monitor Processing**
   ```bash
   # Watch job queue
   az webapp log tail --name $APP_NAME \
     --resource-group rg-teams-minutes-test | grep "Job"

   # Expected sequence:
   # 1. "Job enqueued: enrich_meeting" (webhook triggered)
   # 2. "Job started: enrich_meeting"
   # 3. "Fetching transcript from Microsoft Graph"
   # 4. "Job completed: enrich_meeting"
   # 5. "Job enqueued: generate_minutes"
   # 6. "Job started: generate_minutes"
   # 7. "Calling Azure OpenAI GPT-4o for minutes generation"
   # 8. "Job completed: generate_minutes"
   ```

4. **Verify in UI**
   - Navigate to https://<APP_SERVICE_URL>
   - Login with test account
   - Find meeting in dashboard
   - Verify meeting minutes generated
   - Test approval workflow
   - Download DOCX/PDF exports

**Success Criteria:**
- [ ] Webhook triggered within 10 minutes of meeting end
- [ ] Transcript fetched from Microsoft Graph
- [ ] Azure OpenAI generates minutes successfully
- [ ] Minutes appear in UI with correct content
- [ ] Approval workflow functions
- [ ] Document export works (DOCX/PDF)
- [ ] SharePoint archival succeeds (if configured)

---

## Phase 4: Performance & Monitoring

### Test 6: Application Insights Monitoring

```bash
# Verify telemetry is being sent
az monitor app-insights metrics show \
  --app <app-insights-name> \
  --resource-group rg-teams-minutes-test \
  --metrics "requests/count"

# Check for errors
az monitor app-insights query \
  --app <app-insights-name> \
  --resource-group rg-teams-minutes-test \
  --analytics-query "traces | where severityLevel > 2 | order by timestamp desc | take 20"
```

**Success Criteria:**
- [ ] Telemetry data flowing to Application Insights
- [ ] No critical errors in traces
- [ ] Request success rate > 95%
- [ ] Database queries < 500ms average

---

## Phase 5: Rollback & Recovery Procedures

### Before Testing: Create Backups

**CRITICAL: Always backup before major changes**

```bash
# Backup PostgreSQL database
DB_SERVER="<database-server-name>"
DB_NAME="meeting_minutes"
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"

# Create database dump
az postgres flexible-server execute --name $DB_SERVER \
  --admin-user <admin> \
  --admin-password <password> \
  --database-name $DB_NAME \
  --file-path $BACKUP_FILE

# Or use pg_dump (if available)
pg_dump -h $DB_SERVER.postgres.database.azure.com \
  -U <admin> \
  -d $DB_NAME \
  -f $BACKUP_FILE

# Upload backup to safe storage
az storage blob upload \
  --account-name <storage-account> \
  --container-name backups \
  --name $BACKUP_FILE \
  --file $BACKUP_FILE
```

### If Critical Issues Found

**Option 1: Quick Rollback (keep infrastructure, fix code)**
```bash
# Revert to previous deployment
az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --src previous-deploy.zip

# Or enable mock mode temporarily (disable real services)
az webapp config appsettings set --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --settings \
    USE_MOCK_SERVICES="true" \
    USE_MOCK_GRAPH="true" \
    USE_MOCK_AI="true" \
    USE_MOCK_SHAREPOINT="true"
```

**Option 2: Database Restore**
```bash
# Restore database from backup (if data corruption)
# WARNING: This will overwrite current database

# Download backup file
az storage blob download \
  --account-name <storage-account> \
  --container-name backups \
  --name $BACKUP_FILE \
  --file restore.sql

# Restore database
psql -h $DB_SERVER.postgres.database.azure.com \
  -U <admin> \
  -d $DB_NAME \
  -f restore.sql

# Or use Azure CLI
az postgres flexible-server restore \
  --resource-group rg-teams-minutes-test \
  --name $DB_SERVER \
  --source-server $DB_SERVER \
  --restore-point-in-time "2025-11-20T10:00:00Z"
```

**Option 3: Full Teardown with Data Preservation**
```bash
# IMPORTANT: Backup database FIRST (see above)

# Export Key Vault secrets before deletion
SECRETS=$(az keyvault secret list --vault-name $VAULT_NAME --query "[].name" -o tsv)
mkdir -p keyvault-backup
for secret in $SECRETS; do
  az keyvault secret show --vault-name $VAULT_NAME \
    --name $secret \
    --query "value" -o tsv > keyvault-backup/$secret.txt
done

# Delete resource group
az group delete --name rg-teams-minutes-test --yes

# CRITICAL: Key Vault soft-delete protection
# Key Vault is NOT immediately deleted - it enters soft-delete state
# You have 90 days to recover it OR you must purge it to reuse the name

# Check if Key Vault has purge protection enabled
az keyvault show --name $VAULT_NAME \
  --query "properties.enablePurgeProtection"

# If purge protection is ENABLED, you CANNOT purge the vault
# You must wait 90 days for automatic deletion
# If purge protection is DISABLED, you can purge immediately

# To recover deleted Key Vault (within 90 days)
az keyvault recover --name $VAULT_NAME

# To permanently purge Key Vault (ONLY if purge protection disabled)
az keyvault purge --name $VAULT_NAME

# NOTE: You cannot create a new Key Vault with the same name
# until the old one is purged or recovered

# IMPORTANT: If using Key Vault in production, ALWAYS enable purge protection
# This prevents accidental permanent deletion of secrets
```

**Option 4: Scale to Zero (keep infrastructure, stop billing)**

**CRITICAL: Drain job queue before scaling down to prevent data loss**

```bash
# Step 1: Check job queue status
az postgres flexible-server execute --name <db-server> \
  --admin-user <admin> \
  --admin-password <password> \
  --database-name meeting_minutes \
  --query-string "SELECT status, COUNT(*) FROM job_queue GROUP BY status;"

# Expected output:
# status      | count
# ------------|------
# pending     | X
# processing  | Y
# completed   | Z

# Step 2: Wait for pending/processing jobs to complete
# Monitor until pending + processing = 0
# This may take 10-30 minutes depending on queue depth

# Step 3: Disable webhook renewals (prevent new jobs)
az webapp config appsettings set --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --settings ENABLE_GRAPH_WEBHOOKS="false"

# Step 4: Restart to apply setting
az webapp restart --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Step 5: Verify queue is empty
az postgres flexible-server execute --name <db-server> \
  --admin-user <admin> \
  --admin-password <password> \
  --database-name meeting_minutes \
  --query-string "SELECT COUNT(*) FROM job_queue WHERE status IN ('pending', 'processing');"

# Should return: 0

# Step 6: Stop App Service (keeps all data)
az webapp stop --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Or scale to zero instances (no compute charges)
az appservice plan update --name <plan-name> \
  --resource-group rg-teams-minutes-test \
  --number-of-workers 0

# To resume:
az webapp start --name $APP_NAME \
  --resource-group rg-teams-minutes-test

# Re-enable webhooks
az webapp config appsettings set --name $APP_NAME \
  --resource-group rg-teams-minutes-test \
  --settings ENABLE_GRAPH_WEBHOOKS="true"
```

**Why Queue Draining is Critical:**
- Jobs in `processing` state may be lost if instance shuts down mid-execution
- Webhook notifications may be lost if received during shutdown
- Background tasks (AI generation, SharePoint upload) may fail partially

### Data Retention Policy

**Database Backups:**
- Automated backups: 7 days retention (Azure PostgreSQL default)
- Manual backups: Store in Azure Blob Storage with 30-day retention
- Before major changes: Always create manual backup

**Key Vault:**
- Soft-delete: 90 days retention (cannot be disabled)
- Purge protection: Optional (prevents permanent deletion)
- Backup: Export secrets to secure storage before teardown

**Application Insights:**
- Logs retention: 90 days default
- Custom retention: Configure in Azure Portal (up to 730 days)

---

## Validation Checklist Summary

Before promoting to production, ensure ALL tests pass:

### Infrastructure
- [ ] Bicep deployment completes without errors
- [ ] All Azure resources provisioned correctly
- [ ] RBAC assignments applied (Key Vault, OpenAI, Storage)

### Key Vault Integration
- [ ] Managed Identity authenticates to Key Vault
- [ ] All required secrets retrieved successfully
- [ ] 15-minute cache working (no repeated fetches)
- [ ] No fallback to environment variables

### Job Worker & Failover
- [ ] Single instance acquires lock and processes jobs
- [ ] Second instance enters STANDBY mode (doesn't process)
- [ ] Standby retries lock acquisition every 30 seconds
- [ ] Failover works when active instance crashes (<60s)
- [ ] Lock released on all shutdown paths (no stranding)

### Webhook Authentication
- [ ] Validation callback succeeds (no 401 errors)
- [ ] Live webhook notifications received
- [ ] Jobs enqueued from webhook triggers
- [ ] Admin endpoints still require authentication

### End-to-End Flow
- [ ] Teams meeting triggers webhook
- [ ] Transcript fetched from Microsoft Graph
- [ ] Azure OpenAI generates minutes
- [ ] Minutes appear in UI correctly
- [ ] Approval workflow functional
- [ ] Document export works (DOCX/PDF)
- [ ] SharePoint archival succeeds

### Monitoring
- [ ] Application Insights receiving telemetry
- [ ] No critical errors in logs
- [ ] Performance within acceptable limits

---

## Common Issues & Solutions

### Issue: Key Vault Access Denied
**Symptom:** "DefaultAzureCredential authentication failed"

**Solution:**
```bash
# Verify Managed Identity has Key Vault Secrets User role
az role assignment create \
  --assignee $MANAGED_IDENTITY_CLIENT_ID \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-teams-minutes-test/providers/Microsoft.KeyVault/vaults/$VAULT_NAME
```

### Issue: Job Worker Lock Stranded
**Symptom:** All instances in STANDBY, no jobs processing

**Solution:**
```bash
# Connect to database and release advisory lock
az postgres flexible-server execute --name <db-server> \
  --admin-user <admin> \
  --admin-password <password> \
  --database-name meeting_minutes \
  --query-string "SELECT pg_advisory_unlock_all();"

# Restart App Service
az webapp restart --name $APP_NAME \
  --resource-group rg-teams-minutes-test
```

### Issue: Webhooks Return 401
**Symptom:** "POST /webhooks/graph/notifications 401"

**Solution:**
```bash
# Verify routes.ts has webhook endpoints OUTSIDE /api/* prefix
# Check server logs for auth middleware messages
# Webhook endpoints should bypass authentication
```

### Issue: OpenAI Rate Limits
**Symptom:** "Rate limit exceeded" errors

**Solution:**
```bash
# Increase tokens-per-minute quota in Azure OpenAI
# Or add retry logic with exponential backoff
```

---

## Next Steps After Successful Validation

Once ALL validation tests pass:

1. **Document Results**
   - Screenshot successful tests
   - Save log excerpts showing correct behavior
   - Note any performance metrics

2. **Production Deployment**
   - Use same Bicep template with production parameters
   - Follow same configuration steps
   - Apply learnings from test deployment

3. **Monitoring Setup**
   - Configure Application Insights alerts
   - Set up Azure Monitor dashboards
   - Enable auto-scaling rules

4. **User Onboarding**
   - Invite pilot users (20 max)
   - Provide training documentation
   - Set up support channels

---

**Last Updated:** November 20, 2025  
**Test Environment:** Azure Commercial (East US)  
**Deployment Method:** Bicep + Azure Cloud Shell
