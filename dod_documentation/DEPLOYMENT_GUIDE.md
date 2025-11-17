# Deployment Guide
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Deployment instructions for the DOD Teams Meeting Minutes Management System across development, pilot, and Azure Government (GCC High) production environments

**Architecture Status:** Production-ready design for 16-week implementation timeline. This guide covers the complete deployment process from Azure infrastructure provisioning through production launch.

**What You're Deploying:** An enterprise-grade autonomous meeting minutes system with backend services, database schema, API layer, workflow engine, Microsoft Graph integrations, and comprehensive frontend UI - all following DOD security and compliance requirements.

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

✅ **Database:**
- Full PostgreSQL schema with 7 tables
- Migration system (Drizzle ORM)
- Session management
- Job queue persistence

✅ **API Layer:**
- 15+ RESTful endpoints
- Authentication middleware
- Webhook receivers for Microsoft Teams
- Health check endpoints

✅ **Integration Layer:**
- Microsoft Teams meeting capture
- SharePoint document archival
- Azure OpenAI processing
- Email distribution via Graph API

✅ **Frontend:** React application with comprehensive UI (Microsoft Fluent + IBM Carbon design, WCAG 2.1 AA accessibility, dual-theme system)

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Microsoft 365 Test Environment Setup](#2-microsoft-365-test-environment-setup)
3. [Azure AD Application Registration](#3-azure-ad-application-registration)
4. [Azure OpenAI Setup](#4-azure-openai-setup)
5. [SharePoint Configuration](#5-sharepoint-configuration)
6. [Replit Development Deployment](#6-replit-development-deployment)
7. [Azure Government Production Deployment](#7-azure-government-production-deployment)
8. [Teams App Packaging and Installation](#8-teams-app-packaging-and-installation)
9. [Post-Deployment Configuration](#9-post-deployment-configuration)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Reference

### 1.1 Deployment Timeline

| Environment | Duration | Key Steps |
|------------|----------|-----------|
| **Development/Testing** | 3-4 hours | M365 trial + Azure AD + Replit setup |
| **Azure Government Production** | 6-8 hours | Infrastructure + DB + Application + Teams app |
| **DOD Validation Testing** | 5 hours | Complete validation before production |

### 1.2 Cost Estimates

**Note:** Production architecture uses multi-scale-unit App Service Environment (ASEv3) design with auto-scaling capability to support up to 300,000 concurrent users if necessary. See SCALABILITY_ARCHITECTURE.md for detailed capacity planning.

| Environment | Monthly Cost | Components |
|------------|-------------|------------|
| **Development (Replit)** | $15-20 | Azure OpenAI only (M365 trial free, PostgreSQL included) |
| **Azure Government Baseline (10K users)** | $54,150 | 3× ASEv3, 18× I3v2 instances, 12× PostgreSQL shards, Azure Front Door, Azure OpenAI |
| **Azure Government Peak (300K users)** | $1,088,200 | 12× ASEv3, 880× I3v2 instances, 12× scaled PostgreSQL shards, Azure Front Door, Azure OpenAI |

**Deployment Model:** This guide covers Replit development deployment. Production Azure Government deployment requires Infrastructure-as-Code (Terraform/Bicep) and is documented in SCALABILITY_ARCHITECTURE.md Section 7.

### 1.3 Prerequisites Checklist

**For All Deployments:**
- [ ] Microsoft 365 admin access (Global Administrator role)
- [ ] Azure Government (GCC High) subscription with billing enabled
- [ ] Domain name (optional but recommended)
- [ ] Credit card for Azure services

**For Azure Government Production:**
- [ ] Azure Government subscription (GCC High or DOD)
- [ ] Azure CLI installed and configured
- [ ] Appropriate clearance levels for administrators

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

**Purpose:** Support multi-level access control for 300,000+ users

#### Step 1: Navigate to Groups

1. Go to https://portal.azure.com
2. Sign in as admin
3. Navigate to **Azure Active Directory** → **Groups** → **All groups**

#### Step 2: Create Clearance-Level Groups

Click **+ New group** for each:

**Group 1: UNCLASSIFIED Clearance**
- Group type: **Security**
- Group name: `Clearance-UNCLASSIFIED`
- Description: `Users cleared for UNCLASSIFIED meetings`
- Membership type: **Assigned** (or Dynamic for automation)
- Add members: All test users

**Group 2: CONFIDENTIAL Clearance**
- Group type: **Security**
- Group name: `Clearance-CONFIDENTIAL`
- Description: `Users cleared for CONFIDENTIAL meetings (includes UNCLASSIFIED)`
- Membership type: **Assigned**
- Add members: jane.smith, bob.johnson

**Group 3: SECRET Clearance**
- Group type: **Security**
- Group name: `Clearance-SECRET`
- Description: `Users cleared for SECRET meetings (includes all lower)`
- Membership type: **Assigned**
- Add members: jane.smith only

#### Step 3: Create Role Groups

**Group 4: Viewer Role**
- Group name: `Role-Viewer`
- Description: `Can view meetings they attended`
- Add members: john.doe, charlie.brown

**Group 5: Editor Role**
- Group name: `Role-Editor`
- Description: `Can edit minutes before approval`
- Add members: bob.johnson

**Group 6: Approver Role**
- Group name: `Role-Approver`
- Description: `Can approve/reject meeting minutes`
- Add members: bob.johnson, alice.williams

**Group 7: Admin Role**
- Group name: `Role-Admin`
- Description: `Full system access and configuration`
- Add members: jane.smith

**Success indicator:** All 7 groups created and members assigned

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
- Select **Accounts in this organizational directory only (Single tenant)**

**Redirect URI:**
- Platform: **Web**
- For Replit: `https://your-workspace.replit.app/auth/callback`
- For Azure Government: `https://your-domain.com/auth/callback`
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
- Network connectivity: **All networks** (or configure private endpoint)

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
  │   │   ├─ UNCLASSIFIED/
  │   │   ├─ CONFIDENTIAL/
  │   │   └─ SECRET/
  │   ├─ 02-February/
  │   │   └─ (same structure)
  └─ (repeat for each year/month)
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

## 7. Azure Government Production Deployment

**Document Purpose:** This section provides an overview of Azure Government (GCC High) production deployment. For detailed step-by-step instructions, refer to the comprehensive deployment plans referenced below.

### 7.1 Overview

The DOD Teams Meeting Minutes Management System deploys exclusively to **Azure Government (GCC High)** cloud infrastructure to meet DOD security requirements and compliance standards.

**IMPORTANT:** This section provides a simplified overview. Production deployment uses a **multi-scale-unit App Service Environment (ASEv3) architecture** with horizontally sharded databases. For complete deployment instructions, see SCALABILITY_ARCHITECTURE.md Section 7.

**Key Characteristics:**
- **Scale:** Auto-scaling capability to support up to 300,000 concurrent users (baseline: 10,000 users)
- **Classification:** Supports UNCLASSIFIED, CONFIDENTIAL, and SECRET classifications with IL5 data segregation
- **Compliance:** FedRAMP High, DISA SRG Level 5, IL5 boundary
- **Architecture:** Multi-scale-unit ASEv3 clusters (12 units max) with 12 horizontally sharded PostgreSQL databases

### 7.2 Production Architecture Overview

**Note:** The following diagram shows the multi-scale-unit production architecture. Development deployment on Replit uses a simplified single-instance configuration.

```
┌─────────────────────────────────────────────────────────────────────┐
│              Azure Government (GCC High) Cloud                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Microsoft 365 GCC High                                             │
│  ├─ Teams (Meeting Capture via Graph API .us endpoints)            │
│  ├─ SharePoint (IL5-compliant Document Archival)                   │
│  ├─ Exchange (Email Distribution)                                   │
│  └─ Azure AD (CAC/PIV Authentication + Clearance-based RBAC)       │
│                                                                      │
│  Azure Front Door Premium                                           │
│  ├─ Global Load Balancing & Classification-based Routing            │
│  ├─ WAF + DDoS Protection                                           │
│  └─ TLS 1.2+ Termination                                            │
│                                                                      │
│  Multi-Scale-Unit ASE Clusters (Classification-Specific VNets)      │
│  ├─ BASELINE (10K users): 3 ASEv3, 18 I3v2 instances               │
│  │  • UNCLASS: 1 ASEv3 (12 instances) - VNet 10.0.0.0/16           │
│  │  • CONF: 1 ASEv3 (4 instances) - VNet 10.10.0.0/16              │
│  │  • SECRET: 1 ASEv3 (2 instances) - VNet 10.20.0.0/16 (no egress)│
│  │                                                                   │
│  └─ PEAK (300K users): 12 ASEv3, 880 I3v2 instances                │
│     • UNCLASS: 6 ASEv3 (600 instances)                              │
│     • CONF: 4 ASEv3 (240 instances)                                 │
│     • SECRET: 2 ASEv3 (40 instances)                                │
│                                                                      │
│  Horizontally Sharded PostgreSQL (12 shards total)                  │
│  ├─ UNCLASS: 6 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)      │
│  ├─ CONF: 4 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)         │
│  └─ SECRET: 2 shards (GP_Gen5_4-8 baseline, GP_Gen5_16 peak)       │
│     • HSM-backed CMK encryption (Key Vault Premium)                 │
│     • 90-day backups, private endpoint only                         │
│                                                                      │
│  Azure OpenAI Service (GCC High)                                    │
│  ├─ GPT-4o + Whisper Models                                         │
│  ├─ 100K TPM Capacity                                               │
│  └─ Regional Deployment (Virginia)                                  │
│                                                                      │
│  Azure Key Vault (Standard + Premium HSM)                           │
│  ├─ SECRET database encryption (Premium HSM, FIPS 140-2 Level 2)   │
│  ├─ CONF database encryption (Standard, Customer-Managed Keys)      │
│  └─ Application secrets and certificates                            │
│                                                                      │
│  Azure Monitor + Application Insights                               │
│  ├─ Classification-aware audit logging                              │
│  ├─ Performance monitoring across all ASE clusters                  │
│  └─ 7-year log retention for SECRET data                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Resource Blueprint

**BASELINE Configuration (10,000 concurrent users):**

| Resource Category | Configuration | Purpose | Monthly Cost |
|----------|------------------|---------|--------------|
| **Compute (ASEv3)** | 3× ASE, 18× I3v2 instances | Classification-specific application hosting | $28,350 |
| **Database** | 12× PostgreSQL shards (GP_Gen5_4-8) | Horizontally sharded storage | $14,400 |
| **Azure Front Door** | Premium tier, WAF enabled | Global load balancing & routing | $5,000 |
| **Azure OpenAI** | GPT-4o + Whisper, 100K TPM | AI processing | $4,000 |
| **Key Vault** | Standard + Premium (HSM for SECRET) | Secrets & encryption key management | $1,200 |
| **Networking** | 3× VNets, Private Endpoints, NSGs | Classification-specific network isolation | $800 |
| **Monitoring** | Application Insights, 7-year retention | Audit logging & performance monitoring | $400 |
| **TOTAL BASELINE** | | | **$54,150/month** |

**PEAK Configuration (300,000 concurrent users - sustained load):**

| Resource Category | Configuration | Purpose | Monthly Cost |
|----------|------------------|---------|--------------|
| **Compute (ASEv3)** | 12× ASE, 880× I3v2 instances | Scaled classification-specific hosting | $939,600 |
| **Database** | 12× PostgreSQL shards (GP_Gen5_16) | Scaled sharded storage | $115,200 |
| **Azure Front Door** | Premium tier, WAF enabled | Global load balancing & routing | $10,000 |
| **Azure OpenAI** | GPT-4o + Whisper, scaled capacity | AI processing | $15,000 |
| **Key Vault** | Standard + Premium (HSM for SECRET) | Secrets & encryption key management | $2,400 |
| **Networking** | 12× VNets, Private Endpoints, NSGs | Classification-specific network isolation | $4,000 |
| **Monitoring** | Application Insights, 7-year retention | Audit logging & performance monitoring | $2,000 |
| **TOTAL PEAK** | | | **$1,088,200/month** |

**Note:** For complete cost breakdown including read replicas, Azure Monitor metrics, and operational overhead, see SCALABILITY_ARCHITECTURE.md Section 9.

### 7.4 Deployment Workflow Summary

**High-Level Deployment Steps:**

1. **Prerequisites Validation** (1-2 days)
   - Azure Government (GCC High) subscription active
   - Microsoft 365 GCC High tenant configured
   - Azure AD admin permissions verified
   - Clearance levels documented for administrators

2. **Phase 1: Azure Infrastructure** (2-3 days)
   - Create Resource Group in usgovvirginia region
   - Deploy VNET with subnets (public, app, data, management)
   - Configure Network Security Groups (NSGs)
   - Deploy Azure Database for PostgreSQL Flexible Server
   - Set up private endpoints for database

3. **Phase 2: Application Services** (2-3 days)
   - Deploy App Service Environment v3 (ASEv3) clusters
   - Configure classification-specific VNets (UNCLASS, CONF, SECRET)
   - Deploy I3v2 instances with Node.js 20 runtime
   - Configure auto-scaling rules per classification level
   - Deploy Azure Front Door Premium for global load balancing

4. **Phase 3: AI & Integration** (1-2 days)
   - Provision Azure OpenAI Service
   - Deploy GPT-4 model
   - Configure Microsoft Graph API application
   - Set up SharePoint site and document libraries

5. **Phase 4: Security Configuration** (1-2 days)
   - Create Azure Key Vault
   - Store all secrets and certificates
   - Configure Managed Identities
   - Set up Azure AD group-based RBAC
   - Implement clearance-level access control

6. **Phase 5: Application Deployment** (1 day)
   - Deploy application code to App Service
   - Run database migrations
   - Configure environment variables from Key Vault
   - Verify health checks

7. **Phase 6: Microsoft Teams Integration** (1-2 days)
   - Package Teams app manifest
   - Install Teams app in tenant
   - Configure Graph API webhooks
   - Test meeting capture workflow

8. **Phase 7: Testing & Validation** (3-5 days pilot / 7-14 days production)
   - End-to-end workflow testing
   - Security validation (clearance levels, classifications)
   - Performance testing (load, scale)
   - User acceptance testing
   - Security Authority to Operate (ATO) preparation

### 7.5 Comprehensive Deployment Documentation

For detailed step-by-step deployment instructions, configuration examples, troubleshooting guides, and security hardening procedures, refer to these comprehensive deployment plans:

| Deployment Scenario | Document | Lines | Timeline | Users |
|-------------------|----------|-------|----------|-------|
| **Pilot (Recommended First Step)** | `AZURE_GOV_PILOT_PLAN.md` | 1,282 | 2-4 weeks | 50-100 |
| **Production (Full Scale)** | `AZURE_GOV_IMPLEMENTATION_PLAN.md` | Comprehensive | 16 weeks (+16mo ATO) | 300,000 |
| **Scaling (Pilot → Production)** | `PILOT_TO_PRODUCTION_SCALING.md` | Detailed | 1 day | 100 → 300K |

**Key Documents:**

1. **AZURE_GOV_PILOT_PLAN.md**
   - Cost-optimized pilot deployment ($1,500-2,500/month)
   - Simplified architecture for 50-100 users
   - 60-day evaluation period
   - Built-in scaling path to production
   - Go/no-go decision framework
   - Complete Azure CLI commands and configuration examples

2. **AZURE_GOV_IMPLEMENTATION_PLAN.md**
   - Production-grade architecture with auto-scaling for up to 300,000 concurrent users
   - High availability, disaster recovery, security hardening
   - FedRAMP High, DISA SRG Level 5 compliance
   - Complete resource manifests and deployment scripts
   - ATO preparation guidance
   - Monitoring, alerting, and incident response procedures

3. **PILOT_TO_PRODUCTION_SCALING.md**
   - Multi-day upgrade procedure from pilot to production
   - Infrastructure scaling to multi-scale-unit ASEv3 architecture
   - Database shard deployment and data migration
   - Cost impact analysis (baseline → peak capacity)
   - Performance validation procedures

### 7.6 Prerequisites for Azure Government Deployment

**Required Access:**
- [ ] Azure Government subscription (GCC High or DOD)
- [ ] Microsoft 365 GCC High tenant
- [ ] Azure AD Global Administrator access
- [ ] Billing account configured
- [ ] SECRET clearance for system administrators (production)

**Required Tools:**
- [ ] Azure CLI configured for Azure Government (`az cloud set --name AzureUSGovernment`)
- [ ] PowerShell 7+ with Az modules
- [ ] Node.js 20 LTS for local development/testing
- [ ] Git for source control

**Required Documentation:**
- [ ] Security Authorization to Operate (ATO) requirements (production)
- [ ] Data classification policies documented
- [ ] Incident response procedures defined
- [ ] Disaster recovery plan approved

---

## 8. Teams App Packaging and Installation

### 8.1 Create App Manifest

#### Step 1: Create manifest.json

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_APP_CLIENT_ID",
  "packageName": "com.yourorg.meetingminutes",
  "developer": {
    "name": "Your Organization",
    "websiteUrl": "https://your-domain.com",
    "privacyUrl": "https://your-domain.com/privacy",
    "termsOfUseUrl": "https://your-domain.com/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "DOD Teams Meeting Minutes Management System"
  },
  "description": {
    "short": "Automated Teams meeting minutes generation and distribution",
    "full": "Automatically captures, processes, and distributes Teams meeting minutes with AI-powered summarization, action item extraction, and SharePoint archival."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "configurableTabs": [],
  "staticTabs": [{
    "entityId": "dashboard",
    "name": "Dashboard",
    "contentUrl": "https://your-domain.com/",
    "scopes": ["personal"]
  }],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "your-domain.com"
  ],
  "webApplicationInfo": {
    "id": "YOUR_APP_CLIENT_ID",
    "resource": "api://your-domain.com/YOUR_APP_CLIENT_ID"
  }
}
```

#### Step 2: Create App Icons

**Color icon (color.png):**
- Size: 192x192 pixels
- Format: PNG
- Use your organization branding

**Outline icon (outline.png):**
- Size: 32x32 pixels
- Format: PNG
- Transparent background, white icon

### 8.2 Package App

```bash
# Create app package directory
mkdir teams-app
cd teams-app

# Add files
# - manifest.json
# - color.png
# - outline.png

# Create ZIP package
zip -r meeting-minutes-app.zip manifest.json color.png outline.png
```

### 8.3 Install App in Teams

#### Method 1: Upload to Teams Admin Center (Recommended)

1. Go to https://admin.teams.microsoft.com
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app** → **Upload**
4. Select `meeting-minutes-app.zip`
5. Click **Submit**
6. Wait for approval (instant for admin)

#### Method 2: Sideload Directly (Testing Only)

1. Open Teams web or desktop client
2. Click **Apps** in left sidebar
3. Click **Manage your apps**
4. Click **Upload a custom app** → **Upload for me or my teams**
5. Select `meeting-minutes-app.zip`
6. Click **Add**

### 8.4 Pin App to Sidebar

1. In Teams, click **Apps**
2. Search for "Meeting Minutes"
3. Right-click app → **Pin**
4. App now appears in left sidebar

**Success indicator:** App opens in Teams, shows login page

---

## 9. Post-Deployment Configuration

### 9.1 Verify Application Health

```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Expected response:
{"status":"healthy","database":"connected","timestamp":"2025-11-06T..."}
```

### 9.2 Configure Teams Webhook Subscription

**Automatic on first login:**
- Webhook subscribed when admin first logs in
- Check logs for: `[GraphWebhookService] Subscription created`

**Manual subscription (if needed):**
```http
POST https://graph.microsoft.com/v1.0/subscriptions
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "changeType": "created",
  "notificationUrl": "https://your-domain.com/api/webhooks/teams",
  "resource": "communications/onlineMeetings",
  "expirationDateTime": "2025-12-06T00:00:00Z",
  "clientState": "YOUR_SECRET_VALUE"
}
```

### 9.3 Test End-to-End Workflow

1. **Schedule Teams meeting:**
   - Create meeting with 2-3 test users
   - Add meeting description/agenda
   
2. **Conduct meeting:**
   - Join meeting with test users
   - Enable Teams recording
   - Have 5-minute discussion
   - End meeting

3. **Wait for processing:**
   - System should auto-detect completed meeting
   - Check dashboard for "Processing" status
   - Wait 2-3 minutes for AI generation

4. **Review minutes:**
   - Open meeting in app
   - Verify minutes content
   - Check action items extracted

5. **Approve minutes:**
   - Click "Approve"
   - Verify email distribution
   - Check SharePoint archival

**Success indicators:**
- ✅ Meeting auto-captured
- ✅ Minutes generated
- ✅ Action items extracted
- ✅ Email sent to attendees
- ✅ Document uploaded to SharePoint

### 9.4 Monitor Logs

**Azure Monitor (Production):**
```bash
# Stream logs from Azure App Service
az webapp log tail --name app-teams-minutes-prod --resource-group rg-teams-minutes
```

**Replit Console (Development):**
- Click **Console** tab
- Monitor real-time logs

**Key log patterns to verify:**
- `[GraphWebhookService] Received meeting notification`
- `[MeetingOrchestrator] Processing meeting`
- `[MinutesGenerator] Generated minutes`
- `[SharePointClient] Uploaded document`
- `[EmailService] Sent distribution email`

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

#### Issue: "Database connection failed"

**Symptoms:** App crashes on startup, health check fails

**Solutions:**
1. Verify DATABASE_URL is correct
2. Check Azure NSG rules allow traffic from App Service subnet to database subnet
3. Verify database user has correct permissions
4. Check private endpoint connection is established
5. Verify database firewall rules allow App Service VNET

#### Issue: "Azure OpenAI API error 401"

**Symptoms:** Minutes generation fails

**Solutions:**
1. Verify API key is correct
2. Check endpoint URL format: `https://resource.openai.azure.com/`
3. Verify deployment name matches (case-sensitive)
4. Check Azure OpenAI resource is in same subscription

#### Issue: "SharePoint upload failed"

**Symptoms:** Minutes approved but SharePoint URL is null

**Solutions:**
1. Verify Sites.Selected permission granted
2. Check site URL is correct (case-sensitive)
3. Verify library name exists
4. Check folder structure created
5. Verify app has write permission to site

#### Issue: "Teams webhook not receiving events"

**Symptoms:** Meetings not auto-captured

**Solutions:**
1. Check webhook subscription exists (Graph API)
2. Verify notificationUrl is publicly accessible (not localhost)
3. Check SSL certificate is valid
4. Verify webhook endpoint responds to validation request
5. Check subscription not expired (renews every 3 days)

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
```

### 10.3 Getting Help

**Documentation:**
- Microsoft Graph API: https://docs.microsoft.com/graph/
- Azure OpenAI: https://docs.microsoft.com/azure/cognitive-services/openai/
- Teams Apps: https://docs.microsoft.com/microsoftteams/platform/

**Support Channels:**
- Azure Support Portal
- Microsoft 365 Admin Center (Help & Support)
- Stack Overflow (tag: microsoft-graph)

---

## Appendix A: Environment Variable Reference

### Required Variables

```bash
# Microsoft Graph API
GRAPH_TENANT_ID=          # Azure AD tenant ID
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

# SharePoint (optional)
SHAREPOINT_SITE_URL=      # https://tenant.sharepoint.com/sites/...
SHAREPOINT_LIBRARY=       # Library name (e.g., Minutes Archive)

# Application
NODE_ENV=                 # production | development
PORT=                     # 5000 (default)
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
EMAIL_FROM=               # Default: noreply@yourdomain.com
```

---

**Document Classification:** IBM Internal - Deployment Guide  
**Version:** 1.0  
**Last Updated:** November 2025  
**Review Cycle:** Quarterly or after major platform updates
