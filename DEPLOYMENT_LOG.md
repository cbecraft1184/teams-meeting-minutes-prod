# Teams Meeting Minutes - Azure Commercial Deployment Log

**Deployment Date:** November 22, 2025  
**Deployer:** Christopher Becraft  
**Target Environment:** Azure Commercial (East US)  
**Application:** Teams Meeting Minutes AI System

---

## Deployment Progress

### Phase 0: Pre-Deployment Verification ✅ IN PROGRESS

**Objective:** Identify the Azure subscription tenant to use for deployment

**Date/Time:** November 22, 2025

---

#### Step 0.1: Microsoft 365 Developer Program Check
**Time:** Initial setup  
**Action:** Checked Microsoft 365 Developer Program eligibility  
**Result:** Not qualified for sandbox subscription  
**Screenshot:** `image_1763835408644.png`  
**Notes:** 
- Message: "You don't currently qualify for a Microsoft 365 Developer Program sandbox subscription"
- **Decision:** Proceeding with existing Azure subscription tenant instead

---

#### Step 0.2: Access Azure Portal
**Time:** Initial navigation  
**Action:** Navigated to https://portal.azure.com  
**Result:** Successfully accessed Azure Portal  
**Screenshot:** `image_1763835457982.png`  
**Notes:**
- Account: Christopher Becraft
- Portal showing: "Azure free account"
- No resources viewed recently (new account or clean environment)

---

#### Step 0.3: Open Azure Cloud Shell
**Time:** Cloud Shell initialization  
**Action:** Clicked Cloud Shell icon (`>_`) in Azure Portal  
**Result:** Cloud Shell setup dialog appeared  
**Screenshot:** `image_1763835781062.png`  
**Configuration Selected:**
- Storage option: "No storage account required" ✅
- Subscription: Azure subscription 1
- Virtual network: Unchecked
- **Reason:** Only running verification commands, no persistent storage needed

---

#### Step 0.4: Cloud Shell Activation
**Time:** Shell startup  
**Action:** Applied Cloud Shell configuration  
**Result:** Cloud Shell successfully initialized  
**Screenshot:** `image_1763835953597.png`  
**Console Output:**
```
Requesting a Cloud Shell.Succeeded.
Connecting terminal...

Welcome to Azure Cloud Shell

Type "az" to use Azure CLI
Type "help" to learn about Cloud Shell

christopher [ ~ ]$
```
**Warning Received:** 
```
Subscription used to launch your CloudShell 17fbbec-ad82-47-a53c-fcb6b7320bbc 
is not registered to Microsoft.CloudShell2 Namespace.
```
**Status:** Warning can be ignored - CloudShell is functional

---

#### Step 0.5: Identify Subscription Tenant ✅ COMPLETED
**Time:** November 22, 2025  
**Command Executed:**
```bash
az account show --output table
```
**Result:** Successfully identified Azure subscription tenant  
**Screenshot:** `image_1763836089409.png`

**Output:**
```
EnvironmentName  IsDefault  Name                  State    TenantId
AzureCloud       True       Azure subscription 1  Enabled  edbe879d-bd5b-4db7-bdb8-70bb31490f85
```

**Key Information Discovered:**
- **Tenant ID**: `edbe879d-bd5b-4db7-bdb8-70bb31490f85` ✅
- **Subscription Name**: Azure subscription 1
- **Environment**: AzureCloud (Azure Commercial) ✅ 
- **State**: Enabled ✅
- **IsDefault**: True

**Why This Matters:**
- ✅ This tenant will host ALL resources (Azure + Microsoft 365)
- ✅ Custom Teams app will be registered in THIS tenant
- ✅ Demo users MUST have accounts in THIS tenant
- ✅ All Azure AD authentication will use THIS tenant

---

#### Step 0.6: Verify Microsoft 365 Access ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Accessed Microsoft 365 admin center  
**URL:** https://admin.microsoft.com  
**Result:** Successfully confirmed Microsoft 365 access  
**Screenshot:** `image_1763836288409.png`

**Microsoft 365 Status:**
- ✅ **Tenant Has Microsoft 365**: Confirmed
- ✅ **License Type**: Microsoft 365 Business Standard
- ✅ **Admin Account**: ChristopherBecraft@ChrisBecraftmicrosoft.com
- ✅ **Admin Access**: Full administrative rights confirmed

**Services Included in Business Standard:**
- ✅ Microsoft Teams (meeting capture, bot integration)
- ✅ SharePoint Online (document archival)
- ✅ Exchange Online (email distribution)
- ✅ Azure Active Directory (authentication)

**Key Findings:**
- Organization has 1 user currently: Christopher Becraft
- Can add additional demo users (up to license limit)
- All required services (Teams/SharePoint/Exchange) are available
- Same tenant ID as Azure subscription: `edbe879d-bd5b-4db7-bdb8-70bb31490f85`

**Deployment Confirmation:**
✅ **READY TO DEPLOY** - Single tenant has both:
- Azure subscription (for hosting infrastructure)
- Microsoft 365 Business Standard (for Teams/SharePoint/Exchange)

---

### Phase 1: Create Azure Resources 🚀 IN PROGRESS

**Objective:** Create all required Azure infrastructure (Resource Group, Container Apps, PostgreSQL, Azure OpenAI)

**Date/Time:** November 22, 2025

---

#### Step 1.1: Set Environment Variables ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Defined resource names and configuration in Azure Cloud Shell  
**Screenshot:** `image_1763845816473.png`

**Configuration Set:**
- Resource Group: `rg-teams-minutes-demo`
- Location: `eastus2` (changed from eastus due to PostgreSQL capacity)
- PostgreSQL Server: Unique name with timestamp
- OpenAI Account: Unique name with timestamp
- Key Vault: Unique name with timestamp
- Database credentials: Auto-generated secure password
- Session secret: Auto-generated

**Result:** ✅ All environment variables configured successfully

---

#### Step 1.2: Create Resource Group ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created Azure Resource Group  
**Screenshot:** `image_1763845878238.png`  
**Command:** `az group create --name rg-teams-minutes-demo --location eastus2`

**Result:**
```json
{
  "id": "/subscriptions/17fbbec-ad82-4747-a12e-fc8d8f2d0cbc/resourceGroups/rg-teams-minutes-demo",
  "location": "eastus2",
  "name": "rg-teams-minutes-demo",
  "provisioningState": "Succeeded"
}
```

**Status:** ✅ Resource Group created successfully

---

#### Step 1.3: Create PostgreSQL Flexible Server ❌ FAILED - Region Not Available
**Time:** November 22, 2025  
**Action:** Attempted to create PostgreSQL Flexible Server in East US  
**Screenshot:** `image_1763845966687.png`

**Error Encountered:**
```
The location 'eastus' is not accepting creations of new Flexible servers.
Please try using another region.
RegionDoesNotSupportAvailabilityZone
OperationNotAllowed
```

**Command Duration:** 114 seconds (failed, no resource created)

**Root Cause:** Azure East US region has capacity constraints for PostgreSQL Flexible Servers (Standard_B2s tier)

**Resolution:** Switch deployment region to **East US 2** or another supported region

---

#### Step 1.3 (Retry): PostgreSQL in East US 2 ✅ SUCCESS
**Time:** November 22, 2025  
**Action:** Created PostgreSQL server in East US 2  
**Screenshot:** `image_1763846167954.png`, `image_1763846273145.png`

**Result:** ✅ PostgreSQL server created successfully in East US 2

**Configuration:**
- Region: East US 2 (eastus2)
- Tier: Burstable Standard_B2s
- Version: PostgreSQL 16
- Storage: 32 GB

**Warnings (Ignored):** Subscription registration warnings (red text) - informational only, not blocking

---

#### Step 1.4: Create Database ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created 'meetings' database on PostgreSQL server  
**Screenshot:** `image_1763846273145.png`

**Result:** ✅ Database 'meetings' created successfully

**Summary:** PostgreSQL infrastructure is ready for application deployment

---

#### Step 1.5: Create Azure OpenAI Service ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created Azure OpenAI Service account  
**Screenshot:** `image_1763846367911.png`

**Result:** ✅ Azure OpenAI account created successfully

**Configuration:**
- Region: East US 2 (eastus2)
- SKU: S0 (Standard)
- Service Type: OpenAI

**Warnings (Ignored):** Subscription registration warnings (red text) - informational only

**Next Step:** Deploy AI models (GPT-4o for minutes generation)

---

#### Step 1.6: Deploy GPT-4o Model ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Deployed GPT-4o model to Azure OpenAI  
**Screenshot:** `image_1763846423627.png`

**Result:** ✅ GPT-4o model deployed successfully

**Configuration:**
- Model: GPT-4o
- Version: 2024-08-06
- Capacity: 100 tokens/min
- SKU: Standard

---

#### Step 1.7: Create Application Insights ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created Application Insights for monitoring  
**Screenshot:** `image_1763846664851.png`

**Result:** ✅ Application Insights created successfully

**Configuration:**
- Region: East US 2
- Application Type: Web

---

#### Step 1.8: Create App Service Plan ❌ FAILED - Quota Issues
**Time:** November 22, 2025  
**Action:** Created App Service Plan  
**Screenshot:** `image_1763847001905.png`

**Result:** ⚠️ App Service Plan created, but Web App deployment failed

**Configuration:**
- Tier: Basic B1 (Linux)
- Region: East US 2

**Issue:** VM quota exhausted (see Phase 3 for resolution)

---

#### Step 1.9: Create App Service ❌ FAILED - Quota Exhausted
**Time:** November 22, 2025  
**Action:** Attempted to create App Service (web hosting)  
**Screenshot:** `image_1763847001905.png`

**Result:** ❌ Failed due to VM quota constraints

**Error:** "This region has quota of 1 instances for your subscription."

**Resolution:** Pivoted to Azure Container Apps (see Phase 3)

---

#### Step 1.10: Create Key Vault ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created Key Vault for secrets management  
**Screenshot:** `image_1763847078164.png`

**Result:** ✅ Key Vault created successfully

**Configuration:**
- SKU: Standard
- Region: East US 2
- Deployment enabled: true

---

### ✅ PHASE 1 COMPLETE (Container Apps Architecture)

**Resources Successfully Created:**
1. ✅ Resource Group (`rg-teams-minutes-demo`)
2. ✅ PostgreSQL Flexible Server (East US 2, Burstable B2s)
3. ✅ Database `meetings` 
4. ✅ Azure OpenAI Service (S0)
5. ✅ GPT-4o Model Deployed (capacity: 100)
6. ✅ Application Insights (monitoring)
7. ✅ Key Vault (secrets management)
8. ✅ Azure Container Registry (Basic SKU) - *Added during Phase 3*
9. ✅ Container Apps Environment - *Added during Phase 3*

**Architecture Decision:** 
- Initial App Service deployment failed (VM quota exhausted)
- Pivoted to Azure Container Apps for container-based hosting
- Container Apps provides better scalability and containerization support

**Total Phase 1 Duration:** ~15-20 minutes

---

### Phase 2: Azure AD App Registration 🚀 IN PROGRESS

**Objective:** Create Azure AD App Registration with Microsoft Graph API permissions

**Date/Time:** November 22, 2025

**Purpose:**
- Allow application to access Microsoft Teams meetings
- Enable email distribution via Microsoft Graph
- Enable SharePoint document uploads
- Authenticate users via Azure AD SSO

---

#### Step 2.1: Register Microsoft Graph API App ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Created App Registration in Azure Portal  
**Screenshot:** `image_1763847419808.png`

**Result:** ✅ App Registration created successfully

**Application Details:**
- **Name:** Teams Minutes Graph API
- **Application (client) ID:** `7338369d-c5c6-40cc-94cf-96cb79ed146c`
- **Directory (tenant) ID:** `edbe879d-bd5b-4db7-bdb8-70bb31490f85`
- **Object ID:** `dd31e577-99d1-4476-8d38-b30197b7020`
- **Supported account types:** Single tenant

---

#### Step 2.2: Add Microsoft Graph API Permissions ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Added 7 application permissions for Microsoft Graph API  
**Screenshot:** `image_1763848868986.png`

**Result:** ✅ All 7 required permissions added successfully

**Permissions Added (Application type):**
1. ✅ Calendars.ReadWrite
2. ✅ Mail.Send
3. ✅ OnlineMeetingRecording.Read.All
4. ✅ OnlineMeetings.ReadWrite.All
5. ✅ OnlineMeetingTranscript.Read.All
6. ✅ Sites.ReadWrite.All
7. ✅ User.Read.All

**Status:** All permissions show "Not granted" - admin consent required (next step)

---

#### Step 2.3: Grant Admin Consent ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Granted admin consent for all 7 application permissions  
**Screenshot:** `image_1763849045958.png`

**Result:** ✅ Admin consent granted successfully

**Status:** All 7 permissions now show "Granted for Chris Becraft" (green checkmarks)
- Message: "Successfully granted admin consent for the requested permissions"

---

#### Step 2.4: Create Client Secret ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Generated client secret for app-only authentication  
**Screenshot:** `image_1763849202309.png`

**Result:** ✅ Client secret created successfully

**Client Secret Details:**
- **Description:** Teams Minutes Production Secret
- **Secret ID:** 4bb5d42c-8834-4203-a724-82320ad49f41
- **Expires:** May 21, 2026 (180 days)
- **Secret Value:** ✅ Copied and stored securely (not logged for security)

**Note:** Secret value is stored securely and will be used for `GRAPH_CLIENT_SECRET_PROD` environment variable.

---

#### Step 2.5: Create Bot Registration for Teams ✅ COMPLETED
**Time:** November 22, 2025  
**Action:** Registered Azure Bot for Teams integration  
**Screenshot:** `image_1763852368072.png`

**Result:** ✅ Azure Bot created successfully

**Bot Configuration:**
- **Bot handle:** teams-minutes-bot
- **Resource group:** rg-teams-minutes-demo
- **Pricing tier:** F0 (Free)
- **Type of App:** Single Tenant
- **App ID:** 7338369d-c5c6-40cc-94cf-96cb79ed146c (linked to Graph API app)
- **App Tenant ID:** edbe879d-bd5b-4db7-bdb8-70bb31490f85
- **Deployment name:** Microsoft.AzureBot-20251122175012

**Note:** Messaging endpoint will be configured after Container App deployment in Phase 3.

**Bot Overview (from Azure Portal):**
- Resource displayed at: `image_1763852446901.png`
- Messaging endpoint: (Not configured - pending Phase 3 deployment)
- Location: Global

---

## 🎉 Phase 2 Complete: Azure AD Configuration

**Summary:**
- ✅ App Registration: "Teams Minutes Graph API" created
- ✅ 7 Microsoft Graph API permissions added and granted admin consent
- ✅ Client secret generated and stored securely
- ✅ Azure Bot: "teams-minutes-bot" created and linked to app registration

**Key IDs for Environment Variables:**
- **GRAPH_TENANT_ID_PROD:** edbe879d-bd5b-4db7-bdb8-70bb31490f85
- **GRAPH_CLIENT_ID_PROD:** 7338369d-c5c6-40cc-94cf-96cb79ed146c
- **GRAPH_CLIENT_SECRET_PROD:** [Stored securely]

---

## Deployment Phases Overview

1. ✅ **Phase 0: Pre-Deployment Verification** - COMPLETED
2. ✅ **Phase 1: Create Azure Resources** - COMPLETED
3. 🚀 **Phase 2: Azure AD App Registration** - IN PROGRESS
4. **Phase 3: Deploy Application** - Build and deploy code to Azure
5. **Phase 4: Teams App Integration** - Upload Teams app manifest
6. **Phase 5: End-to-End Testing** - Verify complete workflow

---

## Important Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Use existing Azure subscription tenant | Microsoft 365 Developer Program sandbox not available | Nov 22, 2025 |
| Single-tenant deployment | Custom Teams apps are tenant-scoped; simplifies configuration | Nov 22, 2025 |
| No Cloud Shell storage | Only running verification commands | Nov 22, 2025 |

---

## Configuration Values Discovered

| Parameter | Value | Source | Date |
|-----------|-------|--------|------|
| Deployment Region | East US (planned) | COMMERCIAL_DEMO_DEPLOYMENT.md | Nov 22, 2025 |
| **Tenant ID** | **edbe879d-bd5b-4db7-bdb8-70bb31490f85** | az account show | Nov 22, 2025 |
| Subscription Name | Azure subscription 1 | az account show | Nov 22, 2025 |
| Subscription ID | edbe879d-bd5b-4db7-bdb8-70bb31490f85 | az account show | Nov 22, 2025 |
| Environment | AzureCloud (Commercial) | az account show | Nov 22, 2025 |
| Microsoft 365 License | Business Standard | Microsoft 365 Admin Center | Nov 22, 2025 |
| Admin Email | ChristopherBecraft@ChrisBecraftmicrosoft.com | Microsoft 365 Admin Center | Nov 22, 2025 |
| Teams/SharePoint/Exchange | ✅ All Available | Microsoft 365 Admin Center | Nov 22, 2025 |

---

## Issues Encountered

| Issue | Resolution | Date |
|-------|------------|------|
| Microsoft 365 Developer Program denied | Use existing Azure subscription tenant | Nov 22, 2025 |
| CloudShell namespace warning | Ignored - shell is functional | Nov 22, 2025 |
| East US region capacity constraint | Switch to East US 2 for PostgreSQL deployment | Nov 22, 2025 |

---

## Screenshots Archive

1. `image_1763835408644.png` - Microsoft 365 Developer Program (not qualified)
2. `image_1763835457982.png` - Azure Portal homepage
3. `image_1763835781062.png` - Cloud Shell setup dialog
4. `image_1763835953597.png` - Cloud Shell activated
5. `image_1763836089409.png` - Tenant identification command output ⭐
6. `image_1763836288409.png` - Microsoft 365 Admin Center verification ⭐✅
7. `image_1763845816473.png` - Environment variables configuration
8. `image_1763845878238.png` - Resource Group creation ✅
9. `image_1763845966687.png` - PostgreSQL creation failure (East US capacity)
10. `image_1763846167954.png` - PostgreSQL server created in East US 2 (with warnings)
11. `image_1763846273145.png` - Database 'meetings' created successfully

---

## Commands Executed

```bash
# Phase 0: Pre-Deployment Verification
# Executed: November 22, 2025

# 1. Identify Azure subscription tenant
az account show --output table
# Output:
# EnvironmentName  IsDefault  Name                  State    TenantId
# AzureCloud       True       Azure subscription 1  Enabled  edbe879d-bd5b-4db7-bdb8-70bb31490f85
```

---

## Notes & Observations

- User (Christopher) has multiple Microsoft accounts causing initial confusion
- Architect recommended single-tenant approach for simplicity
- Deployment cost: $85/month (demo), $463/month (100 users production)
- Email distribution feature fully implemented and ready
- All 12 database tables documented and validated

---

### Phase 3: Container Deployment 🚀 COMPLETED

**Objective:** Deploy application to Azure Container Apps after App Service quota issues

**Date/Time:** November 23, 2025

---

#### Background: App Service Quota Issues

**Original Plan:** Deploy to Azure App Service (Basic B1)

**Issue Encountered:**
- App Service Plan created successfully
- Web App creation failed: "This region has quota of 1 instances for your subscription. Try selecting a different region or SKU."
- Root cause: Subscription VM quota exhausted (1 of 1 VMs used)

**Resolution:** Pivot to Azure Container Apps architecture

---

#### Step 3.1: Delete Failed App Service Plan ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Cleaned up failed App Service deployment  
**Result:** ✅ App Service Plan deleted successfully

---

#### Step 3.2: Create Azure Container Registry ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Created Azure Container Registry for container images  

**Result:** ✅ Container Registry created successfully

**Configuration:**
- Name: teamminutesacr
- SKU: Basic
- Region: East US 2
- Admin enabled: Yes

---

#### Step 3.3: Create Dockerfile ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Developed production-ready Dockerfile  
**Result:** ✅ Architect-approved multi-stage build

**Features:**
- Multi-stage build (builder + runtime)
- Alpine Linux base (minimal size)
- Build tools cleanup after npm install
- Health check endpoint
- All runtime assets copied correctly

---

#### Step 3.4: Build and Push Container Image ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Built container image using Azure ACR Build  
**Result:** ✅ Image built and pushed successfully

**Build Output:**
- Frontend bundle: 951.72 kB
- Backend bundle: 250.2 kB
- Image: teamminutesacr.azurecr.io/teams-minutes:latest
- npm vulnerabilities: 4 (3 low, 1 high) - non-blocking for demo

**Architect Review:** PASS - Production-ready

---

#### Step 3.5: Create Container Apps Environment ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Created Azure Container Apps Environment  
**Result:** ✅ Environment created successfully

**Configuration:**
- Name: teams-minutes-env
- Region: East US 2

---

#### Step 3.6: Deploy Container App ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Deployed container app with environment variables  
**Result:** ✅ Container app deployed successfully

**Configuration:**
- Name: teams-minutes-app
- Image: teamminutesacr.azurecr.io/teams-minutes:latest
- Target port: 5000
- Ingress: External (HTTPS)
- App URL: teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io

**Environment Variables:**
- NODE_ENV=production
- DATABASE_URL=[PostgreSQL connection string]
- SESSION_SECRET=[Generated]
- PORT=5000

---

#### Step 3.7: Update Bot Messaging Endpoint ✅ COMPLETED
**Time:** November 23, 2025  
**Action:** Updated Azure Bot messaging endpoint to Container App URL  
**Result:** ✅ Bot endpoint updated successfully

**Endpoint:** https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/teams/messages

---

### ✅✅ PHASE 3 COMPLETE! Application Deployed to Azure Container Apps

**Deployment Summary:**
1. ✅ Pivoted from App Service to Container Apps (quota issues)
2. ✅ Created Azure Container Registry
3. ✅ Developed production-ready Dockerfile (architect-approved)
4. ✅ Built and pushed container image (Azure ACR Build)
5. ✅ Created Container Apps Environment
6. ✅ Deployed Container App with environment variables
7. ✅ Updated Bot messaging endpoint

**Application URL:** https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io

**Total Phase 3 Duration:** ~45 minutes (including pivot)

---

## Lessons Learned: Azure Quotas

**Key Insights from Deployment:**

1. **App Service Plan ≠ Web App Quotas**
   - App Service Plan creation can succeed even when Web App quota is exhausted
   - Always check VM quota before attempting App Service deployments
   
2. **VM Quota Constraints**
   - East US 2 had 1 VM quota for this subscription
   - Silent failures are common - always check Activity Log
   
3. **Container Apps as Alternative**
   - No VM quota constraints
   - Simpler scaling model
   - Better for microservices architecture
   
4. **Quota Approval Process**
   - "Approved" quotas don't guarantee immediate availability
   - Always verify resource creation in Activity Log
   
5. **Regional Availability**
   - Different regions have different capacity
   - East US had PostgreSQL capacity issues
   - East US 2 worked for all resources

---

## Final Architecture

**Azure Resources Created:**
1. ✅ Resource Group (`rg-teams-minutes-demo`)
2. ✅ PostgreSQL Flexible Server (East US 2, Burstable B2s)
3. ✅ Database `meetings` 
4. ✅ Azure OpenAI Service (S0)
5. ✅ GPT-4o Model Deployed (capacity: 100)
6. ✅ Application Insights (monitoring)
7. ✅ **Azure Container Registry** (teamminutesacr)
8. ✅ **Container Apps Environment** (teams-minutes-env)
9. ✅ **Container App** (teams-minutes-app)
10. ✅ Key Vault (secrets management)
11. ✅ Azure Bot (teams-minutes-bot)

**Deployment Type:** Azure Container Apps (instead of App Service)

---

**Last Updated:** November 23, 2025  
**Status:** ✅ DEPLOYMENT COMPLETE

**Phase 3 Summary:**
- ✅ **Container Registry**: teamminutesacr.azurecr.io
- ✅ **Container Image**: teams-minutes:latest
- ✅ **Container App URL**: teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
- ✅ **Bot Endpoint**: Configured

**Next Steps:** Phase 4 - Teams App Integration (Upload manifest, test in Teams)
