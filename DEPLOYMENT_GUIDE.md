# Deployment Guide
## Automated Meeting Minutes Platform

**Document Purpose:** Complete deployment instructions for all environments - from development/testing to AWS production deployment

**Last Updated:** November 2025

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Microsoft 365 Test Environment Setup](#2-microsoft-365-test-environment-setup)
3. [Azure AD Application Registration](#3-azure-ad-application-registration)
4. [Azure OpenAI Setup](#4-azure-openai-setup)
5. [SharePoint Configuration](#5-sharepoint-configuration)
6. [Replit Development Deployment](#6-replit-development-deployment)
7. [AWS Production Deployment](#7-aws-production-deployment)
8. [Teams App Packaging and Installation](#8-teams-app-packaging-and-installation)
9. [Post-Deployment Configuration](#9-post-deployment-configuration)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Reference

### 1.1 Deployment Timeline

| Environment | Duration | Key Steps |
|------------|----------|-----------|
| **Development/Testing** | 3-4 hours | M365 trial + Azure AD + Replit setup |
| **AWS Production** | 6-8 hours | Infrastructure + DB + Application + Teams app |
| **Full Commercial Testing** | 5 hours | Complete validation before production |

### 1.2 Cost Estimates

| Environment | Monthly Cost | Components |
|------------|-------------|------------|
| **Development** | $15-20 | Azure OpenAI only (M365 trial free) |
| **AWS Production** | $1,700-2,000 | ECS Fargate, RDS, Secrets Manager |
| **Azure Production** | $1,500-1,800 | AKS, Azure Database, Key Vault |

### 1.3 Prerequisites Checklist

**For All Deployments:**
- [ ] Microsoft 365 admin access (Global Administrator role)
- [ ] Azure subscription with billing enabled
- [ ] Domain name (optional but recommended)
- [ ] Credit card for Azure services

**For AWS Deployment:**
- [ ] AWS account with admin access
- [ ] AWS CLI installed and configured
- [ ] Docker installed locally

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
- For AWS: `https://your-domain.com/auth/callback`
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

## 7. AWS Production Deployment

### 7.1 Infrastructure Setup

#### Step 1: Create RDS PostgreSQL Database

**Using AWS Console:**

1. Go to AWS Console → **RDS** → **Create database**
2. Configure:
   - **Engine:** PostgreSQL 15.4
   - **Templates:** Production
   - **DB instance identifier:** `meeting-minutes-db`
   - **Master username:** `dbadmin`
   - **Master password:** Generate strong password (save it!)
   - **Instance type:** db.t3.medium (or larger for 300K users)
   - **Storage:** 50 GB SSD, enable auto-scaling
   - **Multi-AZ:** Yes (for high availability)
   - **VPC:** Choose your VPC
   - **Public access:** No
   - **Encryption:** Enabled
3. Click **Create database**
4. Wait 10-15 minutes for provisioning

**Save these values:**
```
Endpoint: xxx.rds.amazonaws.com
Port: 5432
Database: postgres
```

#### Step 2: Create IAM Role for Application

```bash
# Create IAM role for ECS task
aws iam create-role \
  --role-name MeetingMinutesECSRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name MeetingMinutesECSRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam attach-role-policy \
  --role-name MeetingMinutesECSRole \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
```

### 7.2 Store Secrets in AWS Secrets Manager

```bash
# Database credentials
aws secretsmanager create-secret \
  --name meeting-minutes/database \
  --secret-string '{
    "host": "xxx.rds.amazonaws.com",
    "port": 5432,
    "database": "postgres",
    "username": "dbadmin",
    "password": "YOUR_DB_PASSWORD"
  }'

# Microsoft Graph API
aws secretsmanager create-secret \
  --name meeting-minutes/microsoft \
  --secret-string '{
    "tenantId": "YOUR_TENANT_ID",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET"
  }'

# Azure OpenAI
aws secretsmanager create-secret \
  --name meeting-minutes/openai \
  --secret-string '{
    "endpoint": "https://your-resource.openai.azure.com/",
    "apiKey": "YOUR_OPENAI_KEY",
    "deployment": "gpt-4"
  }'

# SharePoint
aws secretsmanager create-secret \
  --name meeting-minutes/sharepoint \
  --secret-string '{
    "siteUrl": "https://yourtenant.sharepoint.com/sites/meetingminutes",
    "library": "Minutes Archive"
  }'

# Session secret
aws secretsmanager create-secret \
  --name meeting-minutes/session \
  --secret-string "$(openssl rand -hex 32)"
```

### 7.3 Build and Push Docker Image

#### Step 1: Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

#### Step 2: Build and Push

```bash
# Create ECR repository
aws ecr create-repository --repository-name meeting-minutes

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t meeting-minutes .

# Tag image
docker tag meeting-minutes:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/meeting-minutes:latest

# Push image
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/meeting-minutes:latest
```

### 7.4 Deploy to ECS Fargate

#### Step 1: Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name meeting-minutes-cluster
```

#### Step 2: Create Task Definition

```json
{
  "family": "meeting-minutes",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/MeetingMinutesECSRole",
  "containerDefinitions": [{
    "name": "app",
    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/meeting-minutes:latest",
    "portMappings": [{
      "containerPort": 5000,
      "protocol": "tcp"
    }],
    "secrets": [
      {"name": "DATABASE_URL", "valueFrom": "meeting-minutes/database:host::"},
      {"name": "GRAPH_TENANT_ID", "valueFrom": "meeting-minutes/microsoft:tenantId::"},
      {"name": "GRAPH_CLIENT_ID", "valueFrom": "meeting-minutes/microsoft:clientId::"},
      {"name": "GRAPH_CLIENT_SECRET", "valueFrom": "meeting-minutes/microsoft:clientSecret::"},
      {"name": "AZURE_OPENAI_ENDPOINT", "valueFrom": "meeting-minutes/openai:endpoint::"},
      {"name": "AZURE_OPENAI_API_KEY", "valueFrom": "meeting-minutes/openai:apiKey::"},
      {"name": "SESSION_SECRET", "valueFrom": "meeting-minutes/session::"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/meeting-minutes",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

Register task definition:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

#### Step 3: Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name meeting-minutes-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing

# Create target group
aws elbv2 create-target-group \
  --name meeting-minutes-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /api/health

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=<TG_ARN>
```

#### Step 4: Create ECS Service

```bash
aws ecs create-service \
  --cluster meeting-minutes-cluster \
  --service-name meeting-minutes-service \
  --task-definition meeting-minutes:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-xxx,subnet-yyy],
    securityGroups=[sg-xxx],
    assignPublicIp=DISABLED
  }" \
  --load-balancers "targetGroupArn=<TG_ARN>,containerName=app,containerPort=5000"
```

**Success indicator:** Service shows RUNNING status, tasks healthy in target group

### 7.5 Configure DNS

1. Get ALB DNS name from AWS Console
2. Create CNAME record in your DNS provider:
   - Name: `meeting-minutes.yourdomain.com`
   - Type: CNAME
   - Value: `meeting-minutes-alb-xxx.us-east-1.elb.amazonaws.com`
3. Wait for DNS propagation (5-30 minutes)

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
    "full": "Automated Meeting Minutes Management"
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

**AWS CloudWatch:**
```bash
aws logs tail /ecs/meeting-minutes --follow
```

**Replit Console:**
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
2. Check RDS security group allows traffic from ECS tasks
3. Verify database user has correct permissions
4. Check database is in same VPC/region

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
