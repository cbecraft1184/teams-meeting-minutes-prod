# Microsoft Azure Government PILOT Implementation Plan
## DOD Teams Meeting Minutes Management System - Pilot Phase

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Classification:** UNCLASSIFIED

---

## 🚀 **SCALING GUARANTEE**

This pilot is designed for **seamless scaling to production**:
- ✅ **Same codebase** - No code changes required
- ✅ **One command** - Scale infrastructure with single script
- ✅ **Zero data loss** - All pilot data migrates automatically  
- ✅ **1-day upgrade** - Pilot to production in 24 hours
- ✅ **Easy rollback** - Return to pilot config if needed

**See:** `PILOT_TO_PRODUCTION_SCALING.md` for complete scaling guide

---

## Table of Contents
1. [Pilot Overview](#pilot-overview)
2. [Scaling Strategy](#scaling-strategy)
3. [Pilot vs Production Comparison](#pilot-vs-production-comparison)
4. [Pilot Architecture](#pilot-architecture)
5. [Required Azure Services (Pilot)](#required-azure-services-pilot)
6. [Prerequisites & Access Requirements](#prerequisites--access-requirements)
7. [Phase 1: Rapid Azure Setup](#phase-1-rapid-azure-setup)
8. [Phase 2: Microsoft Integration](#phase-2-microsoft-integration)
9. [Phase 3: Azure OpenAI Pilot](#phase-3-azure-openai-pilot)
10. [Phase 4: Quick Deployment](#phase-4-quick-deployment)
11. [Phase 5: Pilot Testing](#phase-5-pilot-testing)
12. [Pilot Manifest](#pilot-manifest)
13. [Success Criteria & Metrics](#success-criteria--metrics)
14. [Transition to Production](#transition-to-production)

---

## Pilot Overview

### Purpose
Validate the DOD Teams Meeting Minutes Management System with a limited user group before full-scale deployment, proving:
- Technical feasibility in Azure Government Cloud
- Microsoft Graph API integration reliability
- Azure OpenAI quality for meeting minutes
- User acceptance and workflow fit
- Security and compliance baseline

### Pilot Scope
```yaml
Duration: 60 days (2 months)
User Base: 50-100 pilot users
Meetings: ~500-1,000 meetings total
Geographic Scope: Single command/site
Environment: Azure Government (GCC High)
Budget: $1,500-2,500/month
Timeline: 2-4 weeks to deploy
```

### Pilot Objectives
1. ✅ **Technical Validation**
   - Prove Azure Government (GCC High) integration works
   - Validate Microsoft Graph API webhooks
   - Test Azure OpenAI quality for minutes generation
   - Confirm SharePoint archival automation

2. ✅ **User Acceptance**
   - Train 50-100 pilot users
   - Collect usability feedback
   - Validate approval workflow
   - Measure time savings

3. ✅ **Security Validation**
   - Test clearance-based access control
   - Validate classification handling
   - Prove audit trail completeness
   - Security scan and remediation

4. ✅ **Performance Baseline**
   - Measure response times
   - Monitor AI processing duration
   - Test concurrent user load
   - Validate email distribution speed

5. ✅ **Cost Validation**
   - Measure actual Azure OpenAI costs
   - Calculate per-meeting cost
   - Project full-scale costs
   - Optimize resource sizing

---

## Scaling Strategy

### Built for Seamless Production Migration

This pilot uses **production-ready architecture** at pilot scale. Scaling to production requires **zero code changes** - only infrastructure upgrades.

### What Makes This Pilot Production-Ready?

```yaml
Infrastructure Design:
  ✅ Same resource types as production (App Service, PostgreSQL, OpenAI)
  ✅ Same database schema (no migration needed)
  ✅ Same application code (environment-driven config)
  ✅ Same authentication (Azure AD with same permissions)
  ✅ Same integrations (Graph API, SharePoint identical)

Scaling Approach:
  ✅ In-place upgrade (scale existing resources)
  ✅ Configuration-driven (change env vars only)
  ✅ One-command scaling (automated script provided)
  ✅ Data preserved (all pilot data migrates automatically)
  ✅ Rollback support (emergency downgrade script)
```

### Scaling Timeline

```
Pilot Complete → Run Scale Script → Production Ready
    (60 days)         (1 day)          (Live!)
    
Total: 61 days from pilot start to 300,000 concurrent users
```

### Scaling Resources Provided

1. **`scripts/scale-to-production.sh`** - One-command upgrade script
2. **`scripts/rollback-to-pilot.sh`** - Emergency rollback script  
3. **`scripts/validate-production.sh`** - Post-upgrade validation
4. **`PILOT_TO_PRODUCTION_SCALING.md`** - Complete scaling guide

### Cost-Efficient Scaling Path

| Phase | Users | Monthly Cost | Timeline |
|-------|-------|--------------|----------|
| Pilot | 100 | $1,500-2,500 | 60 days |
| Scale | Same resources | $0 (1-day event) | 1 day |
| Production | 300,000 | $5,000-7,000 | Ongoing |

**No wasted investment** - Every dollar spent on pilot infrastructure transitions to production.

---

## Pilot vs Production Comparison

| Aspect | Pilot | Production |
|--------|-------|------------|
| **Users** | 50-100 | 300,000 |
| **Duration** | 60 days | Ongoing |
| **Meetings/Month** | 500-1,000 | 100,000 |
| **Availability** | 95% (43.8 hrs/year) | 99.9% (8.76 hrs/year) |
| **App Service** | B3 (1 instance) | P3v3 (2-20 instances) |
| **Database** | Burstable B2s (2 vCores) | GP D4s (4 vCores, HA) |
| **Auto-scaling** | No | Yes |
| **High Availability** | No | Yes (zone-redundant) |
| **Geo-replication** | No | Yes |
| **Load Balancer** | Basic | Application Gateway (WAF) |
| **Cost/Month** | $1,500-2,500 | $5,000-7,000 |
| **Deployment Time** | 2-4 weeks | 8-12 weeks |
| **Compliance Depth** | Basic | Full FedRAMP High |

---

## Pilot Architecture

### High-Level Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│              Azure Government Cloud (GCC High)               │
│                                                               │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  Microsoft 365   │◄────────│   Azure AD (Gov)       │   │
│  │  GCC High        │         │   - SSO/Auth           │   │
│  │  - Teams         │         │   - Pilot User Groups  │   │
│  │  - SharePoint    │         └────────────────────────┘   │
│  └──────────────────┘                                        │
│         │                                                     │
│         │ Graph API                                          │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Azure App Service (B3 - Single Instance)      │  │
│  │        - Node.js Application                          │  │
│  │        - HTTPS Only (TLS 1.2)                         │  │
│  │        - Managed Identity                             │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                    │                               │
│         │                    │                               │
│         ▼                    ▼                               │
│  ┌──────────────┐    ┌──────────────────────────────┐     │
│  │ Azure OpenAI │    │   PostgreSQL Flexible Server │     │
│  │ (Gov Cloud)  │    │   - Burstable B2s (2 vCores) │     │
│  │ - GPT-4      │    │   - 32 GB Storage            │     │
│  │ - 10k TPM    │    │   - 7-day backups            │     │
│  └──────────────┘    └──────────────────────────────┘     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Azure Key Vault (Standard)              │  │
│  │              - API Keys & Secrets                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Application Insights (Basic Tier)           │  │
│  │          - Basic monitoring and logging              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Network Architecture (Simplified)

```
┌────────────────────────────────────────────────────┐
│           Azure VNET (Pilot) - 10.1.0.0/16         │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Default Subnet (10.1.0.0/24)                │ │
│  │  - App Service VNET Integration              │ │
│  │  - PostgreSQL Private Endpoint               │ │
│  │  - Key Vault Private Endpoint                │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
└────────────────────────────────────────────────────┘

Note: Simplified network for pilot - no separate subnets
Production will use multi-subnet architecture
```

---

## Required Azure Services (Pilot)

### Core Services (Cost-Optimized)

| Service | SKU/Tier | Purpose | Monthly Cost |
|---------|----------|---------|--------------|
| **Azure App Service** | B3 (1 instance) | Application hosting | $109 |
| **PostgreSQL Flexible Server** | Burstable B2s | Database | $48 |
| **Azure OpenAI Service** | Standard (10k TPM) | AI processing | $500-1,000 |
| **Azure Key Vault** | Standard | Secrets | $3 |
| **Application Insights** | Basic | Monitoring | $50 |
| **Azure Storage** | LRS | Backups | $10 |
| **Azure Load Balancer** | Basic | Optional | $18 |
| **TOTAL** | | | **$738-1,238** |

**Note:** OpenAI costs are usage-based and will vary. Budget assumes ~500 meetings with 50k tokens each.

### Identity & Access

| Service | Configuration |
|---------|--------------|
| **Azure AD (Gov)** | Existing - no additional cost |
| **Microsoft 365 GCC High** | Pilot users use existing licenses |
| **Managed Identity** | System-assigned (free) |

---

## Prerequisites & Access Requirements

### Required Accounts (Same as Production)

1. **Azure Government Subscription**
   - Portal: https://portal.azure.us
   - Contributor or Owner role
   - Budget approval: $2,500/month for 2 months

2. **Microsoft 365 GCC High Tenant**
   - Existing DOD tenant
   - Global Admin access (for app registration)
   - 50-100 pilot user licenses

3. **Azure OpenAI Access**
   - Request access if not already approved
   - Specify: Pilot project, 10k TPM limit

### Pilot-Specific Requirements

4. **Pilot User Group**
   - Create Azure AD group: "Teams-Minutes-Pilot-Users"
   - Add 50-100 volunteer users
   - Ensure mix of clearance levels for testing

5. **Pilot Command Selection**
   - Single command or directorate
   - Executive sponsor identified
   - 2-3 "champion" users for feedback

### Approvals (Lightweight for Pilot)

- [ ] Pilot budget approved ($5,000 total for 2 months)
- [ ] ISSO informed and pilot security plan reviewed
- [ ] Pilot users selected and notified
- [ ] Executive sponsor committed

---

## Phase 1: Rapid Azure Setup

### Step 1.1: Create Pilot Resource Group

```bash
# Login to Azure Government
az cloud set --name AzureUSGovernment
az login

# Create Resource Group
az group create \
  --name rg-teams-minutes-pilot \
  --location usgovvirginia \
  --tags Environment=Pilot Classification=UNCLASSIFIED System=TeamsMeetingMinutes Phase=Pilot
```

### Step 1.2: Create Simplified VNET

```bash
# Create VNET (single subnet for simplicity)
az network vnet create \
  --resource-group rg-teams-minutes-pilot \
  --name vnet-teams-pilot \
  --address-prefix 10.1.0.0/16 \
  --subnet-name subnet-default \
  --subnet-prefix 10.1.0.0/24 \
  --location usgovvirginia
```

### Step 1.3: Deploy PostgreSQL (Burstable Tier)

```bash
# Create PostgreSQL Flexible Server (Cost-optimized)
az postgres flexible-server create \
  --resource-group rg-teams-minutes-pilot \
  --name psql-teams-pilot \
  --location usgovvirginia \
  --admin-user pgadmin \
  --admin-password '<SECURE_PASSWORD>' \
  --sku-name Standard_B2s \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --backup-retention 7 \
  --public-access 0.0.0.0-255.255.255.255

# Create Database
az postgres flexible-server db create \
  --resource-group rg-teams-minutes-pilot \
  --server-name psql-teams-pilot \
  --database-name teams_minutes

# Note: Public access enabled for pilot simplicity
# Production uses private endpoints only
```

### Step 1.4: Setup Key Vault

```bash
# Create Key Vault
az keyvault create \
  --resource-group rg-teams-minutes-pilot \
  --name kv-teams-pilot \
  --location usgovvirginia \
  --sku standard \
  --enable-soft-delete true \
  --retention-days 7

# Store Database URL
DB_URL="postgresql://pgadmin:<PASSWORD>@psql-teams-pilot.postgres.database.usgovcloudapi.net:5432/teams_minutes?sslmode=require"

az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name DATABASE-URL \
  --value "$DB_URL"
```

---

## Phase 2: Microsoft Integration

### Step 2.1: Register Azure AD Application (Same as Production)

**Portal:** https://portal.azure.us → Azure Active Directory → App registrations

1. **Create Registration**
   - Name: `Teams-Minutes-Pilot`
   - Redirect URI: `https://app-teams-pilot.azurewebsites.us/auth/callback`

2. **API Permissions** (Same as production)

| Permission | Type | Purpose |
|------------|------|---------|
| `OnlineMeetings.Read.All` | Application | Meeting metadata |
| `OnlineMeetingRecording.Read.All` | Application | Recordings |
| `OnlineMeetingTranscript.Read.All` | Application | Transcripts |
| `User.Read.All` | Application | User info |
| `Mail.Send` | Application | Email distribution |
| `Sites.ReadWrite.All` | Application | SharePoint |
| `Group.Read.All` | Application | Azure AD groups |

3. **Create Client Secret & Store**

```bash
# Via Portal: Create secret, then store in Key Vault
az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name AZURE-AD-CLIENT-ID \
  --value '<CLIENT_ID>'

az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name AZURE-AD-CLIENT-SECRET \
  --value '<CLIENT_SECRET>'

az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name AZURE-AD-TENANT-ID \
  --value '<TENANT_ID>'
```

### Step 2.2: Configure SharePoint for Pilot

**Option A: Reuse Existing Site (Faster)**
- Use existing SharePoint team site
- Add "Pilot Minutes" folder
- Configure permissions for pilot users only

**Option B: Create Dedicated Pilot Site**

```powershell
# Connect to SharePoint Online (GCC High)
Connect-SPOService -Url https://dod-admin.sharepoint.us

# Create pilot site
New-SPOSite `
  -Url https://dod.sharepoint.us/sites/TeamsMeetingMinutesPilot `
  -Owner pilot-admin@dod.mil `
  -StorageQuota 10240 `
  -Title "Meeting Minutes Pilot" `
  -Template "STS#3"
```

### Step 2.3: Create Pilot User Groups

```bash
# Via Azure Portal: Azure AD → Groups

# Create groups:
1. "Teams-Minutes-Pilot-Users" (all pilot participants)
2. "Teams-Minutes-Pilot-Approvers" (5-10 people)
3. "Teams-Minutes-Pilot-Admins" (2-3 people)
```

---

## Phase 3: Azure OpenAI Pilot

### Step 3.1: Request Pilot Access (if needed)

If you don't have Azure OpenAI access yet:

```yaml
Access Request:
  Organization: DOD [Your Command]
  Use Case: 60-day pilot - automated meeting minutes
  Expected Volume: 500-1,000 meetings
  Token Limit: 10,000 TPM
  Classification: UNCLASSIFIED pilot data only
```

### Step 3.2: Deploy Azure OpenAI (Pilot Config)

```bash
# Create Azure OpenAI resource
az cognitiveservices account create \
  --name openai-teams-pilot \
  --resource-group rg-teams-minutes-pilot \
  --location usgovvirginia \
  --kind OpenAI \
  --sku S0 \
  --custom-domain openai-teams-pilot

# Get credentials
OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name openai-teams-pilot \
  --resource-group rg-teams-minutes-pilot \
  --query properties.endpoint -o tsv)

OPENAI_KEY=$(az cognitiveservices account keys list \
  --name openai-teams-pilot \
  --resource-group rg-teams-minutes-pilot \
  --query key1 -o tsv)

# Store in Key Vault
az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name AZURE-OPENAI-ENDPOINT \
  --value $OPENAI_ENDPOINT

az keyvault secret set \
  --vault-name kv-teams-pilot \
  --name AZURE-OPENAI-KEY \
  --value $OPENAI_KEY
```

### Step 3.3: Deploy GPT-4 Model (Conservative Quota)

```bash
# Deploy GPT-4 with lower capacity for pilot
az cognitiveservices account deployment create \
  --resource-group rg-teams-minutes-pilot \
  --name openai-teams-pilot \
  --deployment-name gpt-4 \
  --model-name gpt-4 \
  --model-version "0613" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard

# This gives you ~10,000 TPM - sufficient for pilot
# Can process ~20 meetings/hour
```

---

## Phase 4: Quick Deployment

### Step 4.1: Deploy from Replit (Fastest Method)

**If you already have working code in Replit:**

```bash
# Option A: Deploy directly from Replit
# 1. In Replit, click "Deploy" button
# 2. Select "Azure App Service"
# 3. Login with Azure Gov credentials
# 4. Select rg-teams-minutes-pilot
# 5. Deploy

# Option B: Build Docker image locally
docker build -f Dockerfile.production -t teams-minutes-pilot:latest .

# Create Azure Container Registry (optional)
az acr create \
  --resource-group rg-teams-minutes-pilot \
  --name acrteamspilot \
  --sku Basic \
  --location usgovvirginia

az acr login --name acrteamspilot

# Tag and push
docker tag teams-minutes-pilot:latest acrteamspilot.azurecr.us/teams-minutes:pilot
docker push acrteamspilot.azurecr.us/teams-minutes:pilot
```

### Step 4.2: Create App Service (B3 Tier)

```bash
# Create App Service Plan (cost-optimized)
az appservice plan create \
  --resource-group rg-teams-minutes-pilot \
  --name plan-teams-pilot \
  --location usgovvirginia \
  --is-linux \
  --sku B3

# Create Web App
az webapp create \
  --resource-group rg-teams-minutes-pilot \
  --plan plan-teams-pilot \
  --name app-teams-pilot \
  --deployment-container-image-name acrteamspilot.azurecr.us/teams-minutes:pilot

# Enable Managed Identity
az webapp identity assign \
  --resource-group rg-teams-minutes-pilot \
  --name app-teams-pilot

# Get Principal ID for Key Vault access
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group rg-teams-minutes-pilot \
  --name app-teams-pilot \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name kv-teams-pilot \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Step 4.3: Configure App Settings

```bash
# Set environment variables (referencing Key Vault)
az webapp config appsettings set \
  --resource-group rg-teams-minutes-pilot \
  --name app-teams-pilot \
  --settings \
    NODE_ENV=production \
    PORT=5000 \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/DATABASE-URL/)" \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/AZURE-AD-CLIENT-ID/)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/AZURE-AD-CLIENT-SECRET/)" \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/AZURE-AD-TENANT-ID/)" \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/AZURE-OPENAI-ENDPOINT/)" \
    AZURE_OPENAI_KEY="@Microsoft.KeyVault(SecretUri=https://kv-teams-pilot.vault.usgovcloudapi.net/secrets/AZURE-OPENAI-KEY/)" \
    SHAREPOINT_SITE_URL="https://dod.sharepoint.us/sites/TeamsMeetingMinutesPilot" \
    PILOT_MODE=true \
    PILOT_USER_GROUP="Teams-Minutes-Pilot-Users"
```

### Step 4.4: Enable HTTPS and Custom Domain

```bash
# Enable HTTPS only
az webapp update \
  --resource-group rg-teams-minutes-pilot \
  --name app-teams-pilot \
  --https-only true

# Add custom domain (optional for pilot)
# Default URL: https://app-teams-pilot.azurewebsites.us
# For pilot, default URL is usually sufficient
```

### Step 4.5: Setup Monitoring

```bash
# Create Application Insights
az monitor app-insights component create \
  --resource-group rg-teams-minutes-pilot \
  --app app-insights-pilot \
  --location usgovvirginia \
  --kind web \
  --application-type web

# Get connection string
APPINSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --resource-group rg-teams-minutes-pilot \
  --app app-insights-pilot \
  --query connectionString -o tsv)

# Link to Web App
az webapp config appsettings set \
  --resource-group rg-teams-minutes-pilot \
  --name app-teams-pilot \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CONNECTION"
```

---

## Phase 5: Pilot Testing

### Step 5.1: Initial Smoke Test

**Day 1: Basic Functionality**

```bash
# Test health endpoint
curl https://app-teams-pilot.azurewebsites.us/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "openai": "available"
}
```

**Test Checklist:**
- [ ] Application loads
- [ ] Database connection works
- [ ] Azure AD authentication works
- [ ] Can view meetings list
- [ ] Can manually trigger test minute generation

### Step 5.2: Week 1 - Core Workflow Testing

**Participants:** 5-10 pilot users + 2-3 approvers

**Test Scenarios:**
1. **Meeting Capture**
   - Schedule Teams meeting with pilot users
   - Verify webhook receives notification
   - Check meeting appears in dashboard

2. **AI Generation**
   - Trigger AI processing manually
   - Review generated minutes quality
   - Check action items extraction

3. **Approval Workflow**
   - Approver reviews minutes
   - Test approve action
   - Test reject with feedback

4. **Email Distribution**
   - Verify all attendees receive email
   - Check DOCX/PDF attachments
   - Confirm classification markings

5. **SharePoint Archival**
   - Verify document appears in SharePoint
   - Check metadata is correct
   - Confirm permissions work

### Step 5.3: Week 2-3 - Expanded Testing

**Participants:** Full 50-100 pilot users

**Focus Areas:**
- **Volume Testing:** 50-100 meetings/week
- **Concurrent Access:** 20+ users at once
- **Performance:** Response times under load
- **Edge Cases:** Large meetings, no transcript, external attendees

**Metrics to Collect:**
```yaml
Technical Metrics:
  - Minutes generation time: Target < 2 minutes
  - API response time: Target < 500ms
  - Email delivery time: Target < 1 minute
  - Error rate: Target < 1%

User Metrics:
  - Time saved per meeting: Survey users
  - Minutes quality rating: 1-5 scale
  - Approval workflow efficiency
  - User satisfaction: NPS score
```

### Step 5.4: Week 4-6 - Refinement

**Activities:**
- Address bug reports
- Tune AI prompts based on feedback
- Optimize performance
- Security scanning
- Documentation updates

### Step 5.5: Week 7-8 - Final Validation

**Final Acceptance Tests:**
- [ ] All pilot users trained
- [ ] 500+ meetings processed successfully
- [ ] <1% error rate achieved
- [ ] User satisfaction >80%
- [ ] Security scan passed
- [ ] Performance targets met
- [ ] Cost per meeting validated

---

## Pilot Manifest

### Azure Resources (Pilot Configuration)

```yaml
# Resource Group
resource_group:
  name: rg-teams-minutes-pilot
  location: usgovvirginia
  tags:
    Environment: Pilot
    Phase: Testing
    Duration: 60 days

# Networking (Simplified)
networking:
  vnet:
    name: vnet-teams-pilot
    address_space: 10.1.0.0/16
    subnets:
      - name: subnet-default
        cidr: 10.1.0.0/24

# Compute (Cost-Optimized)
compute:
  app_service_plan:
    name: plan-teams-pilot
    sku: B3
    instances: 1
    
  web_app:
    name: app-teams-pilot
    runtime: node:20
    url: https://app-teams-pilot.azurewebsites.us
    https_only: true
    
  container_registry:
    name: acrteamspilot
    sku: Basic

# Database (Burstable Tier)
database:
  postgresql:
    name: psql-teams-pilot
    version: 14
    sku: Standard_B2s
    tier: Burstable
    vcores: 2
    storage: 32GB
    backup_retention: 7 days
    high_availability: false

# AI Services (Limited Quota)
ai:
  openai:
    name: openai-teams-pilot
    sku: S0
    models:
      - gpt-4:
          version: "0613"
          capacity: 10
          tpm: 10000

# Security
security:
  key_vault:
    name: kv-teams-pilot
    sku: Standard
    soft_delete_retention: 7 days
    
  managed_identity:
    type: System-assigned

# Monitoring
monitoring:
  application_insights:
    name: app-insights-pilot
    sampling_percentage: 100
    retention: 30 days
```

### Application Configuration (Pilot-Specific)

```yaml
# Pilot Feature Flags
pilot_config:
  pilot_mode: true
  pilot_duration_days: 60
  pilot_user_group: "Teams-Minutes-Pilot-Users"
  max_pilot_meetings: 1000
  
  # Pilot-specific features
  features:
    detailed_logging: true
    user_feedback_prompts: true
    manual_trigger_allowed: true
    skip_auto_webhooks: false
    
  # Pilot notifications
  notifications:
    daily_summary_to_admins: true
    weekly_report_to_sponsor: true
    alert_on_errors: true

# Resource Limits (Pilot)
limits:
  max_concurrent_ai_requests: 5
  max_meeting_size_mb: 500
  max_attendees_per_meeting: 100
  ai_timeout_seconds: 120
```

### Pilot User Groups

```yaml
azure_ad_groups:
  pilot_users:
    name: "Teams-Minutes-Pilot-Users"
    description: "All pilot participants"
    members: 50-100 users
    
  pilot_approvers:
    name: "Teams-Minutes-Pilot-Approvers"
    description: "Users who can approve minutes"
    members: 5-10 users
    
  pilot_admins:
    name: "Teams-Minutes-Pilot-Admins"
    description: "Pilot administrators"
    members: 2-3 users
```

### Code Modifications for Pilot

**File:** `server/middleware/pilotMode.ts`

```typescript
// New file for pilot-specific logic
export function isPilotUser(userEmail: string): boolean {
  // Check if user is in pilot group
  return checkAzureADGroup(userEmail, 'Teams-Minutes-Pilot-Users');
}

export function enforcePilotLimits(req, res, next) {
  // Limit to 1000 meetings during pilot
  const meetingCount = await db.getMeetingCount();
  if (meetingCount >= 1000) {
    return res.status(429).json({ 
      error: 'Pilot meeting limit reached' 
    });
  }
  next();
}
```

**File:** `server/routes.ts`

```typescript
// Add pilot middleware
import { isPilotUser, enforcePilotLimits } from './middleware/pilotMode';

// Apply to routes
app.use('/api/meetings', enforcePilotLimits);
app.use('/api/meetings', requirePilotUser);
```

---

## Success Criteria & Metrics

### Technical Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | >95% | Application Insights |
| **Minutes Generation Time** | <2 minutes | Custom telemetry |
| **API Response Time (p95)** | <500ms | Application Insights |
| **Error Rate** | <1% | Application Insights |
| **Email Delivery Rate** | >99% | Graph API logs |
| **SharePoint Success Rate** | >99% | Custom logs |

### User Acceptance Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **User Satisfaction (NPS)** | >50 | Survey |
| **Minutes Quality Rating** | >4.0/5.0 | Survey |
| **Time Savings** | >30 min/meeting | Survey |
| **Training Completion** | 100% | Training logs |
| **Active Usage Rate** | >80% of pilot users | Analytics |
| **Feature Adoption** | >70% use approval workflow | Analytics |

### Business Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Cost per Meeting** | <$2.00 | Azure billing |
| **Projected ROI** | >200% | Financial analysis |
| **Meeting Coverage** | >80% of pilot meetings | Analytics |
| **Approval Cycle Time** | <24 hours | Database queries |
| **Action Item Completion** | >60% | Database queries |

### Security Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Security Scan Results** | 0 high/critical | Azure Defender |
| **Access Control Violations** | 0 | Audit logs |
| **Classification Errors** | 0 | Manual review |
| **Unauthorized Access Attempts** | 0 | Azure AD logs |

---

## Transition to Production

### Decision Points

**Go/No-Go Decision Criteria (End of Pilot)**

✅ **GO if:**
- All technical success criteria met
- User satisfaction >70%
- Cost per meeting <$3
- Zero critical security issues
- Executive sponsor approval

🛑 **NO-GO if:**
- Error rate >5%
- User satisfaction <50%
- Major security vulnerabilities
- Cost per meeting >$5
- Lack of user adoption

### Seamless Scaling Path (if GO)

**The pilot infrastructure BECOMES your production infrastructure - just scaled up.**

#### Option 1: One-Command In-Place Upgrade (Recommended)

**Timeline: 1 day**

```bash
# Step 1: Run the scaling script
./scripts/scale-to-production.sh

# That's it! Your pilot is now production-ready.
```

**What the script does automatically:**
1. ✅ Scales App Service: B3 → P3v3 with auto-scaling (2-20 instances)
2. ✅ Scales Database: B2s → D4s with HA (zone-redundant)
3. ✅ Scales OpenAI: 10k TPM → 100k TPM
4. ✅ Updates monitoring: 30-day → 90-day retention
5. ✅ Updates backups: 7-day → 30-day retention
6. ✅ Updates environment: PILOT_MODE=false
7. ✅ Restarts application with production config

**Benefits:**
- Zero data loss (all pilot data preserved)
- Zero code changes required
- Zero downtime (brief restart only)
- All pilot learnings captured in production

**Post-Upgrade:**
```bash
# Validate production deployment
./scripts/validate-production.sh

# Add production features (WAF, custom domain, etc.)
# See AZURE_GOV_IMPLEMENTATION_PLAN.md for full production setup
```

#### Option 2: Parallel Deployment (Zero Downtime)

**Timeline: 1-2 weeks**

**Week 1: Deploy New Production**
1. Create new resource group: `rg-teams-minutes-prod`
2. Deploy fresh production infrastructure
3. Run pilot and production in parallel
4. Validate production with test users

**Week 2: Gradual Migration**
1. Migrate 1,000 users to production
2. Monitor for 2-3 days
3. Migrate remaining users
4. Decommission pilot after 1 week

**Benefits:**
- True zero downtime
- Easy rollback (keep pilot running)
- Fresh production environment

#### Option 3: Fresh Production Start

**Timeline: 2-3 weeks**

Follow full production deployment plan:
- See `AZURE_GOV_IMPLEMENTATION_PLAN.md`
- Export pilot data for analysis (optional)
- Start production with clean slate

### Rollout Strategy After Scaling

**Week 1: Initial 500 Users**
- Expand from pilot users (100) to 500 users
- Monitor performance and errors
- Validate auto-scaling kicks in

**Week 2-4: Expand to 5,000 Users**
- Gradual rollout by command/directorate
- Collect feedback and optimize
- Verify cost per meeting stays under budget

**Week 5-12: Full 300,000 User Rollout**
- Expand by 25,000-50,000 users per week
- Monitor Azure costs and adjust quotas
- Provide training and support materials
- Continue iterative improvements

### Complete Documentation

All scaling resources provided:
- **`scripts/scale-to-production.sh`** - One-command upgrade
- **`scripts/rollback-to-pilot.sh`** - Emergency rollback  
- **`scripts/validate-production.sh`** - Post-upgrade checks
- **`PILOT_TO_PRODUCTION_SCALING.md`** - Complete guide
- **`AZURE_GOV_IMPLEMENTATION_PLAN.md`** - Full production details

---

## Pilot Timeline

### Week-by-Week Schedule

```yaml
Week 1: Infrastructure Setup
  - Day 1-2: Azure resources provisioned
  - Day 3-4: Azure AD app registration
  - Day 5: Initial deployment and smoke test

Week 2: Integration & Testing
  - Day 1-2: Microsoft Graph API integration
  - Day 3: SharePoint configuration
  - Day 4-5: Initial testing with 5 users

Week 3: Core Pilot
  - Full 50-100 users onboarded
  - Process 100-200 meetings
  - Collect initial feedback

Week 4: Refinement
  - Bug fixes based on feedback
  - Performance optimization
  - Security hardening

Week 5-6: Full Pilot Operation
  - Process 200-300 meetings
  - Collect metrics and feedback
  - Continuous improvement

Week 7-8: Final Validation
  - Final testing
  - Security review
  - Cost analysis
  - Go/No-Go decision
```

---

## Cost Tracking & Optimization

### Daily Cost Monitoring

```bash
# Check daily costs
az consumption usage list \
  --resource-group rg-teams-minutes-pilot \
  --start-date "2025-01-01" \
  --end-date "2025-01-31"

# Monitor OpenAI usage specifically
# Via Azure Portal: OpenAI resource → Metrics → Token Usage
```

### Cost Optimization Tips for Pilot

1. **Turn off resources during non-business hours**
   ```bash
   # Stop App Service at night (if acceptable)
   az webapp stop --name app-teams-pilot --resource-group rg-teams-minutes-pilot
   
   # Start in morning
   az webapp start --name app-teams-pilot --resource-group rg-teams-minutes-pilot
   ```

2. **Monitor OpenAI token usage**
   - Review prompts for efficiency
   - Reduce unnecessary API calls
   - Cache results when possible

3. **Use B-tier resources**
   - Already configured for cost optimization
   - Acceptable for pilot workloads

---

## Support & Operations (Pilot)

### Pilot Team Roles

| Role | Count | Responsibilities |
|------|-------|------------------|
| **Pilot Lead** | 1 | Overall pilot management |
| **Technical Lead** | 1 | Azure + app deployment |
| **User Champion** | 2-3 | User training, feedback |
| **Security Lead** | 1 | Security monitoring |

### Daily Operations

**Pilot Administrator Checklist:**
- [ ] Check Application Insights for errors
- [ ] Review user feedback forms
- [ ] Monitor Azure costs
- [ ] Check email distribution success rate
- [ ] Review SharePoint archival status

### Pilot Communication Plan

**Daily:**
- Monitor Teams channel for pilot user questions
- Review Application Insights for issues

**Weekly:**
- Send status email to pilot users
- Update executive sponsor
- Team meeting to review metrics

**Bi-weekly:**
- User feedback survey
- Technical metrics review
- Cost analysis

---

## Appendix

### A. Pilot User Training Materials

**1-Hour Training Session Outline:**
1. Introduction (10 min)
   - What is the system?
   - How it helps you
   - Pilot timeline and goals

2. Basic Usage (20 min)
   - How meetings are captured
   - Viewing generated minutes
   - Approval workflow

3. Hands-On Practice (20 min)
   - Schedule test meeting
   - Review sample minutes
   - Practice approval

4. Q&A (10 min)

### B. Pilot Feedback Form

```yaml
Survey Questions:
  1. How easy was it to use the system? (1-5)
  2. How accurate were the generated minutes? (1-5)
  3. How much time did this save you? (minutes)
  4. What did you like most?
  5. What needs improvement?
  6. Would you recommend expanding this? (Yes/No/Maybe)
  7. Additional comments
```

### C. Troubleshooting Guide

**Common Pilot Issues:**

| Issue | Solution |
|-------|----------|
| Meeting not captured | Check user is in pilot group |
| Minutes generation failed | Check OpenAI quota |
| Email not sent | Verify Graph API permissions |
| SharePoint access denied | Check site permissions |
| Slow performance | Review Application Insights |

---

## Quick Reference

### Important URLs (Pilot)

```yaml
Application: https://app-teams-pilot.azurewebsites.us
Azure Portal: https://portal.azure.us
SharePoint: https://dod.sharepoint.us/sites/TeamsMeetingMinutesPilot
App Insights: https://portal.azure.us → app-insights-pilot
```

### Important Commands

```bash
# View logs
az webapp log tail --name app-teams-pilot --resource-group rg-teams-minutes-pilot

# Restart app
az webapp restart --name app-teams-pilot --resource-group rg-teams-minutes-pilot

# Check costs
az consumption usage list --resource-group rg-teams-minutes-pilot
```

---

**Document Version:** 1.0  
**Pilot Duration:** 60 days  
**Classification:** UNCLASSIFIED  
**Pilot Lead:** [Your Name]  
**Next Review:** Weekly during pilot
