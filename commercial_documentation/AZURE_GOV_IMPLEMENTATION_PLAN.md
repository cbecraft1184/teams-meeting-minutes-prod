# Microsoft Azure Government Integration & Implementation Plan
## DOD Teams Meeting Minutes Management System

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Azure Government Cloud Architecture](#azure-government-cloud-architecture)
3. [Required Azure Services](#required-azure-services)
4. [Prerequisites & Access Requirements](#prerequisites--access-requirements)
5. [Phase 1: Azure Infrastructure Setup](#phase-1-azure-infrastructure-setup)
6. [Phase 2: Microsoft Graph API Integration](#phase-2-microsoft-graph-api-integration)
7. [Phase 3: Azure OpenAI Deployment](#phase-3-azure-openai-deployment)
8. [Phase 4: Application Deployment](#phase-4-application-deployment)
9. [Phase 5: Security & Compliance](#phase-5-security--compliance)
10. [Complete Manifest](#complete-manifest)
11. [Testing & Validation](#testing--validation)
12. [Monitoring & Operations](#monitoring--operations)

---

## Executive Summary

This document provides a complete implementation plan for deploying the DOD Teams Meeting Minutes Management System to Microsoft Azure Government Cloud (GCC High/DOD). The solution will serve 300,000+ users with SECRET classification support.

**Timeline:** 16 weeks (commercial deployment) + 16 months (DOD ATO process)  
**Environment:** Azure Government (GCC High or DOD)  
**Compliance:** SOC 2 Type II, DFARS, ITAR, enterprise security standards L5  
**Scale:** 300,000 concurrent users

---

## Azure Government Cloud Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Government Cloud                       │
│                                                                   │
│  ┌──────────────────┐         ┌─────────────────────────────┐  │
│  │  Microsoft 365   │◄────────│   Azure AD (Gov)            │  │
│  │  GCC High/DOD    │         │   - SSO/Authentication      │  │
│  │  - Teams         │         │   - Group-based RBAC        │  │
│  │  - SharePoint    │         │   - Clearance Groups        │  │
│  │  - Exchange      │         └─────────────────────────────┘  │
│  └──────────────────┘                                            │
│         │                                                         │
│         │ Graph API                                              │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Application Load Balancer (WAF)             │   │
│  │              - TLS Termination                           │   │
│  │              - DDoS Protection                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          Azure App Service / Container Apps              │   │
│  │          - Node.js Application (Multi-AZ)                │   │
│  │          - Auto-scaling (2-20 instances)                 │   │
│  │          - Private VNET Integration                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                    │                                   │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────┐    ┌────────────────────────────────────┐   │
│  │ Azure OpenAI │    │   Azure Database for PostgreSQL     │   │
│  │ (Gov Cloud)  │    │   - Flexible Server                 │   │
│  │ - GPT-4      │    │   - HA with Zone Redundancy         │   │
│  │ - IL5/IL6    │    │   - Automated Backups (30 days)     │   │
│  └──────────────┘    │   - Point-in-time Recovery          │   │
│                       └────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Azure Key Vault (Gov)                       │   │
│  │              - API Keys & Secrets                        │   │
│  │              - Certificates (TLS)                        │   │
│  │              - Managed Identities                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Azure Monitor + Log Analytics               │   │
│  │              - Application Insights                      │   │
│  │              - Security Audit Logs                       │   │
│  │              - Performance Metrics                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Azure VNET (Gov)                        │
│                    10.0.0.0/16                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Public Subnet (10.0.1.0/24)                         │   │
│  │  - Application Gateway / Load Balancer               │   │
│  │  - Public IP with DDoS Protection                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Subnet (10.0.2.0/24)                    │   │
│  │  - App Service VNET Integration                      │   │
│  │  - Private Endpoints for Services                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Data Subnet (10.0.3.0/24)                           │   │
│  │  - PostgreSQL Private Endpoint                       │   │
│  │  - No Public Access                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Management Subnet (10.0.4.0/24)                     │   │
│  │  - Bastion Host (admin access)                       │   │
│  │  - Network Security Groups (NSG)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Azure Services

### Core Services

| Service | SKU/Tier | Purpose | Monthly Cost (Est.) |
|---------|----------|---------|---------------------|
| **Azure App Service** | P3v3 (2 instances min) | Application hosting | $438/instance |
| **Azure Database for PostgreSQL** | General Purpose, 8 vCores | Primary database | $580 |
| **Azure OpenAI Service** | Gov Cloud deployment | AI processing | Usage-based (~$2-5k) |
| **Azure Application Gateway** | WAF v2 | Load balancing + WAF | $246 |
| **Azure Key Vault** | Standard | Secrets management | $0.03/10k operations |
| **Azure Monitor** | Standard | Logging & monitoring | Usage-based (~$200) |
| **Azure Storage** | GRS (Geo-redundant) | Backup & logs | $0.036/GB |
| **Azure Front Door** | Premium (optional) | Global load balancing | $329 |

**Total Estimated Monthly Cost:** $4,000 - $6,000 (scales with usage)

### Identity & Access

| Service | Configuration |
|---------|--------------|
| **Azure AD (Gov)** | Premium P2 - Required for conditional access |
| **Microsoft 365 GCC High** | E5 licenses for Teams/SharePoint access |
| **Managed Identities** | System-assigned for all Azure resources |

### Security & Compliance

| Service | Purpose |
|---------|---------|
| **Azure Sentinel** | Security Information and Event Management (SIEM) |
| **Azure Policy** | Governance and compliance enforcement |
| **Azure Defender** | Threat protection for all resources |
| **Azure DDoS Protection** | Standard tier for public endpoints |

---

## Prerequisites & Access Requirements

### Required Accounts & Permissions

1. **Azure Government Subscription**
   - Verified government entity status
   - Azure Government portal access: https://portal.azure.us
   - Subscription Owner or Contributor role

2. **Microsoft 365 GCC High Tenant**
   - Already provisioned DOD tenant
   - Global Administrator access
   - Teams and SharePoint licenses for all users

3. **Azure AD Permissions**
   - Application Administrator role
   - Security Administrator role (for group management)

4. **Personnel Clearances**
   - All administrators: SECRET clearance minimum
   - US Citizenship required for Azure Gov access
   - Background check completed

### Required Approvals

- [ ] DISA Authority to Operate (ATO) process initiated
- [ ] Information System Security Officer (ISSO) assigned
- [ ] System Security Plan (SSP) approved
- [ ] FedRAMP compliance review completed
- [ ] Privacy Impact Assessment (PIA) approved

---

## Phase 1: Azure Infrastructure Setup

### Step 1.1: Create Azure Government Subscription

**Portal:** https://portal.azure.us

```bash
# Login to Azure Government Cloud
az cloud set --name AzureUSGovernment
az login

# Create Resource Group
az group create \
  --name rg-teams-minutes-prod \
  --location usgovvirginia \
  --tags Environment=Production Classification=SECRET System=TeamsMeetingMinutes
```

### Step 1.2: Configure Virtual Network

```bash
# Create VNET
az network vnet create \
  --resource-group rg-teams-minutes-prod \
  --name vnet-teams-minutes \
  --address-prefix 10.0.0.0/16 \
  --location usgovvirginia

# Create Subnets
az network vnet subnet create \
  --resource-group rg-teams-minutes-prod \
  --vnet-name vnet-teams-minutes \
  --name subnet-public \
  --address-prefix 10.0.1.0/24

az network vnet subnet create \
  --resource-group rg-teams-minutes-prod \
  --vnet-name vnet-teams-minutes \
  --name subnet-app \
  --address-prefix 10.0.2.0/24

az network vnet subnet create \
  --resource-group rg-teams-minutes-prod \
  --vnet-name vnet-teams-minutes \
  --name subnet-data \
  --address-prefix 10.0.3.0/24

az network vnet subnet create \
  --resource-group rg-teams-minutes-prod \
  --vnet-name vnet-teams-minutes \
  --name subnet-mgmt \
  --address-prefix 10.0.4.0/24
```

### Step 1.3: Setup Network Security Groups

```bash
# Create NSG for Application Subnet
az network nsg create \
  --resource-group rg-teams-minutes-prod \
  --name nsg-app \
  --location usgovvirginia

# Allow HTTPS from Load Balancer
az network nsg rule create \
  --resource-group rg-teams-minutes-prod \
  --nsg-name nsg-app \
  --name AllowHTTPS \
  --priority 100 \
  --source-address-prefixes 10.0.1.0/24 \
  --destination-port-ranges 443 \
  --access Allow \
  --protocol Tcp

# Create NSG for Data Subnet
az network nsg create \
  --resource-group rg-teams-minutes-prod \
  --name nsg-data \
  --location usgovvirginia

# Allow PostgreSQL from App Subnet only
az network nsg rule create \
  --resource-group rg-teams-minutes-prod \
  --nsg-name nsg-data \
  --name AllowPostgreSQL \
  --priority 100 \
  --source-address-prefixes 10.0.2.0/24 \
  --destination-port-ranges 5432 \
  --access Allow \
  --protocol Tcp

# Deny all other inbound
az network nsg rule create \
  --resource-group rg-teams-minutes-prod \
  --nsg-name nsg-data \
  --name DenyAllInbound \
  --priority 4096 \
  --access Deny \
  --protocol '*'
```

### Step 1.4: Deploy PostgreSQL Database

```bash
# Create PostgreSQL Server
az postgres flexible-server create \
  --resource-group rg-teams-minutes-prod \
  --name psql-teams-minutes-prod \
  --location usgovvirginia \
  --admin-user pgadmin \
  --admin-password '<SECURE_PASSWORD>' \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --version 14 \
  --storage-size 256 \
  --backup-retention 30 \
  --geo-redundant-backup Enabled \
  --high-availability Enabled \
  --zone 1 \
  --standby-zone 2 \
  --public-access None \
  --vnet vnet-teams-minutes \
  --subnet subnet-data

# Create Database
az postgres flexible-server db create \
  --resource-group rg-teams-minutes-prod \
  --server-name psql-teams-minutes-prod \
  --database-name teams_minutes

# Configure Firewall (Private VNET only)
az postgres flexible-server firewall-rule create \
  --resource-group rg-teams-minutes-prod \
  --name psql-teams-minutes-prod \
  --rule-name AllowAppSubnet \
  --start-ip-address 10.0.2.0 \
  --end-ip-address 10.0.2.255
```

### Step 1.5: Setup Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
  --resource-group rg-teams-minutes-prod \
  --name kv-teams-minutes-prod \
  --location usgovvirginia \
  --sku standard \
  --enable-purge-protection true \
  --enable-soft-delete true \
  --retention-days 90 \
  --enabled-for-deployment false \
  --enabled-for-disk-encryption false \
  --enabled-for-template-deployment true \
  --network-acls-default-action Deny

# Allow access from App Subnet
az keyvault network-rule add \
  --resource-group rg-teams-minutes-prod \
  --name kv-teams-minutes-prod \
  --subnet subnet-app \
  --vnet-name vnet-teams-minutes
```

### Step 1.6: Create Managed Identity

```bash
# Create User-Assigned Managed Identity
az identity create \
  --resource-group rg-teams-minutes-prod \
  --name id-teams-minutes-app \
  --location usgovvirginia

# Get Principal ID
PRINCIPAL_ID=$(az identity show \
  --resource-group rg-teams-minutes-prod \
  --name id-teams-minutes-app \
  --query principalId -o tsv)

# Grant Key Vault access to Managed Identity
az keyvault set-policy \
  --name kv-teams-minutes-prod \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list \
  --certificate-permissions get list
```

---

## Phase 2: Microsoft Graph API Integration

### Step 2.1: Register Azure AD Application

**Portal:** https://portal.azure.us → Azure Active Directory → App registrations

1. **Create New Registration**
   - Name: `DOD-Teams-Minutes-System`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: `https://teams-minutes.dod.mil/auth/callback`

2. **Configure API Permissions**

Required Microsoft Graph Permissions:

| Permission | Type | Purpose |
|------------|------|---------|
| `OnlineMeetings.Read.All` | Application | Read Teams meeting metadata |
| `OnlineMeetingRecording.Read.All` | Application | Access meeting recordings |
| `OnlineMeetingTranscript.Read.All` | Application | Access meeting transcripts |
| `Calendars.Read` | Application | Read meeting schedules |
| `User.Read.All` | Application | Read user/attendee information |
| `Mail.Send` | Application | Send email distribution |
| `Sites.ReadWrite.All` | Application | SharePoint archival |
| `Group.Read.All` | Application | Read Azure AD groups (clearance) |

```bash
# Grant admin consent (requires Global Admin)
# This must be done via Azure Portal
```

3. **Create Client Secret**

```bash
# Via Portal: App registrations → Certificates & secrets → New client secret
# Name: Production-Secret
# Expires: 24 months
# SAVE THE VALUE - you only see it once!
```

4. **Store in Key Vault**

```bash
# Store App ID
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-AD-CLIENT-ID \
  --value '<YOUR_CLIENT_ID>'

# Store Client Secret
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-AD-CLIENT-SECRET \
  --value '<YOUR_CLIENT_SECRET>'

# Store Tenant ID
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-AD-TENANT-ID \
  --value '<YOUR_TENANT_ID>'
```

### Step 2.2: Configure Graph API Webhooks

**Webhook Endpoint:** `https://teams-minutes.dod.mil/api/webhooks/teams`

1. **Subscribe to Meeting Events**

```javascript
// POST https://graph.microsoft.us/v1.0/subscriptions
{
  "changeType": "created,updated",
  "notificationUrl": "https://teams-minutes.dod.mil/api/webhooks/teams",
  "resource": "/communications/onlineMeetings",
  "expirationDateTime": "2025-12-31T18:23:45.9356913Z",
  "clientState": "<RANDOM_SECRET_FOR_VALIDATION>"
}
```

2. **Validation Handler**

Your application must respond to validation requests:

```javascript
// Handle validation token from Microsoft
app.post('/api/webhooks/teams', (req, res) => {
  const validationToken = req.query.validationToken;
  if (validationToken) {
    res.status(200).send(validationToken);
    return;
  }
  // Handle actual webhook notification
  processWebhook(req.body);
  res.status(202).send();
});
```

### Step 2.3: Configure SharePoint Integration

**SharePoint Site:** `https://dod.sharepoint.us/sites/TeamsMeetingMinutes`

1. **Create SharePoint Site**

```powershell
# Connect to SharePoint Online (GCC High)
Connect-SPOService -Url https://dod-admin.sharepoint.us

# Create site collection
New-SPOSite `
  -Url https://dod.sharepoint.us/sites/TeamsMeetingMinutes `
  -Owner admin@dod.mil `
  -StorageQuota 1048576 `
  -Title "Meeting Minutes Archive" `
  -Template "STS#3"
```

2. **Configure Document Library**

- Library Name: `Minutes Archive`
- Enable versioning: Yes (50 versions)
- Require check-out: No
- Content approval: Yes

3. **Add Metadata Columns**

```powershell
# Classification
Add-PnPField -Type Choice `
  -InternalName "Classification" `
  -DisplayName "Classification Level" `
  -Choices "UNCLASSIFIED","CONFIDENTIAL","SECRET" `
  -Required

# Meeting Date
Add-PnPField -Type DateTime `
  -InternalName "MeetingDate" `
  -DisplayName "Meeting Date" `
  -Required

# Organizer
Add-PnPField -Type Text `
  -InternalName "Organizer" `
  -DisplayName "Meeting Organizer"

# Approval Status
Add-PnPField -Type Choice `
  -InternalName "ApprovalStatus" `
  -DisplayName "Approval Status" `
  -Choices "Pending","Approved","Rejected"
```

---

## Phase 3: Azure OpenAI Deployment

### Step 3.1: Request Azure OpenAI Access (Gov Cloud)

**Portal:** https://customervoice.microsoft.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR7en2Ais5pxKtso_Pz4b1_xUOFA5Qk1UWDRBMjg0WFhPMkIzTzhKQ1dWNyQlQCN0PWcu

1. **Submit Access Request**
   - Organization: DOD / [Your Command]
   - Use Case: Automated meeting minutes processing
   - Data Classification: Up to SECRET
   - Expected Volume: 100,000 meetings/month

2. **Wait for Approval** (2-4 weeks typical)

### Step 3.2: Deploy Azure OpenAI Resource

```bash
# Create Azure OpenAI resource
az cognitiveservices account create \
  --name openai-teams-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --location usgovvirginia \
  --kind OpenAI \
  --sku S0 \
  --custom-domain openai-teams-minutes-prod \
  --public-network-access Disabled

# Get endpoint and key
OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name openai-teams-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --query properties.endpoint -o tsv)

OPENAI_KEY=$(az cognitiveservices account keys list \
  --name openai-teams-minutes-prod \
  --resource-group rg-teams-minutes-prod \
  --query key1 -o tsv)

# Store in Key Vault
az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-OPENAI-ENDPOINT \
  --value $OPENAI_ENDPOINT

az keyvault secret set \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-OPENAI-KEY \
  --value $OPENAI_KEY
```

### Step 3.3: Deploy GPT-4 Model

```bash
# Deploy GPT-4 model
az cognitiveservices account deployment create \
  --resource-group rg-teams-minutes-prod \
  --name openai-teams-minutes-prod \
  --deployment-name gpt-4 \
  --model-name gpt-4 \
  --model-version "0613" \
  --model-format OpenAI \
  --sku-capacity 100 \
  --sku-name Standard
```

### Step 3.4: Configure Rate Limits & Quotas

```bash
# Set Token Per Minute (TPM) quota
# Default: 10,000 TPM for Standard tier
# Request increase via support ticket for production: 100,000+ TPM

# Monitor usage
az monitor metrics list \
  --resource openai-teams-minutes-prod \
  --metric-names "TokenTransaction" \
  --aggregation Total
```

---

## Phase 4: Application Deployment

### Step 4.1: Build Production Docker Image

**File:** `Dockerfile.production`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --production=false
RUN cd client && npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

**Build and Push:**

```bash
# Login to Azure Container Registry
az acr create \
  --resource-group rg-teams-minutes-prod \
  --name acrteamsminutes \
  --sku Premium \
  --location usgovvirginia

az acr login --name acrteamsminutes

# Build image
docker build -f Dockerfile.production -t acrteamsminutes.azurecr.us/teams-minutes:latest .

# Push to ACR
docker push acrteamsminutes.azurecr.us/teams-minutes:latest
```

### Step 4.2: Deploy to Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  --resource-group rg-teams-minutes-prod \
  --name plan-teams-minutes \
  --location usgovvirginia \
  --is-linux \
  --sku P3v3 \
  --number-of-workers 2

# Create Web App
az webapp create \
  --resource-group rg-teams-minutes-prod \
  --plan plan-teams-minutes \
  --name app-teams-minutes-prod \
  --deployment-container-image-name acrteamsminutes.azurecr.us/teams-minutes:latest

# Configure Managed Identity
az webapp identity assign \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod

# Enable VNET Integration
az webapp vnet-integration add \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod \
  --vnet vnet-teams-minutes \
  --subnet subnet-app

# Configure Auto-scaling
az monitor autoscale create \
  --resource-group rg-teams-minutes-prod \
  --resource app-teams-minutes-prod \
  --resource-type Microsoft.Web/serverfarms \
  --name autoscale-teams-minutes \
  --min-count 2 \
  --max-count 20 \
  --count 2

# Add CPU-based scaling rule
az monitor autoscale rule create \
  --resource-group rg-teams-minutes-prod \
  --autoscale-name autoscale-teams-minutes \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 2
```

### Step 4.3: Configure Application Settings

```bash
# Set environment variables from Key Vault
az webapp config appsettings set \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod \
  --settings \
    NODE_ENV=production \
    PORT=5000 \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/DATABASE-URL/)" \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/AZURE-AD-CLIENT-ID/)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/AZURE-AD-CLIENT-SECRET/)" \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/AZURE-AD-TENANT-ID/)" \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/AZURE-OPENAI-ENDPOINT/)" \
    AZURE_OPENAI_KEY="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/AZURE-OPENAI-KEY/)" \
    SHAREPOINT_SITE_URL="https://dod.sharepoint.us/sites/TeamsMeetingMinutes" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-teams-minutes-prod.vault.usgovcloudapi.net/secrets/SESSION-SECRET/)"
```

### Step 4.4: Setup Application Gateway (Load Balancer + WAF)

```bash
# Create Public IP
az network public-ip create \
  --resource-group rg-teams-minutes-prod \
  --name pip-appgw \
  --allocation-method Static \
  --sku Standard \
  --location usgovvirginia

# Create Application Gateway
az network application-gateway create \
  --resource-group rg-teams-minutes-prod \
  --name appgw-teams-minutes \
  --location usgovvirginia \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name vnet-teams-minutes \
  --subnet subnet-public \
  --public-ip-address pip-appgw \
  --http-settings-cookie-based-affinity Enabled \
  --http-settings-port 443 \
  --http-settings-protocol Https \
  --frontend-port 443

# Enable WAF
az network application-gateway waf-config set \
  --resource-group rg-teams-minutes-prod \
  --gateway-name appgw-teams-minutes \
  --enabled true \
  --firewall-mode Prevention \
  --rule-set-type OWASP \
  --rule-set-version 3.2
```

### Step 4.5: Configure Custom Domain & TLS

```bash
# Add custom domain
az webapp config hostname add \
  --resource-group rg-teams-minutes-prod \
  --webapp-name app-teams-minutes-prod \
  --hostname teams-minutes.dod.mil

# Upload TLS certificate (DOD PKI certificate)
az webapp config ssl upload \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod \
  --certificate-file /path/to/dod-cert.pfx \
  --certificate-password '<CERT_PASSWORD>'

# Bind certificate
az webapp config ssl bind \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod \
  --certificate-thumbprint '<THUMBPRINT>' \
  --ssl-type SNI
```

---

## Phase 5: Security & Compliance

### Step 5.1: Enable Monitoring & Logging

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name law-teams-minutes \
  --location usgovvirginia \
  --retention-time 90

# Enable Application Insights
az monitor app-insights component create \
  --resource-group rg-teams-minutes-prod \
  --app app-insights-teams-minutes \
  --location usgovvirginia \
  --workspace law-teams-minutes

# Link to Web App
az webapp config appsettings set \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="<CONNECTION_STRING>"

# Enable diagnostic logging
az monitor diagnostic-settings create \
  --resource app-teams-minutes-prod \
  --name diag-teams-minutes \
  --workspace law-teams-minutes \
  --logs '[{"category": "AppServiceHTTPLogs", "enabled": true}]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'
```

### Step 5.2: Configure Azure Sentinel (SIEM)

```bash
# Enable Sentinel on Log Analytics Workspace
az sentinel workspace create \
  --resource-group rg-teams-minutes-prod \
  --workspace-name law-teams-minutes

# Configure data connectors
# - Azure Activity
# - Azure AD Identity Protection
# - Microsoft 365 (Teams/SharePoint)
# - Threat Intelligence
```

### Step 5.3: Implement Azure Policy

**File:** `azure-policy.json`

```json
{
  "properties": {
    "displayName": "DOD Teams Minutes - Compliance Policy",
    "policyType": "Custom",
    "mode": "All",
    "parameters": {},
    "policyRule": {
      "if": {
        "allOf": [
          {
            "field": "type",
            "equals": "Microsoft.Web/sites"
          },
          {
            "field": "tags['System']",
            "equals": "TeamsMeetingMinutes"
          }
        ]
      },
      "then": {
        "effect": "audit",
        "details": {
          "type": "Microsoft.Web/sites/config",
          "existenceCondition": {
            "allOf": [
              {
                "field": "Microsoft.Web/sites/config/httpsOnly",
                "equals": true
              },
              {
                "field": "Microsoft.Web/sites/config/minTlsVersion",
                "equals": "1.2"
              }
            ]
          }
        }
      }
    }
  }
}
```

```bash
# Apply policy
az policy definition create \
  --name dod-teams-minutes-compliance \
  --rules azure-policy.json \
  --mode All

az policy assignment create \
  --name assign-dod-compliance \
  --policy dod-teams-minutes-compliance \
  --resource-group rg-teams-minutes-prod
```

### Step 5.4: Configure Backup & Disaster Recovery

```bash
# Database automated backups (already enabled)
# Retention: 30 days

# Point-in-time restore capability
az postgres flexible-server restore \
  --resource-group rg-teams-minutes-prod \
  --name psql-teams-minutes-prod-restore \
  --source-server psql-teams-minutes-prod \
  --restore-time "2025-01-01T00:00:00Z"

# Geo-replication (already enabled with HA configuration)

# App Service backup
az webapp config backup create \
  --resource-group rg-teams-minutes-prod \
  --webapp-name app-teams-minutes-prod \
  --container-url "<STORAGE_SAS_URL>" \
  --backup-name daily-backup \
  --frequency 1d \
  --retention 30
```

---

## Complete Manifest

### Azure Resources Manifest

```yaml
# Resource Group
resource_group:
  name: rg-teams-minutes-prod
  location: usgovvirginia
  tags:
    Environment: Production
    Classification: SECRET
    System: TeamsMeetingMinutes
    Owner: DOD-CIO

# Networking
networking:
  vnet:
    name: vnet-teams-minutes
    address_space: 10.0.0.0/16
    subnets:
      - name: subnet-public
        cidr: 10.0.1.0/24
      - name: subnet-app
        cidr: 10.0.2.0/24
      - name: subnet-data
        cidr: 10.0.3.0/24
      - name: subnet-mgmt
        cidr: 10.0.4.0/24
  
  nsg:
    - name: nsg-app
      rules:
        - AllowHTTPS: 443/TCP from 10.0.1.0/24
    - name: nsg-data
      rules:
        - AllowPostgreSQL: 5432/TCP from 10.0.2.0/24
        - DenyAllInbound: Deny all

  public_ip:
    name: pip-appgw
    sku: Standard
    allocation: Static

# Compute
compute:
  app_service_plan:
    name: plan-teams-minutes
    sku: P3v3
    workers: 2-20 (auto-scaling)
  
  web_app:
    name: app-teams-minutes-prod
    runtime: node:20
    https_only: true
    tls_version: 1.2
    vnet_integration: subnet-app

  container_registry:
    name: acrteamsminutes
    sku: Premium

# Database
database:
  postgresql:
    name: psql-teams-minutes-prod
    version: 14
    sku: Standard_D4s_v3
    storage: 256GB
    backup_retention: 30 days
    geo_redundancy: Enabled
    high_availability: Zone-redundant

# AI Services
ai:
  openai:
    name: openai-teams-minutes-prod
    sku: S0
    models:
      - gpt-4:
          version: "0613"
          capacity: 100 (TPM: 100,000)

# Security
security:
  key_vault:
    name: kv-teams-minutes-prod
    sku: Standard
    soft_delete: true
    purge_protection: true
    retention: 90 days
  
  managed_identity:
    name: id-teams-minutes-app
    type: User-assigned

  application_gateway:
    name: appgw-teams-minutes
    sku: WAF_v2
    capacity: 2
    waf_mode: Prevention
    rule_set: OWASP 3.2

# Monitoring
monitoring:
  log_analytics:
    name: law-teams-minutes
    retention: 90 days
  
  application_insights:
    name: app-insights-teams-minutes
  
  sentinel:
    enabled: true
    data_connectors:
      - Azure Activity
      - Azure AD
      - Microsoft 365
      - Threat Intelligence

# Storage
storage:
  account:
    name: stteamsminutesprod
    sku: Standard_GRS
    access_tier: Hot
```

### Application Code Manifest

```yaml
# Application Structure
application:
  name: dod-teams-minutes-system
  version: 1.0.0
  runtime: Node.js 20.x
  
  dependencies:
    frontend:
      - react: ^18.2.0
      - typescript: ^5.3.0
      - wouter: ^3.0.0
      - @tanstack/react-query: ^5.0.0
      - @radix-ui/react-*: (multiple components)
      - tailwindcss: ^3.4.0
      - lucide-react: ^0.300.0
    
    backend:
      - express: ^4.18.0
      - @neondatabase/serverless: ^0.9.0
      - drizzle-orm: ^0.29.0
      - @microsoft/microsoft-graph-client: ^3.0.0
      - @azure/identity: ^4.0.0
      - @azure/keyvault-secrets: ^4.7.0
      - openai: ^4.20.0
      - passport: ^0.7.0
      - express-session: ^1.17.0
      - jsonwebtoken: ^9.0.0
      - docx: ^8.5.0
      - pdf-lib: ^1.17.0
      - archiver: ^6.0.0
    
    dev_dependencies:
      - vite: ^5.0.0
      - tsx: ^4.0.0
      - drizzle-kit: ^0.20.0
      - @types/node: ^20.0.0
      - @types/express: ^4.17.0

  configuration_files:
    - package.json
    - tsconfig.json
    - vite.config.ts
    - tailwind.config.ts
    - drizzle.config.ts
    - Dockerfile.production

  source_structure:
    - /client/src          # React frontend
    - /server              # Express backend
    - /shared              # Shared types/schema
    - /config              # Configuration files
    - /docs                # Documentation

# Microsoft Integration
microsoft_integration:
  azure_ad:
    tenant_type: GCC High / DOD
    app_registration:
      name: DOD-Teams-Minutes-System
      permissions:
        - OnlineMeetings.Read.All
        - OnlineMeetingRecording.Read.All
        - OnlineMeetingTranscript.Read.All
        - Calendars.Read
        - User.Read.All
        - Mail.Send
        - Sites.ReadWrite.All
        - Group.Read.All
  
  graph_api:
    endpoint: https://graph.microsoft.us
    version: v1.0
    
  sharepoint:
    site_url: https://dod.sharepoint.us/sites/TeamsMeetingMinutes
    library: Minutes Archive

# Environment Variables (stored in Key Vault)
environment:
  required_secrets:
    - DATABASE_URL
    - AZURE_AD_CLIENT_ID
    - AZURE_AD_CLIENT_SECRET
    - AZURE_AD_TENANT_ID
    - AZURE_OPENAI_ENDPOINT
    - AZURE_OPENAI_KEY
    - SESSION_SECRET
    - SHAREPOINT_SITE_URL
  
  configuration:
    - NODE_ENV=production
    - PORT=5000
    - LOG_LEVEL=info
```

### Third-Party Tools & Services

```yaml
# External Dependencies
external_services:
  microsoft_365:
    - Microsoft Teams (GCC High)
    - SharePoint Online (GCC High)
    - Exchange Online (GCC High)
    - Azure AD Premium P2
  
  azure_government:
    - Azure App Service
    - Azure Database for PostgreSQL
    - Azure OpenAI Service
    - Azure Key Vault
    - Azure Application Gateway
    - Azure Monitor
    - Azure Sentinel
  
  development_tools:
    - Visual Studio Code
    - Azure CLI
    - Docker Desktop
    - Git
    - Postman (API testing)

# Compliance & Security Tools
compliance:
  scanning:
    - Azure Defender for Cloud
    - Azure Policy
    - Dependabot (GitHub)
  
  audit:
    - Azure Sentinel
    - Log Analytics
    - Application Insights
```

---

## Testing & Validation

### Step 6.1: Integration Testing

```bash
# Test Database Connectivity
az postgres flexible-server connect \
  --name psql-teams-minutes-prod \
  --admin-user pgadmin \
  --database-name teams_minutes

# Test Key Vault Access
az keyvault secret show \
  --vault-name kv-teams-minutes-prod \
  --name AZURE-AD-CLIENT-ID

# Test Managed Identity
az webapp identity show \
  --resource-group rg-teams-minutes-prod \
  --name app-teams-minutes-prod
```

### Step 6.2: Security Testing

```yaml
security_tests:
  penetration_testing:
    - OWASP Top 10 validation
    - SQL injection testing
    - XSS vulnerability scan
    - Authentication bypass attempts
    - Authorization testing
  
  compliance_validation:
    - enterprise security standards controls verification
    - FedRAMP requirements check
    - DISA STIG compliance scan
    - CIS Benchmark validation

  tools:
    - OWASP ZAP
    - Burp Suite
    - Nessus
    - Qualys
```

### Step 6.3: Load Testing

```yaml
load_testing:
  scenarios:
    - name: Normal Load
      users: 10000 concurrent
      duration: 1 hour
      
    - name: Peak Load
      users: 50000 concurrent
      duration: 30 minutes
      
    - name: Stress Test
      users: 100000 concurrent
      duration: 15 minutes
  
  metrics:
    - Response time p95 < 500ms
    - Response time p99 < 1000ms
    - Error rate < 0.1%
    - CPU utilization < 70%
    - Memory utilization < 80%
  
  tools:
    - Apache JMeter
    - Azure Load Testing
```

### Step 6.4: Disaster Recovery Testing

```bash
# Test database restore
az postgres flexible-server restore \
  --resource-group rg-teams-minutes-prod \
  --name psql-teams-minutes-dr-test \
  --source-server psql-teams-minutes-prod \
  --restore-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)"

# Verify data integrity
# Connect and run validation queries

# Test failover to secondary region (if configured)
# Verify application availability during failover
```

---

## Monitoring & Operations

### Step 7.1: Monitoring Dashboard

**Azure Portal → Monitor → Workbooks**

Create custom workbook with:

```kusto
// Application health
requests
| where timestamp > ago(1h)
| summarize 
    Total = count(),
    Success = countif(success == true),
    Failed = countif(success == false),
    AvgDuration = avg(duration)
    by bin(timestamp, 5m)

// Database connections
dependencies
| where type == "SQL"
| summarize 
    Connections = count(),
    AvgDuration = avg(duration),
    MaxDuration = max(duration)
    by bin(timestamp, 5m)

// OpenAI API calls
dependencies
| where target contains "openai"
| summarize 
    Calls = count(),
    Tokens = sum(customDimensions.tokens),
    Cost = sum(customDimensions.cost)
    by bin(timestamp, 1h)

// Error tracking
exceptions
| where timestamp > ago(24h)
| summarize Count = count() by type, outerMessage
| order by Count desc
```

### Step 7.2: Alerting Rules

```bash
# High error rate alert
az monitor metrics alert create \
  --name alert-high-error-rate \
  --resource-group rg-teams-minutes-prod \
  --scopes app-teams-minutes-prod \
  --condition "avg Percentage HTTP 5xx > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email admin@dod.mil

# High CPU alert
az monitor metrics alert create \
  --name alert-high-cpu \
  --resource-group rg-teams-minutes-prod \
  --scopes app-teams-minutes-prod \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email admin@dod.mil

# Database connection failures
az monitor metrics alert create \
  --name alert-db-connection-failure \
  --resource-group rg-teams-minutes-prod \
  --scopes psql-teams-minutes-prod \
  --condition "total failed_connections > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email dba@dod.mil
```

### Step 7.3: Operational Runbooks

**Daily Operations:**
- Monitor Application Insights dashboard
- Review error logs in Log Analytics
- Check auto-scaling metrics
- Verify backup completion

**Weekly Operations:**
- Review security alerts in Sentinel
- Check certificate expiration dates
- Review and archive old meeting minutes
- Performance optimization review

**Monthly Operations:**
- Rotate service principal secrets
- Update Azure OpenAI model versions
- Review and optimize database indexes
- Capacity planning review
- Security patch deployment

---

## Implementation Timeline

### Week 1-2: Infrastructure Setup
- [ ] Azure Government subscription provisioning
- [ ] VNET and networking configuration
- [ ] PostgreSQL database deployment
- [ ] Key Vault setup
- [ ] Managed Identity configuration

### Week 3-4: Azure AD & Graph API
- [ ] App registration and permissions
- [ ] Graph API webhook configuration
- [ ] SharePoint site creation
- [ ] Azure AD group setup (clearance levels)

### Week 5-6: Azure OpenAI
- [ ] Access request submission
- [ ] OpenAI resource deployment
- [ ] Model deployment and testing
- [ ] Rate limit configuration

### Week 7-8: Application Deployment
- [ ] Docker image build and push
- [ ] App Service deployment
- [ ] Application Gateway configuration
- [ ] Custom domain and TLS setup
- [ ] Auto-scaling configuration

### Week 9-10: Security & Compliance
- [ ] Monitoring and logging setup
- [ ] Azure Sentinel configuration
- [ ] Security scanning and remediation
- [ ] Compliance validation

### Week 11-12: Testing & Launch
- [ ] Integration testing
- [ ] Load testing
- [ ] Security testing
- [ ] User acceptance testing
- [ ] Production launch

---

## Support & Maintenance

### Support Contacts
- **Azure Support:** Premier Support (24/7)
- **Microsoft 365 Support:** GCC High support line
- **Security Incidents:** Azure Security Center

### Documentation
- Architecture diagrams (Visio/draw.io)
- Network topology
- Data flow diagrams
- API documentation
- Runbooks and SOPs

### Training
- Administrator training (2 days)
- Security team training (1 day)
- End-user documentation and videos

---

## Appendix

### A. Required Certificates
- DOD PKI certificates for TLS
- Code signing certificates
- Service principal certificates

### B. Compliance Checklist
- [ ] SOC 2 Type II authorization
- [ ] DISA STIG compliance
- [ ] enterprise security standards controls
- [ ] Privacy Impact Assessment
- [ ] System Security Plan

### C. Disaster Recovery
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 15 minutes
- Backup frequency: Continuous (PITR)
- Geo-replication: Enabled

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Classification:** UNCLASSIFIED  
**Point of Contact:** [Your Name/Team]
