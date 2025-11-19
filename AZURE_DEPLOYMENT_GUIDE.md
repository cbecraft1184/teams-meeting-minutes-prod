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

### Step 6: Configure Application (10 min)

**6.1: Create Azure AD App Registrations**

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
