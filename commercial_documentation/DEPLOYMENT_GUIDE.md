# Deployment Guide
## Commercial Teams Meeting Minutes Management System

**Document Purpose:** Deployment instructions for the Commercial Teams Meeting Minutes Management System across development, pilot, and Azure Commercial (multi-tenant SaaS) production environments

**Architecture Status:** Production-ready design for 16-week commercialization timeline. This guide covers the complete deployment process from Azure infrastructure provisioning through multi-tenant SaaS launch.

**What You're Deploying:** An enterprise-grade autonomous meeting minutes system with backend services, database schema, API layer, workflow engine, Microsoft Graph integrations, and comprehensive frontend UI - all following SOC 2 Type II compliance requirements.

**Last Updated:** November 17, 2025

---

## What This System Includes

**Production architecture components:**

✅ **Backend Services:**
- Durable PostgreSQL-backed job queue with automatic retry
- Meeting orchestrator coordinating entire workflow
- Microsoft Graph API client (webhooks, meetings, email, SharePoint)
- Azure OpenAI integration for AI processing
- Document generation (DOCX, PDF)
- Email distribution system
- Azure AD group-based access control
- Multi-tenant isolation and data segregation

✅ **Database:**
- Full PostgreSQL schema with 7 tables
- Migration system (Drizzle ORM)
- Session management
- Job queue persistence
- Multi-tenant data isolation with row-level security

✅ **API Layer:**
- 15+ RESTful endpoints
- Authentication middleware with multi-tenant support
- Webhook receivers for Microsoft Teams
- Health check endpoints
- Tenant provisioning and management APIs

✅ **Integration Layer:**
- Microsoft Teams meeting capture
- SharePoint document archival
- Azure OpenAI processing
- Email distribution via Graph API
- Customer onboarding automation

✅ **Frontend:** React application with comprehensive UI (Microsoft Fluent + IBM Carbon design, WCAG 2.1 AA accessibility, dual-theme system)

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Microsoft 365 Test Environment Setup](#2-microsoft-365-test-environment-setup)
3. [Azure AD Application Registration](#3-azure-ad-application-registration)
4. [Azure OpenAI Setup](#4-azure-openai-setup)
5. [SharePoint Configuration](#5-sharepoint-configuration)
6. [Replit Development Deployment](#6-replit-development-deployment)
7. [Azure Commercial Production Deployment](#7-azure-commercial-production-deployment)
8. [Multi-Tenant Customer Onboarding](#8-multi-tenant-customer-onboarding)
9. [Post-Deployment Configuration](#9-post-deployment-configuration)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Reference

### 1.1 Deployment Timeline

| Environment | Duration | Key Steps |
|------------|----------|-----------|
| **Development/Testing** | 3-4 hours | M365 trial + Azure AD + Replit setup |
| **Azure Commercial Production** | 6-8 hours | Infrastructure + DB + Application + Multi-tenant setup |
| **Customer Onboarding (per tenant)** | 30 minutes | Automated provisioning + SSO configuration |

### 1.2 Cost Estimates

**Note:** Production architecture uses multi-scale-unit App Service Environment (ASEv3) design with auto-scaling capability to support up to 300,000 concurrent users if necessary. See SCALABILITY_ARCHITECTURE.md for detailed capacity planning.

| Environment | Monthly Cost | Components |
|------------|-------------|------------|
| **Development (Replit)** | $15-20 | Azure OpenAI only (M365 trial free, PostgreSQL included) |
| **Azure Commercial Baseline (10K users)** | $54,150 | 3× ASEv3, 18× I3v2 instances, 12× PostgreSQL shards, Azure Front Door, Azure OpenAI |
| **Azure Commercial Peak (300K users)** | $1,088,200 | 12× ASEv3, 880× I3v2 instances, 12× scaled PostgreSQL shards, Azure Front Door, Azure OpenAI |

**Deployment Model:** This guide covers Replit development deployment and Azure Commercial multi-tenant production deployment with automated customer onboarding.

### 1.3 Prerequisites Checklist

**For All Deployments:**
- [ ] Microsoft 365 admin access (Global Administrator role)
- [ ] Azure subscription with billing enabled
- [ ] Domain name (optional but recommended)
- [ ] Credit card for Azure services

**For Azure Commercial Production:**
- [ ] Azure subscription (commercial public cloud)
- [ ] Azure CLI installed and configured
- [ ] SOC 2 Type II certification in progress (for enterprise sales)
- [ ] Multi-tenant architecture understanding

**For Replit Deployment:**
- [ ] Replit account (free or Teams plan)
- [ ] Basic understanding of environment variables

---

## 2. Microsoft 365 Test Environment Setup

### 2.1 Option A: Microsoft 365 E5 Trial (Recommended for Testing)

**What you get:** 30 days free, 25 user licenses, full Teams/Azure AD access

#### Step 1: Sign Up for Trial

1. Visit: https://www.microsoft.com/en-us/microsoft-365/enterprise/e5
2. Click **"Free trial"**
3. Enter your email address
4. Fill in organization details:
   - Company: `Meeting Minutes Testing` (or your organization name)
   - Organization size: `25 users`
   - Country: `United States`
5. Create subdomain (cannot be changed later):
   - Example: `meetingminutestest`
   - Full domain: `meetingminutestest.onmicrosoft.com`
6. Create admin account:
   - Username: `admin`
   - Full email: `admin@meetingminutestest.onmicrosoft.com`
   - Password: **Create strong password and save it securely!**
7. Verify phone number (SMS or call)
8. Wait 2-5 minutes for provisioning

**Success indicator:** You see "You're all set!" message

#### Step 2: Bookmark Admin Centers

Save these URLs for quick access:
- **Microsoft 365 Admin:** https://admin.microsoft.com
- **Teams Admin Center:** https://admin.teams.microsoft.com
- **Azure AD Portal:** https://portal.azure.com
- **Teams Web Client:** https://teams.microsoft.com

Sign in with: `admin@meetingminutestest.onmicrosoft.com`

#### Step 3: Create Test Users

Create 5-10 test users for access control validation:

1. Go to https://admin.microsoft.com
2. Navigate to **Users** → **Active users** → **Add a user**
3. Create these users:

| Display Name | Email Prefix | Password | Purpose |
|-------------|-------------|----------|---------|
| John Doe | john.doe | TestPass123! | Viewer role testing |
| Jane Smith | jane.smith | TestPass123! | Admin role testing |
| Bob Johnson | bob.johnson | TestPass123! | Approver role testing |
| Alice Williams | alice.williams | TestPass123! | Approver role testing |
| Charlie Brown | charlie.brown | TestPass123! | Viewer role testing |

**For each user:**
- Assign **Microsoft 365 E5** license
- **UNCHECK** "Require password change on next login"
- Click **Finish adding user**

#### Step 4: Enable Custom Apps in Teams

1. Go to **Teams Admin Center:** https://admin.teams.microsoft.com
2. Navigate to **Teams apps** → **Setup policies** → **Global**
3. Under **Upload custom apps:** Toggle to **On**
4. Click **Save**
5. Wait up to 24 hours for changes to propagate (usually instant)

### 2.2 Option B: Microsoft 365 Developer Program (Free - If Eligible)

**Eligibility:** Visual Studio Professional/Enterprise subscribers, Microsoft partners

**Benefits over Trial:**
- 90-day duration (vs. 30 days)
- Auto-renews if actively used
- Pre-loaded sample data
- 25 test users already configured

#### Step 1: Join Developer Program

1. Visit: https://developer.microsoft.com/en-us/microsoft-365/dev-program
2. Click **"Join Now"**
3. Sign in with your Microsoft account (use Visual Studio subscription account)
4. Complete profile:
   - Country: United States
   - Company: Your organization
   - Development interests: Select "Microsoft Teams"
5. Accept terms and conditions

#### Step 2: Create Instant Sandbox

1. In Developer Program dashboard, click **"Set up E5 subscription"**
2. Choose **"Instant sandbox"** (recommended for Teams testing)
3. Select region: **United States**
4. Create admin credentials:
   - Username: `admin`
   - Password: Strong password (save it!)
5. Verify phone number
6. Wait 1-2 minutes for provisioning

**What you get:**
- 25 pre-configured test users (e.g., Adele Vance, Alex Wilber, etc.)
- Sample Teams with existing data
- Pre-configured SharePoint sites
- Teams app sideloading already enabled

### 2.3 Create Azure AD Access Control Groups

**Purpose:** Support role-based access control for enterprise customers

#### Step 1: Navigate to Groups

1. Go to https://portal.azure.com
2. Sign in as admin
3. Navigate to **Azure Active Directory** → **Groups** → **All groups**

#### Step 2: Create Role Groups

Click **+ New group** for each:

**Group 1: Viewer Role**
- Group type: **Security**
- Group name: `Role-Viewer`
- Description: `Can view meetings they attended`
- Membership type: **Assigned** (or Dynamic for automation)
- Add members: john.doe, charlie.brown

**Group 2: Editor Role**
- Group type: **Security**
- Group name: `Role-Editor`
- Description: `Can edit minutes before approval`
- Membership type: **Assigned**
- Add members: bob.johnson

**Group 3: Approver Role**
- Group type: **Security**
- Group name: `Role-Approver`
- Description: `Can approve/reject meeting minutes`
- Membership type: **Assigned**
- Add members: bob.johnson, alice.williams

**Group 4: Admin Role**
- Group type: **Security**
- Group name: `Role-Admin`
- Description: `Full system access and configuration`
- Membership type: **Assigned**
- Add members: jane.smith

**Success indicator:** All 4 groups created and members assigned

---

## 3. Azure AD Application Registration

### 3.1 Register New Application

#### Step 1: Create App Registration

1. Go to https://portal.azure.com
2. Sign in as admin
3. Navigate to **Azure Active Directory** → **App registrations**
4. Click **+ New registration**

#### Step 2: Configure Basic Settings

**Application name:** `Meeting Minutes System` (or your preferred name)

**Supported account types:** 
- For single-tenant testing: **Accounts in this organizational directory only (Single tenant)**
- For multi-tenant SaaS: **Accounts in any organizational directory (Any Azure AD directory - Multitenant)**

**Redirect URI:**
- Platform: **Web**
- For Replit: `https://your-workspace.replit.app/auth/callback`
- For Azure Commercial: `https://your-domain.com/auth/callback`
- Leave blank for now (update later)

Click **Register**

#### Step 3: Save Application IDs

**CRITICAL:** Copy and save these values immediately:

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (tenant) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3.2 Create Client Secret

1. In your app, navigate to **Certificates & secrets**
2. Click **+ New client secret**
3. Configure:
   - Description: `Meeting Minutes Secret`
   - Expires: **24 months** (recommended for production)
4. Click **Add**
5. **IMMEDIATELY COPY THE SECRET VALUE** (shows only once!)
   - Example: `abc123~DEF456.G7H8I9J0K1L2M3N4O5P6Q7R8S9T0`

**⚠️ WARNING:** You cannot retrieve this secret later. Save it securely!

### 3.3 Configure API Permissions

#### Step 1: Add Microsoft Graph Permissions

1. Navigate to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**

#### Step 2: Add Delegated Permissions (User context)

Add these delegated permissions:

| Permission | Purpose |
|-----------|---------|
| `User.Read` | Read signed-in user profile |
| `OnlineMeetings.Read` | Read user's Teams meetings |
| `Group.Read.All` | Read user's group memberships for access control |
| `Mail.Send` | Send email as signed-in user |

**To add:**
1. Click **Delegated permissions**
2. Search for each permission
3. Check the box
4. Click **Add permissions**

#### Step 3: Add Application Permissions (Service context)

Add these application permissions:

| Permission | Purpose |
|-----------|---------|
| `User.Read.All` | Read all users' profiles for attendee lookup |
| `Group.Read.All` | Read all group memberships for Azure AD sync |
| `OnlineMeetings.Read.All` | Read all meetings via webhooks |
| `Calendars.Read` | Read meeting schedules and metadata |
| `Mail.Send` | Send minutes distribution emails |
| `Sites.Selected` | Access SharePoint sites for archival |

**Alternative:** If `Sites.Selected` is unavailable, use `Files.ReadWrite.All`

**To add:**
1. Click **Application permissions**
2. Search for each permission
3. Check the box
4. Click **Add permissions**

#### Step 4: Grant Admin Consent

**CRITICAL:** Application permissions require tenant admin consent

1. Click **Grant admin consent for [Your Organization]**
2. Confirm by clicking **Yes**
3. Verify all permissions show **Granted** with green checkmarks

**Success indicator:** All permissions display green checkmarks in "Status" column

### 3.4 Configure Authentication Settings

1. Navigate to **Authentication**
2. Under **Implicit grant and hybrid flows:**
   - ✅ Check **Access tokens**
   - ✅ Check **ID tokens**
3. Under **Advanced settings:**
   - Allow public client flows: **Yes**
4. Click **Save**

---

## 4. Azure OpenAI Setup

### 4.1 Create Azure OpenAI Resource

#### Step 1: Navigate to Azure OpenAI

1. Go to https://portal.azure.com
2. Search for "Azure OpenAI" in top search bar
3. Click **+ Create**

#### Step 2: Configure Resource

**Basics:**
- Subscription: Select your subscription
- Resource group: Create new or use existing
- Region: **East US** or **West Europe** (check GPT-4 availability)
- Name: `meeting-minutes-openai`
- Pricing tier: **Standard S0**

**Networking:**
- Network connectivity: **All networks** (or configure private endpoint for production)

**Tags:** (optional)
- Environment: Development

Click **Review + create** → **Create**

Wait 3-5 minutes for deployment

#### Step 3: Deploy GPT-4 Model

1. Once created, click **Go to resource**
2. Navigate to **Model deployments** → **Manage Deployments**
   - This opens Azure OpenAI Studio
3. Click **+ Create new deployment**
4. Configure:
   - Model: **gpt-4** or **gpt-4-32k**
   - Deployment name: `gpt-4`
   - Model version: Select latest
   - Deployment type: **Standard**
5. Click **Create**

#### Step 4: Get API Credentials

1. In Azure Portal, go to your Azure OpenAI resource
2. Navigate to **Keys and Endpoint**
3. **Save these values:**

```
Endpoint: https://meeting-minutes-openai.openai.azure.com/
Key 1: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Deployment Name: gpt-4
```

### 4.2 Test API Access (Optional)

```bash
curl https://meeting-minutes-openai.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_KEY_HERE" \
  -d '{
    "messages": [{"role": "user", "content": "Test connection"}],
    "max_tokens": 10
  }'
```

**Expected response:** JSON with completion text

---

## 5. SharePoint Configuration

### 5.1 Create SharePoint Site

#### Step 1: Create Site Collection

1. Go to https://admin.microsoft.com
2. Navigate to **Show all** → **SharePoint** → **Active sites**
3. Click **+ Create**
4. Select **Team site**
5. Configure:
   - Site name: `Meeting Minutes`
   - Site address: `/sites/meetingminutes`
   - Privacy: **Private**
   - Language: English
6. Click **Finish**

#### Step 2: Create Document Library

1. Navigate to your new site: `https://yourtenant.sharepoint.com/sites/meetingminutes`
2. Click **+ New** → **Document library**
3. Name: `Minutes Archive`
4. Description: `Automated meeting minutes storage`
5. Click **Create**

#### Step 3: Create Folder Structure

Create this folder hierarchy in the library:

```
/Minutes Archive/
  ├─ 2025/
  │   ├─ 01-January/
  │   ├─ 02-February/
  │   ├─ 03-March/
  │   └─ (each month)
  └─ (repeat for each year)
```

### 5.2 Grant Application Access (Sites.Selected Permission)

#### Step 1: Get Site ID

1. Use Microsoft Graph Explorer: https://developer.microsoft.com/graph/graph-explorer
2. Sign in as admin
3. Run this query:
   ```
   GET https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/meetingminutes
   ```
4. Copy the `id` field from response

#### Step 2: Grant Permission via Graph API

Use Graph Explorer or PowerShell:

```http
POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [{
    "application": {
      "id": "YOUR_APP_CLIENT_ID",
      "displayName": "Meeting Minutes System"
    }
  }]
}
```

**Success indicator:** Response with `id` and granted permission

---

## 6. Replit Development Deployment

### 6.1 Configure Environment Variables

#### Step 1: Add Secrets to Replit

1. Open your Replit workspace
2. Click **Tools** → **Secrets**
3. Add these secrets:

**Microsoft Graph API:**
```
GRAPH_TENANT_ID=your-tenant-id
GRAPH_CLIENT_ID=your-client-id
GRAPH_CLIENT_SECRET=your-client-secret
```

**Azure OpenAI:**
```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4
```

**SharePoint:**
```
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/meetingminutes
SHAREPOINT_LIBRARY=Minutes Archive
```

**Database (auto-configured by Replit):**
```
DATABASE_URL=postgresql://...
SESSION_SECRET=auto-generated
```

### 6.2 Update Redirect URI

1. Copy your Replit app URL: `https://your-workspace.replit.app`
2. Go to Azure Portal → Azure AD → App registrations → Your app
3. Navigate to **Authentication**
4. Add redirect URI: `https://your-workspace.replit.app/auth/callback`
5. Click **Save**

### 6.3 Deploy Application

Application auto-deploys when you:
1. Click **Run** in Replit
2. Wait for workflow to start
3. Open webview to see application

**Success indicator:** Application loads, shows login page

### 6.4 Test Authentication

1. Click **Login**
2. Sign in with test user (e.g., `john.doe@meetingminutestest.onmicrosoft.com`)
3. Consent to permissions if prompted
4. Verify dashboard loads

---

## 7. Azure Commercial Production Deployment

**Document Purpose:** This section provides an overview of Azure Commercial multi-tenant production deployment. For detailed step-by-step instructions, refer to the comprehensive deployment plans referenced below.

### 7.1 Overview

The Commercial Teams Meeting Minutes Management System deploys to **Azure Commercial (public cloud)** infrastructure as a multi-tenant SaaS offering to support enterprise customers globally.

**IMPORTANT:** This section provides a simplified overview. Production deployment uses a **multi-scale-unit App Service Environment (ASEv3) architecture** with horizontally sharded databases. For complete deployment instructions, see SCALABILITY_ARCHITECTURE.md Section 7.

**Key Characteristics:**
- **Scale:** Auto-scaling capability to support up to 300,000 concurrent users (baseline: 10,000 users)
- **Multi-Tenancy:** Complete tenant isolation with row-level security and data segregation
- **Compliance:** SOC 2 Type II, GDPR, ISO 27001 compliance
- **Architecture:** Multi-scale-unit ASEv3 clusters (12 units max) with 12 horizontally sharded PostgreSQL databases
- **Global Distribution:** Azure Front Door for worldwide low-latency access

### 7.2 Production Architecture Overview

**Note:** The following diagram shows the multi-scale-unit production architecture. Development deployment on Replit uses a simplified single-instance configuration.

```
┌─────────────────────────────────────────────────────────────────────┐
│              Azure Commercial (Public Cloud)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Microsoft 365 Commercial                                           │
│  ├─ Teams (Meeting Capture via Graph API)                          │
│  ├─ SharePoint (Document Archival per tenant)                      │
│  ├─ Exchange (Email Distribution)                                   │
│  └─ Azure AD (Multi-tenant SSO + Role-based RBAC)                  │
│                                                                      │
│  Azure Front Door Premium                                           │
│  ├─ Global Load Balancing & Tenant-based Routing                    │
│  ├─ WAF + DDoS Protection                                           │
│  └─ TLS 1.2+ Termination                                            │
│                                                                      │
│  Multi-Scale-Unit ASE Clusters (Multi-tenant VNets)                 │
│  ├─ BASELINE (10K users): 3 ASEv3, 18 I3v2 instances               │
│  │  • Region 1 (East US): 1 ASEv3 (8 instances)                    │
│  │  • Region 2 (West Europe): 1 ASEv3 (6 instances)                │
│  │  • Region 3 (Southeast Asia): 1 ASEv3 (4 instances)             │
│  │                                                                   │
│  └─ PEAK (300K users): 12 ASEv3, 880 I3v2 instances                │
│     • Region 1: 6 ASEv3 (400 instances)                             │
│     • Region 2: 4 ASEv3 (320 instances)                             │
│     • Region 3: 2 ASEv3 (160 instances)                             │
│                                                                      │
│  Horizontally Sharded PostgreSQL (12 shards total)                  │
│  ├─ Region 1: 6 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)     │
│  ├─ Region 2: 4 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)     │
│  └─ Region 3: 2 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)     │
│     • CMK encryption (Key Vault)                                    │
│     • 35-day backups, geo-redundant replication                     │
│     • Row-level security for tenant isolation                       │
│                                                                      │
│  Azure OpenAI Service (Commercial)                                  │
│  ├─ GPT-4o deployment (multi-region)                               │
│  └─ Whisper deployment for transcription                            │
│                                                                      │
│  Azure Application Insights                                         │
│  ├─ Performance monitoring per tenant                               │
│  ├─ Usage analytics and billing metrics                             │
│  └─ Security audit logs                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Multi-Tenant Architecture

**Tenant Isolation Strategy:**

1. **Database Level:**
   - Row-level security (RLS) with tenant_id column on all tables
   - Connection pooling per tenant with resource limits
   - Dedicated schema per tenant for large customers (optional)

2. **Application Level:**
   - Tenant context injected into all API requests
   - Middleware validates tenant access on every request
   - Tenant-specific configuration and feature flags

3. **Storage Level:**
   - Separate SharePoint sites per tenant
   - Tenant-scoped document libraries
   - Isolated email distribution per tenant

### 7.4 Deployment Steps (High-Level)

**Note:** Complete Infrastructure-as-Code (Terraform/Bicep) templates are available in SCALABILITY_ARCHITECTURE.md Section 7.

#### Step 1: Provision Infrastructure (1-2 hours)

```bash
# Terraform deployment
cd infrastructure/terraform
terraform init
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
```

**Creates:**
- 3× App Service Environments (East US, West Europe, Southeast Asia)
- 12× PostgreSQL shards with geo-replication
- Azure Front Door with custom domain
- Azure OpenAI deployments (multi-region)
- Key Vault for secrets management
- Application Insights for monitoring

#### Step 2: Configure Database (30 minutes)

```bash
# Run migrations on all shards
npm run migrate:production

# Enable row-level security
npm run db:enable-rls

# Create tenant management functions
npm run db:setup-multi-tenant
```

#### Step 3: Deploy Application (1 hour)

```bash
# Build and deploy Docker containers
docker build -t meetingminutes:latest .
docker push meetingminutes:latest

# Deploy to App Service
az webapp create --resource-group rg-teams-minutes \
  --plan asp-teams-minutes \
  --name app-teams-minutes-prod \
  --deployment-container-image meetingminutes:latest
```

#### Step 4: Configure Azure Front Door (30 minutes)

1. Set up custom domain: `app.meetingminutes.com`
2. Configure SSL/TLS certificates (Let's Encrypt or purchased)
3. Set up routing rules for tenant detection
4. Enable WAF rules and DDoS protection

#### Step 5: Configure Monitoring (30 minutes)

```bash
# Set up Application Insights
az monitor app-insights component create \
  --app app-teams-minutes \
  --location eastus \
  --resource-group rg-teams-minutes

# Configure alerts
az monitor metrics alert create \
  --name high-cpu-alert \
  --resource-group rg-teams-minutes \
  --condition "avg Percentage CPU > 80"
```

### 7.5 SOC 2 Compliance Considerations

**Security Controls:**
- ✅ Data encryption at rest and in transit
- ✅ Role-based access control (RBAC)
- ✅ Audit logging for all data access
- ✅ Regular security scanning and penetration testing
- ✅ Incident response procedures
- ✅ Change management processes

**Operational Controls:**
- ✅ 99.9% uptime SLA with monitoring
- ✅ Automated backups (35-day retention)
- ✅ Disaster recovery plan with geo-replication
- ✅ Performance monitoring and alerting
- ✅ Capacity planning and auto-scaling

**Compliance Documentation:**
- Security policies and procedures
- Risk assessment and management
- Vendor management (Microsoft, Azure)
- Business continuity plan
- Annual SOC 2 audit report

### 7.6 Estimated Infrastructure Costs

**Baseline (10,000 concurrent users):**
- App Service Environment (3× ASEv3): $6,000/month
- App Service Instances (18× I3v2): $32,400/month
- PostgreSQL Shards (12× GP_Gen5_8): $12,000/month
- Azure Front Door Premium: $600/month
- Azure OpenAI: $3,000/month
- Storage & Monitoring: $150/month
- **Total: $54,150/month**

**Peak (300,000 concurrent users):**
- App Service Environment (12× ASEv3): $24,000/month
- App Service Instances (880× I3v2): $1,056,000/month
- PostgreSQL Shards (12× GP_Gen5_16): $6,000/month
- Azure Front Door Premium: $1,200/month
- Azure OpenAI: $1,000/month (optimized caching)
- Storage & Monitoring: $1,000/month
- **Total: $1,088,200/month**

**Per-Customer Cost:**
- Small Business (100 users): $540/month infrastructure
- Enterprise (1,000 users): $5,415/month infrastructure
- Large Enterprise (10,000 users): $54,150/month infrastructure

---

## 8. Multi-Tenant Customer Onboarding

### 8.1 Automated Onboarding Flow

**Purpose:** Enable new customers to self-onboard within 30 minutes without manual intervention

#### Step 1: Customer Sign-Up

1. Customer visits: `https://app.meetingminutes.com/signup`
2. Fills out registration form:
   - Organization name
   - Admin email
   - Microsoft 365 tenant domain
   - Number of users (for pricing)
3. Receives verification email
4. Clicks verification link

#### Step 2: Tenant Provisioning (Automated)

System automatically:

1. **Creates tenant record** in database with unique tenant_id
2. **Generates tenant-specific configuration:**
   - Unique subdomain: `{company}.meetingminutes.com`
   - Tenant-scoped database access
   - Resource allocation based on plan
3. **Provisions SharePoint site:**
   - Creates site collection: `/sites/{tenant-id}`
   - Sets up document library
   - Configures permissions
4. **Sends welcome email** with setup instructions

#### Step 3: Azure AD App Consent (Customer Action)

Customer admin:

1. Receives email with consent link
2. Clicks **"Authorize Meeting Minutes System"**
3. Signs in with Microsoft 365 admin account
4. Reviews requested permissions
5. Clicks **"Accept"** to grant consent

**Permissions requested:**
- OnlineMeetings.Read.All
- User.Read.All
- Group.Read.All
- Mail.Send
- Sites.Selected

#### Step 4: Configure Webhook Subscriptions (Automated)

System automatically:

1. Creates Microsoft Graph webhook subscription for customer tenant
2. Subscribes to meeting lifecycle events
3. Validates webhook endpoint with customer's tenant
4. Sends confirmation email to customer admin

#### Step 5: User Access Setup (Customer Action)

Customer admin:

1. Navigates to admin portal: `https://{company}.meetingminutes.com/admin`
2. Syncs Azure AD groups
3. Maps groups to roles:
   - Viewer: `All Employees`
   - Approver: `Managers`
   - Admin: `IT Admins`
4. Invites users via email or auto-assigns based on groups

### 8.2 SSO Configuration

**Supported Methods:**
- Azure AD (primary)
- SAML 2.0
- OpenID Connect

#### Azure AD SSO Setup

1. Customer admin navigates to **Settings** → **Single Sign-On**
2. Selects **"Azure AD"**
3. Enters Microsoft 365 tenant details:
   - Tenant ID
   - Domain name
4. Clicks **"Test Connection"**
5. System validates configuration
6. Clicks **"Enable SSO"**

**Success indicator:** Users can now sign in with `username@customer-domain.com`

### 8.3 Customer Onboarding Checklist

**Week 1: Initial Setup**
- [ ] Sign up and verify email
- [ ] Grant Azure AD app consent
- [ ] Configure SSO
- [ ] Sync Azure AD groups
- [ ] Assign roles to groups

**Week 2: Configuration**
- [ ] Customize email templates
- [ ] Configure SharePoint archival settings
- [ ] Set up retention policies
- [ ] Test meeting capture with pilot group

**Week 3: Pilot Deployment**
- [ ] Onboard 10-20 pilot users
- [ ] Conduct 5-10 test meetings
- [ ] Review generated minutes
- [ ] Gather feedback

**Week 4: Full Rollout**
- [ ] Onboard all users
- [ ] Announce launch to organization
- [ ] Monitor usage and performance
- [ ] Schedule training sessions

### 8.4 Customer Support and Success

**Support Channels:**
- **Email:** support@meetingminutes.com (24-hour SLA)
- **Live Chat:** Available during business hours
- **Knowledge Base:** https://docs.meetingminutes.com
- **Slack Community:** For peer support

**Success Metrics:**
- Time to first value: <30 days
- User adoption: >80% of licensed users active within 60 days
- Customer satisfaction: NPS >50
- Retention: >85% annual renewal rate

---

## 9. Post-Deployment Configuration

### 9.1 Health Checks

#### Production Health Check Endpoints

**System Health:**
```bash
curl https://app.meetingminutes.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T10:00:00Z",
  "services": {
    "database": "healthy",
    "azure_openai": "healthy",
    "microsoft_graph": "healthy",
    "sharepoint": "healthy"
  },
  "version": "1.0.0"
}
```

**Database Health:**
```bash
curl https://app.meetingminutes.com/health/database
```

**Expected response:**
```json
{
  "status": "healthy",
  "shards": 12,
  "healthy_shards": 12,
  "connection_pool": "optimal"
}
```

### 9.2 Configure Microsoft Graph Webhooks

**Purpose:** Enable automatic meeting capture

#### Step 1: Create Subscription

Use admin portal or API:

```bash
POST https://app.meetingminutes.com/api/admin/webhooks/subscribe
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "tenantId": "customer-tenant-id",
  "resourceType": "onlineMeetings"
}
```

#### Step 2: Verify Subscription

```bash
GET https://app.meetingminutes.com/api/admin/webhooks/subscriptions
```

**Expected response:**
```json
{
  "subscriptions": [
    {
      "id": "subscription-id",
      "tenantId": "customer-tenant-id",
      "resourceType": "onlineMeetings",
      "expirationDateTime": "2025-12-17T10:00:00Z",
      "status": "active"
    }
  ]
}
```

**Note:** Subscriptions auto-renew 24 hours before expiration

### 9.3 Test End-to-End Flow

#### Step 1: Schedule Test Meeting

1. Sign in to Microsoft Teams
2. Schedule meeting for 30 minutes in the future
3. Add at least 2 attendees
4. Include agenda in meeting description

#### Step 2: Conduct Meeting

1. Start Teams meeting
2. Have participants join
3. Record meeting (enable cloud recording)
4. Discuss agenda items for 5-10 minutes
5. End meeting

#### Step 3: Verify Automated Processing

1. Wait 2-5 minutes for system to detect meeting end
2. Check dashboard: `https://{company}.meetingminutes.com/meetings`
3. Verify meeting appears with status "Processing"
4. Wait 5-10 minutes for AI processing
5. Verify status changes to "Pending Approval"

#### Step 4: Review and Approve Minutes

1. Click on meeting card
2. Review generated content:
   - Attendees list
   - Meeting summary
   - Key discussion points
   - Decisions made
   - Action items with assignees
3. Make edits if needed
4. Click **"Approve"**

#### Step 5: Verify Distribution

1. Check attendees' email inboxes
2. Verify email received with subject: "Meeting Minutes: [Meeting Title]"
3. Verify DOCX and PDF attachments
4. Check SharePoint site for archived document
5. Verify document appears in correct folder: `/Minutes Archive/2025/11-November/`

**Success indicators:**
- ✅ Meeting auto-captured
- ✅ Minutes generated with >90% accuracy
- ✅ Action items extracted correctly
- ✅ Email sent to all attendees
- ✅ Document uploaded to SharePoint

### 9.4 Monitor Performance

**Azure Application Insights:**

1. Go to https://portal.azure.com
2. Navigate to **Application Insights** → Your resource
3. Check key metrics:
   - Request rate
   - Response time
   - Failed requests
   - Dependency calls (Graph API, OpenAI)

**Custom Dashboards:**

Create dashboard showing:
- Meetings processed per day
- Average processing time
- AI accuracy rate (approval without edits)
- Customer usage by tenant
- Infrastructure costs per tenant

**Alerts:**

Set up alerts for:
- Response time >2 seconds
- Error rate >1%
- Database connection failures
- Azure OpenAI rate limiting

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: "Failed to authenticate with Azure AD"

**Symptoms:** Login fails, shows error page

**Solutions:**
1. Verify redirect URI matches exactly (including trailing slash)
2. Check client secret is correct and not expired
3. Verify tenant ID is correct
4. Check browser allows cookies from domain
5. For multi-tenant: Verify app registration supports multi-tenant authentication

#### Issue: "Database connection failed"

**Symptoms:** App crashes on startup, health check fails

**Solutions:**
1. Verify DATABASE_URL is correct
2. Check Azure NSG rules allow traffic from App Service subnet to database subnet
3. Verify database user has correct permissions
4. Check private endpoint connection is established
5. Verify database firewall rules allow App Service VNET
6. For multi-tenant: Check tenant_id context is set correctly

#### Issue: "Azure OpenAI API error 401"

**Symptoms:** Minutes generation fails

**Solutions:**
1. Verify API key is correct
2. Check endpoint URL format: `https://resource.openai.azure.com/`
3. Verify deployment name matches (case-sensitive)
4. Check Azure OpenAI resource is in same subscription
5. Verify API key has not expired or been rotated

#### Issue: "SharePoint upload failed"

**Symptoms:** Minutes approved but SharePoint URL is null

**Solutions:**
1. Verify Sites.Selected permission granted
2. Check site URL is correct (case-sensitive)
3. Verify library name exists
4. Check folder structure created
5. Verify app has write permission to site
6. For multi-tenant: Check tenant-specific site exists

#### Issue: "Teams webhook not receiving events"

**Symptoms:** Meetings not auto-captured

**Solutions:**
1. Check webhook subscription exists (Graph API)
2. Verify notificationUrl is publicly accessible (not localhost)
3. Check SSL certificate is valid
4. Verify webhook endpoint responds to validation request
5. Check subscription not expired (renews every 3 days)
6. For multi-tenant: Verify each tenant has active subscription

#### Issue: "Tenant isolation breach detected"

**Symptoms:** User sees data from different tenant

**Solutions:**
1. Verify tenant_id context set on all requests
2. Check row-level security policies enabled
3. Verify middleware validates tenant access
4. Check connection pooling not mixing tenant contexts
5. Review audit logs for unauthorized access attempts

### 10.2 Diagnostic Commands

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Test Azure OpenAI
curl "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview" \
  -H "api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Test SharePoint access
curl "https://graph.microsoft.com/v1.0/sites/SITE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check webhook subscription
curl "https://graph.microsoft.com/v1.0/subscriptions" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test tenant isolation
psql $DATABASE_URL -c "SELECT COUNT(*) FROM meetings WHERE tenant_id = 'test-tenant';"
```

### 10.3 Getting Help

**Documentation:**
- Microsoft Graph API: https://docs.microsoft.com/graph/
- Azure OpenAI: https://docs.microsoft.com/azure/cognitive-services/openai/
- Multi-tenant apps: https://docs.microsoft.com/azure/active-directory/develop/howto-convert-app-to-be-multi-tenant

**Support Channels:**
- Azure Support Portal
- Microsoft 365 Admin Center (Help & Support)
- Stack Overflow (tag: microsoft-graph)
- Internal support: support@meetingminutes.com

---

## Appendix A: Environment Variable Reference

### Required Variables

```bash
# Microsoft Graph API
GRAPH_TENANT_ID=          # Azure AD tenant ID (for single-tenant)
GRAPH_CLIENT_ID=          # App registration client ID
GRAPH_CLIENT_SECRET=      # App client secret

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=    # https://resource.openai.azure.com/
AZURE_OPENAI_API_KEY=     # Azure OpenAI API key
AZURE_OPENAI_DEPLOYMENT=  # Deployment name (e.g., gpt-4)

# Database
DATABASE_URL=             # PostgreSQL connection string

# Session
SESSION_SECRET=           # Random 64-character string

# SharePoint (optional for development)
SHAREPOINT_SITE_URL=      # https://tenant.sharepoint.com/sites/...
SHAREPOINT_LIBRARY=       # Library name (e.g., Minutes Archive)

# Multi-Tenant Configuration
MULTI_TENANT_ENABLED=     # true | false (default: false for dev)
TENANT_DETECTION_MODE=    # subdomain | header | path

# Application
NODE_ENV=                 # production | development
PORT=                     # 5000 (default)
PUBLIC_URL=               # https://app.meetingminutes.com
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
EMAIL_FROM=               # Default: noreply@meetingminutes.com

# Security
ENABLE_RATE_LIMITING=     # true | false (default: true)
MAX_REQUESTS_PER_MINUTE=  # Default: 60

# SOC 2 Compliance
AUDIT_LOG_RETENTION_DAYS= # Default: 365
ENABLE_ENCRYPTION_AT_REST=# true (always for production)
```

---

**Document Classification:** IBM Confidential - Commercial Deployment Guide  
**Version:** 1.0  
**Last Updated:** November 2025  
**Review Cycle:** Quarterly or after major platform updates
