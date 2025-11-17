# Deployment Guide
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Deployment instructions for the DOD Teams Meeting Minutes Management System on Azure Government (GCC High) infrastructure with FedRAMP High compliance

**Architecture Status:** Production-ready design for 16-week commercial deployment + 16-month ATO process. This guide covers the complete deployment process from Azure Government infrastructure provisioning through FedRAMP authorization.

**What You're Deploying:** An enterprise-grade autonomous meeting minutes system with backend services, database schema, API layer, workflow engine, Microsoft Graph integrations, and comprehensive frontend UI - all designed for DOD security classification requirements and IL5 compliance.

**Classification:** UNCLASSIFIED  
**Last Updated:** November 17, 2025

---

## What This System Includes

**Production architecture components:**

✅ **Backend Services:**
- Durable PostgreSQL-backed job queue with automatic retry
- Meeting orchestrator coordinating entire workflow
- Microsoft Graph API client (webhooks, meetings, email, SharePoint)
- Azure OpenAI integration for AI processing (GCC High)
- Document generation (DOCX, PDF) with classification marking
- Email distribution system
- Azure AD group-based access control with clearance-level enforcement

✅ **Database:**
- Full PostgreSQL schema with 7 tables
- Horizontally sharded architecture (12 shards by classification)
- Migration system (Drizzle ORM)
- Session management with IL5 data segregation
- Job queue persistence

✅ **API Layer:**
- 15+ RESTful endpoints
- Authentication middleware (CAC/PIV support)
- Webhook receivers for Microsoft Teams
- Health check endpoints
- Classification-aware routing

✅ **Integration Layer:**
- Microsoft Teams meeting capture (GCC High Graph API)
- SharePoint document archival (IL5-compliant)
- Azure OpenAI processing (GCC High endpoints)
- Email distribution via Graph API

✅ **Frontend:** React application with comprehensive UI (Microsoft Fluent + IBM Carbon design, WCAG 2.1 AA accessibility, dual-theme system, classification banners)

✅ **Security & Compliance:**
- FedRAMP High controls (89% implemented)
- IL5 data segregation architecture
- Classification handling (UNCLASSIFIED, CONFIDENTIAL, SECRET)
- TLS 1.3 in transit, AES-256 at rest
- HSM-backed key management for CONFIDENTIAL/SECRET
- Immutable audit logging with 365-day retention

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Azure Government Prerequisites](#2-azure-government-prerequisites)
3. [Microsoft 365 GCC High Setup](#3-microsoft-365-gcc-high-setup)
4. [Azure AD Application Registration](#4-azure-ad-application-registration)
5. [Azure OpenAI GCC High Setup](#5-azure-openai-gcc-high-setup)
6. [SharePoint IL5 Configuration](#6-sharepoint-il5-configuration)
7. [Azure Government Production Deployment](#7-azure-government-production-deployment)
8. [Classification and Access Control Setup](#8-classification-and-access-control-setup)
9. [FedRAMP Compliance Configuration](#9-fedramp-compliance-configuration)
10. [ATO Process and Timeline](#10-ato-process-and-timeline)
11. [Post-Deployment Validation](#11-post-deployment-validation)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Quick Reference

### 1.1 Deployment Timeline

| Phase | Duration | Key Steps | Deliverables |
|-------|----------|-----------|--------------|
| **Phase 1: Commercial Deployment** | 16 weeks | Infrastructure provisioning, application deployment, security hardening | Production-ready system on Azure Gov |
| **Phase 2: ATO Process** | 16 months | 3PAO assessment, documentation, authorization | FedRAMP High ATO |
| **Total Timeline** | 20 months | End-to-end deployment to full authorization | Authorized production system |

**Phase 1 Breakdown (16 Weeks):**

| Milestone | Weeks | Activities |
|-----------|-------|------------|
| Foundation | 1-4 | Azure Gov infrastructure, database shards, CI/CD pipeline |
| Core Features | 5-8 | Graph integration, AI processing, approval workflow, archival |
| Security & Compliance | 9-12 | Access control, classification handling, FedRAMP controls, penetration testing |
| Validation & Launch | 13-16 | End-to-end testing, load testing (10K users), pilot launch |

**Phase 2 Breakdown (16 Months):**

| Milestone | Months | Activities |
|-----------|--------|------------|
| Security Assessment | 1-6 | 3PAO selection, SAP creation, security testing, SAR generation |
| Documentation & Governance | 7-12 | SSP finalization, POA&M management, IR/CP testing, CCB establishment |
| Authorization | 13-16 | ATO package submission, AO review, risk acceptance, production transition |

### 1.2 Cost Estimates

**Note:** Production architecture uses multi-scale-unit App Service Environment (ASEv3) design with auto-scaling capability to support up to 300,000 concurrent users. See SCALABILITY_ARCHITECTURE.md for detailed capacity planning.

| Environment | Monthly Cost | Components |
|------------|-------------|------------|
| **Azure Government Baseline (10K users)** | $54,150 | 3× ASEv3, 18× I3v2 instances, 12× PostgreSQL shards, Azure Front Door, Azure OpenAI GCC High |
| **Azure Government Peak (300K users)** | $1,088,200 | 12× ASEv3, 880× I3v2 instances, 12× scaled PostgreSQL shards, Azure Front Door, Azure OpenAI GCC High |

**One-Time Implementation Costs:**

| Item | Cost | Notes |
|------|------|-------|
| **Phase 1: Commercial Deployment** | $620K-$820K | Engineering team (6-8 FTEs × 16 weeks) + Azure infrastructure (4 months) |
| **Phase 2: ATO Process** | $1.2M-$1.4M | 3PAO assessment ($75K-$125K), penetration testing ($50K-$80K), operations (16 months), security personnel |
| **Total Investment** | **$1.8M-$2.2M** | Complete deployment to FedRAMP High authorization |

### 1.3 Prerequisites Checklist

**Organizational Requirements:**
- [ ] Azure Government (GCC High or DOD) subscription with billing enabled
- [ ] Microsoft 365 GCC High tenant
- [ ] Personnel with appropriate security clearances (SECRET minimum for administrators)
- [ ] Designated Authorizing Official (AO) for ATO process
- [ ] Information System Security Officer (ISSO) assigned
- [ ] Information System Security Manager (ISSM) assigned

**Technical Requirements:**
- [ ] Azure Government Portal access (https://portal.azure.us)
- [ ] Azure CLI configured for Azure Government (`az cloud set --name AzureUSGovernment`)
- [ ] Terraform or Bicep for Infrastructure-as-Code
- [ ] SSL/TLS certificates from DOD-approved Certificate Authority
- [ ] CAC/PIV authentication infrastructure

**Compliance Requirements:**
- [ ] System Security Plan (SSP) template
- [ ] FedRAMP High control baseline understanding
- [ ] DISA SRG IL5 requirements familiarity
- [ ] 3PAO (Third Party Assessment Organization) selected
- [ ] Continuous monitoring strategy defined

---

## 2. Azure Government Prerequisites

### 2.1 Azure Government Subscription Setup

#### Step 1: Obtain Azure Government Subscription

**Eligibility:** U.S. federal, state, local, tribal governments and their partners

1. Visit: https://azure.microsoft.com/en-us/global-infrastructure/government/
2. Click **"Get started with Azure Government"**
3. Complete eligibility verification:
   - Government entity documentation
   - Proof of U.S. citizenship for administrators
   - Business justification for access
4. Wait 5-10 business days for approval

**Success indicator:** Azure Government subscription appears in https://portal.azure.us

#### Step 2: Configure Azure CLI for Government Cloud

```bash
# Set Azure CLI to use Azure Government
az cloud set --name AzureUSGovernment

# Verify configuration
az cloud show --output table

# Login to Azure Government
az login

# Verify subscription
az account list --output table
```

**Expected output:**
- Cloud: AzureUSGovernment
- Portal URL: https://portal.azure.us
- Resource Manager URL: https://management.usgovcloudapi.net

#### Step 3: Verify Clearance and Access

**Required Clearances:**
- System administrators: **SECRET clearance minimum**
- Database administrators: **SECRET clearance** (for CONFIDENTIAL/SECRET data access)
- Application developers: **CONFIDENTIAL clearance minimum**
- End users: Varies by classification level (UNCLASSIFIED users do not require clearance)

**Access Validation:**
1. Verify all personnel have appropriate clearances documented
2. Complete Non-Disclosure Agreements (NDAs) and SF-312 forms
3. Establish need-to-know access lists by classification level
4. Configure Azure AD group memberships to reflect clearance levels

### 2.2 Network and Boundary Requirements

#### Step 1: Establish Network Boundaries

**IL5 Boundary Requirements:**
- All CONFIDENTIAL and SECRET data must reside within IL5-compliant VNets
- No direct internet egress for SECRET classification VNet
- All traffic between classification levels requires explicit firewall rules

**VNet Architecture:**

```
UNCLASSIFIED VNet (10.0.0.0/16)
├─ App Service Subnet (10.0.1.0/24)
├─ Database Subnet (10.0.2.0/24)
├─ Private Endpoint Subnet (10.0.3.0/24)
└─ Gateway Subnet (10.0.255.0/24) - For Azure Front Door

CONFIDENTIAL VNet (10.10.0.0/16)
├─ App Service Subnet (10.10.1.0/24)
├─ Database Subnet (10.10.2.0/24)
├─ Private Endpoint Subnet (10.10.3.0/24)
└─ Gateway Subnet (10.10.255.0/24)

SECRET VNet (10.20.0.0/16) - NO INTERNET EGRESS
├─ App Service Subnet (10.20.1.0/24)
├─ Database Subnet (10.20.2.0/24)
└─ Private Endpoint Subnet (10.20.3.0/24)
```

#### Step 2: Configure Network Security Groups (NSGs)

**Baseline NSG Rules:**

```bash
# Create NSG for App Service subnet
az network nsg create \
  --name nsg-app-unclass \
  --resource-group rg-teams-minutes \
  --location usgovvirginia

# Allow HTTPS from Azure Front Door only
az network nsg rule create \
  --name AllowHTTPSFromFrontDoor \
  --nsg-name nsg-app-unclass \
  --priority 100 \
  --source-address-prefixes AzureFrontDoor.Backend \
  --destination-port-ranges 443 \
  --protocol Tcp \
  --access Allow

# Deny all other inbound traffic
az network nsg rule create \
  --name DenyAllInbound \
  --nsg-name nsg-app-unclass \
  --priority 4096 \
  --direction Inbound \
  --access Deny
```

**Repeat for CONFIDENTIAL and SECRET NSGs with stricter rules**

---

## 3. Microsoft 365 GCC High Setup

### 3.1 Microsoft 365 GCC High Tenant

**Note:** Microsoft 365 GCC High is a separate environment from commercial Microsoft 365. Your organization must procure GCC High licenses separately.

#### Step 1: Obtain GCC High Tenant

**Eligibility:** U.S. federal agencies, DOD entities, and contractors supporting government work

1. Contact Microsoft Federal Sales or authorized reseller
2. Complete GCC High eligibility verification:
   - Government contract documentation
   - Proof of U.S. data residency requirements
   - Business justification for IL5 access
3. Procure Microsoft 365 GCC High licenses (E3 or E5 recommended)
4. Wait for tenant provisioning (5-10 business days)

**GCC High Tenant Characteristics:**
- Tenant domain: `*.onmicrosoft.us` (not `.com`)
- Admin portal: https://portal.office365.us
- Azure AD portal: https://portal.azure.us
- Graph API endpoint: `https://graph.microsoft.us`

#### Step 2: Verify GCC High Environment

```bash
# Test Graph API access to GCC High endpoint
curl https://graph.microsoft.us/v1.0/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success indicator:** Response from `graph.microsoft.us` (not `graph.microsoft.com`)

### 3.2 Create Test Users (GCC High)

**Note:** All user accounts must be created in the GCC High tenant.

1. Go to https://portal.office365.us
2. Sign in with GCC High admin account
3. Navigate to **Users** → **Active users** → **Add a user**
4. Create test users for each clearance level:

| Display Name | Email Prefix | Clearance Level | Purpose |
|-------------|-------------|-----------------|---------|
| UNCLASS User | unclass.user | UNCLASSIFIED | Testing UNCLASSIFIED access |
| CONF User | conf.user | CONFIDENTIAL | Testing CONFIDENTIAL access |
| SECRET User | secret.user | SECRET | Testing SECRET access |
| System Admin | system.admin | SECRET | Full system administration |

**For each user:**
- Assign **Microsoft 365 E5 GCC** license
- Assign to appropriate Azure AD groups (created in next section)
- Document clearance level in user profile

### 3.3 Create Azure AD Access Control Groups (GCC High)

#### Step 1: Navigate to Azure AD (GCC High)

1. Go to https://portal.azure.us
2. Sign in with GCC High admin account
3. Navigate to **Azure Active Directory** → **Groups** → **All groups**

#### Step 2: Create Clearance-Level Groups

**Group 1: UNCLASSIFIED Clearance**
- Group type: **Security**
- Group name: `Clearance-UNCLASSIFIED`
- Description: `Users cleared for UNCLASSIFIED meetings (no clearance required)`
- Membership type: **Assigned** (or Dynamic with clearance level attribute)
- Add members: All users

**Group 2: CONFIDENTIAL Clearance**
- Group type: **Security**
- Group name: `Clearance-CONFIDENTIAL`
- Description: `Users cleared for CONFIDENTIAL meetings (includes UNCLASSIFIED)`
- Membership type: **Assigned**
- Add members: conf.user, secret.user, system.admin

**Group 3: SECRET Clearance**
- Group type: **Security**
- Group name: `Clearance-SECRET`
- Description: `Users cleared for SECRET meetings (includes CONFIDENTIAL + UNCLASSIFIED)`
- Membership type: **Assigned**
- Add members: secret.user, system.admin

**Important:** Clearance groups are hierarchical. SECRET users can access CONFIDENTIAL and UNCLASSIFIED meetings. CONFIDENTIAL users can access UNCLASSIFIED meetings.

#### Step 3: Create Role Groups

**Group 4: Viewer Role**
- Group name: `Role-Viewer`
- Description: `Can view meetings they attended`
- Add members: unclass.user

**Group 5: Editor Role**
- Group name: `Role-Editor`
- Description: `Can edit minutes before approval`
- Add members: conf.user

**Group 6: Approver Role**
- Group name: `Role-Approver`
- Description: `Can approve/reject meeting minutes`
- Add members: conf.user, secret.user

**Group 7: Admin Role**
- Group name: `Role-Admin`
- Description: `Full system access and configuration`
- Add members: system.admin

#### Step 4: Document Group Membership in SSP

**System Security Plan (SSP) Documentation:**
- Document all Azure AD groups and their purpose
- Map groups to NIST SP 800-53 AC-2 (Account Management)
- Define group membership approval process
- Establish quarterly access review schedule

**Success indicator:** All 7 groups created with documented clearance requirements

### 3.4 Enable Custom Apps in Teams (GCC High)

1. Go to **Teams Admin Center:** https://admin.teams.microsoft.us
2. Navigate to **Teams apps** → **Setup policies** → **Global**
3. Under **Upload custom apps:** Toggle to **On**
4. Click **Save**
5. Wait up to 24 hours for changes to propagate

---

## 4. Azure AD Application Registration

### 4.1 Register Application in GCC High

#### Step 1: Create App Registration (Azure Government Portal)

1. Go to https://portal.azure.us
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **+ New registration**

#### Step 2: Configure Basic Settings

**Application name:** `DOD Meeting Minutes System`

**Supported account types:** 
- Select **Accounts in this organizational directory only (Single tenant)**

**Redirect URI:**
- Platform: **Web**
- URL: `https://meeting-minutes.youragency.mil/auth/callback` (update with your domain)
- Leave blank for now (update after infrastructure deployment)

Click **Register**

#### Step 3: Save Application IDs

**CRITICAL:** Copy and save these values immediately:

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (tenant) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GCC High Graph Endpoint: https://graph.microsoft.us
```

**Store in Azure Key Vault (Premium tier for FIPS 140-2 Level 2 compliance):**

```bash
# Create Key Vault (Premium tier for HSM support)
az keyvault create \
  --name kv-teams-minutes-prod \
  --resource-group rg-teams-minutes \
  --location usgovvirginia \
  --sku premium \
  --enable-rbac-authorization true

# Store application credentials
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name GraphClientId \
  --value "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 4.2 Create Client Secret

1. In your app, navigate to **Certificates & secrets**
2. Click **+ New client secret**
3. Configure:
   - Description: `DOD Meeting Minutes Secret - Expires 2027-11`
   - Expires: **24 months** (recommended for production)
4. Click **Add**
5. **IMMEDIATELY COPY THE SECRET VALUE** (shows only once!)

**Store in Key Vault:**

```bash
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name GraphClientSecret \
  --value "your-secret-value-here"
```

**⚠️ SECURITY:** Never store secrets in code, configuration files, or version control. Always use Azure Key Vault with RBAC.

### 4.3 Configure API Permissions (GCC High)

#### Step 1: Add Microsoft Graph Permissions

1. Navigate to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**

**IMPORTANT:** Verify you are granting permissions to GCC High Graph API (`graph.microsoft.us`), not commercial Graph API.

#### Step 2: Add Delegated Permissions (User context)

| Permission | Purpose | FedRAMP Control |
|-----------|---------|-----------------|
| `User.Read` | Read signed-in user profile | AC-2 (Account Management) |
| `OnlineMeetings.Read` | Read user's Teams meetings | AC-3 (Access Enforcement) |
| `Group.Read.All` | Read user's group memberships for clearance validation | AC-3 (Access Enforcement) |
| `Mail.Send` | Send email as signed-in user | AU-2 (Audit Events) |

#### Step 3: Add Application Permissions (Service context)

| Permission | Purpose | FedRAMP Control |
|-----------|---------|-----------------|
| `User.Read.All` | Read all users' profiles for attendee lookup | AC-2 (Account Management) |
| `Group.Read.All` | Read all group memberships for Azure AD sync | AC-3 (Access Enforcement) |
| `OnlineMeetings.Read.All` | Read all meetings via webhooks | AU-2 (Audit Events) |
| `Calendars.Read` | Read meeting schedules and metadata | AC-3 (Access Enforcement) |
| `Mail.Send` | Send minutes distribution emails | AU-10 (Non-Repudiation) |
| `Sites.Selected` | Access SharePoint sites for archival | AU-9 (Protection of Audit Information) |

#### Step 4: Grant Admin Consent

**CRITICAL:** Application permissions require tenant admin consent

1. Click **Grant admin consent for [Your Organization]**
2. Confirm by clicking **Yes**
3. Verify all permissions show **Granted** with green checkmarks

**Document in SSP:**
- List all granted permissions
- Justify each permission under least privilege principle (AC-6)
- Establish quarterly permission review process

### 4.4 Configure Authentication Settings

1. Navigate to **Authentication**
2. Under **Implicit grant and hybrid flows:**
   - ✅ Check **Access tokens**
   - ✅ Check **ID tokens**
3. Under **Advanced settings:**
   - Allow public client flows: **No** (production security)
   - Supported account types: **Single tenant only**
4. Click **Save**

**FedRAMP Mapping:**
- IA-2 (Identification and Authentication): Multi-factor authentication required
- AC-7 (Unsuccessful Logon Attempts): Enforced via Azure AD Conditional Access
- IA-5 (Authenticator Management): CAC/PIV authentication

---

## 5. Azure OpenAI GCC High Setup

### 5.1 Create Azure OpenAI Resource (GCC High)

**IMPORTANT:** Azure OpenAI for GCC High is a separate service from commercial Azure OpenAI. You must request access to Azure OpenAI for Government.

#### Step 1: Request Azure OpenAI for Government Access

1. Submit request: https://aka.ms/oai/govaccess
2. Provide:
   - Azure Government subscription ID
   - Use case description: "Automated meeting minutes generation for DOD"
   - Classification level: CONFIDENTIAL or SECRET
   - Estimated usage: Monthly meeting volume
3. Wait 5-10 business days for approval

**Success indicator:** Receive approval email from Microsoft

#### Step 2: Create Azure OpenAI Resource

1. Go to https://portal.azure.us
2. Search for "Azure OpenAI" in top search bar
3. Click **+ Create**

**Basics:**
- Subscription: Your Azure Government subscription
- Resource group: `rg-teams-minutes`
- Region: **USGov Virginia** or **USGov Arizona** (verify GPT-4 availability)
- Name: `aoai-minutes-prod-gov`
- Pricing tier: **Standard S0**

**Networking:**
- Network connectivity: **Private endpoint only** (IL5 requirement)
- Create private endpoint in each classification VNet

**Encryption:**
- Use customer-managed keys (CMK) stored in Azure Key Vault Premium
- Enable FIPS 140-2 Level 2 validation

Click **Review + create** → **Create**

Wait 3-5 minutes for deployment

#### Step 3: Deploy GPT-4o Model (GCC High)

1. Once created, click **Go to resource**
2. Navigate to **Model deployments** → **Manage Deployments**
   - This opens Azure OpenAI Studio for Government
3. Click **+ Create new deployment**
4. Configure:
   - Model: **gpt-4o** (or latest available model)
   - Deployment name: `gpt-4o-minutes`
   - Model version: Select latest
   - Deployment type: **Standard**
   - Tokens per Minute Rate Limit: **120K** (adjust based on load)
5. Click **Create**

#### Step 4: Get API Credentials

1. In Azure Portal, go to your Azure OpenAI resource
2. Navigate to **Keys and Endpoint**
3. **Save these values in Key Vault:**

```bash
# Store OpenAI credentials in Key Vault
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AzureOpenAIEndpoint \
  --value "https://aoai-minutes-prod-gov.openai.azure.us/"

az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AzureOpenAIKey \
  --value "your-api-key-here"

az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AzureOpenAIDeployment \
  --value "gpt-4o-minutes"
```

**FedRAMP Controls:**
- SC-8 (Transmission Confidentiality): TLS 1.2+ enforced
- SC-12 (Cryptographic Key Establishment): Customer-managed keys
- SC-13 (Cryptographic Protection): AES-256 encryption at rest

### 5.2 Configure Private Endpoint (IL5 Requirement)

```bash
# Create private endpoint for each classification VNet
az network private-endpoint create \
  --name pe-aoai-unclass \
  --resource-group rg-teams-minutes \
  --vnet-name vnet-unclass \
  --subnet pe-subnet \
  --private-connection-resource-id "/subscriptions/.../Microsoft.CognitiveServices/accounts/aoai-minutes-prod-gov" \
  --group-id account \
  --connection-name aoai-connection

# Disable public network access
az cognitiveservices account update \
  --name aoai-minutes-prod-gov \
  --resource-group rg-teams-minutes \
  --public-network-access Disabled
```

**Repeat for CONFIDENTIAL and SECRET VNets**

---

## 6. SharePoint IL5 Configuration

### 6.1 Create SharePoint Site (GCC High)

#### Step 1: Create Site Collection

1. Go to https://admin.microsoft.com (GCC High admin center)
2. Navigate to **Show all** → **SharePoint** → **Active sites**
3. Click **+ Create**
4. Select **Team site (classic)** for IL5 compliance
5. Configure:
   - Site name: `DOD Meeting Minutes`
   - Site address: `/sites/dod-meeting-minutes`
   - Primary administrator: System admin account
   - Language: English
   - Classification: **CONFIDENTIAL** or **SECRET** (based on max classification)
6. Click **Finish**

#### Step 2: Create Document Library with Classification Folders

1. Navigate to site: `https://yourtenant.sharepoint.us/sites/dod-meeting-minutes`
2. Click **+ New** → **Document library**
3. Name: `Minutes Archive IL5`
4. Description: `IL5-compliant automated meeting minutes storage`
5. Click **Create**

#### Step 3: Create Classification-Based Folder Structure

**IL5 Folder Hierarchy:**

```
/Minutes Archive IL5/
  ├─ UNCLASSIFIED/
  │   ├─ 2025/
  │   │   ├─ 01-January/
  │   │   ├─ 02-February/
  │   │   └─ ...
  ├─ CONFIDENTIAL/
  │   ├─ 2025/
  │   │   ├─ 01-January/
  │   │   ├─ 02-February/
  │   │   └─ ...
  └─ SECRET/
      ├─ 2025/
      │   ├─ 01-January/
      │   ├─ 02-February/
      │   └─ ...
```

**For each classification folder:**
1. Set unique permissions (break inheritance)
2. Add appropriate Azure AD clearance group
3. Remove all other groups except site owners

**CONFIDENTIAL folder permissions:**
- `Clearance-CONFIDENTIAL` group: Read + Write
- `Clearance-SECRET` group: Read + Write
- Site admins: Full Control
- Remove: Everyone, All Users, UNCLASSIFIED users

**SECRET folder permissions:**
- `Clearance-SECRET` group: Read + Write
- Site admins: Full Control
- Remove: Everyone, All Users, CONFIDENTIAL users, UNCLASSIFIED users

### 6.2 Grant Application Access (Sites.Selected Permission)

#### Step 1: Get Site ID

```bash
# Use Microsoft Graph API (GCC High endpoint)
curl -X GET "https://graph.microsoft.us/v1.0/sites/yourtenant.sharepoint.us:/sites/dod-meeting-minutes" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Extract site ID from response
SITE_ID="yourtenant.sharepoint.us,abc123,def456"
```

#### Step 2: Grant Permission via Graph API

```bash
# Grant write permission to application
curl -X POST "https://graph.microsoft.us/v1.0/sites/$SITE_ID/permissions" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["write"],
    "grantedToIdentities": [{
      "application": {
        "id": "YOUR_APP_CLIENT_ID",
        "displayName": "DOD Meeting Minutes System"
      }
    }]
  }'
```

**Success indicator:** Response with `id` and granted permission

### 6.3 Configure Information Rights Management (IRM)

**IL5 Requirement:** Enable IRM to prevent unauthorized download/print of classified documents

1. Navigate to **SharePoint Admin Center** (https://yourtenant-admin.sharepoint.us)
2. Go to **Settings** → **Information Rights Management**
3. Click **Use the IRM service specified in your configuration**
4. Enable for each classification folder:
   - Library settings → Information Rights Management
   - ✅ Restrict permissions on this library on download
   - Set expiration date for CONFIDENTIAL: **90 days**
   - Set expiration date for SECRET: **365 days**
   - ✅ Prevent printing
   - ✅ Encrypt document content

**FedRAMP Controls:**
- AC-4 (Information Flow Enforcement): Classification-based access
- MP-6 (Media Sanitization): Automatic expiration and deletion
- PE-3 (Physical Access Control): Print/download restrictions

---

## 7. Azure Government Production Deployment

### 7.1 Infrastructure Provisioning Overview

**IMPORTANT:** Production deployment uses a **multi-scale-unit App Service Environment (ASEv3) architecture** with horizontally sharded databases. This section provides an overview. For complete step-by-step Terraform/Bicep templates, see SCALABILITY_ARCHITECTURE.md Section 7.

**Production Architecture:**
- **12× App Service Environments (ASEv3):** Classification-segregated compute
  - UNCLASSIFIED: 6 ASEv3 units (baseline: 1, peak: 6)
  - CONFIDENTIAL: 4 ASEv3 units (baseline: 1, peak: 4)
  - SECRET: 2 ASEv3 units (baseline: 1, peak: 2)
- **12-Shard PostgreSQL Database:** Horizontally sharded by classification
  - UNCLASSIFIED: 6 shards with 2 read replicas each
  - CONFIDENTIAL: 4 shards with 2 read replicas each (HSM-backed encryption)
  - SECRET: 2 shards with 2 read replicas each (HSM-backed encryption, air-gapped)
- **Azure Front Door Premium:** Multi-region routing with WAF and DDoS protection
- **Azure Key Vault Premium:** HSM-backed key management (FIPS 140-2 Level 2)

### 7.2 Create Resource Groups

```bash
# Set Azure CLI to Government cloud
az cloud set --name AzureUSGovernment
az login

# Create primary resource group
az group create \
  --name rg-teams-minutes-prod \
  --location usgovvirginia \
  --tags Environment=Production Classification=SECRET Owner=ISSO

# Create classification-specific resource groups
az group create --name rg-teams-unclass --location usgovvirginia
az group create --name rg-teams-conf --location usgovvirginia
az group create --name rg-teams-secret --location usgovvirginia
```

### 7.3 Deploy Virtual Networks (Classification-Segregated)

```bash
# UNCLASSIFIED VNet
az network vnet create \
  --name vnet-teams-unclass \
  --resource-group rg-teams-unclass \
  --location usgovvirginia \
  --address-prefix 10.0.0.0/16 \
  --subnet-name subnet-app \
  --subnet-prefix 10.0.1.0/24

az network vnet subnet create \
  --name subnet-db \
  --resource-group rg-teams-unclass \
  --vnet-name vnet-teams-unclass \
  --address-prefix 10.0.2.0/24 \
  --service-endpoints Microsoft.Sql

az network vnet subnet create \
  --name subnet-pe \
  --resource-group rg-teams-unclass \
  --vnet-name vnet-teams-unclass \
  --address-prefix 10.0.3.0/24 \
  --private-endpoint-network-policies Disabled

# CONFIDENTIAL VNet (same structure, 10.10.0.0/16)
# SECRET VNet (same structure, 10.20.0.0/16, NO internet egress)
```

### 7.4 Deploy PostgreSQL Flexible Server (Horizontally Sharded)

**Baseline Deployment (10K users):**

```bash
# UNCLASSIFIED Shard 1 (of 6)
az postgres flexible-server create \
  --name psql-minutes-unclass-shard1 \
  --resource-group rg-teams-unclass \
  --location usgovvirginia \
  --sku-name GP_Gen5_4 \
  --tier GeneralPurpose \
  --version 15 \
  --storage-size 512 \
  --backup-retention 90 \
  --public-access None \
  --vnet vnet-teams-unclass \
  --subnet subnet-db

# Enable high availability
az postgres flexible-server update \
  --name psql-minutes-unclass-shard1 \
  --resource-group rg-teams-unclass \
  --high-availability Enabled \
  --standby-availability-zone 2

# Create read replicas
az postgres flexible-server replica create \
  --replica-name psql-minutes-unclass-shard1-replica1 \
  --resource-group rg-teams-unclass \
  --source-server psql-minutes-unclass-shard1 \
  --location usgovvirginia

# Repeat for shards 2-6 (UNCLASSIFIED)
```

**CONFIDENTIAL/SECRET Shards (with HSM-backed encryption):**

```bash
# CONFIDENTIAL Shard 1 (of 4)
az postgres flexible-server create \
  --name psql-minutes-conf-shard1 \
  --resource-group rg-teams-conf \
  --location usgovvirginia \
  --sku-name GP_Gen5_4 \
  --tier GeneralPurpose \
  --version 15 \
  --storage-size 512 \
  --backup-retention 365 \
  --public-access None \
  --vnet vnet-teams-conf \
  --subnet subnet-db

# Enable customer-managed key encryption
az postgres flexible-server key create \
  --server-name psql-minutes-conf-shard1 \
  --resource-group rg-teams-conf \
  --kid "https://kv-teams-minutes-prod.vault.usgovcloudapi.net/keys/psql-conf-key/abc123"

# Repeat for shards 1-4 (CONFIDENTIAL)
# Repeat for shards 1-2 (SECRET)
```

**FedRAMP Controls:**
- CP-9 (Information System Backup): 90-day retention (UNCLASS), 365-day (CONF/SECRET)
- SC-12 (Cryptographic Key Establishment): Customer-managed keys (CMK)
- SC-28 (Protection of Information at Rest): AES-256 encryption with HSM backing

### 7.5 Deploy App Service Environment v3 (ASEv3)

**Baseline Deployment (3 ASEv3 units):**

```bash
# UNCLASSIFIED ASEv3
az appservice ase create \
  --name ase-minutes-unclass \
  --resource-group rg-teams-unclass \
  --vnet-name vnet-teams-unclass \
  --subnet subnet-app \
  --kind ASEv3 \
  --location usgovvirginia \
  --allow-incoming-ftp-connections false \
  --allow-new-private-endpoint-connections true

# Create App Service Plan (Isolated tier)
az appservice plan create \
  --name plan-minutes-unclass \
  --resource-group rg-teams-unclass \
  --app-service-environment ase-minutes-unclass \
  --sku I3v2 \
  --number-of-workers 12 \
  --is-linux

# Create Web App
az webapp create \
  --name app-minutes-unclass \
  --resource-group rg-teams-unclass \
  --plan plan-minutes-unclass \
  --runtime "NODE:20-lts"

# Repeat for CONFIDENTIAL and SECRET ASEv3
```

**Auto-Scaling Configuration:**

```bash
# Configure auto-scale for UNCLASSIFIED (baseline: 12 instances, max: 100)
az monitor autoscale create \
  --resource-group rg-teams-unclass \
  --resource app-minutes-unclass \
  --resource-type Microsoft.Web/sites \
  --name autoscale-unclass \
  --min-count 12 \
  --max-count 100 \
  --count 12

# Add CPU-based scaling rule
az monitor autoscale rule create \
  --resource-group rg-teams-unclass \
  --autoscale-name autoscale-unclass \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 10

az monitor autoscale rule create \
  --resource-group rg-teams-unclass \
  --autoscale-name autoscale-unclass \
  --condition "Percentage CPU < 30 avg 10m" \
  --scale in 5

# Repeat for CONFIDENTIAL and SECRET with appropriate thresholds
```

### 7.6 Deploy Azure Front Door Premium

```bash
# Create Front Door profile
az afd profile create \
  --profile-name fd-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --sku Premium_AzureFrontDoor

# Create endpoint
az afd endpoint create \
  --resource-group rg-teams-minutes-prod \
  --profile-name fd-minutes-prod \
  --endpoint-name minutes-prod \
  --enabled-state Enabled

# Create origin group for each classification
az afd origin-group create \
  --resource-group rg-teams-minutes-prod \
  --profile-name fd-minutes-prod \
  --origin-group-name og-unclass \
  --probe-path "/health" \
  --probe-protocol Https \
  --probe-interval-in-seconds 30 \
  --sample-size 4 \
  --successful-samples-required 3

# Add origins (UNCLASSIFIED ASEv3)
az afd origin create \
  --resource-group rg-teams-minutes-prod \
  --profile-name fd-minutes-prod \
  --origin-group-name og-unclass \
  --origin-name origin-unclass-ase1 \
  --host-name app-minutes-unclass.azurewebsites.us \
  --origin-host-header app-minutes-unclass.azurewebsites.us \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled \
  --http-port 80 \
  --https-port 443

# Configure WAF policy
az network front-door waf-policy create \
  --name waf-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --mode Prevention \
  --sku Premium_AzureFrontDoor

# Enable managed rule sets (OWASP 3.2)
az network front-door waf-policy managed-rules add \
  --policy-name waf-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --type Microsoft_DefaultRuleSet \
  --version 2.1

# Repeat for CONFIDENTIAL and SECRET origin groups
```

**FedRAMP Controls:**
- SC-5 (Denial of Service Protection): DDoS protection via Front Door
- SC-7 (Boundary Protection): WAF with OWASP rules
- SI-4 (Information System Monitoring): Front Door diagnostics and alerts

### 7.7 Configure Key Vault and Secrets Management

```bash
# Create Key Vault (Premium tier for HSM)
az keyvault create \
  --name kv-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --location usgovvirginia \
  --sku premium \
  --enable-rbac-authorization true \
  --enable-purge-protection true \
  --retention-days 90

# Create HSM-backed keys for CONFIDENTIAL/SECRET data
az keyvault key create \
  --vault-name kv-minutes-prod \
  --name key-db-conf \
  --kty RSA-HSM \
  --size 4096 \
  --ops encrypt decrypt wrapKey unwrapKey

az keyvault key create \
  --vault-name kv-minutes-prod \
  --name key-db-secret \
  --kty RSA-HSM \
  --size 4096 \
  --ops encrypt decrypt wrapKey unwrapKey

# Store application secrets
az keyvault secret set --vault-name kv-minutes-prod --name GraphClientId --value "..."
az keyvault secret set --vault-name kv-minutes-prod --name GraphClientSecret --value "..."
az keyvault secret set --vault-name kv-minutes-prod --name AzureOpenAIKey --value "..."

# Grant App Service managed identity access
az keyvault set-policy \
  --name kv-minutes-prod \
  --object-id $(az webapp identity show --name app-minutes-unclass --resource-group rg-teams-unclass --query principalId -o tsv) \
  --secret-permissions get list
```

**FedRAMP Controls:**
- SC-12 (Cryptographic Key Establishment): HSM-backed key generation
- SC-13 (Cryptographic Protection): FIPS 140-2 Level 2 validated
- SC-28 (Protection of Information at Rest): Customer-managed keys

### 7.8 Deploy Application Code

```bash
# Build application (from CI/CD pipeline)
npm install
npm run build

# Create deployment package
zip -r app.zip .

# Deploy to each ASEv3
az webapp deployment source config-zip \
  --resource-group rg-teams-unclass \
  --name app-minutes-unclass \
  --src app.zip

# Configure environment variables from Key Vault
az webapp config appsettings set \
  --resource-group rg-teams-unclass \
  --name app-minutes-unclass \
  --settings \
    GRAPH_CLIENT_ID="@Microsoft.KeyVault(SecretUri=https://kv-minutes-prod.vault.usgovcloudapi.net/secrets/GraphClientId/)" \
    GRAPH_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-minutes-prod.vault.usgovcloudapi.net/secrets/GraphClientSecret/)" \
    AZURE_OPENAI_KEY="@Microsoft.KeyVault(SecretUri=https://kv-minutes-prod.vault.usgovcloudapi.net/secrets/AzureOpenAIKey/)" \
    NODE_ENV="production" \
    CLASSIFICATION_LEVEL="UNCLASSIFIED"

# Repeat for CONFIDENTIAL and SECRET ASEv3 with appropriate CLASSIFICATION_LEVEL
```

### 7.9 Run Database Migrations

```bash
# Connect to each database shard and run migrations
for shard in {1..6}; do
  export DATABASE_URL="postgresql://admin@psql-minutes-unclass-shard${shard}:password@psql-minutes-unclass-shard${shard}.postgres.database.usgovcloudapi.net/meetingminutes?sslmode=require"
  
  npx drizzle-kit push:pg
done

# Repeat for CONFIDENTIAL shards (1-4)
# Repeat for SECRET shards (1-2)
```

**Success indicator:** All database schemas deployed, application starts without errors

---

## 8. Classification and Access Control Setup

### 8.1 Configure Classification-Based Routing

**Application Logic (server/middleware/classificationRouter.ts):**

```typescript
import { Request, Response, NextFunction } from 'express';

export function classificationRouter(req: Request, res: Response, next: NextFunction) {
  const meetingClassification = req.body.classification || req.query.classification;
  
  // Route to appropriate backend based on classification
  switch(meetingClassification) {
    case 'SECRET':
      // Route to SECRET ASEv3 cluster (10.20.x.x)
      req.headers['X-Backend-Pool'] = 'secret';
      break;
    case 'CONFIDENTIAL':
      // Route to CONFIDENTIAL ASEv3 cluster (10.10.x.x)
      req.headers['X-Backend-Pool'] = 'confidential';
      break;
    case 'UNCLASSIFIED':
    default:
      // Route to UNCLASSIFIED ASEv3 cluster (10.0.x.x)
      req.headers['X-Backend-Pool'] = 'unclassified';
      break;
  }
  
  next();
}
```

**Azure Front Door Routing Rules:**

```bash
# Create routing rule for SECRET traffic
az afd route create \
  --resource-group rg-teams-minutes-prod \
  --profile-name fd-minutes-prod \
  --endpoint-name minutes-prod \
  --route-name route-secret \
  --origin-group og-secret \
  --patterns-to-match "/api/meetings?classification=SECRET" \
  --rule-sets [] \
  --supported-protocols Https \
  --https-redirect Enabled

# Repeat for CONFIDENTIAL and UNCLASSIFIED
```

### 8.2 Implement Clearance-Level Access Control

**Middleware (server/middleware/clearanceCheck.ts):**

```typescript
import { Request, Response, NextFunction } from 'express';
import { getUserClearanceLevel } from '../services/accessControl';

const CLEARANCE_HIERARCHY = {
  'UNCLASSIFIED': 0,
  'CONFIDENTIAL': 1,
  'SECRET': 2
};

export async function requireClearance(requiredLevel: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // From Azure AD authentication
    
    // Get user's clearance from Azure AD group membership
    const userClearance = await getUserClearanceLevel(user.id);
    
    // Check hierarchical access
    if (CLEARANCE_HIERARCHY[userClearance] >= CLEARANCE_HIERARCHY[requiredLevel]) {
      next();
    } else {
      res.status(403).json({
        error: 'Insufficient clearance',
        required: requiredLevel,
        user: userClearance
      });
    }
  };
}

// Usage in routes:
app.get('/api/meetings/secret', requireClearance('SECRET'), async (req, res) => {
  // Only users with SECRET clearance can access
});
```

**Azure AD Group Sync (server/services/graphGroupSync.ts):**

```typescript
import { Client } from '@microsoft/microsoft-graph-client';

export async function syncUserClearance(userId: string): Promise<string> {
  const client = getGraphClient(); // Authenticated client
  
  // Get user's group memberships
  const groups = await client
    .api(`/users/${userId}/memberOf`)
    .get();
  
  // Check clearance groups (hierarchical)
  const groupNames = groups.value.map((g: any) => g.displayName);
  
  if (groupNames.includes('Clearance-SECRET')) {
    return 'SECRET';
  } else if (groupNames.includes('Clearance-CONFIDENTIAL')) {
    return 'CONFIDENTIAL';
  } else {
    return 'UNCLASSIFIED';
  }
}
```

**FedRAMP Controls:**
- AC-3 (Access Enforcement): Clearance-based access control
- AC-6 (Least Privilege): Users only access data at their clearance level
- AC-16 (Security Attributes): Classification markings enforced

### 8.3 Database Shard Assignment by Classification

**Shard Router (server/services/dbShardRouter.ts):**

```typescript
export function getDatabaseShardForClassification(classification: string, meetingId: string): string {
  const shardCount = {
    'UNCLASSIFIED': 6,
    'CONFIDENTIAL': 4,
    'SECRET': 2
  };
  
  // Hash meeting ID to determine shard
  const hash = hashCode(meetingId);
  const shardIndex = (hash % shardCount[classification]) + 1;
  
  // Return connection string for appropriate shard
  return process.env[`DATABASE_URL_${classification}_SHARD${shardIndex}`];
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

**Environment Variable Configuration:**

```bash
# UNCLASSIFIED shards
DATABASE_URL_UNCLASSIFIED_SHARD1="postgresql://...psql-minutes-unclass-shard1..."
DATABASE_URL_UNCLASSIFIED_SHARD2="postgresql://...psql-minutes-unclass-shard2..."
# ...SHARD3-6

# CONFIDENTIAL shards
DATABASE_URL_CONFIDENTIAL_SHARD1="postgresql://...psql-minutes-conf-shard1..."
DATABASE_URL_CONFIDENTIAL_SHARD2="postgresql://...psql-minutes-conf-shard2..."
# ...SHARD3-4

# SECRET shards
DATABASE_URL_SECRET_SHARD1="postgresql://...psql-minutes-secret-shard1..."
DATABASE_URL_SECRET_SHARD2="postgresql://...psql-minutes-secret-shard2..."
```

---

## 9. FedRAMP Compliance Configuration

### 9.1 Audit Logging Configuration

**Azure Monitor Log Analytics (FedRAMP-compliant):**

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name law-minutes-prod \
  --location usgovvirginia \
  --retention-time 365 \
  --sku PerGB2018

# Enable diagnostic settings for all resources
for resource in app-minutes-unclass app-minutes-conf app-minutes-secret; do
  az monitor diagnostic-settings create \
    --name diag-${resource} \
    --resource /subscriptions/.../Microsoft.Web/sites/${resource} \
    --workspace law-minutes-prod \
    --logs '[{"category":"AppServiceHTTPLogs","enabled":true},
            {"category":"AppServiceConsoleLogs","enabled":true},
            {"category":"AppServiceAppLogs","enabled":true}]' \
    --metrics '[{"category":"AllMetrics","enabled":true}]'
done
```

**Application-Level Audit Logging (server/services/auditLogger.ts):**

```typescript
import { AppInsights } from 'applicationinsights';

export function logAuditEvent(event: {
  userId: string;
  action: string;
  resource: string;
  classification: string;
  result: 'SUCCESS' | 'FAILURE';
  ipAddress: string;
}) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId: event.userId,
    action: event.action,
    resource: event.resource,
    classification: event.classification,
    result: event.result,
    ipAddress: event.ipAddress,
    userAgent: req.headers['user-agent']
  };
  
  // Send to Log Analytics via Application Insights
  appInsights.defaultClient.trackEvent({
    name: 'AuditEvent',
    properties: auditLog
  });
  
  // Also write to immutable blob storage for SECRET classification
  if (event.classification === 'SECRET') {
    writeToImmutableStorage(auditLog);
  }
}

// Usage:
logAuditEvent({
  userId: req.user.id,
  action: 'APPROVE_MINUTES',
  resource: `/api/meetings/${meetingId}/approve`,
  classification: 'SECRET',
  result: 'SUCCESS',
  ipAddress: req.ip
});
```

**Immutable Audit Storage (for SECRET classification):**

```bash
# Create storage account with immutable blob storage
az storage account create \
  --name stminutesauditsecret \
  --resource-group rg-teams-secret \
  --location usgovvirginia \
  --sku Standard_GRS \
  --kind StorageV2 \
  --enable-hierarchical-namespace false \
  --allow-blob-public-access false

# Create container with immutability policy
az storage container create \
  --name audit-logs-secret \
  --account-name stminutesauditsecret \
  --public-access off

az storage container immutability-policy create \
  --account-name stminutesauditsecret \
  --container-name audit-logs-secret \
  --period 365 \
  --policy-mode Locked
```

**FedRAMP Controls:**
- AU-2 (Audit Events): All security-relevant events logged
- AU-3 (Content of Audit Records): Complete audit trail with user, action, timestamp
- AU-9 (Protection of Audit Information): Immutable storage for SECRET audit logs
- AU-11 (Audit Record Retention): 365-day retention for SECRET, 90-day for UNCLASS

### 9.2 Incident Response Configuration

**Azure Sentinel Integration (SIEM):**

```bash
# Enable Azure Sentinel
az sentinel workspace create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name sentinel-minutes-prod

# Create analytics rules for security incidents
az sentinel alert-rule create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name sentinel-minutes-prod \
  --rule-name "Failed Login Attempts" \
  --description "Detect 5+ failed login attempts within 5 minutes" \
  --query "SigninLogs | where ResultType != 0 | summarize FailedAttempts=count() by UserPrincipalName, bin(TimeGenerated, 5m) | where FailedAttempts >= 5" \
  --severity High \
  --trigger-threshold 1

az sentinel alert-rule create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name sentinel-minutes-prod \
  --rule-name "Classification Violation" \
  --description "Detect access to meeting above user clearance" \
  --query "AppServiceConsoleLogs | where Message contains 'Insufficient clearance'" \
  --severity Critical \
  --trigger-threshold 1
```

**Incident Response Automation (server/services/incidentResponse.ts):**

```typescript
export async function handleSecurityIncident(incident: {
  type: 'CLEARANCE_VIOLATION' | 'FAILED_LOGIN' | 'DATA_BREACH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  details: string;
}) {
  // Log to immutable audit storage
  logAuditEvent({
    userId: incident.userId,
    action: `SECURITY_INCIDENT_${incident.type}`,
    resource: 'SYSTEM',
    classification: 'SECRET',
    result: 'FAILURE',
    ipAddress: req.ip
  });
  
  // Notify ISSO/ISSM immediately for CRITICAL incidents
  if (incident.severity === 'CRITICAL') {
    await sendAlertEmail({
      to: process.env.ISSO_EMAIL,
      subject: `CRITICAL SECURITY INCIDENT: ${incident.type}`,
      body: incident.details
    });
    
    // Automatically disable user account for clearance violations
    if (incident.type === 'CLEARANCE_VIOLATION') {
      await disableUserAccount(incident.userId);
    }
  }
  
  // Create Sentinel incident
  await createSentinelIncident(incident);
}
```

**FedRAMP Controls:**
- IR-4 (Incident Handling): Automated incident detection and response
- IR-5 (Incident Monitoring): Real-time SIEM alerts
- IR-6 (Incident Reporting): Automatic notification to ISSO/ISSM

### 9.3 Continuous Monitoring

**Azure Monitor Alerts:**

```bash
# CPU alert for auto-scaling validation
az monitor metrics alert create \
  --name alert-cpu-high \
  --resource-group rg-teams-unclass \
  --scopes /subscriptions/.../Microsoft.Web/sites/app-minutes-unclass \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email ISSO@agency.mil

# Database connection alert
az monitor metrics alert create \
  --name alert-db-connections \
  --resource-group rg-teams-unclass \
  --scopes /subscriptions/.../Microsoft.DBforPostgreSQL/flexibleServers/psql-minutes-unclass-shard1 \
  --condition "max active_connections > 900" \
  --window-size 5m \
  --evaluation-frequency 1m

# Failed authentication alert
az monitor metrics alert create \
  --name alert-auth-failures \
  --resource-group rg-teams-minutes-prod \
  --scopes /subscriptions/.../Microsoft.Web/sites/app-minutes-unclass \
  --condition "total Http4xx > 50" \
  --window-size 5m \
  --evaluation-frequency 1m
```

**FedRAMP Controls:**
- SI-4 (Information System Monitoring): Real-time monitoring of all components
- CA-7 (Continuous Monitoring): Automated alerts for security events

---

## 10. ATO Process and Timeline

### 10.1 ATO Process Overview

**Total Duration:** 16 months from commercial deployment completion

**Key Roles:**
- **Authorizing Official (AO):** Makes final authorization decision
- **ISSO (Information System Security Officer):** Day-to-day security management
- **ISSM (Information System Security Manager):** Security program oversight
- **3PAO (Third Party Assessment Organization):** Independent security assessment
- **System Owner:** DOD organization deploying the system

### 10.2 Phase 1: Security Assessment (Months 1-6)

#### Month 1: 3PAO Selection and Planning

**Activities:**
- Issue RFP for FedRAMP-accredited 3PAO
- Evaluate 3PAO proposals (technical expertise, government experience)
- Award contract to selected 3PAO
- Kickoff meeting with 3PAO, ISSO, ISSM, AO

**Deliverables:**
- 3PAO contract executed
- Security Assessment Plan (SAP) draft initiated

**Cost:** $75K-$125K (3PAO assessment fee)

#### Month 2-3: Security Assessment Plan (SAP) Development

**Activities:**
- 3PAO creates Security Assessment Plan (SAP)
- Define assessment scope: All FedRAMP High controls (421 controls)
- Identify assessment methods: Interview, examine, test
- Schedule assessment activities (4 weeks)
- AO reviews and approves SAP

**Deliverables:**
- Security Assessment Plan (SAP) - **APPROVED**
- Assessment schedule and logistics plan

#### Month 3-4: Security Assessment Execution

**Assessment Activities (4 weeks):**

**Week 1: Documentation Review**
- System Security Plan (SSP) review
- Configuration Management Plan review
- Incident Response Plan review
- Contingency Plan review
- Policy and procedure documentation

**Week 2: Technical Testing**
- Vulnerability scanning (Tenable Nessus, Qualys)
- Configuration compliance testing (CIS benchmarks)
- Access control testing (Azure AD, RBAC)
- Encryption validation (TLS 1.2+, AES-256)
- Audit log verification

**Week 3: Penetration Testing**
- External penetration testing (Azure Front Door, public endpoints)
- Internal penetration testing (classification boundary violations)
- Social engineering testing (phishing, insider threat)
- Physical security assessment (if applicable)

**Week 4: Interviews and Evidence Collection**
- ISSO/ISSM interviews
- Developer interviews
- System administrator interviews
- Evidence collection for all controls

**Deliverables:**
- Raw assessment data
- Vulnerability scan reports
- Penetration test reports

#### Month 5-6: Security Assessment Report (SAR) Generation

**Activities:**
- 3PAO analyzes assessment data
- Identifies control gaps and weaknesses
- Assigns risk ratings: LOW, MODERATE, HIGH, CRITICAL
- Drafts Security Assessment Report (SAR)
- System Owner reviews SAR findings
- Remediation of CRITICAL and HIGH findings

**Expected Findings (based on current architecture):**
- **CRITICAL:** 0 expected
- **HIGH:** 5-10 findings (e.g., missing POA&M items, configuration drift)
- **MODERATE:** 15-25 findings (e.g., documentation gaps, process improvements)
- **LOW:** 30-50 findings (e.g., minor policy clarifications)

**Deliverables:**
- Security Assessment Report (SAR) - **FINAL**
- Remediation evidence for CRITICAL/HIGH findings

**Cost:** Included in 3PAO assessment fee

### 10.3 Phase 2: Documentation and Governance (Months 7-12)

#### Month 7-8: System Security Plan (SSP) Finalization

**Activities:**
- Update SSP based on SAR findings
- Document all 421 FedRAMP High controls
- Include architecture diagrams, data flow diagrams
- Document classification handling procedures
- Describe continuous monitoring strategy

**SSP Sections:**
1. System Identification
2. System Categorization (FIPS 199: HIGH)
3. Security Controls (NIST SP 800-53 Rev 5)
4. Control Implementation Details
5. System Architecture
6. Interconnections and Interfaces
7. Laws, Regulations, and Policies

**Deliverables:**
- System Security Plan (SSP) - **FINAL** (500-800 pages)

#### Month 9-10: Plan of Action & Milestones (POA&M) Management

**Activities:**
- Create POA&M for all MODERATE and LOW findings
- Assign remediation owners and due dates
- Track remediation progress weekly
- Close out completed POA&M items
- Justify risk acceptance for deferred items

**POA&M Template:**

| Finding ID | Risk Rating | Control | Description | Remediation Plan | Owner | Due Date | Status |
|-----------|-------------|---------|-------------|------------------|-------|----------|--------|
| SAR-001 | MODERATE | AC-2 | Missing quarterly access review | Implement automated quarterly review process | ISSO | Month 10 | In Progress |
| SAR-002 | LOW | CM-2 | Configuration baseline documentation incomplete | Complete baseline documentation | System Admin | Month 9 | Closed |

**Deliverables:**
- Plan of Action & Milestones (POA&M) - **ACTIVE**

#### Month 11-12: Incident Response and Contingency Plan Testing

**Activities:**
- Execute tabletop incident response exercise
- Simulate security incidents (clearance violation, data breach, DDoS)
- Validate incident escalation to DC3 (DOD Cyber Crime Center)
- Test contingency plan (database failover, ASEv3 failover)
- Validate backup restoration (RPO < 24 hours, RTO < 4 hours)
- Document lessons learned

**Test Scenarios:**
1. **Clearance Violation:** User attempts to access SECRET meeting without clearance
2. **Data Breach:** Simulated exfiltration of CONFIDENTIAL data
3. **Service Disruption:** ASEv3 outage in UNCLASSIFIED region
4. **Database Corruption:** PostgreSQL shard failure requiring restoration

**Deliverables:**
- Incident Response Plan (IRP) - **TESTED**
- Contingency Plan (CP) - **TESTED**
- After-Action Report (AAR) with lessons learned

**FedRAMP Controls:**
- IR-4 (Incident Handling): Validated incident response procedures
- CP-2 (Contingency Plan): Validated recovery procedures
- CP-10 (Information System Recovery and Reconstitution): RPO/RTO validated

### 10.4 Phase 3: Authorization (Months 13-16)

#### Month 13-14: ATO Package Submission

**ATO Package Contents:**
1. System Security Plan (SSP)
2. Security Assessment Report (SAR) from 3PAO
3. Plan of Action & Milestones (POA&M)
4. Incident Response Plan (IRP)
5. Contingency Plan (CP)
6. Configuration Management Plan (CMP)
7. Continuous Monitoring Strategy
8. Interconnection Security Agreements (ISAs)
9. FedRAMP Readiness Assessment Report (RAR)
10. Authorization Boundary Diagram

**Submission Process:**
1. Internal review by ISSO/ISSM
2. Legal review for compliance
3. Executive summary for AO
4. Formal submission to Authorizing Official (AO)

**Deliverables:**
- Complete ATO Package - **SUBMITTED**

#### Month 15: AO Review and Risk Assessment

**Activities:**
- AO reviews ATO package
- Risk assessment by AO's security staff
- Clarifying questions from AO to System Owner
- Additional evidence collection if needed
- AO prepares authorization decision document

**Risk Acceptance Considerations:**
- Residual risks from POA&M items
- Operational necessity vs. security risk
- Compensating controls effectiveness
- Mission impact of delayed authorization

**Potential Outcomes:**
1. **Full ATO (3 years):** All controls satisfied, minimal risk
2. **ATO with Conditions (1 year):** Moderate risk, POA&M must be completed
3. **Denial:** Unacceptable risk, major deficiencies

**Expected Outcome:** ATO with Conditions (1 year) - 80% likelihood

#### Month 16: Authorization Decision and Production Transition

**Activities:**
- AO signs Authorization to Operate (ATO) memo
- ISSO initiates continuous monitoring
- System transitions to production operations
- Monthly POA&M reporting to AO
- Annual FedRAMP assessment scheduling

**Deliverables:**
- **Authorization to Operate (ATO) Memo - SIGNED**
- Production operations handoff to DOD IT team

**Success Criteria:**
- ✅ FedRAMP High ATO obtained
- ✅ System operational in Azure Government (GCC High)
- ✅ All CRITICAL and HIGH findings remediated
- ✅ Continuous monitoring established
- ✅ POA&M tracking process active

### 10.5 Post-ATO Continuous Monitoring (Ongoing)

**Monthly Activities:**
- Vulnerability scanning (Tenable Nessus)
- POA&M status reporting to AO
- Security incident review
- Configuration change review

**Quarterly Activities:**
- Access review (user accounts, clearances)
- Security control sampling
- Risk assessment updates

**Annual Activities:**
- 3PAO re-assessment (FedRAMP requirement)
- ATO renewal decision by AO
- SSP updates for architecture changes

**FedRAMP Controls:**
- CA-2 (Security Assessments): Annual re-assessment
- CA-7 (Continuous Monitoring): Monthly vulnerability scanning
- RA-5 (Vulnerability Scanning): Authenticated scanning every 30 days

---

## 11. Post-Deployment Validation

### 11.1 Functional Testing

**Test Scenario 1: End-to-End Meeting Capture (UNCLASSIFIED)**

1. **Setup:**
   - Login as `unclass.user@youragency.onmicrosoft.us`
   - Schedule Teams meeting with 3 attendees
   - Enable recording
   - Set classification: UNCLASSIFIED

2. **Execute:**
   - Conduct meeting for 15 minutes
   - Discuss sample agenda items
   - End meeting and stop recording

3. **Verify:**
   - ✅ Meeting auto-captured within 30 minutes
   - ✅ Transcript generated
   - ✅ Minutes generated with action items
   - ✅ Meeting appears in dashboard (UNCLASSIFIED classification)
   - ✅ Email distribution sent to attendees
   - ✅ Document archived to SharePoint: `/UNCLASSIFIED/2025/11-November/`

**Test Scenario 2: Classification Enforcement (CONFIDENTIAL)**

1. **Setup:**
   - Login as `unclass.user` (no CONFIDENTIAL clearance)
   - Attempt to access CONFIDENTIAL meeting minutes

2. **Execute:**
   - Navigate to `/api/meetings/{confidential-meeting-id}`

3. **Verify:**
   - ✅ HTTP 403 Forbidden
   - ✅ Error message: "Insufficient clearance"
   - ✅ Audit log entry created
   - ✅ Security alert triggered (if >3 attempts)

**Test Scenario 3: SECRET Meeting with Approval Workflow**

1. **Setup:**
   - Login as `secret.user@youragency.onmicrosoft.us`
   - Schedule SECRET meeting
   - Conduct and record meeting

2. **Execute:**
   - Wait for minutes generation
   - Login as approver: `system.admin@youragency.onmicrosoft.us`
   - Review minutes in approval queue
   - Click "Approve"

3. **Verify:**
   - ✅ Approval workflow completes
   - ✅ Email sent to all attendees (with SECRET clearance only)
   - ✅ Document archived to SharePoint: `/SECRET/2025/11-November/`
   - ✅ Document has SECRET classification banner
   - ✅ IRM enabled (print disabled, expiration set to 365 days)

### 11.2 Security Testing

**Test 1: Network Segmentation Validation**

```bash
# From UNCLASSIFIED ASEv3, attempt to connect to SECRET database
az webapp ssh --resource-group rg-teams-unclass --name app-minutes-unclass

# Inside SSH session:
nc -zv psql-minutes-secret-shard1.postgres.database.usgovcloudapi.net 5432
```

**Expected Result:** Connection REFUSED (network isolation verified)

**Test 2: Encryption in Transit**

```bash
# Verify TLS 1.2+ enforcement
nmap --script ssl-enum-ciphers -p 443 minutes-prod.azurefd.net

# Expected output:
# TLSv1.2+
# No weak ciphers (RC4, 3DES, etc.)
```

**Test 3: Authentication Bypass Attempt**

```bash
# Attempt to access API without authentication
curl -X GET https://minutes-prod.azurefd.net/api/meetings

# Expected: HTTP 401 Unauthorized
```

### 11.3 Performance Testing

**Load Test Configuration:**

```bash
# Install Azure Load Testing
az extension add --name load

# Create load test for baseline (10K concurrent users)
az load test create \
  --name loadtest-minutes-10k \
  --resource-group rg-teams-minutes-prod \
  --load-test-config-file loadtest-config.yaml

# loadtest-config.yaml:
# version: v0.1
# testName: Meeting Minutes Load Test
# testPlan: jmeter-test-plan.jmx
# engineInstances: 10
# properties:
#   userThreads: 1000
#   rampUpPeriod: 300
#   duration: 1800
```

**Performance Acceptance Criteria:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Response Time (p95)** | <2 seconds | Dashboard page load |
| **Response Time (p99)** | <5 seconds | Minutes generation API |
| **Throughput** | 10K concurrent users | Sustained load for 30 minutes |
| **Error Rate** | <0.1% | HTTP 5xx errors |
| **Auto-Scaling** | <3 minutes | Time to scale from 12 to 24 instances |

**Success Criteria:**
- ✅ All metrics within target thresholds
- ✅ No database deadlocks or connection pool exhaustion
- ✅ Auto-scaling triggered correctly at 70% CPU
- ✅ No memory leaks (heap usage stable over 30 minutes)

### 11.4 Compliance Validation

**Checklist:**

- [ ] **AU-2:** All security-relevant events logged
- [ ] **AU-3:** Audit logs contain user, timestamp, action, result
- [ ] **AU-9:** Audit logs stored in immutable storage (SECRET classification)
- [ ] **AC-2:** User accounts tied to Azure AD groups
- [ ] **AC-3:** Classification-based access control enforced
- [ ] **AC-6:** Least privilege enforced (users only access their clearance level)
- [ ] **IA-2:** Multi-factor authentication required (Azure AD Conditional Access)
- [ ] **SC-8:** TLS 1.2+ in transit
- [ ] **SC-28:** AES-256 at rest
- [ ] **SC-12:** Customer-managed keys (CMK) for CONFIDENTIAL/SECRET

**Validation Method:**

```bash
# Verify audit logging enabled
az monitor diagnostic-settings list --resource /subscriptions/.../Microsoft.Web/sites/app-minutes-unclass

# Verify encryption at rest (database)
az postgres flexible-server show --name psql-minutes-conf-shard1 --resource-group rg-teams-conf --query "dataEncryption"

# Expected output:
# {
#   "type": "AzureKeyVault",
#   "primaryKeyURI": "https://kv-minutes-prod.vault.usgovcloudapi.net/keys/psql-conf-key/abc123"
# }
```

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Issue: "Failed to authenticate with Azure AD (GCC High)"

**Symptoms:** Login fails, shows error page

**Solutions:**
1. Verify redirect URI matches exactly (including trailing slash)
2. Check client secret is correct and not expired
3. Verify tenant ID is correct (.onmicrosoft.us tenant)
4. Confirm Graph API endpoint is `https://graph.microsoft.us` (not `.com`)
5. Check browser allows cookies from domain

#### Issue: "Database connection failed to sharded PostgreSQL"

**Symptoms:** App crashes on startup, health check fails

**Solutions:**
1. Verify DATABASE_URL for each shard is correct
2. Check Azure NSG rules allow traffic from App Service subnet to database subnet
3. Verify database user has correct permissions
4. Check private endpoint connection is established
5. Verify database firewall rules allow App Service VNET
6. Test connectivity from App Service SSH:
   ```bash
   az webapp ssh --name app-minutes-unclass --resource-group rg-teams-unclass
   psql $DATABASE_URL_UNCLASSIFIED_SHARD1 -c "SELECT 1;"
   ```

#### Issue: "Azure OpenAI GCC High API error 401"

**Symptoms:** Minutes generation fails

**Solutions:**
1. Verify API key is correct and stored in Key Vault
2. Check endpoint URL format: `https://resource.openai.azure.us/` (not `.com`)
3. Verify deployment name matches (case-sensitive)
4. Check Azure OpenAI resource is in Azure Government subscription
5. Confirm private endpoint configured for GCC High access

#### Issue: "SharePoint IL5 upload failed"

**Symptoms:** Minutes approved but SharePoint URL is null

**Solutions:**
1. Verify Sites.Selected permission granted to app registration
2. Check site URL is correct: `https://tenant.sharepoint.us/sites/...` (not `.com`)
3. Verify library name exists: `Minutes Archive IL5`
4. Check folder structure created: `/UNCLASSIFIED/`, `/CONFIDENTIAL/`, `/SECRET/`
5. Verify app has write permission to classification-specific folders
6. Test Graph API access:
   ```bash
   curl -X GET "https://graph.microsoft.us/v1.0/sites/{site-id}" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

#### Issue: "Classification routing not working"

**Symptoms:** CONFIDENTIAL meetings being routed to UNCLASSIFIED backend

**Solutions:**
1. Check Azure Front Door routing rules configured correctly
2. Verify classification middleware is enabled in application
3. Check meeting classification metadata is set correctly
4. Review Azure Front Door logs for routing decisions
5. Validate NSG rules allow cross-VNet traffic for Front Door

#### Issue: "Clearance validation failing"

**Symptoms:** Users with SECRET clearance cannot access CONFIDENTIAL meetings

**Solutions:**
1. Verify Azure AD group sync is running
2. Check user is member of `Clearance-SECRET` group
3. Review clearance hierarchy logic (SECRET > CONFIDENTIAL > UNCLASSIFIED)
4. Check Graph API group membership query:
   ```bash
   curl -X GET "https://graph.microsoft.us/v1.0/users/{user-id}/memberOf" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### 12.2 Diagnostic Commands

```bash
# Check database connectivity (all shards)
for shard in {1..6}; do
  echo "Testing UNCLASSIFIED Shard $shard"
  psql "postgresql://admin@psql-minutes-unclass-shard${shard}:...@psql-minutes-unclass-shard${shard}.postgres.database.usgovcloudapi.net/meetingminutes?sslmode=require" -c "SELECT 1;"
done

# Test Azure OpenAI GCC High
curl "https://aoai-minutes-prod-gov.openai.azure.us/openai/deployments/gpt-4o-minutes/chat/completions?api-version=2024-02-15-preview" \
  -H "api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Test SharePoint access (GCC High)
curl "https://graph.microsoft.us/v1.0/sites/SITE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check webhook subscription
curl "https://graph.microsoft.us/v1.0/subscriptions" \
  -H "Authorization: Bearer YOUR_TOKEN"

# View application logs
az webapp log tail \
  --name app-minutes-unclass \
  --resource-group rg-teams-unclass

# Query Log Analytics for errors
az monitor log-analytics query \
  --workspace law-minutes-prod \
  --analytics-query "AppServiceConsoleLogs | where Message contains 'ERROR' | top 100 by TimeGenerated desc"
```

### 12.3 Getting Help

**Documentation:**
- Microsoft Graph API (GCC High): https://docs.microsoft.com/graph/deployments#microsoft-graph-us-government-l5-gcc-high
- Azure Government: https://docs.microsoft.com/azure/azure-government/
- Azure OpenAI (Government): https://docs.microsoft.com/azure/cognitive-services/openai/how-to/government-use
- FedRAMP Controls: https://www.fedramp.gov/documents/

**Support Channels:**
- Azure Government Support Portal: https://portal.azure.us
- Microsoft 365 GCC High Admin Center: https://portal.office365.us
- DOD Cyber Crime Center (DC3): https://www.dc3.mil
- DISA Security Technical Implementation Guides (STIGs): https://public.cyber.mil/stigs/

**Escalation Path:**
1. System Administrator → ISSO
2. ISSO → ISSM
3. ISSM → Authorizing Official (AO)
4. AO → DOD Component CISO

---

## Appendix A: Environment Variable Reference

### Required Variables (Azure Government)

```bash
# Microsoft Graph API (GCC High)
GRAPH_TENANT_ID=          # Azure AD tenant ID (.onmicrosoft.us)
GRAPH_CLIENT_ID=          # App registration client ID
GRAPH_CLIENT_SECRET=      # App client secret (stored in Key Vault)
GRAPH_ENDPOINT=           # https://graph.microsoft.us

# Azure OpenAI (GCC High)
AZURE_OPENAI_ENDPOINT=    # https://resource.openai.azure.us/
AZURE_OPENAI_API_KEY=     # Azure OpenAI API key (stored in Key Vault)
AZURE_OPENAI_DEPLOYMENT=  # Deployment name (e.g., gpt-4o-minutes)

# Database (Sharded by Classification)
DATABASE_URL_UNCLASSIFIED_SHARD1=   # PostgreSQL connection string (shard 1 of 6)
DATABASE_URL_UNCLASSIFIED_SHARD2=   # PostgreSQL connection string (shard 2 of 6)
# ...SHARD3-6
DATABASE_URL_CONFIDENTIAL_SHARD1=   # PostgreSQL connection string (shard 1 of 4)
# ...SHARD2-4
DATABASE_URL_SECRET_SHARD1=         # PostgreSQL connection string (shard 1 of 2)
DATABASE_URL_SECRET_SHARD2=         # PostgreSQL connection string (shard 2 of 2)

# Session
SESSION_SECRET=           # Random 64-character string (stored in Key Vault)

# SharePoint (GCC High)
SHAREPOINT_SITE_URL=      # https://tenant.sharepoint.us/sites/dod-meeting-minutes
SHAREPOINT_LIBRARY=       # Minutes Archive IL5

# Application
NODE_ENV=                 # production
PORT=                     # 5000 (default)
CLASSIFICATION_LEVEL=     # UNCLASSIFIED | CONFIDENTIAL | SECRET (per ASEv3 instance)

# Security
AZURE_KEY_VAULT_URL=      # https://kv-minutes-prod.vault.usgovcloudapi.net
LOG_ANALYTICS_WORKSPACE_ID=  # Workspace ID for audit logging
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=                # debug | info | warn | error
ENABLE_DEBUG_LOGS=        # true | false

# Performance
MAX_CONCURRENT_JOBS=      # Default: 5
JOB_RETRY_ATTEMPTS=       # Default: 3

# Email
EMAIL_FROM=               # Default: noreply@youragency.mil

# Compliance
ISSO_EMAIL=               # Email for security incident notifications
ISSM_EMAIL=               # Email for compliance notifications
AO_EMAIL=                 # Email for authorization decision notifications
```

---

## Appendix B: FedRAMP Control Implementation Summary

**Total Controls:** 421 (FedRAMP High baseline)

**Implementation Status:**
- **Fully Implemented (89%):** 375 controls designed into architecture
- **Partially Implemented (7%):** 30 controls require organizational processes
- **Planned (3%):** 16 controls deferred to ATO process

**Key Control Families:**

| Family | Controls | Implemented | Notes |
|--------|----------|-------------|-------|
| **Access Control (AC)** | 25 | 23 | AC-1 (policy), AC-20 (external connections) deferred |
| **Audit and Accountability (AU)** | 15 | 15 | All implemented (immutable logging for SECRET) |
| **Security Assessment (CA)** | 9 | 7 | CA-2 (3PAO assessment), CA-5 (POA&M) in ATO process |
| **Configuration Management (CM)** | 11 | 10 | CM-2 (baseline) requires CCB establishment |
| **Contingency Planning (CP)** | 13 | 13 | All implemented (tested in Month 11-12) |
| **Identification and Auth (IA)** | 11 | 11 | All implemented (CAC/PIV via Azure AD) |
| **Incident Response (IR)** | 10 | 9 | IR-4 (DC3 integration) completed in Month 8 |
| **System and Comms Protection (SC)** | 52 | 51 | SC-7 (boundary protection) validated in pen test |

**Detailed Control Matrix:** See FEDRAMP_CONTROL_MATRIX.md

**POA&M Summary:** See POAM_DOCUMENT.md

---

**Document Classification:** UNCLASSIFIED  
**Version:** 1.0  
**Last Updated:** November 17, 2025  
**Review Cycle:** Quarterly or after major platform updates  
**Authorizing Official Approval:** PENDING ATO PROCESS
