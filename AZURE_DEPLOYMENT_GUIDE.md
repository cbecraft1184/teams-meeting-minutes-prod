# Azure Deployment Guide - NAVY ERP Demo Pilot

**Best Method:** Use **Azure Cloud Shell** (not Replit environment)  
**Reason:** Replit's containerized environment has Azure CLI/Bicep compatibility issues  
**Time:** 30-45 minutes end-to-end

---

## 🚀 Quick Start (Recommended)

### Step 1: Prepare Requirements (5 min)

Gather this information before starting:

| **Requirement** | **Your Value** | **Example** |
|----------------|----------------|-------------|
| **Azure Subscription ID** | _________________ | `12345678-1234-1234-1234-123456789012` |
| **Tenant ID** | _________________ | ABC123987.onmicrosoft.com tenant ID |
| **Admin Email** | _________________ | `ChrisBECRAFT@ABC123987.onmicrosoft.com` |
| **Environment Name** | `navy-demo` | Fixed for NAVY ERP pilot |
| **Region** | `eastus` | East US recommended |

**Find your IDs:**
```bash
# Go to: https://portal.azure.com
# Top right → Click your profile → "Switch directory" → Find tenant ID
# Or run in Cloud Shell: az account show
```

---

### Step 2: Open Azure Cloud Shell (2 min)

**Option A: Browser**
1. Go to: **https://shell.azure.com**
2. Sign in with: `ChrisBECRAFT@ABC123987.onmicrosoft.com`
3. Choose: **Bash** (not PowerShell)
4. Wait for cloud shell to initialize (~30 seconds)

**Option B: Azure Portal**
1. Go to: **https://portal.azure.com**
2. Click the **">_" icon** (top right toolbar)
3. Choose: **Bash**

---

### Step 3: Clone Project to Cloud Shell (3 min)

```bash
# Create working directory
mkdir -p ~/navy-erp-demo
cd ~/navy-erp-demo

# Download project files from Replit
# OPTION A: If you have GitHub repo connected
git clone <your-github-repo-url> .

# OPTION B: Manual upload (recommended for quick start)
# In Cloud Shell toolbar, click "Upload/Download files" icon
# Upload these files:
#   - azure-infrastructure/main.bicep
#   - azure-infrastructure/deploy.sh
#   - azure-infrastructure/parameters/demo.bicepparam
```

**Quick file structure check:**
```bash
ls -la
# Should see: main.bicep, deploy.sh, parameters/
```

---

### Step 4: Configure Deployment (5 min)

**Edit parameter file:**
```bash
# Open editor
code parameters/demo.bicepparam

# Update these values:
# - tenantId: '<YOUR-TENANT-ID>'
# - adminEmail: 'ChrisBECRAFT@ABC123987.onmicrosoft.com'
# - environment: 'navy-demo'
# - location: 'eastus'

# Save: Ctrl+S, Close: Ctrl+Q
```

**Verify your subscription:**
```bash
# Check current subscription
az account show

# If wrong subscription, switch:
az account set --subscription "<subscription-id>"

# Verify Owner/Contributor role
az role assignment list --assignee ChrisBECRAFT@ABC123987.onmicrosoft.com --include-inherited
```

---

### Step 5: Deploy Infrastructure (20 min)

```bash
# Make script executable
chmod +x deploy.sh

# Validate deployment first (no changes made)
./deploy.sh demo --validate-only

# If validation passes, deploy
./deploy.sh demo
```

**What happens during deployment:**
- ✅ Creates resource group: `tmm-navy-demo-eastus`
- ✅ Azure App Service (Node.js hosting)
- ✅ PostgreSQL database
- ✅ Azure OpenAI Service (GPT-4o + Whisper)
- ✅ Storage Account
- ✅ Key Vault (for secrets)
- ✅ Application Insights (monitoring)

**Expected output:**
```
[SUCCESS] Deployment completed successfully!

Resource Group: tmm-navy-demo-eastus
App Service: https://tmm-app-navy-demo.azurewebsites.net
PostgreSQL: tmm-pg-navy-demo.postgres.database.azure.com
OpenAI Endpoint: https://tmm-openai-navy-demo.openai.azure.com
```

---

### Step 6: Configure Azure AD Groups (15 min)

The application uses Azure AD group membership to determine user roles and clearance levels. You must create these groups before users can access the application.

**6.1: Create Role Groups**

Create these groups in Azure AD (Entra ID) with the exact names shown:

```bash
# Admin role - Full access to Settings, create meetings
az ad group create \
  --display-name "DOD-Role-Admin" \
  --mail-nickname "DOD-Role-Admin" \
  --description "Meeting Minutes Administrators - Full access to settings and meeting creation"

# Approver role - Can approve/reject meeting minutes
az ad group create \
  --display-name "DOD-Role-Approver" \
  --mail-nickname "DOD-Role-Approver" \
  --description "Meeting Minutes Approvers - Can approve or reject meeting minutes"

# Auditor role - View-only access to all meetings within clearance
az ad group create \
  --display-name "DOD-Role-Auditor" \
  --mail-nickname "DOD-Role-Auditor" \
  --description "Meeting Minutes Auditors - View-only access to all meetings"

# Viewer role - Can only view meetings they attended
az ad group create \
  --display-name "DOD-Role-Viewer" \
  --mail-nickname "DOD-Role-Viewer" \
  --description "Meeting Minutes Viewers - Can only view meetings they attended"
```

**6.2: Create Clearance Level Groups**

```bash
# TOP SECRET clearance - Can see all meeting classifications
az ad group create \
  --display-name "DOD-Clearance-TOP_SECRET" \
  --mail-nickname "DOD-Clearance-TOP-SECRET" \
  --description "TOP SECRET clearance - Access to all classified meetings"

# SECRET clearance - Can see SECRET, CONFIDENTIAL, and UNCLASSIFIED
az ad group create \
  --display-name "DOD-Clearance-SECRET" \
  --mail-nickname "DOD-Clearance-SECRET" \
  --description "SECRET clearance - Access to SECRET and below"

# CONFIDENTIAL clearance - Can see CONFIDENTIAL and UNCLASSIFIED
az ad group create \
  --display-name "DOD-Clearance-CONFIDENTIAL" \
  --mail-nickname "DOD-Clearance-CONFIDENTIAL" \
  --description "CONFIDENTIAL clearance - Access to CONFIDENTIAL and below"

# UNCLASSIFIED clearance - Default for all users
az ad group create \
  --display-name "DOD-Clearance-UNCLASSIFIED" \
  --mail-nickname "DOD-Clearance-UNCLASSIFIED" \
  --description "UNCLASSIFIED clearance - Access to unclassified meetings only"
```

**6.3: Assign Users to Groups**

Add users to appropriate groups using Azure Portal or CLI:

**Using Azure Portal:**
1. Go to **Azure Active Directory** → **Groups**
2. Select a group (e.g., `DOD-Role-Approver`)
3. Click **Members** → **Add members**
4. Search for users by name or email
5. Click **Select**

**Using Azure CLI:**
```bash
# Example: Add user to Approver role
az ad group member add \
  --group "DOD-Role-Approver" \
  --member-id $(az ad user show --id john.smith@navy.mil --query id -o tsv)

# Example: Add user to SECRET clearance
az ad group member add \
  --group "DOD-Clearance-SECRET" \
  --member-id $(az ad user show --id john.smith@navy.mil --query id -o tsv)
```

**Important Rules:**
- Each user should be in **ONE role group** (Admin, Approver, Auditor, OR Viewer)
- Each user should be in **ONE clearance group** (TOP_SECRET, SECRET, CONFIDENTIAL, OR UNCLASSIFIED)
- If a user is in multiple role groups, the system uses the highest role (Admin > Approver > Auditor > Viewer)
- If a user is in multiple clearance groups, the system uses the highest clearance

**Recommended Pilot Assignments (20 users):**
- 2 Admins (TOP_SECRET or SECRET clearance)
- 5 Approvers (SECRET clearance)
- 3 Auditors (SECRET clearance)
- 10 Viewers (mix of CONFIDENTIAL and UNCLASSIFIED)

**6.4: Verify Group Configuration**

```bash
# List all DOD groups
az ad group list --query "[?startsWith(displayName, 'DOD-')].{Name:displayName, Members:mail}" -o table

# Check a specific user's groups
az ad user get-member-groups \
  --id john.smith@navy.mil \
  --query "[?startsWith(displayName, 'DOD-')].[displayName]" -o table
```

**How It Works:**
1. User logs in with Azure AD SSO
2. Application fetches their group memberships via Microsoft Graph API
3. Groups are parsed to extract role and clearance level
4. Permissions are cached for 15 minutes (automatic refresh)
5. No app restart needed - changes take effect within 15 minutes

**To Change a User's Role:**
1. Remove them from current role group: `az ad group member remove --group "DOD-Role-Viewer" --member-id <user-id>`
2. Add them to new role group: `az ad group member add --group "DOD-Role-Approver" --member-id <user-id>`
3. Wait up to 15 minutes for cache to refresh (or have user log out/in)

---

### Step 7: Configure Application (10 min)

**7.1: Create Azure AD App Registrations**

```bash
# Create app registration for authentication
az ad app create \
  --display-name "NAVY ERP Meeting Minutes" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://tmm-app-navy-demo.azurewebsites.net/auth/callback" \
  --enable-id-token-issuance true

# Save the appId from output
APP_ID="<paste-app-id-here>"

# Add Microsoft Graph permissions
az ad app permission add \
  --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    b0afded3-3588-46d8-8b3d-9842eff778da=Scope \
    43431867-d0fb-4f55-aebb-5c2e3ae67fbc=Scope

# Grant admin consent (requires admin)
az ad app permission admin-consent --id $APP_ID
```

**6.2: Store Secrets in Key Vault**

```bash
# Get Key Vault name
KEYVAULT_NAME=$(az keyvault list \
  --resource-group tmm-navy-demo-eastus \
  --query "[0].name" -o tsv)

echo "Key Vault: $KEYVAULT_NAME"

# Get Azure OpenAI key
OPENAI_KEY=$(az cognitiveservices account keys list \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "key1" -o tsv)

# Store OpenAI credentials
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name openai-api-key \
  --value "$OPENAI_KEY"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name openai-endpoint \
  --value "https://tmm-openai-navy-demo.openai.azure.com"

# Generate and store session secret
SESSION_SECRET=$(openssl rand -base64 32)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name session-secret \
  --value "$SESSION_SECRET"

# Store database connection string
DB_PASSWORD="<your-db-password-from-deployment>"
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name database-url \
  --value "postgresql://dbadmin:${DB_PASSWORD}@tmm-pg-navy-demo.postgres.database.azure.com:5432/meeting_minutes?sslmode=require"

# Store Azure AD app ID
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-client-id \
  --value "$APP_ID"

# Store tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-tenant-id \
  --value "$TENANT_ID"
```

**6.3: Grant App Service Access to Key Vault**

```bash
# Get App Service managed identity
APP_PRINCIPAL_ID=$(az webapp identity assign \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $APP_PRINCIPAL_ID \
  --secret-permissions get list
```

---

### Step 7: Deploy Application Code (10 min)

**Option A: Deploy from Replit (Recommended)**

Back in Replit:
```bash
# Install Azure CLI in Replit (one-time)
npm install -g azure-cli

# Login to Azure
az login

# Build application
npm run build

# Create deployment package
zip -r deploy.zip \
  dist/ \
  server/ \
  package.json \
  package-lock.json

# Deploy to App Service
az webapp deployment source config-zip \
  --resource-group tmm-navy-demo-eastus \
  --name tmm-app-navy-demo \
  --src deploy.zip
```

**Option B: Deploy from Cloud Shell**

```bash
# Upload your built application to Cloud Shell
# Then deploy
az webapp deployment source config-zip \
  --resource-group tmm-navy-demo-eastus \
  --name tmm-app-navy-demo \
  --src deploy.zip
```

---

### Step 8: Initialize Database (5 min)

```bash
# Get database connection string
DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEYVAULT_NAME \
  --name database-url \
  --query value -o tsv)

# Run database migrations (from Replit or local)
export DATABASE_URL="$DATABASE_URL"
npm run db:push

# Verify tables created
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

---

### Step 9: Test Deployment (5 min)

**Health Check:**
```bash
# Test app is running
curl https://tmm-app-navy-demo.azurewebsites.net/api/health

# Expected response:
# {"status":"healthy","database":"connected","openai":"available"}
```

**Access Application:**
1. Open browser: `https://tmm-app-navy-demo.azurewebsites.net`
2. Sign in with: `ChrisBECRAFT@ABC123987.onmicrosoft.com`
3. Should see Dashboard with no meetings yet

**Test Teams Integration:**
1. Schedule a test Teams meeting
2. Enable recording
3. Conduct short 5-minute meeting
4. End meeting
5. Wait 3-5 minutes
6. Check dashboard for captured meeting

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Infrastructure deployed (check Azure Portal)
- [ ] App Service running (health check returns 200)
- [ ] Database connected (health check shows "connected")
- [ ] Azure OpenAI available (health check shows "available")
- [ ] Can sign in with Azure AD
- [ ] Dashboard loads without errors
- [ ] Test meeting captured and processed
- [ ] AI generates meeting minutes
- [ ] Can approve and distribute minutes

---

## 🔍 Monitoring & Troubleshooting

### View Application Logs

**Azure Portal:**
```
Portal → tmm-app-navy-demo → Monitoring → Log stream
```

**Azure CLI:**
```bash
az webapp log tail \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus
```

### Common Issues

**Issue: App won't start**
```bash
# Check logs
az webapp log tail --name tmm-app-navy-demo --resource-group tmm-navy-demo-eastus

# Verify Key Vault access
az keyvault secret show --vault-name $KEYVAULT_NAME --name database-url

# Restart app
az webapp restart --name tmm-app-navy-demo --resource-group tmm-navy-demo-eastus
```

**Issue: Database connection failed**
```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group tmm-navy-demo-eastus \
  --name tmm-pg-navy-demo

# Add Azure services access
az postgres flexible-server firewall-rule create \
  --resource-group tmm-navy-demo-eastus \
  --name tmm-pg-navy-demo \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Issue: AI not generating minutes**
```bash
# Check Azure OpenAI deployment
az cognitiveservices account deployment list \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus

# Verify API key
az cognitiveservices account keys list \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus
```

---

## 💰 Cost Management

**Monitor Spending:**
```bash
# View current month costs
az consumption usage list \
  --start-date $(date -d "first day of this month" +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'navy-demo')].{Resource:instanceName, Cost:pretaxCost}" \
  --output table
```

**Expected Costs (Demo Pilot):**
- App Service Basic: ~$13/month
- PostgreSQL Basic: ~$30/month
- Azure OpenAI: ~$50-100/month (usage-based)
- Storage: ~$5/month
- **Total: ~$100-150/month for 6-week pilot**

---

## 📞 Support

**Deployment Issues:**
- Check deployment logs in Cloud Shell
- Review Azure Portal → Resource Group → Deployments
- Verify prerequisites completed

**Application Issues:**
- Check Application Insights in Azure Portal
- Review App Service logs
- Verify Key Vault secrets

**Teams Integration Issues:**
- Verify Graph API permissions granted
- Check webhook subscriptions
- Review meeting recording settings

---

## 🎯 Next Steps After Deployment

1. **Add 20 pilot users** to Azure AD
2. **Create demo SharePoint site** for archival
3. **Schedule training session** (1 hour)
4. **Conduct first test meeting**
5. **Begin 4-6 week pilot evaluation**

---

**This guide gets your NAVY ERP demo pilot running on Azure in under 1 hour using Azure Cloud Shell (the reliable method).**
