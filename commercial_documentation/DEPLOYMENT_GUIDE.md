# Enterprise Meeting Minutes Management System
## Production Deployment Guide - Azure Commercial Multi-Tenant SaaS

**Classification:** Confidential - Deployment Documentation  
**Document Version:** 1.0  
**Date:** November 2025  
**Audience:** DevOps Engineers, Platform Engineers, SRE Teams

---

## Overview

This guide provides comprehensive instructions for deploying the Enterprise Meeting Minutes Management System as a multi-tenant SaaS platform on Azure Commercial infrastructure. The deployment supports global enterprise customers with SOC 2 Type II compliance, 99.9% SLA guarantees, and auto-scaling to support 300,000+ concurrent users.

**Deployment Architecture:**
- **Primary Region:** East US 2 (primary customer base)
- **Secondary Regions:** West US 2, West Europe (geographic distribution + DR)
- **Compliance:** SOC 2 Type II, ISO 27001, GDPR
- **SLA:** 99.9% uptime with financial penalties

---

## Prerequisites

### Azure Subscription Requirements

**Production Subscription:**
- Azure subscription with Enterprise Agreement or Pay-As-You-Go
- Resource quotas: 200+ vCPUs, App Service Plan capacity
- Microsoft 365 Business or Enterprise tenant for Graph API testing

**Required Permissions:**
- Contributor access to production resource groups
- User Access Administrator for RBAC
- Key Vault Administrator for secrets management
- Network Contributor for VNet and Front Door configuration

### External Service Accounts

**Required Services:**
- **Stripe:** Payment processing and subscription billing
- **SendGrid or Azure Communication Services:** Transactional email (backup channel)
- **DataDog or Application Insights:** Monitoring and observability
- **PagerDuty or Azure Monitor Alerts:** Incident management

### Domain and DNS

**Custom Domain Setup:**
- Primary domain: `app.yourcompany.com`
- API subdomain: `api.yourcompany.com`
- Admin portal: `admin.yourcompany.com`
- DNS provider with API access for automated certificate validation
- SSL/TLS certificates (Azure Front Door managed or custom)

---

## Infrastructure Architecture

### Network Topology

**Multi-Region Virtual Networks:**

```
East US 2 (Primary):
  VNet: 10.10.0.0/16
    - AppService Subnet: 10.10.1.0/24
    - Database Subnet: 10.10.2.0/24 (Private Endpoints)
    - Redis Subnet: 10.10.3.0/24 (Cache)
    - Management Subnet: 10.10.10.0/24

West US 2 (Secondary):
  VNet: 10.20.0.0/16
    - AppService Subnet: 10.20.1.0/24
    - Database Subnet: 10.20.2.0/24
    - Redis Subnet: 10.20.3.0/24

West Europe (Secondary):
  VNet: 10.30.0.0/16
    - AppService Subnet: 10.30.1.0/24
    - Database Subnet: 10.30.2.0/24
    - Redis Subnet: 10.30.3.0/24
```

**Traffic Management:**
- Azure Front Door Premium: Global load balancing, WAF, DDoS protection
- Geographic routing: US customers → East/West US, EU customers → West Europe
- Automatic failover if primary region degraded
- CDN for static assets (images, JS, CSS)

**Security:**
- Network Security Groups on all subnets
- Private endpoints for databases, storage, Key Vault
- No public IP addresses on backend resources
- Azure Firewall for egress control (optional for enhanced security)

### Compute Infrastructure

**App Service Plans (Production Standard PV3):**

```yaml
East US 2:
  Tier: Production Standard (PremiumV3)
  SKU: P3v3 (8 vCPU, 16 GB RAM per instance)
  Instances: 
    - Minimum: 6 (baseline)
    - Maximum: 60 (auto-scale for peak load)
  Zone Redundancy: Enabled (3 availability zones)

West US 2:
  Tier: Production Standard (PremiumV3)
  SKU: P3v3
  Instances: 4-40 (scaled to ~70% of East US)
  Zone Redundancy: Enabled

West Europe:
  Tier: Production Standard (PremiumV3)
  SKU: P3v3
  Instances: 4-40
  Zone Redundancy: Enabled
```

**Auto-Scaling Configuration:**

```yaml
Scale-Out Rules:
  - CPU > 70% for 5 minutes → Add 3 instances
  - Memory > 80% for 5 minutes → Add 3 instances
  - HTTP Response Time > 2 seconds avg for 3 minutes → Add 5 instances
  - Queue Depth > 500 jobs → Add 5 instances

Scale-In Rules:
  - CPU < 30% for 20 minutes → Remove 2 instances
  - Memory < 40% for 20 minutes → Remove 2 instances
  - Minimum instances: 6 (East US), 4 (West US/Europe)
  
Cooldown Period: 10 minutes between scaling operations
```

### Database Infrastructure

**Azure Database for PostgreSQL (Flexible Server):**

```yaml
Production Configuration:
  Version: PostgreSQL 14 LTS
  Tier: General Purpose
  Compute: 32 vCores (scalable to 64)
  Memory: 128 GB
  Storage: 2 TB with auto-growth to 16 TB
  IOPS: 20,000 baseline, burstable to 80,000
  
High Availability:
  Mode: Zone-redundant (automatic failover within region)
  Replication: Synchronous to standby replica
  Failover Time: <120 seconds automatic
  
Backup:
  Retention: 35 days (maximum for compliance)
  Geo-Backup: Enabled to paired region
  Point-in-Time Restore: Any point within retention window

Read Replicas:
  - 3 read replicas in East US 2 (query distribution)
  - 1 read replica in West US 2 (failover capable)
  - 1 read replica in West Europe (local read performance)

Connection Pooling:
  PgBouncer: Integrated, transaction mode
  Max Connections: 5,000 (distributed across replicas)
  Connection Timeout: 30 seconds
```

**Data Isolation (Multi-Tenancy):**
- Organization ID in every table (indexed)
- Row-Level Security (RLS) policies enforce tenant boundaries
- Application-level validation as defense-in-depth
- Separate encryption keys per organization (optional Premium tier)

### Caching Layer

**Azure Cache for Redis (Premium):**

```yaml
Configuration:
  Tier: Premium P2 (13 GB cache)
  Clustering: Enabled (6 shards)
  Replication: Zone-redundant
  Persistence: RDB snapshots every 15 minutes
  
Cache Strategy:
  - User sessions: 8-hour TTL
  - Meeting metadata: 15-minute TTL
  - Organization settings: 30-minute TTL
  - Static assets: 24-hour TTL
  
Eviction Policy: allkeys-lru (least recently used)
```

### Identity and Access Management

**Azure AD B2C (Customer Identity):**
- Custom branded login experience per organization
- Support for enterprise SSO (SAML, OIDC)
- MFA enforcement configurable per organization
- Social identity providers (Google, Microsoft) for smaller customers

**Service Principals:**
- Application registration for Microsoft Graph API access
- Managed Identity for Azure resource access
- Least privilege permissions (minimal Graph API scopes)
- Certificate-based authentication (90-day rotation)

**Role-Based Access Control:**

```yaml
Application Roles:
  SuperAdmin:
    - Platform-level configuration
    - Customer onboarding and offboarding
    - Billing and subscription management
    
  OrgAdmin:
    - Organization settings and branding
    - User provisioning within organization
    - Usage analytics and reporting
    
  Approver:
    - Review and approve meeting minutes
    - Edit and manage action items
    
  Editor:
    - Edit meeting minutes
    - Manage action items
    
  Viewer:
    - Read-only access to approved minutes
```

---

## Deployment Steps

### Step 1: Resource Group Creation

```bash
# Set Azure subscription
az account set --subscription "<production-subscription-id>"

# Create resource groups for each region
az group create \
  --name rg-meeting-minutes-eastus2 \
  --location eastus2 \
  --tags "Environment=Production" "Service=MeetingMinutes" "CostCenter=Engineering"

az group create \
  --name rg-meeting-minutes-westus2 \
  --location westus2 \
  --tags "Environment=Production" "Service=MeetingMinutes" "CostCenter=Engineering"

az group create \
  --name rg-meeting-minutes-westeurope \
  --location westeurope \
  --tags "Environment=Production" "Service=MeetingMinutes" "CostCenter=Engineering"
```

### Step 2: Virtual Network Setup

```bash
# East US 2 VNet
az network vnet create \
  --resource-group rg-meeting-minutes-eastus2 \
  --name vnet-meeting-minutes-eastus2 \
  --address-prefix 10.10.0.0/16 \
  --location eastus2

# Create subnets
az network vnet subnet create \
  --resource-group rg-meeting-minutes-eastus2 \
  --vnet-name vnet-meeting-minutes-eastus2 \
  --name snet-appservice \
  --address-prefix 10.10.1.0/24 \
  --delegations Microsoft.Web/serverFarms

az network vnet subnet create \
  --resource-group rg-meeting-minutes-eastus2 \
  --vnet-name vnet-meeting-minutes-eastus2 \
  --name snet-database \
  --address-prefix 10.10.2.0/24 \
  --disable-private-endpoint-network-policies true

# Repeat for West US 2 and West Europe
```

### Step 3: Key Vault Deployment

```bash
# Create Key Vault (Standard tier)
az keyvault create \
  --name kv-meeting-minutes-prod \
  --resource-group rg-meeting-minutes-eastus2 \
  --location eastus2 \
  --sku Standard \
  --enable-rbac-authorization true \
  --enable-soft-delete true \
  --retention-days 90

# Create private endpoint
az network private-endpoint create \
  --name pe-keyvault-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --vnet-name vnet-meeting-minutes-eastus2 \
  --subnet snet-database \
  --private-connection-resource-id $(az keyvault show --name kv-meeting-minutes-prod --query id -o tsv) \
  --group-id vault \
  --connection-name kv-private-connection

# Store critical secrets
az keyvault secret set --vault-name kv-meeting-minutes-prod --name database-url --value "<connection-string>"
az keyvault secret set --vault-name kv-meeting-minutes-prod --name session-secret --value "<random-256-bit-key>"
az keyvault secret set --vault-name kv-meeting-minutes-prod --name stripe-secret-key --value "<stripe-key>"
az keyvault secret set --vault-name kv-meeting-minutes-prod --name openai-api-key --value "<azure-openai-key>"
```

### Step 4: PostgreSQL Database

```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --name psql-meeting-minutes-prod \
  --resource-group rg-meeting-minutes-eastus2 \
  --location eastus2 \
  --admin-user dbadmin \
  --admin-password '<strong-password>' \
  --sku-name Standard_D32s_v3 \
  --tier GeneralPurpose \
  --storage-size 2048 \
  --version 14 \
  --high-availability ZoneRedundant \
  --backup-retention 35 \
  --geo-redundant-backup Enabled \
  --public-access None

# Create private endpoint
az network private-endpoint create \
  --name pe-postgresql-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --vnet-name vnet-meeting-minutes-eastus2 \
  --subnet snet-database \
  --private-connection-resource-id $(az postgres flexible-server show --name psql-meeting-minutes-prod --query id -o tsv) \
  --group-id postgresqlServer \
  --connection-name psql-private-connection

# Create database
az postgres flexible-server db create \
  --resource-group rg-meeting-minutes-eastus2 \
  --server-name psql-meeting-minutes-prod \
  --database-name meeting_minutes_production

# Create read replicas
az postgres flexible-server replica create \
  --replica-name psql-meeting-minutes-replica-1 \
  --resource-group rg-meeting-minutes-eastus2 \
  --source-server psql-meeting-minutes-prod \
  --location eastus2

az postgres flexible-server replica create \
  --replica-name psql-meeting-minutes-replica-westus2 \
  --resource-group rg-meeting-minutes-westus2 \
  --source-server psql-meeting-minutes-prod \
  --location westus2
```

### Step 5: Redis Cache

```bash
# Create Redis Cache (Premium tier)
az redis create \
  --name redis-meeting-minutes-prod \
  --resource-group rg-meeting-minutes-eastus2 \
  --location eastus2 \
  --sku Premium \
  --vm-size P2 \
  --zones 1 2 3 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2

# Get connection string
az redis list-keys \
  --name redis-meeting-minutes-prod \
  --resource-group rg-meeting-minutes-eastus2

# Store in Key Vault
az keyvault secret set \
  --vault-name kv-meeting-minutes-prod \
  --name redis-connection-string \
  --value "<redis-connection-string>"
```

### Step 6: App Service Plans and Web Apps

```bash
# Create App Service Plan (East US 2)
az appservice plan create \
  --name plan-meeting-minutes-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --location eastus2 \
  --sku P3v3 \
  --is-linux \
  --number-of-workers 6 \
  --zone-redundant

# Create Web App
az webapp create \
  --name app-meeting-minutes-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --plan plan-meeting-minutes-eastus2 \
  --runtime "NODE:20-lts"

# Enable managed identity
az webapp identity assign \
  --name app-meeting-minutes-eastus2 \
  --resource-group rg-meeting-minutes-eastus2

# Configure auto-scaling
az monitor autoscale create \
  --resource-group rg-meeting-minutes-eastus2 \
  --resource app-meeting-minutes-eastus2 \
  --resource-type Microsoft.Web/serverFarms \
  --name autoscale-eastus2 \
  --min-count 6 \
  --max-count 60 \
  --count 6

az monitor autoscale rule create \
  --resource-group rg-meeting-minutes-eastus2 \
  --autoscale-name autoscale-eastus2 \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 3

az monitor autoscale rule create \
  --resource-group rg-meeting-minutes-eastus2 \
  --autoscale-name autoscale-eastus2 \
  --condition "CpuPercentage < 30 avg 20m" \
  --scale in 2

# Repeat for West US 2 and West Europe
```

### Step 7: Application Configuration

```bash
# Configure environment variables
az webapp config appsettings set \
  --name app-meeting-minutes-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-prod.vault.azure.net/secrets/database-url)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-prod.vault.azure.net/secrets/session-secret)" \
    REDIS_URL="@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-prod.vault.azure.net/secrets/redis-connection-string)" \
    STRIPE_SECRET_KEY="@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-prod.vault.azure.net/secrets/stripe-secret-key)" \
    AZURE_OPENAI_ENDPOINT="https://<resource-name>.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-prod.vault.azure.net/secrets/openai-api-key)" \
    GRAPH_API_ENDPOINT="https://graph.microsoft.com" \
    ENABLE_MULTI_TENANCY=true

# Grant Key Vault access
az keyvault set-policy \
  --name kv-meeting-minutes-prod \
  --object-id $(az webapp identity show --name app-meeting-minutes-eastus2 --resource-group rg-meeting-minutes-eastus2 --query principalId -o tsv) \
  --secret-permissions get list
```

### Step 8: Azure Front Door Setup

```bash
# Create Front Door profile
az afd profile create \
  --profile-name fd-meeting-minutes \
  --resource-group rg-meeting-minutes-eastus2 \
  --sku Premium_AzureFrontDoor

# Create endpoint
az afd endpoint create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --endpoint-name app \
  --enabled-state Enabled

# Create origin group with health probes
az afd origin-group create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --origin-group-name backend-origins \
  --probe-request-type GET \
  --probe-protocol Https \
  --probe-interval-in-seconds 30 \
  --probe-path /api/health

# Add origins (multi-region)
az afd origin create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --origin-group-name backend-origins \
  --origin-name eastus2-origin \
  --host-name app-meeting-minutes-eastus2.azurewebsites.net \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled

az afd origin create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --origin-group-name backend-origins \
  --origin-name westus2-origin \
  --host-name app-meeting-minutes-westus2.azurewebsites.net \
  --priority 2 \
  --weight 500 \
  --enabled-state Enabled

az afd origin create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --origin-group-name backend-origins \
  --origin-name westeurope-origin \
  --host-name app-meeting-minutes-westeurope.azurewebsites.net \
  --priority 3 \
  --weight 300 \
  --enabled-state Enabled

# Add custom domain
az afd custom-domain create \
  --resource-group rg-meeting-minutes-eastus2 \
  --profile-name fd-meeting-minutes \
  --custom-domain-name app-domain \
  --host-name app.yourcompany.com \
  --minimum-tls-version TLS12

# Configure WAF
az network front-door waf-policy create \
  --name wafMeetingMinutes \
  --resource-group rg-meeting-minutes-eastus2 \
  --sku Premium_AzureFrontDoor \
  --mode Prevention

az network front-door waf-policy managed-rules add \
  --policy-name wafMeetingMinutes \
  --resource-group rg-meeting-minutes-eastus2 \
  --type Microsoft_DefaultRuleSet \
  --version 2.1
```

### Step 9: Database Schema Deployment

```bash
# Connect to database via jumpbox or Azure Cloud Shell
export DATABASE_URL="postgresql://dbadmin:<password>@psql-meeting-minutes-prod.postgres.database.azure.com:5432/meeting_minutes_production?sslmode=require"

# Run migrations
npm run db:push

# Verify schema
psql $DATABASE_URL -c "\dt"
```

### Step 10: Application Deployment

```bash
# Build production bundle
npm run build

# Create deployment ZIP
zip -r deployment.zip dist package.json package-lock.json -x "node_modules/*"

# Deploy to all regions
az webapp deployment source config-zip \
  --resource-group rg-meeting-minutes-eastus2 \
  --name app-meeting-minutes-eastus2 \
  --src deployment.zip

az webapp deployment source config-zip \
  --resource-group rg-meeting-minutes-westus2 \
  --name app-meeting-minutes-westus2 \
  --src deployment.zip

az webapp deployment source config-zip \
  --resource-group rg-meeting-minutes-westeurope \
  --name app-meeting-minutes-westeurope \
  --src deployment.zip
```

---

## Monitoring and Observability

### Application Insights Setup

```bash
# Create Application Insights
az monitor app-insights component create \
  --app app-insights-meeting-minutes \
  --location eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app app-insights-meeting-minutes \
  --resource-group rg-meeting-minutes-eastus2 \
  --query instrumentationKey -o tsv)

# Configure in Web App
az webapp config appsettings set \
  --name app-meeting-minutes-eastus2 \
  --resource-group rg-meeting-minutes-eastus2 \
  --settings APPLICATIONINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

### Critical Alerts

```yaml
SLA-Critical Alerts (P1):
  - Availability < 99.9% over 5-minute window
  - Error rate > 1% over 5 minutes
  - P95 response time > 3 seconds
  - Database connection failures
  - Payment processing failures

Performance Alerts (P2):
  - CPU > 80% for 15 minutes
  - Memory > 85% for 15 minutes
  - Queue depth > 1000 jobs
  - Cache hit rate < 80%

Security Alerts (P1):
  - Authentication failures > 10 per minute
  - Privilege escalation attempts
  - Suspicious data access patterns
  - Certificate expiration < 14 days
```

---

## Security Hardening

### HTTPS and TLS

- Enforce TLS 1.2 minimum (preferably TLS 1.3)
- HSTS headers with 1-year max-age
- Disable weak ciphers and protocols
- Automated certificate rotation via Azure Front Door

### Network Security

- No public IP addresses on backend resources
- Private endpoints for all Azure services
- NSG rules: deny-by-default, allow specific traffic
- Azure Front Door: Only HTTPS traffic allowed

### Data Encryption

- **At Rest:** Transparent Data Encryption (TDE) for PostgreSQL
- **In Transit:** TLS 1.2+ for all connections
- **Secrets:** Azure Key Vault with RBAC
- **Customer Data:** Optional customer-managed keys (Premium tier)

---

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- Automated daily backups (35-day retention)
- Geo-redundant to paired region
- Point-in-time restore tested monthly

**Application Backups:**
- Infrastructure as Code (Bicep/Terraform)
- Configuration in Key Vault
- CI/CD pipelines in source control

### Failover Procedures

**Regional Failover:**
- Azure Front Door automatically routes traffic away from degraded region
- Manual database replica promotion if needed
- RTO: 10 minutes (automatic routing changes)
- RPO: 5 seconds (database replication lag)

**Full Disaster Recovery:**
- Restore from geo-redundant backup to alternate region
- Redeploy application via CI/CD
- Update DNS to point to DR region
- RTO: 4 hours, RPO: 1 hour

---

## SOC 2 Compliance Controls

### Implemented Controls

**CC6.1 - Logical and Physical Access Controls:**
- Azure AD authentication with MFA
- RBAC for all resources
- Audit logging enabled

**CC6.6 - Encryption:**
- TLS 1.2+ for data in transit
- TDE for data at rest
- Key Vault for secrets management

**CC7.2 - System Monitoring:**
- Application Insights for performance
- Security Center for threat detection
- Automated alerts for anomalies

**CC8.1 - Change Management:**
- CI/CD pipelines with approvals
- Infrastructure as Code
- Rollback capability

**CC9.1 - Risk Assessment:**
- Regular penetration testing
- Vulnerability scanning
- Third-party security audits

---

**Document Control:**
- Version: 1.0
- Classification: Confidential - Deployment Documentation
- Last Updated: November 2025
- Next Review: February 2026
