# Azure Deployment Guide - NAVY ERP Demo Pilot

**Best Method:** Use **Azure Cloud Shell** (not Replit environment)  
**Reason:** Replit's containerized environment has Azure CLI/Bicep compatibility issues  
**Time:** 30-45 minutes end-to-end

---

## ⚠️ CRITICAL: Azure Government vs Commercial Cloud

This application is designed for **Azure Government (GCC High)** deployment for NAVY ERP. The configuration is **fundamentally different** from Azure Commercial Cloud.

### Microsoft 365 GCC High vs Commercial

| Service | Commercial Cloud | GCC High (Government) | **Use For NAVY** |
|---------|------------------|----------------------|------------------|
| **Microsoft Graph API** | `https://graph.microsoft.com` | `https://graph.microsoft.us` | ✅ GCC High |
| **Azure AD OAuth** | `https://login.microsoftonline.com` | `https://login.microsoftonline.us` | ✅ GCC High |
| **SharePoint** | `https://{tenant}.sharepoint.com` | `https://{tenant}.sharepoint.us` | ✅ GCC High |
| **Exchange Online** | `outlook.office365.com` | `outlook.office365.us` | ✅ GCC High |
| **Teams** | Commercial Teams | GCC High Teams | ✅ GCC High |

### Required OAuth Scopes for GCC High

**Microsoft Graph API Permissions (GCC High):**

```bash
# Application permissions (daemon/background services)
https://graph.microsoft.us/.default

# Delegated permissions (user context)
https://graph.microsoft.us/User.Read
https://graph.microsoft.us/Calendars.Read
https://graph.microsoft.us/OnlineMeetings.Read
https://graph.microsoft.us/Files.ReadWrite.All
https://graph.microsoft.us/Group.Read.All
```

**Key Differences from Commercial:**
- ❌ Commercial scopes: `https://graph.microsoft.com/.default`
- ✅ GCC High scopes: `https://graph.microsoft.us/.default`
- Resource identifier changes from `.com` to `.us`

### Application Environment Variables for GCC High

**Required Configuration:**

```bash
# Azure AD Endpoints (GCC High)
AZURE_AD_AUTHORITY=https://login.microsoftonline.us/{tenant-id}
AZURE_AD_TOKEN_ENDPOINT=https://login.microsoftonline.us/{tenant-id}/oauth2/v2.0/token

# Microsoft Graph API (GCC High)
MICROSOFT_GRAPH_ENDPOINT=https://graph.microsoft.us
MICROSOFT_GRAPH_SCOPE=https://graph.microsoft.us/.default

# SharePoint (GCC High)
SHAREPOINT_SITE_URL=https://{tenant}.sharepoint.us/sites/{site-name}

# Teams Bot Framework (GCC High)
BOT_FRAMEWORK_ENDPOINT=https://smba.trafficmanager.net/amer-client-ss.msg/

# Azure OpenAI (Azure Government)
AZURE_OPENAI_ENDPOINT=https://{resource-name}.openai.azure.us/
```

**DO NOT USE Commercial Endpoints:**
- ❌ `login.microsoftonline.com`
- ❌ `graph.microsoft.com`
- ❌ `{tenant}.sharepoint.com`
- ❌ `{resource-name}.openai.azure.com`

### Tenant Requirements

**NAVY ERP Tenant Configuration:**
- **Tenant:** ABC123987.onmicrosoft.com (GCC High tenant)
- **Tenant Type:** Microsoft 365 GCC High
- **Azure Subscription:** Azure Government subscription required
- **Region:** US Gov Virginia or US Gov Texas

**Verification:**
```bash
# Verify your tenant is GCC High
az login --tenant ABC123987.onmicrosoft.com
az account show --query "{Subscription:name, Tenant:tenantId, Environment:environmentName}"

# Expected output:
# {
#   "Subscription": "Azure Government - NAVY",
#   "Tenant": "<tenant-id>",
#   "Environment": "AzureUSGovernment"
# }
```

### Azure Key Vault + Managed Identity Architecture

**Why Key Vault?**
- ✅ **IL4 Compliance**: FIPS 140-2 Level 2 HSM-backed secrets
- ✅ **No Hardcoded Secrets**: Never store secrets in code or environment variables
- ✅ **Managed Identity for Key Vault**: App Service authenticates to Key Vault without passwords
- ✅ **Audit Trail**: All secret access logged in Application Insights
- ✅ **Automatic Rotation**: Supports secret versioning and rotation

**How It Works:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Azure App Service (Meeting Minutes Application)                     │
│  • System-assigned managed identity enabled                          │
│  • Managed identity ONLY for Key Vault access (not Graph API)        │
│  • No credentials stored in code or config                           │
└────────────────┬─────────────────────────────────────────────────────┘
                 │
                 │ (1) Managed Identity Authentication
                 │     App Service → Key Vault (passwordless)
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Azure Key Vault (Premium SKU - Azure Government)                    │
│  • Domain: vault.usgovcloudapi.net (NOT vault.azure.net)             │
│  • Access policy: Grants "Get" + "List" to App Service identity      │
│  • Secrets: Azure AD client secret, Graph API config, OpenAI keys    │
│  • FIPS 140-2 Level 2 HSM encryption                                 │
└────────────────┬─────────────────────────────────────────────────────┘
                 │
                 │ (2) Secrets loaded at runtime (Key Vault references)
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Application loads secrets from Key Vault                            │
│  • azure-ad-client-id + azure-ad-client-secret                       │
│  • graph-api-endpoint, graph-api-scope                               │
│  • sharepoint-site-url, azure-openai-api-key                         │
│  • database-url, session-secret                                      │
└────────────────┬─────────────────────────────────────────────────────┘
                 │
                 │ (3) Client Credentials Authentication
                 │     App uses Azure AD client ID + secret
                 ▼
           Application accesses external services:
           • Microsoft Graph API (GCC High) - client credentials
           • SharePoint (GCC High) - via Graph API
           • Azure OpenAI (Azure Government) - API key
           • PostgreSQL database - connection string
```

**Authentication Methods Used:**
1. **App Service → Key Vault**: System-assigned managed identity (passwordless)
2. **App Service → Microsoft Graph API**: Client credentials (Azure AD app registration + client secret)
3. **App Service → Azure OpenAI**: API key (stored in Key Vault)
4. **App Service → PostgreSQL**: Connection string (stored in Key Vault)

### Complete Key Vault Secrets List

All secrets must be configured for GCC High endpoints:

| Secret Name | Value Format | Required | Purpose |
|-------------|--------------|----------|---------|
| `database-url` | `postgresql://user:pass@host:5432/db?sslmode=require` | ✅ Yes | PostgreSQL connection string |
| `session-secret` | Base64 string (32+ bytes) | ✅ Yes | Express session encryption |
| `azure-ad-client-id` | GUID | ✅ Yes | Azure AD app registration ID |
| `azure-ad-tenant-id` | GUID | ✅ Yes | Azure AD tenant ID |
| `azure-ad-client-secret` | String | ✅ Yes | Azure AD app secret (for service principal) |
| `azure-ad-authority` | `https://login.microsoftonline.us/{tenant}` | ✅ Yes | GCC High OAuth authority |
| `graph-api-endpoint` | `https://graph.microsoft.us` | ✅ Yes | GCC High Graph endpoint |
| `graph-api-scope` | `https://graph.microsoft.us/.default` | ✅ Yes | GCC High OAuth scope |
| `sharepoint-site-url` | `https://{tenant}.sharepoint.us/sites/{site}` | ✅ Yes | GCC High SharePoint site |
| `sharepoint-library` | `Approved Minutes` | ✅ Yes | SharePoint document library name |
| `azure-openai-endpoint` | `https://{resource}.openai.azure.us/` | ✅ Yes | Azure Gov OpenAI endpoint |
| `azure-openai-api-key` | String | ✅ Yes | Azure OpenAI API key |
| `azure-openai-deployment` | `gpt-4o` | ✅ Yes | OpenAI model deployment name |
| `microsoft-app-id` | GUID | ⚠️ Optional | Teams Bot app ID (if using bot features) |
| `microsoft-app-password` | String | ⚠️ Optional | Teams Bot password (if using bot features) |

### App Service Environment Variables (Key Vault References)

Instead of storing secrets directly in App Service configuration, use **Key Vault references**:

```bash
# Format: @Microsoft.KeyVault(SecretUri={vault-url}/secrets/{secret-name}/)

DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/database-url/)
SESSION_SECRET=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/session-secret/)
AZURE_AD_CLIENT_ID=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-client-id/)
AZURE_AD_TENANT_ID=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-tenant-id/)
AZURE_AD_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-client-secret/)
AZURE_AD_AUTHORITY=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-authority/)
MICROSOFT_GRAPH_ENDPOINT=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/graph-api-endpoint/)
MICROSOFT_GRAPH_SCOPE=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/graph-api-scope/)
SHAREPOINT_SITE_URL=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/sharepoint-site-url/)
SHAREPOINT_LIBRARY=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/sharepoint-library/)
AZURE_OPENAI_ENDPOINT=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-openai-endpoint/)
AZURE_OPENAI_API_KEY=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-openai-api-key/)
AZURE_OPENAI_DEPLOYMENT=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-openai-deployment/)
```

**Important:**
- ⚠️ Azure Government uses `.usgovcloudapi.net` domain (not `.azure.net`)
- ⚠️ Managed identity must have "Get" + "List" permissions on Key Vault
- ⚠️ App Service automatically resolves these references at runtime

### Security Best Practices

**DO:**
- ✅ Use managed identity (no credentials to manage)
- ✅ Store ALL secrets in Key Vault (database passwords, API keys, OAuth secrets)
- ✅ Use Key Vault references in App Service configuration
- ✅ Enable soft delete and purge protection on Key Vault
- ✅ Rotate secrets regularly (90-day policy)
- ✅ Monitor secret access via Application Insights

**DON'T:**
- ❌ Store secrets in code or configuration files
- ❌ Use plaintext environment variables for sensitive data
- ❌ Commit secrets to Git repositories
- ❌ Share secrets via email or chat
- ❌ Use the same secrets across dev/test/prod environments

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
# Go to: https://portal.azure.us (Azure Government Portal)
# Top right → Click your profile → "Switch directory" → Find tenant ID
# Or run in Cloud Shell: az account show
```

---

### Step 2: Open Azure Cloud Shell (2 min)

**Option A: Browser**
1. Go to: **https://shell.azure.us** (Azure Government Cloud Shell)
2. Sign in with: `ChrisBECRAFT@ABC123987.onmicrosoft.com`
3. Choose: **Bash** (not PowerShell)
4. Wait for cloud shell to initialize (~30 seconds)

**Option B: Azure Portal**
1. Go to: **https://portal.azure.us** (Azure Government Portal)
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
App Service: https://tmm-app-navy-demo.azurewebsites.us
PostgreSQL: tmm-pg-navy-demo.postgres.database.usgovcloudapi.net
OpenAI Endpoint: https://tmm-openai-navy-demo.openai.azure.us
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
  --web-redirect-uris "https://tmm-app-navy-demo.azurewebsites.us/auth/callback" \
  --enable-id-token-issuance true

# Save the appId from output
APP_ID="<paste-app-id-here>"

# Add Microsoft Graph permissions (GCC High)
az ad app permission add \
  --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    b0afded3-3588-46d8-8b3d-9842eff778da=Scope \
    43431867-d0fb-4f55-aebb-5c2e3ae67fbc=Scope \
    9492366f-7969-46a4-8d15-ed1a20078fff=Role

# Application permissions:
# - b0afded3-3588-46d8-8b3d-9842eff778da = OnlineMeetings.Read.All (delegated)
# - 43431867-d0fb-4f55-aebb-5c2e3ae67fbc = User.Read (delegated)
# - 9492366f-7969-46a4-8d15-ed1a20078fff = Sites.ReadWrite.All (application)

# Grant admin consent (requires admin)
az ad app permission admin-consent --id $APP_ID

# Create client secret for app registration
APP_SECRET=$(az ad app credential reset \
  --id $APP_ID \
  --query password -o tsv)

echo "IMPORTANT: Save this client secret securely (shown only once): $APP_SECRET"
```

**7.2: Store Secrets in Key Vault**

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

# Get Azure OpenAI endpoint (Azure Government)
OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "properties.endpoint" -o tsv)

# Store Azure OpenAI credentials (Azure Government)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-openai-api-key \
  --value "$OPENAI_KEY"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-openai-endpoint \
  --value "$OPENAI_ENDPOINT"

# Note: Azure Government OpenAI endpoint format: https://{resource-name}.openai.azure.us/

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-openai-deployment \
  --value "gpt-4o"

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

# Store Azure AD app registration credentials
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-client-id \
  --value "$APP_ID"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-client-secret \
  --value "$APP_SECRET"

# Store Azure AD tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-tenant-id \
  --value "$TENANT_ID"

# Store Azure AD authority (GCC High)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-ad-authority \
  --value "https://login.microsoftonline.us/$TENANT_ID"

# Store Microsoft Graph endpoint and scope (GCC High)
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name graph-api-endpoint \
  --value "https://graph.microsoft.us"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name graph-api-scope \
  --value "https://graph.microsoft.us/.default"

# Store SharePoint site URL (GCC High)
# Note: Update this URL to match your SharePoint site created in Step 7.3
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name sharepoint-site-url \
  --value "https://ABC123987.sharepoint.us/sites/meeting-minutes"
```

**7.2: Grant App Service Access to Key Vault**

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

**7.3: Configure SharePoint Integration for GCC High**

SharePoint integration uses **Microsoft Graph API** with **client credentials authentication** (Azure AD app registration + client secret) - NOT Replit connectors or managed identity.

**Authentication Method:**
- ✅ **Client Credentials Flow**: App uses `azure-ad-client-id` + `azure-ad-client-secret` to authenticate to Microsoft Graph
- ✅ **Application Permissions**: Sites.ReadWrite.All permission already added in Step 7.1
- ❌ **NOT Managed Identity**: App Service managed identity is only for Key Vault access, not Graph API

**Create SharePoint Site (GCC High):**

1. **Create SharePoint site** for meeting minutes archival:
   ```bash
   # Navigate to SharePoint admin center (GCC High)
   # https://{tenant}-admin.sharepoint.us/_layouts/15/online/AdminHome.aspx
   
   # Create new site:
   # - Site name: "Meeting Minutes Archive"
   # - URL: https://{tenant}.sharepoint.us/sites/meeting-minutes
   # - Template: Team site
   ```

2. **Create document library**:
   ```bash
   # In your new site:
   # 1. Click "New" → "Document library"
   # 2. Name: "Approved Minutes"
   # 3. Click "Create"
   
   # Note the library name: "Approved Minutes"
   ```

3. **Verify Graph API permissions** (already completed in Step 7.1):
   ```bash
   # The Sites.ReadWrite.All permission was already added in Step 7.1
   # Verify it's granted:
   az ad app permission list --id $APP_ID
   ```

4. **Store SharePoint library name** in Key Vault:
   ```bash
   # SharePoint library name (site URL already stored in Step 7.2)
   az keyvault secret set \
     --vault-name $KEYVAULT_NAME \
     --name sharepoint-library \
     --value "Approved Minutes"
   
   # Note: SharePoint site URL and all GCC High secrets (graph-api-endpoint, graph-api-scope, 
   # azure-ad-authority) were already stored in Step 7.2.
   ```

5. **Verify SharePoint access**:
   ```bash
   # After app deployment, test Graph API access using client credentials
   # The application authenticates using azure-ad-client-id + azure-ad-client-secret
   # and accesses SharePoint via Microsoft Graph API
   ```

**Key Points:**
- ✅ Uses **Azure AD client credentials** (app registration + client secret) - NOT Replit connectors
- ✅ App Service **managed identity** used ONLY for Key Vault access
- ✅ Uses **Microsoft Graph API** for file upload (`https://graph.microsoft.us`)
- ✅ Uses **GCC High endpoints** (`.sharepoint.us`, not `.sharepoint.com`)
- ✅ Secrets stored in **Azure Key Vault** (IL4 compliant)
- ✅ No hardcoded credentials in code

**Required App Service Environment Variables:**

The application will automatically load these from Key Vault references (note: `.usgovcloudapi.net` domain for Azure Government):

```bash
# SharePoint configuration
SHAREPOINT_SITE_URL=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/sharepoint-site-url/)
SHAREPOINT_LIBRARY=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/sharepoint-library/)

# Microsoft Graph API configuration (GCC High)
MICROSOFT_GRAPH_ENDPOINT=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/graph-api-endpoint/)
MICROSOFT_GRAPH_SCOPE=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/graph-api-scope/)

# Azure AD configuration (GCC High)
AZURE_AD_CLIENT_ID=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-client-id/)
AZURE_AD_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-client-secret/)
AZURE_AD_TENANT_ID=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-tenant-id/)
AZURE_AD_AUTHORITY=@Microsoft.KeyVault(SecretUri=https://tmm-kv-navy-demo.vault.usgovcloudapi.net/secrets/azure-ad-authority/)
```

**Troubleshooting:**

**Problem: SharePoint upload fails with 401 Unauthorized**
- **Cause:** App registration doesn't have Sites.ReadWrite.All permission, or client secret is incorrect
- **Solution:** Verify permissions in Step 7.1, ensure client secret is correctly stored in Key Vault

**Problem: SharePoint upload fails with 404 Not Found**
- **Cause:** Site URL or library name incorrect
- **Solution:** Verify site URL and library name in SharePoint admin center (GCC High)

---

### Step 8: Build and Deploy Application (15 min)

**8.1: Build React Frontend**

The application uses **Vite** to build the React frontend. Build artifacts go to `dist/` directory.

```bash
# Navigate to project root (in Replit or local dev machine)
cd ~/navy-erp-demo  # Or your project directory

# Install dependencies (if not already done)
npm install

# Build React frontend for production
npm run build

# Verify build output
ls -lh dist/
# Should see: index.html, assets/ (JS bundles, CSS)
```

**Build Output:**
- `dist/index.html` - Frontend entry point
- `dist/assets/` - Minified JavaScript and CSS bundles
- All imports resolved and bundled by Vite

**8.2: Configure App Service Environment Variables**

Set all environment variables to use Key Vault references:

```bash
# Get App Service name
APP_SERVICE_NAME="tmm-app-navy-demo"
RESOURCE_GROUP="tmm-navy-demo-eastus"
KEYVAULT_NAME=$(az keyvault list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv)

# Set database configuration
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/database-url/)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/session-secret/)"

# Set Azure AD configuration (GCC High)
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-ad-client-id/)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-ad-client-secret/)" \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-ad-tenant-id/)" \
    AZURE_AD_AUTHORITY="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-ad-authority/)"

# Set Microsoft Graph API configuration (GCC High)
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    MICROSOFT_GRAPH_ENDPOINT="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/graph-api-endpoint/)" \
    MICROSOFT_GRAPH_SCOPE="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/graph-api-scope/)"

# Set SharePoint configuration (GCC High)
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    SHAREPOINT_SITE_URL="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/sharepoint-site-url/)" \
    SHAREPOINT_LIBRARY="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/sharepoint-library/)"

# Set Azure OpenAI configuration (Azure Government)
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-openai-endpoint/)" \
    AZURE_OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-openai-api-key/)" \
    AZURE_OPENAI_DEPLOYMENT="@Microsoft.KeyVault(SecretUri=https://$KEYVAULT_NAME.vault.usgovcloudapi.net/secrets/azure-openai-deployment/)"

# Set Node.js environment
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV="production" \
    PORT="8080"
```

**Verify environment variables:**
```bash
az webapp config appsettings list \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?contains(name, 'AZURE') || contains(name, 'DATABASE') || contains(name, 'GRAPH')].[name,value]" -o table

# Should see all Key Vault references (@Microsoft.KeyVault...)
```

**8.3: Create Deployment Package**

Package the application with all required files:

```bash
# Create deployment directory
mkdir -p deploy-package
cd deploy-package

# Copy built frontend
cp -r ../dist ./

# Copy backend server code
cp -r ../server ./

# Copy shared types/schemas
cp -r ../shared ./

# Copy package files
cp ../package.json ./
cp ../package-lock.json ./

# Create ZIP archive
zip -r ../tmm-navy-demo-deploy.zip .

# Go back to project root
cd ..

# Verify package contents
unzip -l tmm-navy-demo-deploy.zip
# Should see: dist/, server/, shared/, package.json, package-lock.json
```

**8.4: Deploy to Azure App Service**

```bash
# Deploy using ZIP deployment
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --src tmm-navy-demo-deploy.zip

# Monitor deployment logs
az webapp log tail \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP

# Wait for message: "Deployment successful"
```

**Deployment Process:**
1. ZIP file uploaded to App Service
2. App Service extracts files
3. Runs `npm install --production` (installs dependencies from package.json)
4. Starts Node.js server using `npm start`
5. Application available at `https://tmm-app-navy-demo.azurewebsites.us`

**8.5: Verify Deployment**

```bash
# Check application logs for startup errors
az webapp log show \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --limit 50

# Test health endpoint
curl https://tmm-app-navy-demo.azurewebsites.us/api/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "openai": "available",
#   "timestamp": "2025-11-21T..."
# }
```

**Troubleshooting:**

**Problem: Deployment fails with "npm install" error**
- **Cause:** Missing package.json or package-lock.json in ZIP
- **Solution:** Verify ZIP contains both files at root level

**Problem: App returns 503 Service Unavailable**
- **Cause:** Node.js process crashed during startup
- **Solution:** Check logs with `az webapp log tail`, look for uncaught exceptions

**Problem: Key Vault reference unresolved (shows @Microsoft.KeyVault... in logs)**
- **Cause:** App Service managed identity doesn't have Key Vault access
- **Solution:** Re-run Step 7.2 to grant Key Vault access policy

**Problem: Database connection fails**
- **Cause:** PostgreSQL firewall blocking App Service IP
- **Solution:** Verify App Service outbound IPs allowed in PostgreSQL firewall

---

### Step 9: Initialize Database with Migrations (10 min)

⚠️ **Database Safety Protocol**: Always back up before running migrations in production.

**9.1: Pre-Migration Safety Checks**

```bash
# Verify database connectivity
az postgres flexible-server show \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --query "{Name:name,State:state,Version:version}" -o table

# Expected: State should be "Ready"

# Create backup before first migration
az postgres flexible-server backup create \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --backup-name "pre-migration-$(date +%Y%m%d-%H%M%S)"

# Verify backup created
az postgres flexible-server backup list \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --query "[0].{Name:name,Status:status,Time:earliestRestoreDate}" -o table
```

**9.2: Run Database Migrations**

The application uses **Drizzle ORM** for schema management. Migrations are applied using `db:push`.

```bash
# Get database connection string from Key Vault
DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEYVAULT_NAME \
  --name database-url \
  --query value -o tsv)

# Export for local use
export DATABASE_URL="$DATABASE_URL"

# Run schema migration (Drizzle ORM)
npm run db:push

# Expected output:
# ✓ Applying migrations...
# ✓ Created table: meetings
# ✓ Created table: meeting_minutes
# ✓ Created table: action_items
# ✓ Created table: job_queue
# ✓ Created table: graph_webhook_subscriptions
# ✓ Created table: user_group_cache
# ✓ Created table: app_settings
# ✓ Created table: teams_conversation_references
# ✓ Created table: adaptive_card_outbox
```

**9.3: Verify Schema**

```bash
# List all tables
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<your-password>" \
  --database-name meeting_minutes \
  --querytext "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" \
  -o table

# Expected tables (9 total):
# - action_items
# - adaptive_card_outbox
# - app_settings
# - graph_webhook_subscriptions
# - job_queue
# - meeting_minutes
# - meetings
# - teams_conversation_references
# - user_group_cache

# Verify key columns for meetings table
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<your-password>" \
  --database-name meeting_minutes \
  --querytext "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='meetings' ORDER BY ordinal_position;" \
  -o table
```

**9.4: Initialize Default Data**

```bash
# Create default app settings (approval workflow enabled by default)
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<your-password>" \
  --database-name meeting_minutes \
  --querytext "
    INSERT INTO app_settings (id, require_approval, enable_email_distribution, enable_sharepoint_archival, enable_teams_card_notifications)
    VALUES (1, true, true, true, true)
    ON CONFLICT (id) DO NOTHING;
  "

# Verify settings created
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<your-password>" \
  --database-name meeting_minutes \
  --querytext "SELECT * FROM app_settings;" \
  -o table
```

**Migration Troubleshooting:**

**Problem: Migration fails with "relation already exists"**
- **Cause:** Database already has tables from previous deployment
- **Solution:** Either drop existing tables or skip with `npm run db:push --force`

**Problem: Migration fails with "permission denied"**
- **Cause:** Database user lacks CREATE TABLE permission
- **Solution:** Grant permissions:
  ```bash
  az postgres flexible-server execute \
    --name tmm-pg-navy-demo \
    --admin-user dbadmin \
    --admin-password "<password>" \
    --database-name meeting_minutes \
    --querytext "GRANT ALL PRIVILEGES ON DATABASE meeting_minutes TO dbadmin;"
  ```

**Problem: Cannot connect to database**
- **Cause:** Firewall blocking connection from current IP
- **Solution:** Add your IP to PostgreSQL firewall rules

**Important Notes:**
- ⚠️ **Never modify primary key types** (e.g., serial ↔ varchar) - causes data loss
- ⚠️ **Always backup before migrations** in production
- ⚠️ **Test migrations in dev environment** first
- ⚠️ **Monitor migration logs** for errors

---

### Step 10: Configure Microsoft Graph Webhooks (5 min)

The application uses **Microsoft Graph webhooks** to automatically capture Teams meetings. Webhooks have a 48-hour maximum lifespan and must be renewed periodically.

**10.1: Webhook Prerequisites**

```bash
# Verify app registration has required permissions (from Step 7.1)
az ad app permission list --id $APP_ID --query "[].{Resource:resourceDisplayName,Permission:value}" -o table

# Should see:
# - OnlineMeetings.Read.All
# - Calendars.Read
```

**10.2: Webhook Lifecycle**

The application automatically manages webhook subscriptions:

1. **Creation**: On first startup, app creates webhook subscription via Microsoft Graph API
2. **Validation**: Microsoft validates webhook endpoint (responds to validation token)
3. **Renewal**: Background job renews subscription every 12 hours (max 48-hour lifespan)
4. **Crash Recovery**: On restart, app re-creates subscriptions if missing

**Webhook Endpoint:**
```
https://tmm-app-navy-demo.azurewebsites.us/api/graph/notifications
```

**10.3: Verify Webhook Registration**

After application starts, check webhook status:

```bash
# Check application logs for webhook creation
az webapp log tail \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  | grep "webhook"

# Expected log entries:
# [INFO] Creating Microsoft Graph webhook subscription...
# [INFO] Webhook subscription created: <subscription-id>
# [INFO] Webhook will expire at: 2025-11-23T12:00:00Z
```

**Query webhook status via database:**
```bash
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT subscription_id, resource, expiration_datetime, created_at FROM graph_webhook_subscriptions ORDER BY created_at DESC LIMIT 5;" \
  -o table
```

**10.4: Manual Webhook Renewal (If Needed)**

If webhooks expire (app was down >48 hours):

```bash
# Restart app service to trigger webhook re-creation
az webapp restart \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP

# Monitor logs for webhook creation
az webapp log tail \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP
```

**Webhook Troubleshooting:**

**Problem: Webhook creation fails with 403 Forbidden**
- **Cause:** App registration lacks OnlineMeetings.Read.All permission
- **Solution:** Re-run Step 7.1 to grant Graph API permissions

**Problem: Webhook validation fails**
- **Cause:** App Service not accessible from Microsoft Graph service
- **Solution:** Verify App Service is running and accessible via public internet

**Problem: Meetings not captured automatically**
- **Cause:** Webhook subscription expired or deleted
- **Solution:** Restart app service to re-create subscription

**Important Notes:**
- ⚠️ **Webhooks expire after 48 hours maximum** (Microsoft Graph limit)
- ⚠️ **App must run continuously** to renew webhooks every 12 hours
- ⚠️ **If app stops >48 hours**, webhooks expire and must be recreated
- ⚠️ **One webhook per resource type** (onlineMeetings, calendar events)

---

### Step 11: Test Deployment (5 min)

**Health Check:**
```bash
# Test app is running
curl https://tmm-app-navy-demo.azurewebsites.us/api/health

# Expected response:
# {"status":"healthy","database":"connected","openai":"available"}
```

**Access Application:**
1. Open browser: `https://tmm-app-navy-demo.azurewebsites.us`
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

### Step 12: Configure Monitoring and Alerting (10 min)

**12.1: Enable Application Insights**

Application Insights is already created by Bicep deployment. Configure alerting rules:

```bash
# Get Application Insights resource ID
APPINSIGHTS_ID=$(az monitor app-insights component show \
  --app tmm-appinsights-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

echo "Application Insights ID: $APPINSIGHTS_ID"
```

**12.2: Create Alert Rules**

**Alert 1: High Error Rate**
```bash
az monitor metrics alert create \
  --name "High Error Rate - Navy Demo" \
  --resource-group $RESOURCE_GROUP \
  --scopes $APPINSIGHTS_ID \
  --condition "count exceptions/count > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --description "Alert when error rate exceeds 10 exceptions in 5 minutes"
```

**Alert 2: Database Connection Failures**
```bash
az monitor metrics alert create \
  --name "Database Connection Failed - Navy Demo" \
  --resource-group $RESOURCE_GROUP \
  --scopes $APPINSIGHTS_ID \
  --condition "count customEvents/count where name == 'DatabaseConnectionFailed' > 3" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 1 \
  --description "Critical alert for database connection failures"
```

**Alert 3: Webhook Subscription Expiring**
```bash
az monitor metrics alert create \
  --name "Webhook Expiring Soon - Navy Demo" \
  --resource-group $RESOURCE_GROUP \
  --scopes $APPINSIGHTS_ID \
  --condition "count customEvents/count where name == 'WebhookExpiringIn6Hours' > 0" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --severity 3 \
  --description "Warning when Microsoft Graph webhook will expire in 6 hours"
```

**12.3: Configure Log Analytics Queries**

Useful queries for monitoring:

```kusto
// Failed job queue items (last 24 hours)
customEvents
| where timestamp > ago(24h)
| where name == "JobFailed"
| summarize count() by jobType = tostring(customDimensions.jobType), error = tostring(customDimensions.error)
| order by count_ desc

// Meeting processing latency
customMetrics
| where timestamp > ago(1h)
| where name == "MeetingProcessingDuration"
| summarize avg(value), max(value), min(value) by bin(timestamp, 5m)

// Azure OpenAI API call failures
dependencies
| where timestamp > ago(24h)
| where target contains "openai.azure"
| where success == false
| summarize count() by resultCode
```

**12.4: Set Up Email Notifications**

```bash
# Create action group for email alerts
az monitor action-group create \
  --name "NavyDemo-Admins" \
  --resource-group $RESOURCE_GROUP \
  --short-name "NavyAdmins" \
  --email-receiver name="Admin1" email="ChrisBECRAFT@ABC123987.onmicrosoft.com" \
  --email-receiver name="Admin2" email="admin2@ABC123987.onmicrosoft.com"

# Link action group to alerts
az monitor metrics alert update \
  --name "High Error Rate - Navy Demo" \
  --resource-group $RESOURCE_GROUP \
  --add-action /subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/actionGroups/NavyDemo-Admins
```

**12.5: Dashboard for Monitoring**

Create custom dashboard in Azure Portal:

1. Navigate to: **Azure Portal** → **Dashboard** → **New dashboard**
2. Add tiles:
   - **App Service Metrics**: CPU, Memory, Response Time
   - **Application Insights**: Request rate, Failed requests, Exceptions
   - **PostgreSQL Metrics**: Connection count, Storage used, CPU%
   - **Azure OpenAI**: Token usage, API calls, Latency
3. Pin dashboard for daily monitoring

**Monitoring Checklist:**
- [ ] Application Insights enabled and receiving telemetry
- [ ] Alert rules created for critical failures
- [ ] Email notifications configured
- [ ] Dashboard created for daily monitoring
- [ ] Log Analytics queries saved

---

### Step 13: Configure Backup and Recovery (10 min)

⚠️ **Critical**: Backups are mandatory for IL4 compliance. 35-day retention required.

**13.1: PostgreSQL Automated Backups**

```bash
# Verify backup configuration
az postgres flexible-server show \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --query "{BackupRetentionDays:backup.backupRetentionDays,GeoRedundant:backup.geoRedundantBackup}" -o table

# Expected output:
# BackupRetentionDays    GeoRedundant
# 35                     Enabled

# List recent backups
az postgres flexible-server backup list \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --query "[].{Name:name,Status:status,Time:earliestRestoreDate}" -o table
```

**13.2: Manual Backup Before Major Changes**

```bash
# Create manual backup before deployments/migrations
BACKUP_NAME="manual-backup-$(date +%Y%m%d-%H%M%S)"

az postgres flexible-server backup create \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --backup-name "$BACKUP_NAME"

echo "Backup created: $BACKUP_NAME"
```

**13.3: Test Backup Restoration (Quarterly)**

**Restore to Test Server:**
```bash
# Create test server from backup
az postgres flexible-server restore \
  --name tmm-pg-navy-demo-restore-test \
  --resource-group $RESOURCE_GROUP \
  --source-server tmm-pg-navy-demo \
  --restore-time "2025-11-20T12:00:00Z"

# Verify restored database
az postgres flexible-server execute \
  --name tmm-pg-navy-demo-restore-test \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT COUNT(*) FROM meetings;"

# Delete test server after verification
az postgres flexible-server delete \
  --name tmm-pg-navy-demo-restore-test \
  --resource-group $RESOURCE_GROUP \
  --yes
```

**13.4: Application Configuration Backup**

```bash
# Export all Key Vault secrets (for disaster recovery documentation)
az keyvault secret list \
  --vault-name $KEYVAULT_NAME \
  --query "[].{Name:name}" -o table > keyvault-secrets-list.txt

# Export App Service configuration
az webapp config appsettings list \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  -o json > app-service-config-backup.json

# Store in secure location (NOT in Git repository)
```

**13.5: Disaster Recovery Procedures**

**Scenario 1: Database Corruption**
```bash
# Restore database to point-in-time before corruption
az postgres flexible-server restore \
  --name tmm-pg-navy-demo \
  --resource-group $RESOURCE_GROUP \
  --restore-time "<timestamp-before-corruption>"
```

**Scenario 2: Accidental Data Deletion**
```bash
# Restore specific tables from backup (requires pg_restore)
# 1. Create backup export
# 2. Restore to temporary server
# 3. Extract specific tables
# 4. Import to production
```

**Scenario 3: Region Outage**
```bash
# Geo-redundant backups allow restore to different region
az postgres flexible-server restore \
  --name tmm-pg-navy-demo-dr \
  --resource-group tmm-navy-demo-westus \
  --location westus \
  --source-server tmm-pg-navy-demo \
  --restore-time "<last-known-good-time>"
```

**Backup Testing Schedule:**
- **Weekly**: Verify automated backups are running
- **Monthly**: Test restore to dev environment
- **Quarterly**: Full DR drill with restore to secondary region

**Recovery Time Objectives (RTO):**
- **Database Restore**: 15-30 minutes
- **Application Redeployment**: 10-15 minutes  
- **Full System Recovery**: 1 hour maximum

**Recovery Point Objectives (RPO):**
- **Database**: 5 minutes (continuous backup)
- **Application Config**: Last deployment (stored in Key Vault)

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
