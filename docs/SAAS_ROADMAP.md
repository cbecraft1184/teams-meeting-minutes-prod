# SaaS Deployment Models Roadmap

## Executive Summary

This document outlines the strategy and implementation plan for offering the Meeting Minutes application as a SaaS product with flexible deployment models to meet diverse customer requirements.

## Deployment Models Overview

The platform supports three distinct deployment models to accommodate varying customer requirements for data control, compliance, and operational preferences.

| Model | Data Location | Operations | Target Customer |
|-------|--------------|------------|-----------------|
| **Managed SaaS** | Our infrastructure | We manage everything | SMB, mid-market |
| **BYOI** | Customer's Azure | We run app, they own data | Regulated enterprise |
| **Self-Hosted** | Customer's environment | Customer manages everything | Government, defense |

---

## Model 1: Managed Multi-Tenant SaaS

### Description
Fully managed service where we host all infrastructure and customer data resides in our multi-tenant environment.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OUR INFRASTRUCTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION TIER                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Web App     │  │ API Server  │  │ Job Workers     │   │   │
│  │  │ (React)     │  │ (Express)   │  │ (Background)    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      DATA TIER                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ PostgreSQL  │  │ Key Vault   │  │ Blob Storage    │   │   │
│  │  │ (Shared)    │  │ (Secrets)   │  │ (Documents)     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SHARED SERVICES                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Azure OpenAI│  │ SharePoint  │  │ App Insights    │   │   │
│  │  │ (Pooled)    │  │ (Our Site)  │  │ (Monitoring)    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema (Multi-Tenant)

```sql
-- Tenant registry
CREATE TABLE tenants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    azure_tenant_id VARCHAR NOT NULL UNIQUE,
    status VARCHAR DEFAULT 'active',  -- active, suspended, cancelled
    plan VARCHAR DEFAULT 'starter',   -- starter, pro, enterprise
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    billing_customer_id VARCHAR       -- Stripe customer ID
);

-- All existing tables get tenant_id
ALTER TABLE meetings ADD COLUMN tenant_id VARCHAR REFERENCES tenants(id);
ALTER TABLE meeting_minutes ADD COLUMN tenant_id VARCHAR REFERENCES tenants(id);
ALTER TABLE action_items ADD COLUMN tenant_id VARCHAR REFERENCES tenants(id);
ALTER TABLE users ADD COLUMN tenant_id VARCHAR REFERENCES tenants(id);
ALTER TABLE job_queue ADD COLUMN tenant_id VARCHAR REFERENCES tenants(id);

-- Row-level security
CREATE POLICY tenant_isolation ON meetings
    USING (tenant_id = current_setting('app.current_tenant')::VARCHAR);
```

### Responsibilities

| Aspect | Our Responsibility |
|--------|-------------------|
| Infrastructure | Provision, scale, maintain |
| Security | Encryption, access control, monitoring |
| Backups | Daily backups, disaster recovery |
| Updates | Automatic, zero-downtime |
| Compliance | SOC2, ISO 27001, GDPR |
| Support | 24/7 for enterprise tier |

### Customer Requirements

1. Azure AD admin consent (one-time)
2. User account provisioning
3. Meeting content (via Teams)

### Pricing Model

| Tier | Price | Includes |
|------|-------|----------|
| Starter | $5/user/month | 100 meetings/month, basic features |
| Pro | $12/user/month | Unlimited meetings, all features |
| Enterprise | Custom | SLA, dedicated support, custom integrations |

### Onboarding Flow

```
1. Visit landing page
       │
       ▼
2. Click "Start Free Trial"
       │
       ▼
3. Azure AD consent flow
   (Authorize app for organization)
       │
       ▼
4. Automatic tenant provisioning
   - Create tenant record
   - Set up default configuration
   - Create admin user
       │
       ▼
5. Admin setup wizard
   - Configure templates
   - Set approval workflow
   - Invite team members
       │
       ▼
6. Ready to use (< 5 minutes)
```

### Pros and Cons

| Pros | Cons |
|------|------|
| Fast onboarding | Data in shared infrastructure |
| Lower cost | Less customer control |
| We handle everything | May not meet strict compliance |
| Easiest to support | Dependent on our SLA |

### Target Customers
- Small and medium businesses
- Startups and growing teams
- Organizations without data residency requirements
- Cost-conscious customers

---

## Model 2: BYOI (Bring Your Own Infrastructure)

### Description
Hybrid model where our control plane runs the application, but all customer data resides in their own Azure subscription.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OUR INFRASTRUCTURE                            │
│                    (Control Plane)                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Web App     │  │ API Server  │  │ Job Orchestrator│   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │  ┌─────────────┐  ┌─────────────┐                        │   │
│  │  │ Billing     │  │ Tenant      │                        │   │
│  │  │ Service     │  │ Registry    │                        │   │
│  │  └─────────────┘  └─────────────┘                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    Secure Connection
                    (Service Principal)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                 CUSTOMER'S AZURE SUBSCRIPTION                    │
│                      (Data Plane)                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      DATA TIER                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ PostgreSQL  │  │ Key Vault   │  │ Storage Account │   │   │
│  │  │ (Customer)  │  │ (Customer)  │  │ (Customer)      │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CUSTOMER SERVICES                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Azure OpenAI│  │ SharePoint  │  │ Graph API       │   │   │
│  │  │ (Customer)  │  │ (Customer)  │  │ (Customer)      │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tenant Resource Profile Schema

```typescript
interface TenantResourceProfile {
  tenantId: string;
  deploymentMode: 'byoi';
  
  // Database
  database: {
    connectionString: string;  // Encrypted, stored in our Key Vault
    region: string;
    schemaVersion: string;
  };
  
  // Azure OpenAI
  openai: {
    endpoint: string;
    deploymentName: string;
    // Credentials via Service Principal
  };
  
  // SharePoint
  sharepoint: {
    siteUrl: string;
    libraryName: string;
  };
  
  // Credentials
  credentials: {
    servicePrincipalId: string;
    keyVaultSecretRef: string;  // Reference to customer's credentials in our KV
  };
  
  // Health
  health: {
    lastHealthCheck: Date;
    status: 'healthy' | 'degraded' | 'unavailable';
  };
}
```

### Responsibilities

| Aspect | Our Responsibility | Customer Responsibility |
|--------|-------------------|------------------------|
| Application | Host, update, maintain | Grant access |
| Database | Schema migrations | Provision, backup, scale |
| Security | App-level security | Infrastructure security |
| Compliance | Shared responsibility | Data compliance |
| Support | Application issues | Infrastructure issues |

### Customer Requirements

**Azure Resources to Provision:**
- Azure Database for PostgreSQL Flexible Server
- Azure Key Vault
- Azure Storage Account
- Azure OpenAI resource (with GPT-4o deployment)
- SharePoint site/library

**Permissions to Grant:**
```
Service Principal requires:
- PostgreSQL: db_owner on database
- Key Vault: Secret Get, List
- Storage: Storage Blob Data Contributor
- Azure OpenAI: Cognitive Services User
- SharePoint: Sites.ReadWrite.All
- Graph API: OnlineMeetings.Read.All, Calendars.Read, Mail.Send
```

**Credential Exchange:**
1. Customer creates service principal in their tenant
2. Grants required permissions
3. Shares credentials via secure onboarding portal
4. We store encrypted in tenant-isolated Key Vault

### Pricing Model

| Component | Price |
|-----------|-------|
| Base Platform | $25/user/month |
| Data Plane Management Fee | $500/month |
| Premium Support SLA | $1,000/month |

### Onboarding Flow

```
1. Enterprise agreement signed
       │
       ▼
2. Customer provisions Azure resources
   (PostgreSQL, Key Vault, Storage, OpenAI)
       │
       ▼
3. Customer creates service principal
   and grants permissions
       │
       ▼
4. Secure credential exchange via portal
       │
       ▼
5. We validate connectivity to all resources
       │
       ▼
6. Schema migration runs on customer DB
       │
       ▼
7. Admin setup wizard
       │
       ▼
8. Ready to use (1-3 days)
```

### Migration Orchestration

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION COORDINATOR                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Version Check                                                │
│     ├─ Query tenant's current schema version                    │
│     └─ Compare with required version                            │
│                                                                  │
│  2. Pre-Migration Validation                                     │
│     ├─ Connection health check                                  │
│     ├─ Backup verification                                      │
│     └─ Dry-run migration                                        │
│                                                                  │
│  3. Migration Execution                                          │
│     ├─ Apply migrations in order                                │
│     ├─ Track progress in our system                             │
│     └─ Rollback on failure                                      │
│                                                                  │
│  4. Post-Migration Validation                                    │
│     ├─ Schema verification                                      │
│     ├─ Data integrity checks                                    │
│     └─ Application health check                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pros and Cons

| Pros | Cons |
|------|------|
| Customer controls their data | More complex onboarding |
| Meets data residency requirements | Customer manages resources |
| Uses customer's Azure investment | Higher support burden |
| Easier compliance | Customer outages affect them |

### Target Customers
- Regulated industries (finance, healthcare)
- Enterprise with data sovereignty requirements
- Organizations with existing Azure investments
- European customers (GDPR)

---

## Model 3: Licensed/Self-Hosted

### Description
Customer purchases a license and deploys the entire application in their own environment with complete control.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 CUSTOMER'S ENVIRONMENT                           │
│           (Complete Self-Managed Deployment)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION TIER                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Web App     │  │ API Server  │  │ Job Workers     │   │   │
│  │  │ (Container) │  │ (Container) │  │ (Container)     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      DATA TIER                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ PostgreSQL  │  │ Key Vault   │  │ Storage Account │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CUSTOMER SERVICES                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Azure OpenAI│  │ SharePoint  │  │ Azure AD        │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    LICENSE VALIDATION                     │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │ License Key (JWT)                                │     │   │
│  │  │ - Customer ID                                    │     │   │
│  │  │ - Edition: Enterprise                            │     │   │
│  │  │ - Seats: 500                                     │     │   │
│  │  │ - Features: [all]                                │     │   │
│  │  │ - Expires: 2026-12-31                            │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Delivery Packages

#### Option A: Docker Images

```yaml
# docker-compose.yml (simplified)
version: '3.8'
services:
  web:
    image: meetingminutes/app:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
      - AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}
      - AZURE_TENANT_ID=${AZURE_TENANT_ID}
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - LICENSE_KEY=${LICENSE_KEY}
    ports:
      - "443:5000"
    
  worker:
    image: meetingminutes/worker:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - LICENSE_KEY=${LICENSE_KEY}
```

**Includes:**
- Docker Compose file for local/simple deployments
- Azure Container Apps template
- Environment variable templates
- Health check endpoints

#### Option B: Azure Marketplace Managed Application

```bicep
// main.bicep (simplified)
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'meeting-minutes'
  location: location
  properties: {
    configuration: {
      ingress: {
        external: true
        targetPort: 5000
      }
    }
    template: {
      containers: [
        {
          name: 'app'
          image: 'meetingminutes.azurecr.io/app:${version}'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
        }
      ]
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: 'meeting-minutes-db'
  location: location
  sku: {
    name: 'Standard_D2ds_v4'
    tier: 'GeneralPurpose'
  }
}
```

**Marketplace Features:**
- One-click deployment
- Automatic resource provisioning
- License validation via Marketplace
- Usage metering integration

#### Option C: Helm Chart (Kubernetes)

```yaml
# values.yaml
replicaCount: 3

image:
  repository: meetingminutes/app
  tag: latest

postgresql:
  enabled: true
  # Or external:
  # external:
  #   host: my-postgres.database.azure.com

azure:
  clientId: ""
  clientSecret: ""
  tenantId: ""
  
license:
  key: ""
  
ingress:
  enabled: true
  hosts:
    - host: minutes.mycompany.com
```

**Includes:**
- Helm chart with dependencies
- CSI driver integration for Key Vault
- Horizontal pod autoscaling
- Upgrade hooks for migrations

#### Option D: Air-Gapped Package

For classified/disconnected environments:

**Package Contents:**
- Container images (tar archives)
- All dependencies bundled
- Offline license bundle (extended validity)
- Manual installation scripts
- Offline documentation

### Licensing Mechanism

```typescript
interface LicenseKey {
  // JWT structure
  header: {
    alg: 'RS256',
    typ: 'JWT'
  },
  payload: {
    iss: 'meeting-minutes-licensing',
    sub: 'customer-uuid',
    iat: number,  // Issued at
    exp: number,  // Expiration
    
    // License details
    customer: {
      id: string,
      name: string,
      domain: string
    },
    edition: 'standard' | 'enterprise' | 'government',
    seats: number,
    features: string[],  // Feature flags
    
    // Validation
    offlineGracePeriod: number,  // Days allowed offline
    phoneHomeRequired: boolean
  },
  signature: string  // RSA signature
}
```

**Validation Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    LICENSE VALIDATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  App Startup                                                     │
│       │                                                          │
│       ▼                                                          │
│  Read LICENSE_KEY from environment                               │
│       │                                                          │
│       ▼                                                          │
│  Verify JWT signature (RSA public key embedded)                  │
│       │                                                          │
│       ├──[Invalid]──► Refuse to start                           │
│       │                                                          │
│       ▼                                                          │
│  Check expiration                                                │
│       │                                                          │
│       ├──[Expired]──► Show renewal notice, grace period         │
│       │                                                          │
│       ▼                                                          │
│  Validate seat count                                             │
│       │                                                          │
│       ├──[Exceeded]──► Warn, soft limit                         │
│       │                                                          │
│       ▼                                                          │
│  Phone home (if enabled and online)                              │
│       │                                                          │
│       ├──[Revoked]──► Refuse to start                           │
│       │                                                          │
│       ▼                                                          │
│  Cache validation result                                         │
│       │                                                          │
│       ▼                                                          │
│  Application starts normally                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibilities

| Aspect | Our Responsibility | Customer Responsibility |
|--------|-------------------|------------------------|
| Software | Provide, update | Install, operate |
| Infrastructure | None | Everything |
| Security | Software security | All security |
| Compliance | Compliance guidance | Full compliance |
| Support | Tiered support contract | First-line triage |

### Customer Prerequisites

**Azure Resources:**
- Azure subscription (Owner role)
- Azure AD tenant
- Azure Container Apps or Kubernetes cluster
- PostgreSQL Flexible Server
- Azure Key Vault
- Storage Account
- Azure OpenAI resource
- Application Insights (optional)

**Permissions:**
- Global Administrator (for Graph consent)
- Key Vault Administrator
- PostgreSQL Administrator
- Container Apps/K8s Administrator

**Technical Staff:**
- Azure infrastructure experience
- Container/Kubernetes experience
- PostgreSQL administration

### Pricing Model

| Component | Price |
|-----------|-------|
| Annual License (per user) | $200/user/year |
| Minimum Commitment | 50 users |
| Standard Support | Included |
| Premium Support (24/7) | +$10,000/year |
| Professional Services | $250/hour |

### Support Model

**Standard Support:**
- Business hours (9-5 ET)
- Email/ticket based
- 48-hour response SLA
- Documentation access
- Quarterly updates

**Premium Support:**
- 24/7 availability
- Phone + email + ticket
- 4-hour response SLA
- Named support engineer
- Monthly updates
- Priority bug fixes

**Diagnostic Bundle:**
```bash
# Customer runs this script
./collect-diagnostics.sh

# Generates:
# - Sanitized logs (no PII)
# - Configuration (secrets redacted)
# - Health check results
# - Version information
# Upload to secure portal for support
```

### Pros and Cons

| Pros | Cons |
|------|------|
| Complete customer control | Highest complexity |
| Works in air-gapped environments | Customer manages everything |
| Customer handles compliance | Harder to support remotely |
| No data leaves their network | Updates require customer action |

### Target Customers
- Government and defense
- Classified environments
- Organizations requiring complete isolation
- On-premises requirements
- Air-gapped networks

---

## Comparison Matrix

| Aspect | Managed SaaS | BYOI | Self-Hosted |
|--------|-------------|------|-------------|
| **Data Location** | Our cloud | Customer's Azure | Customer's environment |
| **Operations** | Us | Us (app) + Customer (data) | Customer |
| **Onboarding** | Minutes | Days | Weeks |
| **Control Level** | Low | Medium | Full |
| **Support Burden** | Low | Medium | High |
| **Revenue Model** | Subscription | Premium subscription | License + Support |
| **Compliance** | Us | Shared | Customer |
| **Updates** | Automatic | Automatic (app) | Manual |
| **Target Market** | SMB | Enterprise | Government |
| **Minimum Price** | $5/user/month | $25/user/month | $10,000/year |

---

## Implementation Roadmap

### Phase 1: Multi-Tenant Foundation (4-6 weeks)

**Objective:** Enable managed multi-tenant SaaS

**Deliverables:**
- [ ] Tenant registry schema and API
- [ ] Tenant_id propagation to all tables
- [ ] Row-level security implementation
- [ ] Azure AD multi-tenant app registration
- [ ] Consent flow and tenant provisioning
- [ ] Basic admin portal

**Technical Changes:**
```sql
-- New tables
CREATE TABLE tenants (...);
CREATE TABLE tenant_settings (...);

-- Migrations
ALTER TABLE meetings ADD COLUMN tenant_id;
ALTER TABLE meeting_minutes ADD COLUMN tenant_id;
-- etc.

-- RLS policies
CREATE POLICY tenant_isolation ON meetings ...;
```

### Phase 2: Billing Integration (3-4 weeks)

**Objective:** Enable subscription and usage-based billing

**Deliverables:**
- [ ] Stripe Billing integration
- [ ] Subscription management API
- [ ] Usage metering (meetings processed, active users)
- [ ] Entitlement enforcement
- [ ] Customer billing portal
- [ ] Trial management

**Integration Points:**
- Stripe Checkout for signup
- Stripe Webhooks for subscription events
- Stripe Usage Records for metering

### Phase 3: Self-Service Onboarding (2-3 weeks)

**Objective:** Enable customers to sign up without manual intervention

**Deliverables:**
- [ ] Landing page with signup flow
- [ ] Azure AD consent experience
- [ ] Automatic tenant provisioning
- [ ] Admin setup wizard
- [ ] Email verification and welcome flow
- [ ] Team invitation system

### Phase 4: Pluggable Data Layer (3-4 weeks)

**Objective:** Abstract data access to support multiple storage backends

**Deliverables:**
- [ ] Storage adapter interface
- [ ] Managed storage adapter (current)
- [ ] Customer storage adapter (BYOI)
- [ ] Connection factory per tenant
- [ ] Health monitoring for external resources
- [ ] Graceful degradation on failures

**Architecture:**
```typescript
interface StorageAdapter {
  getMeeting(id: string): Promise<Meeting>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  // ... all storage operations
}

class ManagedStorageAdapter implements StorageAdapter {
  // Uses our shared database
}

class CustomerStorageAdapter implements StorageAdapter {
  // Connects to customer's database
}
```

### Phase 5: BYOI Support (4-6 weeks)

**Objective:** Enable customer-controlled storage

**Deliverables:**
- [ ] Tenant resource profile schema
- [ ] Secure credential exchange portal
- [ ] Connection validation workflow
- [ ] Migration orchestration system
- [ ] Per-tenant health monitoring
- [ ] Fallback/degradation handling
- [ ] Updated documentation

### Phase 6: Packaging & Licensing (4-6 weeks)

**Objective:** Enable self-hosted deployments

**Deliverables:**
- [ ] Docker image packaging
- [ ] Docker Compose templates
- [ ] Environment configuration system
- [ ] License key generation system
- [ ] License validation in app
- [ ] Installation documentation
- [ ] Upgrade procedures

### Phase 7: Azure Marketplace (2-3 weeks)

**Objective:** Simplified self-hosted deployment via Marketplace

**Deliverables:**
- [ ] ARM/Bicep templates
- [ ] Marketplace managed application
- [ ] Marketplace licensing integration
- [ ] Usage metering via Marketplace
- [ ] Marketplace listing and certification

### Phase 8: Helm & Air-Gapped (3-4 weeks)

**Objective:** Support Kubernetes and disconnected environments

**Deliverables:**
- [ ] Helm chart with dependencies
- [ ] Kubernetes documentation
- [ ] Air-gapped installation package
- [ ] Offline license bundles
- [ ] Offline documentation

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1: Multi-Tenant Foundation | 4-6 weeks | 4-6 weeks |
| 2: Billing Integration | 3-4 weeks | 7-10 weeks |
| 3: Self-Service Onboarding | 2-3 weeks | 9-13 weeks |
| 4: Pluggable Data Layer | 3-4 weeks | 12-17 weeks |
| 5: BYOI Support | 4-6 weeks | 16-23 weeks |
| 6: Packaging & Licensing | 4-6 weeks | 20-29 weeks |
| 7: Azure Marketplace | 2-3 weeks | 22-32 weeks |
| 8: Helm & Air-Gapped | 3-4 weeks | 25-36 weeks |

**Total: 25-36 weeks (6-9 months) for all models**

---

## Milestones

| Milestone | Target | Enables |
|-----------|--------|---------|
| MVP SaaS Launch | Week 10 | Model 1 (Managed) |
| Enterprise Ready | Week 23 | Model 2 (BYOI) |
| Full Product Suite | Week 36 | Model 3 (Self-Hosted) |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-tenant data leak | Critical | Row-level security, tenant isolation testing |
| BYOI connection failures | High | Circuit breakers, health monitoring, fallback UX |
| License bypass | Medium | Cryptographic validation, periodic checks |
| Support burden for self-hosted | High | Premium support tiers, diagnostic tooling |
| Marketplace certification delays | Medium | Early engagement with Microsoft |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Managed SaaS signups | 100 in first quarter |
| BYOI customers | 10 enterprise in first year |
| Self-hosted licenses | 5 government in first year |
| Customer retention | >90% annual |
| Support ticket resolution | <24 hours (managed), <48 hours (BYOI/self-hosted) |

---

## Related Documentation

- [Implementation Plan (Attachment Capture)](./IMPLEMENTATION_PLAN.md)
- [replit.md](../replit.md) - Project overview
- [schema.ts](../shared/schema.ts) - Current database schema
