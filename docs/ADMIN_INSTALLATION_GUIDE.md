# Administrator Installation Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Architecture Overview](#architecture-overview)
4. [Windows Installation](#windows-installation)
5. [Linux Installation](#linux-installation)
6. [Azure Configuration](#azure-configuration)
7. [Microsoft 365 Configuration](#microsoft-365-configuration)
8. [Teams App Deployment](#teams-app-deployment)
9. [Post-Installation Verification](#post-installation-verification)
10. [Maintenance](#maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

This guide is for **IT administrators** who need to install, configure, and maintain the Teams Meeting Minutes application. It covers deployment on both Windows and Linux environments.

### What This Guide Covers

- Server infrastructure setup
- Azure resource provisioning
- Microsoft 365 integration
- Teams app deployment
- Ongoing maintenance

### What You'll Need

- Azure subscription with appropriate permissions
- Microsoft 365 tenant with Global Administrator access
- Teams Administrator privileges
- Basic command-line knowledge

---

## Prerequisites

### Azure Requirements

| Requirement | Details |
|-------------|---------|
| Azure Subscription | Active subscription with billing enabled |
| Role | Contributor or Owner on the subscription |
| Azure AD | Ability to create app registrations |
| Azure OpenAI | Access to Azure OpenAI Service (requires application) |

### Microsoft 365 Requirements

| Requirement | Details |
|-------------|---------|
| License | Microsoft 365 E3/E5 or Teams Premium for transcription |
| Role | Global Administrator for initial setup |
| Teams Admin | Teams Administrator for app deployment |
| SharePoint | SharePoint site for document archival (optional) |

### Development Tools

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18.x LTS or higher | https://nodejs.org |
| Git | Latest | https://git-scm.com |
| Azure CLI | Latest | https://docs.microsoft.com/cli/azure |
| Docker | Latest (optional) | https://docker.com |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Microsoft Teams Client                       │
│                    (Desktop/Web/Mobile)                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Teams SSO Token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Azure Container Apps                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Express Server                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Auth/SSO    │  │ API Routes  │  │ Webhook Handler │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Job Worker  │  │ AI Service  │  │ Graph Client    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Azure Database  │  │ Azure OpenAI    │  │ Microsoft Graph │
│ for PostgreSQL  │  │ (GPT-4o)        │  │ API             │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| **Azure Container Apps** | Hosts the application with auto-scaling |
| **Azure Database for PostgreSQL** | Stores meetings, minutes, and job queue |
| **Azure OpenAI** | Generates meeting minutes using GPT-4o |
| **Microsoft Graph API** | Accesses Teams meetings, transcripts, calendars |
| **Azure AD** | Authentication and authorization |

---

## Windows Installation

### Step 1: Install Prerequisites

1. **Install Node.js**
   - Download from https://nodejs.org
   - Choose LTS version (18.x or higher)
   - Run installer, accept defaults
   - Verify: Open PowerShell and run:
   ```powershell
   node --version
   npm --version
   ```

   ![Screenshot: Node.js version check in PowerShell]

2. **Install Git**
   - Download from https://git-scm.com
   - Run installer, accept defaults
   - Verify:
   ```powershell
   git --version
   ```

3. **Install Azure CLI**
   - Download from https://docs.microsoft.com/cli/azure/install-azure-cli-windows
   - Run MSI installer
   - Verify:
   ```powershell
   az --version
   ```

### Step 2: Clone the Repository

```powershell
# Navigate to your preferred directory
cd C:\Projects

# Clone the repository
git clone https://github.com/your-org/teams-meeting-minutes.git

# Navigate into the project
cd teams-meeting-minutes
```

### Step 3: Install Dependencies

```powershell
# Install Node.js dependencies
npm install
```

### Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```powershell
   copy .env.example .env
   ```

2. Edit `.env` with your configuration:
   ```powershell
   notepad .env
   ```

3. Set the required variables (see [Environment Variables](#environment-variables) section)

### Step 5: Initialize Database

```powershell
# Push schema to database
npm run db:push
```

### Step 6: Build and Run

**For Development:**
```powershell
npm run dev
```

**For Production:**
```powershell
npm run build
npm start
```

The application will be available at `http://localhost:5000`

---

## Linux Installation

### Step 1: Install Prerequisites

**Ubuntu/Debian:**
```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Verify installations
node --version
npm --version
git --version
az --version
```

**RHEL/CentOS:**
```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install Azure CLI
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo dnf install -y azure-cli

# Verify installations
node --version
npm --version
git --version
az --version
```

### Step 2: Clone the Repository

```bash
# Navigate to your preferred directory
cd /opt

# Clone the repository
sudo git clone https://github.com/your-org/teams-meeting-minutes.git

# Set ownership (replace 'appuser' with your user)
sudo chown -R appuser:appuser teams-meeting-minutes

# Navigate into the project
cd teams-meeting-minutes
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit with your preferred editor
nano .env
```

### Step 5: Initialize Database

```bash
npm run db:push
```

### Step 6: Set Up as Systemd Service (Production)

Create service file:
```bash
sudo nano /etc/systemd/system/teams-minutes.service
```

Add the following content:
```ini
[Unit]
Description=Teams Meeting Minutes Application
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/teams-meeting-minutes
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
# Build the application
npm run build

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable teams-minutes

# Start the service
sudo systemctl start teams-minutes

# Check status
sudo systemctl status teams-minutes
```

---

## Azure Configuration

### Step 1: Login to Azure

```bash
az login
```

### Step 2: Create Resource Group

```bash
az group create \
  --name rg-teams-minutes \
  --location eastus2
```

### Step 3: Create Azure Database for PostgreSQL

```bash
az postgres flexible-server create \
  --resource-group rg-teams-minutes \
  --name teams-minutes-db \
  --location eastus2 \
  --admin-user adminuser \
  --admin-password 'YourSecurePassword123!' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32
```

### Step 4: Create Azure Container Registry

```bash
az acr create \
  --resource-group rg-teams-minutes \
  --name teamsminutesacr \
  --sku Basic
```

### Step 5: Create Azure Container App Environment

```bash
az containerapp env create \
  --name teams-minutes-env \
  --resource-group rg-teams-minutes \
  --location eastus2
```

### Step 6: Create Azure OpenAI Resource

1. Go to Azure Portal → Create a resource → Azure OpenAI
2. Fill in details:
   - Resource group: `rg-teams-minutes`
   - Region: East US 2 (or your preferred region)
   - Name: `teams-minutes-openai`
3. Deploy GPT-4o model after resource is created

### Step 7: Create App Registration

1. Go to Azure Portal → Azure Active Directory → App registrations
2. Click **New registration**
3. Enter:
   - Name: `Teams Meeting Minutes`
   - Supported account types: Single tenant (or as required)
   - Redirect URI: `https://your-app-url/auth/callback`
4. Note the **Application (client) ID** and **Directory (tenant) ID**
5. Go to **Certificates & secrets** → **New client secret**
6. Note the secret value (you won't see it again)

---

## Microsoft 365 Configuration

### Step 1: Configure API Permissions

In your App Registration, go to **API permissions** and add:

**Microsoft Graph - Delegated:**
- User.Read
- Calendars.Read
- OnlineMeetings.Read

**Microsoft Graph - Application:**
- CallRecords.Read.All (requires admin consent)

Click **Grant admin consent** for your tenant.

### Step 2: Configure Expose an API

1. Go to **Expose an API**
2. Set **Application ID URI**:
   ```
   api://your-app-url/your-client-id
   ```
3. Add a scope:
   - Scope name: `access_as_user`
   - Who can consent: Admins and users
   - Admin consent display name: `Access Meeting Minutes`
   - Admin consent description: `Allows the app to access Meeting Minutes on behalf of the signed-in user`
   - State: Enabled

### Step 3: Authorize Teams Clients

Under **Authorized client applications**, add:

| Client ID | Description |
|-----------|-------------|
| `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Teams desktop/mobile |
| `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` | Teams web |

Select the `access_as_user` scope for each.

---

## Teams App Deployment

### Step 1: Update Manifest

Edit `teams-app/manifest.json`:

1. Replace `YOUR_CLIENT_ID` with your App Registration client ID
2. Replace `YOUR_APP_URL` with your application URL
3. Update `validDomains` with your domain

### Step 2: Create App Package

```bash
# Navigate to teams-app folder
cd teams-app

# Create ZIP file (Windows)
powershell Compress-Archive -Path * -DestinationPath teams-minutes-app.zip

# Create ZIP file (Linux/Mac)
zip -r teams-minutes-app.zip *
```

### Step 3: Upload to Teams Admin Center

1. Go to https://admin.teams.microsoft.com
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app**
4. Select your ZIP file
5. Review and approve

### Step 4: Assign App to Users

1. In Teams Admin Center, go to **Teams apps** → **Setup policies**
2. Create or edit a policy
3. Under **Pinned apps**, add your Meeting Minutes app
4. Assign the policy to users or groups

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Yes |
| `AZURE_CLIENT_ID` | App registration client ID | Yes |
| `AZURE_CLIENT_SECRET` | App registration client secret | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Yes |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Yes |
| `AZURE_OPENAI_DEPLOYMENT` | GPT-4o deployment name | Yes |
| `SESSION_SECRET` | Random string for session encryption | Yes |
| `SHAREPOINT_SITE_URL` | SharePoint site for archival | No |
| `SHAREPOINT_LIBRARY` | SharePoint document library name | No |
| `ENABLE_JOB_WORKER` | Enable background job processing | No |
| `ENABLE_GRAPH_WEBHOOKS` | Enable Graph API webhooks | No |

---

## Post-Installation Verification

### Checklist

- [ ] Application URL is accessible
- [ ] Health endpoint returns OK: `GET /health`
- [ ] Login works through Teams
- [ ] Dashboard displays correctly
- [ ] Database connection is working
- [ ] Azure OpenAI is responding

### Test Commands

```bash
# Test health endpoint
curl https://your-app-url/health

# Test database connection
npm run db:push

# View application logs
# Azure Container Apps:
az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes

# Linux systemd:
journalctl -u teams-minutes -f
```

---

## Maintenance

### Database Backups

Azure Database for PostgreSQL provides automatic backups. To configure:

1. Azure Portal → PostgreSQL server → Backup
2. Set retention period (7-35 days)
3. Enable geo-redundant backup for disaster recovery

### Log Monitoring

Enable Application Insights for comprehensive monitoring:

1. Azure Portal → Application Insights → Create
2. Connect to your Container App
3. Set up alerts for errors and performance

### Certificate Renewal

Azure Container Apps handles SSL certificates automatically. For custom domains:

1. Azure Portal → Container Apps → Custom domains
2. Add your domain
3. Configure CNAME records
4. SSL certificate is provisioned automatically

### Schema Updates

When updating the application schema:

1. **Development:** Runs automatically with `npm run db:push`
2. **Production:** Run manually via Azure Cloud Shell

```bash
# Connect to production database
export PGPASSWORD='your-password'
psql -h your-server.postgres.database.azure.com -U adminuser -d teams_minutes_db

# Or use the sync script
# See docs/DATABASE_SCHEMA_SYNC.md
```

---

## Troubleshooting

### Common Issues

#### Application Won't Start

**Symptoms:** 500 errors, blank page

**Solutions:**
1. Check environment variables are set correctly
2. Verify database connection:
   ```bash
   psql -h your-server -U adminuser -d your_database
   ```
3. Check application logs for errors

#### Authentication Failures

**Symptoms:** "Not authorized", login loops

**Solutions:**
1. Verify Azure AD app registration settings
2. Check that admin consent was granted
3. Ensure Teams client IDs are authorized
4. See `docs/TEAMS_SSO_CHECKLIST.md`

#### Database Schema Errors

**Symptoms:** SQL syntax errors, "column does not exist"

**Solutions:**
1. Sync database schema:
   ```bash
   npm run db:push
   ```
2. For production, see `docs/DATABASE_SCHEMA_SYNC.md`

#### Meetings Not Appearing

**Symptoms:** Dashboard empty, no meetings synced

**Solutions:**
1. Verify Graph API permissions are granted
2. Check that webhooks are enabled (if using)
3. Ensure meetings have transcription enabled
4. Wait 5-10 minutes after meeting ends

#### Minutes Not Generated

**Symptoms:** Meeting shows "Pending", no minutes

**Solutions:**
1. Verify Azure OpenAI is configured correctly
2. Check job worker is running (`ENABLE_JOB_WORKER=true`)
3. Verify meeting met minimum thresholds (see `docs/PROCESSING_VALIDATION.md`)

### Getting Help

For additional support:

1. Check the [User Guide](USER_GUIDE.md)
2. Review [Database Schema Sync](DATABASE_SCHEMA_SYNC.md)
3. Check [Teams SSO Checklist](TEAMS_SSO_CHECKLIST.md)
4. Review application logs

---

## Security Considerations

### Secrets Management

- Never commit secrets to source control
- Use Azure Key Vault for production secrets
- Rotate secrets every 90 days
- See `docs/DEPLOYMENT_CHECKLIST.md` for rotation schedule

### Network Security

- Enable Azure Firewall or NSG rules
- Restrict database access to application only
- Use private endpoints where possible

### Compliance

- All processing decisions are audited
- Manual overrides require justification
- See `docs/PROCESSING_VALIDATION.md` for audit fields

---

*Last Updated: December 3, 2025*
*Version: 1.0*
