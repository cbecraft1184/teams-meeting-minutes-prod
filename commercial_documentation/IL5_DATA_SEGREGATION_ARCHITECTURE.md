# enterprise data isolation Architecture - DOD Meeting Minutes Management System

**Document Version:** 1.0  
**Last Updated:** 2025-11-14  
**Classification:** UNCLASSIFIED  
**Deployment Target:** Azure Commercial ONLY

---

## Executive Summary

This document defines the **Information Level 5 (IL5) data segregation architecture** for the DOD Meeting Minutes Management System. IL5 compliance requires physical or logical separation of data at different classification levels (Standard, Enhanced, Premium tiers) to prevent unauthorized cross-classification access, data spillage, and commingling of classified information.

**Primary Architecture:** Separate Azure Database for PostgreSQL instances per classification level  
**Alternative Architecture:** Single database with PostgreSQL Row-Level Security (RLS)  
**Recommendation:** Separate instances (defense-in-depth, audit simplification, blast radius reduction)

---

## Table of Contents

1. [IL5 Compliance Requirements](#il5-compliance-requirements)
2. [Architecture Overview](#architecture-overview)
3. [Primary Architecture: Separate Database Instances](#primary-architecture-separate-database-instances)
4. [Alternative Architecture: Row-Level Security](#alternative-architecture-row-level-security)
5. [Application-Layer Access Control](#application-layer-access-control)
6. [Audit Logging and Monitoring](#audit-logging-and-monitoring)
7. [Data Migration Strategy](#data-migration-strategy)
8. [Testing and Validation](#testing-and-validation)
9. [Disaster Recovery and Backup](#disaster-recovery-and-backup)
10. [Compliance Certification](#compliance-certification)

---

## 1. IL5 Compliance Requirements

### 1.1 NIST 800-171 Rev 2 Requirements

**3.1.3 Control: Separate the duties of individuals to reduce the risk of malevolent activity without collusion.**

**Applied to Data Segregation:**
- Data at different classification levels must be stored in isolated environments
- Access controls must enforce "need-to-know" and clearance-based access
- No single point of failure should allow cross-classification data spillage

**3.13.11 Control: Employ cryptographic mechanisms to protect the confidentiality of CUI during storage.**

**Applied to Data Segregation:**
- CONFIDENTIAL and SECRET data must use customer-managed encryption keys (CMK)
- Encryption keys must be stored in FIPS 140-2 Level 2 or higher HSM (Azure Key Vault Premium)
- Key rotation must occur every 90 days for SECRET, 180 days for CONFIDENTIAL

**3.13.16 Control: Protect the confidentiality of CUI at rest.**

**Applied to Data Segregation:**
- Database instances storing CONFIDENTIAL/SECRET must use Transparent Data Encryption (TDE)
- Backup files must be encrypted with same or higher protection level
- Temporary files, cache, and logs must not contain unencrypted classified data

### 1.2 DOD IL5 Specific Requirements

**Physical or Logical Separation:**
- **Option 1 (Preferred):** Separate physical database instances (Azure Database for PostgreSQL Flexible Server)
- **Option 2:** Logical separation using Row-Level Security (RLS) with mandatory access controls (MAC)

**Network Isolation:**
- SECRET database must have no internet egress capability
- CONFIDENTIAL database must restrict egress to approved DOD networks only
- UNCLASSIFIED database may have internet access with appropriate controls

**Access Control:**
- Role-Based Access Control (RBAC) based on Azure AD group membership
- Clearance-level groups: `UNCLASS_Users`, `CONFIDENTIAL_Users`, `SECRET_Users`
- Fail-closed security model: deny by default, explicit grant required

**Audit Requirements:**
- All database queries must be logged with user identity, timestamp, classification
- Audit logs for SECRET must be retained for 7 years, CONFIDENTIAL for 3 years
- Cross-classification access attempts must trigger immediate alerts

### 1.3 SOC 2 Type II Controls Relevant to Data Segregation

| Control | Description | Implementation |
|---------|-------------|----------------|
| AC-4 | Information Flow Enforcement | Firewall rules prevent cross-classification data flow |
| AC-6 | Least Privilege | Users only access databases matching clearance level |
| AU-2 | Audit Events | All database access logged to classification-specific SIEM |
| SC-7 | Boundary Protection | Network segmentation isolates classification boundaries |
| SC-28 | Protection of Information at Rest | CMK encryption for CONFIDENTIAL/SECRET |

---

## 2. Architecture Overview

### 2.1 High-Level Architecture Diagram

**Note:** This architecture uses **classification-specific App Service Environment (ASEv3) clusters** and **horizontally sharded databases** to meet enterprise data isolation requirements. See SCALABILITY_ARCHITECTURE.md for detailed capacity planning.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Azure Front Door (Premium)                           │
│                   - Classification-based routing logic                       │
│                   - WAF + DDoS Protection                                    │
└──────────────┬──────────────────┬──────────────────┬────────────────────────┘
               │                  │                  │
    ┌──────────▼──────────┐ ┌─────▼─────────┐ ┌─────▼──────────┐
    │ UNCLASS VNet        │ │ CONF VNet     │ │ SECRET VNet    │
    │ (10.0.0.0/16)       │ │ (10.10.0.0/16)│ │ (10.20.0.0/16) │
    │ Internet egress OK  │ │ Restricted    │ │ NO EGRESS      │
    └──────────┬──────────┘ └─────┬─────────┘ └─────┬──────────┘
               │                  │                  │
┌──────────────▼──────────────────▼──────────────────▼─────────────────────────┐
│              COMPUTE TIER (Classification-Specific ASE Clusters)              │
├───────────────────────────┬───────────────────────┬───────────────────────────┤
│ UNCLASS ASE Cluster       │ CONF ASE Cluster      │ SECRET ASE Cluster        │
├───────────────────────────┼───────────────────────┼───────────────────────────┤
│ Baseline: 1 ASEv3         │ Baseline: 1 ASEv3     │ Baseline: 1 ASEv3         │
│ - 12× I3v2 instances      │ - 4× I3v2 instances   │ - 2× I3v2 instances       │
│                           │                       │                           │
│ Peak: 6 ASEv3             │ Peak: 4 ASEv3         │ Peak: 2 ASEv3             │
│ - 600× I3v2 instances     │ - 240× I3v2 instances │ - 40× I3v2 instances      │
│                           │                       │                           │
│ Each I3v2 instance:       │ Each I3v2 instance:   │ Each I3v2 instance:       │
│ - 8 vCPU, 32 GB RAM       │ - 8 vCPU, 32 GB RAM   │ - 8 vCPU, 32 GB RAM       │
│ - 2,500-3,000 users       │ - 2,500-3,000 users   │ - 2,500-3,000 users       │
│ - Azure AD integration    │ - Azure AD integration│ - Azure AD integration    │
└───────────────┬───────────┴───────────┬───────────┴───────────┬───────────────┘
                │                       │                       │
┌───────────────▼───────────────────────▼───────────────────────▼───────────────┐
│            DATA TIER (Horizontally Sharded by Classification)                 │
├───────────────────────────┬───────────────────────┬───────────────────────────┤
│ UNCLASS DB Shards (6)     │ CONF DB Shards (4)    │ SECRET DB Shards (2)      │
├───────────────────────────┼───────────────────────┼───────────────────────────┤
│ Shard 1: GP_Gen5_4-8      │ Shard 1: GP_Gen5_4-8  │ Shard 1: GP_Gen5_4-8      │
│ Shard 2: GP_Gen5_4-8      │ Shard 2: GP_Gen5_4-8  │ Shard 2: GP_Gen5_4-8      │
│ Shard 3: GP_Gen5_4-8      │ Shard 3: GP_Gen5_4-8  │                           │
│ Shard 4: GP_Gen5_4-8      │ Shard 4: GP_Gen5_4-8  │ Each shard:               │
│ Shard 5: GP_Gen5_4-8      │                       │ - Private endpoint only   │
│ Shard 6: GP_Gen5_4-8      │ Each shard:           │ - Isolated VNet           │
│                           │ - Private endpoint    │ - HSM-backed CMK (Premium)│
│ Each shard:               │ - CMK encryption      │ - NO internet egress      │
│ - Public/private endpoint │   (Key Vault Standard)│ - 90-day backups          │
│ - Microsoft-managed keys  │ - 30-day backups      │ - 2-3 read replicas       │
│ - 7-day backups           │ - 2-3 read replicas   │                           │
│ - 2-3 read replicas       │                       │ Total capacity:           │
│                           │ Total capacity:       │ - 15K concurrent conn.    │
│ Total capacity (6 shards):│ - 60K concurrent conn.│ - 10K IOPS                │
│ - 180K concurrent conn.   │ - 40K IOPS            │                           │
│ - 60K IOPS                │                       │                           │
├───────────────────────────┼───────────────────────┼───────────────────────────┤
│ Sharding Key: meeting_id  │ Sharding Key:         │ Sharding Key: meeting_id  │
│ (hash-based distribution) │ meeting_id            │ (hash-based distribution) │
└───────────────────────────┴───────────────────────┴───────────────────────────┘

TOTAL SYSTEM CAPACITY (Baseline → Peak):
- Compute: 18 → 880 instances (I3v2)
- Database: 12 shards (6+4+2) with 34-56 read replicas
- Connections: 255K concurrent (baseline) → 300K+ (peak)
- IOPS: 110K (baseline) → 120K+ (peak)
```

### 2.2 Data Flow by Classification

**User Creates UNCLASSIFIED Meeting:**
1. User authenticates via Azure AD (any clearance level)
2. User selects classification = "UNCLASSIFIED" in UI
3. Application routes request to UNCLASSIFIED database instance
4. Meeting record stored in `meetings` table (UNCLASSIFIED DB)
5. Audit log written to UNCLASSIFIED audit trail

**User Creates SECRET Meeting:**
1. User authenticates via Azure AD
2. Application checks Azure AD group membership: `SECRET_Users` group
3. If authorized, user selects classification = "SECRET" in UI
4. Application routes request to SECRET database instance
5. Meeting record stored in `meetings` table (SECRET DB)
6. Audit log written to SECRET audit trail with enhanced logging

**User Searches Across Classifications:**
1. User authenticates via Azure AD
2. Application determines user's highest clearance level (e.g., CONFIDENTIAL)
3. Application queries UNCLASSIFIED DB and CONFIDENTIAL DB in parallel
4. Application does NOT query SECRET DB (user lacks clearance)
5. Results merged and returned to user (no cross-classification indicators)

---

## 3. Primary Architecture: Separate Database Instances

### 3.1 Database Instance Configuration

**UNCLASSIFIED Database Instance:**
```hcl
# Terraform configuration for UNCLASSIFIED PostgreSQL
resource "azurerm_postgresql_flexible_server" "unclassified" {
  name                = "dod-meetings-unclass-db"
  resource_group_name = "rg-meetings-prod-usgovvirginia"
  location            = "usgovvirginia"
  
  sku_name   = "GP_Standard_D8s_v3"  # 8 vCPU, 32 GB RAM
  storage_mb = 524288                # 512 GB
  version    = "14"
  
  administrator_login    = "dbadmin"
  administrator_password = random_password.unclass_db.result
  
  backup_retention_days = 7
  geo_redundant_backup  = true
  
  public_network_access_enabled = true  # Accessible from internet (with firewall)
  
  authentication {
    active_directory_auth_enabled = true
    tenant_id                      = data.azurerm_client_config.current.tenant_id
  }
  
  tags = {
    Classification = "UNCLASSIFIED"
    Environment    = "Production"
    CostCenter     = "IT-DOD-Meetings"
  }
}

# Firewall rule: Allow Azure services
resource "azurerm_postgresql_flexible_server_firewall_rule" "unclass_azure" {
  server_id        = azurerm_postgresql_flexible_server.unclassified.id
  name             = "AllowAzureServices"
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
```

**CONFIDENTIAL Database Instance:**
```hcl
# Terraform configuration for CONFIDENTIAL PostgreSQL
resource "azurerm_postgresql_flexible_server" "confidential" {
  name                = "dod-meetings-conf-db"
  resource_group_name = "rg-meetings-prod-usgovvirginia"
  location            = "usgovvirginia"
  
  sku_name   = "GP_Standard_D4s_v3"  # 4 vCPU, 16 GB RAM
  storage_mb = 262144                # 256 GB
  version    = "14"
  
  administrator_login    = "dbadmin"
  administrator_password = random_password.conf_db.result
  
  backup_retention_days        = 30
  geo_redundant_backup         = true
  customer_managed_key_enabled = true  # CMK encryption
  
  public_network_access_enabled = false  # Private endpoint only
  delegated_subnet_id           = azurerm_subnet.database_subnet.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  
  authentication {
    active_directory_auth_enabled = true
    tenant_id                      = data.azurerm_client_config.current.tenant_id
  }
  
  tags = {
    Classification = "CONFIDENTIAL"
    Environment    = "Production"
    CostCenter     = "IT-DOD-Meetings"
  }
}

# Customer-managed encryption key from Key Vault
resource "azurerm_postgresql_flexible_server_key" "conf_cmk" {
  server_id      = azurerm_postgresql_flexible_server.confidential.id
  key_vault_id   = azurerm_key_vault.conf_kv.id
  key_vault_key_id = azurerm_key_vault_key.conf_db_key.id
}
```

**SECRET Database Instance:**
```hcl
# Terraform configuration for SECRET PostgreSQL
resource "azurerm_postgresql_flexible_server" "secret" {
  name                = "dod-meetings-secret-db"
  resource_group_name = "rg-meetings-prod-usgovvirginia"
  location            = "usgovvirginia"
  
  sku_name   = "GP_Standard_D2s_v3"  # 2 vCPU, 8 GB RAM
  storage_mb = 131072                # 128 GB (smallest workload)
  version    = "14"
  
  administrator_login    = "dbadmin"
  administrator_password = random_password.secret_db.result
  
  backup_retention_days        = 90  # 90-day retention for SECRET
  geo_redundant_backup         = true
  customer_managed_key_enabled = true  # HSM-backed CMK
  
  public_network_access_enabled = false  # No internet access
  delegated_subnet_id           = azurerm_subnet.secret_db_subnet.id  # Isolated VNet
  private_dns_zone_id           = azurerm_private_dns_zone.postgres_secret.id
  
  authentication {
    active_directory_auth_enabled = true
    tenant_id                      = data.azurerm_client_config.current.tenant_id
  }
  
  tags = {
    Classification = "SECRET"
    Environment    = "Production"
    CostCenter     = "IT-DOD-Meetings"
    AuditLevel     = "Enhanced"
  }
}

# HSM-backed encryption key from Premium Key Vault
resource "azurerm_postgresql_flexible_server_key" "secret_cmk" {
  server_id      = azurerm_postgresql_flexible_server.secret.id
  key_vault_id   = azurerm_key_vault.secret_kv.id  # Premium tier (HSM-backed)
  key_vault_key_id = azurerm_key_vault_key.secret_db_key.id
}
```

### 3.2 Schema Consistency Across Instances

**Challenge:** All three database instances use identical schema, but contain different data.

**Solution:** Unified schema deployment via Drizzle ORM migrations.

**Drizzle Configuration (Multi-Instance):**

```typescript
// server/db/connections.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// UNCLASSIFIED database connection
const unclassClient = postgres(process.env.DATABASE_URL_UNCLASS!);
export const unclassDb = drizzle(unclassClient);

// CONFIDENTIAL database connection
const confClient = postgres(process.env.DATABASE_URL_CONF!);
export const confDb = drizzle(confClient);

// SECRET database connection
const secretClient = postgres(process.env.DATABASE_URL_SECRET!);
export const secretDb = drizzle(secretClient);

// Helper: Get database by classification
export function getDbByClassification(classification: string) {
  switch (classification) {
    case 'UNCLASSIFIED':
      return unclassDb;
    case 'CONFIDENTIAL':
      return confDb;
    case 'SECRET':
      return secretDb;
    default:
      throw new Error(`Invalid classification: ${classification}`);
  }
}
```

**Schema Definition (Shared):**

```typescript
// shared/schema.ts
import { pgTable, serial, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';

export const classificationEnum = pgEnum('classification', [
  'UNCLASSIFIED',
  'CONFIDENTIAL',
  'SECRET'
]);

export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  teamsId: varchar('teams_id', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  classification: classificationEnum('classification').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Note: Classification column exists in all tables but should match the database instance
// e.g., UNCLASSIFIED DB should only contain rows where classification = 'UNCLASSIFIED'
```

**Migration Strategy:**

```bash
# Deploy schema to all three instances
npm run db:migrate:unclass   # Deploys to UNCLASSIFIED DB
npm run db:migrate:conf      # Deploys to CONFIDENTIAL DB
npm run db:migrate:secret    # Deploys to SECRET DB
```

**package.json scripts:**

```json
{
  "scripts": {
    "db:migrate:unclass": "DATABASE_URL=$DATABASE_URL_UNCLASS drizzle-kit push:pg",
    "db:migrate:conf": "DATABASE_URL=$DATABASE_URL_CONF drizzle-kit push:pg",
    "db:migrate:secret": "DATABASE_URL=$DATABASE_URL_SECRET drizzle-kit push:pg"
  }
}
```

### 3.3 Application-Layer Routing Logic

**Middleware: Classification-Based Database Router**

```typescript
// server/middleware/classificationRouter.ts
import { Request, Response, NextFunction } from 'express';
import { getDbByClassification } from '../db/connections';

export interface ClassificationContext {
  db: ReturnType<typeof getDbByClassification>;
  classification: string;
  userClearance: string[];
}

export async function classificationRouter(req: Request, res: Response, next: NextFunction) {
  const classification = req.body.classification || req.query.classification;
  
  if (!classification) {
    return res.status(400).json({ error: 'Classification not specified' });
  }
  
  // Validate classification
  if (!['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET'].includes(classification)) {
    return res.status(400).json({ error: 'Invalid classification level' });
  }
  
  // Check user clearance (from Azure AD groups)
  const userClearance = req.user?.clearanceLevels || [];
  
  if (!hasAccessToClassification(userClearance, classification)) {
    return res.status(403).json({ 
      error: 'Insufficient clearance',
      required: classification,
      current: userClearance
    });
  }
  
  // Attach correct database connection to request
  req.classificationContext = {
    db: getDbByClassification(classification),
    classification,
    userClearance
  };
  
  next();
}

function hasAccessToClassification(userClearance: string[], required: string): boolean {
  const hierarchy = {
    'UNCLASSIFIED': 1,
    'CONFIDENTIAL': 2,
    'SECRET': 3
  };
  
  const userMaxLevel = Math.max(...userClearance.map(c => hierarchy[c] || 0));
  const requiredLevel = hierarchy[required] || 0;
  
  return userMaxLevel >= requiredLevel;
}
```

**API Route Example:**

```typescript
// server/routes.ts
import { Router } from 'express';
import { classificationRouter } from './middleware/classificationRouter';
import { eq } from 'drizzle-orm';
import { meetings } from '../shared/schema';

const router = Router();

// Create meeting (classification-aware)
router.post('/api/meetings', classificationRouter, async (req, res) => {
  const { db, classification } = req.classificationContext;
  
  const newMeeting = await db.insert(meetings).values({
    teamsId: req.body.teamsId,
    title: req.body.title,
    classification,  // Enforced from classification context
    status: 'pending',
    scheduledAt: new Date(req.body.scheduledAt),
  }).returning();
  
  // Audit log
  await auditLog({
    action: 'CREATE_MEETING',
    classification,
    userId: req.user.id,
    resource: newMeeting[0].id,
    timestamp: new Date()
  }, classification);
  
  res.json(newMeeting[0]);
});

// Get meeting by ID (classification-aware)
router.get('/api/meetings/:id', classificationRouter, async (req, res) => {
  const { db, classification } = req.classificationContext;
  
  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, parseInt(req.params.id))
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  // Double-check classification matches (defense in depth)
  if (meeting.classification !== classification) {
    await auditLog({
      action: 'CLASSIFICATION_MISMATCH',
      classification,
      userId: req.user.id,
      resource: meeting.id,
      severity: 'CRITICAL',
      details: `Expected ${classification}, found ${meeting.classification}`
    }, 'SECRET');  // Always log to highest classification
    
    return res.status(403).json({ error: 'Classification mismatch' });
  }
  
  res.json(meeting);
});

// Search across user's accessible classifications
router.get('/api/meetings/search', async (req, res) => {
  const userClearance = req.user?.clearanceLevels || [];
  const searchTerm = req.query.q;
  
  const results = [];
  
  // Query each database the user has access to
  for (const classification of userClearance) {
    const db = getDbByClassification(classification);
    
    const classResults = await db.query.meetings.findMany({
      where: like(meetings.title, `%${searchTerm}%`),
      limit: 50
    });
    
    results.push(...classResults);
  }
  
  // Sort by relevance (implementation detail)
  results.sort((a, b) => b.createdAt - a.createdAt);
  
  res.json(results);
});
```

### 3.4 Network Isolation

**VNet Configuration:**

```hcl
# UNCLASSIFIED Database: Public endpoint with firewall
resource "azurerm_postgresql_flexible_server_firewall_rule" "unclass_app_service" {
  server_id        = azurerm_postgresql_flexible_server.unclassified.id
  name             = "AllowAppService"
  start_ip_address = azurerm_app_service.meetings_app.outbound_ip_addresses[0]
  end_ip_address   = azurerm_app_service.meetings_app.outbound_ip_addresses[3]
}

# CONFIDENTIAL Database: Private endpoint in shared VNet
resource "azurerm_private_endpoint" "conf_db" {
  name                = "pe-conf-db"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  subnet_id           = azurerm_subnet.database_subnet.id
  
  private_service_connection {
    name                           = "psc-conf-db"
    private_connection_resource_id = azurerm_postgresql_flexible_server.confidential.id
    subresource_names              = ["postgresqlServer"]
    is_manual_connection           = false
  }
}

# SECRET Database: Isolated VNet with no internet egress
resource "azurerm_virtual_network" "secret_isolated" {
  name                = "vnet-secret-isolated"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.10.0.0/16"]
  
  tags = {
    Classification = "SECRET"
    Isolated       = "true"
  }
}

resource "azurerm_subnet" "secret_db_subnet" {
  name                 = "subnet-secret-db"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.secret_isolated.name
  address_prefixes     = ["10.10.1.0/24"]
  
  delegation {
    name = "postgres-delegation"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action"
      ]
    }
  }
}

# VNet peering: Allow App Service VNet to access SECRET VNet (one-way)
resource "azurerm_virtual_network_peering" "app_to_secret" {
  name                      = "app-to-secret"
  resource_group_name       = azurerm_resource_group.main.name
  virtual_network_name      = azurerm_virtual_network.app_service.name
  remote_virtual_network_id = azurerm_virtual_network.secret_isolated.id
  allow_forwarded_traffic   = false
  allow_gateway_transit     = false
}

# Network Security Group: SECRET DB subnet
resource "azurerm_network_security_group" "secret_db" {
  name                = "nsg-secret-db"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  
  security_rule {
    name                       = "AllowPostgreSQLFromAppService"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = "10.0.1.0/24"  # App Service subnet
    destination_address_prefix = "10.10.1.0/24"
  }
  
  security_rule {
    name                       = "DenyAllOutbound"
    priority                   = 200
    direction                  = "Outbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}
```

### 3.5 Encryption Configuration

**Customer-Managed Keys (CMK) for CONFIDENTIAL/SECRET:**

```hcl
# Key Vault for CONFIDENTIAL
resource "azurerm_key_vault" "conf" {
  name                = "kv-conf-db-keys"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"  # Standard tier for CONFIDENTIAL
  
  purge_protection_enabled = true
  soft_delete_retention_days = 30
  
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_postgresql_flexible_server.confidential.identity[0].principal_id
    
    key_permissions = [
      "Get", "WrapKey", "UnwrapKey"
    ]
  }
}

resource "azurerm_key_vault_key" "conf_db" {
  name         = "conf-db-encryption-key"
  key_vault_id = azurerm_key_vault.conf.id
  key_type     = "RSA"
  key_size     = 2048
  
  key_opts = [
    "decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"
  ]
  
  rotation_policy {
    automatic {
      time_before_expiry = "P30D"
    }
    
    expire_after         = "P180D"  # 180-day rotation for CONFIDENTIAL
    notify_before_expiry = "P30D"
  }
}

# Key Vault for SECRET (HSM-backed)
resource "azurerm_key_vault" "secret" {
  name                = "kv-secret-db-keys"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "premium"  # Premium tier for HSM-backed keys
  
  purge_protection_enabled = true
  soft_delete_retention_days = 90
  
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_postgresql_flexible_server.secret.identity[0].principal_id
    
    key_permissions = [
      "Get", "WrapKey", "UnwrapKey"
    ]
  }
}

resource "azurerm_key_vault_key" "secret_db" {
  name         = "secret-db-encryption-key"
  key_vault_id = azurerm_key_vault.secret.id
  key_type     = "RSA-HSM"  # HSM-backed key
  key_size     = 4096        # 4096-bit for SECRET
  
  key_opts = [
    "decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"
  ]
  
  rotation_policy {
    automatic {
      time_before_expiry = "P15D"
    }
    
    expire_after         = "P90D"  # 90-day rotation for SECRET
    notify_before_expiry = "P15D"
  }
}
```

---

## 4. Alternative Architecture: Row-Level Security

**Note:** This architecture is provided for completeness but is NOT recommended for IL5 compliance due to increased risk of data spillage and audit complexity.

### 4.1 Single Database with RLS Implementation

```sql
-- Enable Row-Level Security on meetings table
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create PostgreSQL roles for each clearance level
CREATE ROLE unclassified_role;
CREATE ROLE confidential_role;
CREATE ROLE secret_role;

-- Grant base permissions
GRANT SELECT, INSERT, UPDATE ON meetings TO unclassified_role;
GRANT SELECT, INSERT, UPDATE ON meetings TO confidential_role;
GRANT SELECT, INSERT, UPDATE ON meetings TO secret_role;

-- RLS Policy: UNCLASSIFIED users can only see UNCLASSIFIED data
CREATE POLICY unclassified_access ON meetings
  FOR ALL
  TO unclassified_role
  USING (classification = 'UNCLASSIFIED');

-- RLS Policy: CONFIDENTIAL users can see UNCLASSIFIED + CONFIDENTIAL
CREATE POLICY confidential_access ON meetings
  FOR ALL
  TO confidential_role
  USING (classification IN ('UNCLASSIFIED', 'CONFIDENTIAL'));

-- RLS Policy: SECRET users can see all classifications
CREATE POLICY secret_access ON meetings
  FOR ALL
  TO secret_role
  USING (classification IN ('UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET'));

-- Prevent escalation: Users cannot INSERT rows above their clearance
CREATE POLICY unclassified_insert ON meetings
  FOR INSERT
  TO unclassified_role
  WITH CHECK (classification = 'UNCLASSIFIED');

CREATE POLICY confidential_insert ON meetings
  FOR INSERT
  TO confidential_role
  WITH CHECK (classification IN ('UNCLASSIFIED', 'CONFIDENTIAL'));

CREATE POLICY secret_insert ON meetings
  FOR INSERT
  TO secret_role
  WITH CHECK (classification IN ('UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET'));
```

### 4.2 Application Integration with RLS

```typescript
// server/db/connection-rls.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Create connection pool per role
const roleConnections = {
  'UNCLASSIFIED': postgres(process.env.DATABASE_URL!, {
    connection: {
      application_name: 'meetings-app',
      options: '-c role=unclassified_role'
    }
  }),
  'CONFIDENTIAL': postgres(process.env.DATABASE_URL!, {
    connection: {
      application_name: 'meetings-app',
      options: '-c role=confidential_role'
    }
  }),
  'SECRET': postgres(process.env.DATABASE_URL!, {
    connection: {
      application_name: 'meetings-app',
      options: '-c role=secret_role'
    }
  })
};

export function getDbByUserClearance(clearance: string) {
  const connection = roleConnections[clearance];
  if (!connection) {
    throw new Error(`Invalid clearance level: ${clearance}`);
  }
  return drizzle(connection);
}
```

### 4.3 Disadvantages of RLS Approach

**Security Risks:**
- Single database means all classifications commingled in one instance
- RLS bugs or misconfigurations could expose cross-classification data
- Harder to implement network isolation (all data in one VNet)
- Backup files contain all classifications (complex key management)

**Operational Complexity:**
- Audit logs mixed across classifications (requires filtering)
- Disaster recovery must restore all classifications simultaneously
- Performance tuning affects all classifications (cannot optimize per level)
- Role management adds overhead (connection pool per role)

**Compliance Challenges:**
- Harder to demonstrate physical separation for IL5 audits
- Shared encryption keys reduce defense-in-depth
- Single point of failure for all classification levels

---

## 5. Application-Layer Access Control

### 5.1 Azure AD Group-Based Clearance Mapping

**Azure AD Groups:**
- `UNCLASS_Users` - All users (default)
- `CONFIDENTIAL_Users` - Users with CONFIDENTIAL or higher clearance
- `SECRET_Users` - Users with SECRET clearance only

**Group Membership Query:**

```typescript
// server/auth/clearance.ts
import { Client } from '@microsoft/microsoft-graph-client';

export async function getUserClearanceLevels(userId: string, accessToken: string): Promise<string[]> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
  
  const groups = await client
    .api(`/users/${userId}/memberOf`)
    .get();
  
  const clearanceLevels: string[] = ['UNCLASSIFIED'];  // Everyone has UNCLASSIFIED
  
  for (const group of groups.value) {
    if (group.displayName === 'CONFIDENTIAL_Users') {
      clearanceLevels.push('CONFIDENTIAL');
    }
    if (group.displayName === 'SECRET_Users') {
      clearanceLevels.push('SECRET');
    }
  }
  
  return clearanceLevels;
}
```

**Session Caching (15-minute TTL):**

```typescript
// server/auth/session.ts
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.SESSION_DB_URL,  // Separate DB for sessions
    },
    tableName: 'user_sessions',
    ttl: 15 * 60,  // 15-minute TTL
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 15 * 60 * 1000,  // 15 minutes
  }
});

// Middleware to refresh clearance levels from Azure AD
export async function refreshClearanceLevels(req, res, next) {
  if (!req.session.clearanceLevels || req.session.clearanceExpiry < Date.now()) {
    const accessToken = req.user.accessToken;
    const clearanceLevels = await getUserClearanceLevels(req.user.id, accessToken);
    
    req.session.clearanceLevels = clearanceLevels;
    req.session.clearanceExpiry = Date.now() + (15 * 60 * 1000);  // 15 minutes
    
    await req.session.save();
  }
  
  req.user.clearanceLevels = req.session.clearanceLevels;
  next();
}
```

### 5.2 Fail-Closed Security Model

**Principle:** Deny by default, explicit grant required.

```typescript
// server/middleware/authorization.ts
export function requireClearance(requiredLevel: string) {
  return (req, res, next) => {
    const userClearance = req.user?.clearanceLevels || [];
    
    if (!hasAccessToClassification(userClearance, requiredLevel)) {
      // Audit unauthorized access attempt
      auditLog({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        classification: requiredLevel,
        userId: req.user?.id || 'UNKNOWN',
        userClearance,
        severity: 'WARNING',
        timestamp: new Date()
      }, 'SECRET');  // Always log to highest classification
      
      return res.status(403).json({
        error: 'Access denied',
        required: requiredLevel,
        message: 'You do not have the required clearance level for this resource.'
      });
    }
    
    next();
  };
}

// Usage in routes
router.get('/api/meetings/:id', 
  requireClearance('CONFIDENTIAL'),  // Requires CONFIDENTIAL or higher
  async (req, res) => {
    // Route handler
  }
);
```

---

## 6. Audit Logging and Monitoring

### 6.1 Classification-Specific Audit Trails

**Audit Log Schema:**

```typescript
// shared/schema-audit.ts
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  classification: classificationEnum('classification').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  userEmail: varchar('user_email', { length: 255 }),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: varchar('resource_id', { length: 255 }),
  severity: varchar('severity', { length: 20 }).notNull(),  // INFO, WARNING, CRITICAL
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
```

**Audit Logging Implementation:**

```typescript
// server/utils/audit.ts
import { getDbByClassification } from '../db/connections';
import { auditLogs } from '../../shared/schema-audit';

interface AuditEntry {
  action: string;
  classification: string;
  userId: string;
  userEmail?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export async function auditLog(entry: AuditEntry, targetClassification: string) {
  const db = getDbByClassification(targetClassification);
  
  await db.insert(auditLogs).values({
    ...entry,
    classification: targetClassification,
    severity: entry.severity || 'INFO'
  });
  
  // Also forward to Azure Monitor / SIEM
  await forwardToAzureMonitor(entry, targetClassification);
}

async function forwardToAzureMonitor(entry: AuditEntry, classification: string) {
  // Send to Log Analytics workspace (classification-specific)
  const workspaceId = getWorkspaceIdByClassification(classification);
  
  // Implementation using Azure Monitor REST API
  // ...
}
```

### 6.2 Real-Time Alerting

**Alert Rules:**

```typescript
// server/monitoring/alerts.ts
export const alertRules = [
  {
    name: 'Cross-Classification Access Attempt',
    condition: (auditEntry) => auditEntry.action === 'CLASSIFICATION_MISMATCH',
    severity: 'CRITICAL',
    notification: ['security-team@dod.mil', 'on-call-pager'],
    action: 'Lock user account, initiate investigation'
  },
  {
    name: 'Repeated Failed Authentication',
    condition: (auditEntry) => auditEntry.action === 'FAILED_AUTH' && count >= 5,
    severity: 'WARNING',
    notification: ['security-team@dod.mil'],
    action: 'Temporarily lock account for 15 minutes'
  },
  {
    name: 'SECRET Data Access Outside Business Hours',
    condition: (auditEntry) => 
      auditEntry.classification === 'SECRET' && 
      auditEntry.action === 'READ' &&
      isOutsideBusinessHours(auditEntry.timestamp),
    severity: 'WARNING',
    notification: ['security-team@dod.mil'],
    action: 'Review access logs, notify user supervisor'
  }
];
```

---

## 7. Data Migration Strategy

### 7.1 Initial Data Population

**Scenario:** Migrating existing meetings from single-database pilot to multi-instance IL5 architecture.

**Migration Script:**

```typescript
// scripts/migrate-to-il5.ts
import { unclassDb, confDb, secretDb } from '../server/db/connections';
import { meetings } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function migrateToIL5(sourceDatabaseUrl: string) {
  const sourceDb = drizzle(postgres(sourceDatabaseUrl));
  
  // Fetch all meetings from source
  const allMeetings = await sourceDb.query.meetings.findMany();
  
  console.log(`Migrating ${allMeetings.length} meetings...`);
  
  let unclassMigrated = 0;
  let confMigrated = 0;
  let secretMigrated = 0;
  
  for (const meeting of allMeetings) {
    const targetDb = getDbByClassification(meeting.classification);
    
    await targetDb.insert(meetings).values(meeting);
    
    if (meeting.classification === 'UNCLASSIFIED') unclassMigrated++;
    if (meeting.classification === 'CONFIDENTIAL') confMigrated++;
    if (meeting.classification === 'SECRET') secretMigrated++;
  }
  
  console.log(`Migration complete:`);
  console.log(`  UNCLASSIFIED: ${unclassMigrated}`);
  console.log(`  CONFIDENTIAL: ${confMigrated}`);
  console.log(`  SECRET: ${secretMigrated}`);
}

// Run migration
migrateToIL5(process.env.SOURCE_DATABASE_URL!);
```

### 7.2 Ongoing Data Synchronization

**Challenge:** Ensuring data integrity across three separate database instances.

**Solution:** Single source of truth per meeting (classification determines database instance).

**Validation Job:**

```typescript
// scripts/validate-data-segregation.ts
async function validateDataSegregation() {
  const violations = [];
  
  // Check UNCLASSIFIED DB: Should only contain UNCLASSIFIED meetings
  const unclassMeetings = await unclassDb.query.meetings.findMany();
  for (const meeting of unclassMeetings) {
    if (meeting.classification !== 'UNCLASSIFIED') {
      violations.push({
        database: 'UNCLASSIFIED',
        meetingId: meeting.id,
        expectedClassification: 'UNCLASSIFIED',
        actualClassification: meeting.classification,
        severity: 'CRITICAL'
      });
    }
  }
  
  // Similar checks for CONFIDENTIAL and SECRET databases
  // ...
  
  if (violations.length > 0) {
    console.error(`CRITICAL: ${violations.length} data segregation violations detected!`);
    
    // Alert security team
    await alertSecurityTeam(violations);
    
    // Quarantine affected meetings
    await quarantineViolations(violations);
  } else {
    console.log('Data segregation validation passed.');
  }
}

// Run daily via cron job
setInterval(validateDataSegregation, 24 * 60 * 60 * 1000);  // Every 24 hours
```

---

## 8. Testing and Validation

### 8.1 Unit Tests for Classification Routing

```typescript
// server/middleware/__tests__/classificationRouter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { classificationRouter, hasAccessToClassification } from '../classificationRouter';

describe('Classification Router', () => {
  it('should route UNCLASSIFIED requests to UNCLASSIFIED DB', async () => {
    const req = {
      body: { classification: 'UNCLASSIFIED' },
      user: { clearanceLevels: ['UNCLASSIFIED'] }
    };
    const res = {};
    const next = vi.fn();
    
    await classificationRouter(req, res, next);
    
    expect(req.classificationContext.classification).toBe('UNCLASSIFIED');
    expect(next).toHaveBeenCalled();
  });
  
  it('should deny CONFIDENTIAL access to UNCLASSIFIED users', async () => {
    const req = {
      body: { classification: 'CONFIDENTIAL' },
      user: { clearanceLevels: ['UNCLASSIFIED'] }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();
    
    await classificationRouter(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  
  it('should allow SECRET users to access all classifications', () => {
    expect(hasAccessToClassification(['SECRET'], 'UNCLASSIFIED')).toBe(true);
    expect(hasAccessToClassification(['SECRET'], 'CONFIDENTIAL')).toBe(true);
    expect(hasAccessToClassification(['SECRET'], 'SECRET')).toBe(true);
  });
});
```

### 8.2 Integration Tests for Data Segregation

```typescript
// tests/integration/il5-segregation.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { unclassDb, confDb, secretDb } from '../../server/db/connections';
import { meetings } from '../../shared/schema';

describe('enterprise data isolation', () => {
  beforeAll(async () => {
    // Seed test data
    await unclassDb.insert(meetings).values({
      teamsId: 'unclass-meeting-1',
      title: 'UNCLASSIFIED Test Meeting',
      classification: 'UNCLASSIFIED',
      status: 'pending',
      scheduledAt: new Date()
    });
    
    await confDb.insert(meetings).values({
      teamsId: 'conf-meeting-1',
      title: 'CONFIDENTIAL Test Meeting',
      classification: 'CONFIDENTIAL',
      status: 'pending',
      scheduledAt: new Date()
    });
    
    await secretDb.insert(meetings).values({
      teamsId: 'secret-meeting-1',
      title: 'SECRET Test Meeting',
      classification: 'SECRET',
      status: 'pending',
      scheduledAt: new Date()
    });
  });
  
  it('should isolate UNCLASSIFIED meetings in UNCLASSIFIED DB', async () => {
    const meetings = await unclassDb.query.meetings.findMany();
    
    expect(meetings.length).toBeGreaterThan(0);
    expect(meetings.every(m => m.classification === 'UNCLASSIFIED')).toBe(true);
  });
  
  it('should isolate CONFIDENTIAL meetings in CONFIDENTIAL DB', async () => {
    const meetings = await confDb.query.meetings.findMany();
    
    expect(meetings.length).toBeGreaterThan(0);
    expect(meetings.every(m => m.classification === 'CONFIDENTIAL')).toBe(true);
  });
  
  it('should isolate SECRET meetings in SECRET DB', async () => {
    const meetings = await secretDb.query.meetings.findMany();
    
    expect(meetings.length).toBeGreaterThan(0);
    expect(meetings.every(m => m.classification === 'SECRET')).toBe(true);
  });
  
  it('should prevent cross-database queries', async () => {
    // Attempt to query CONFIDENTIAL meeting from UNCLASSIFIED DB
    const result = await unclassDb.query.meetings.findFirst({
      where: eq(meetings.teamsId, 'conf-meeting-1')
    });
    
    expect(result).toBeUndefined();  // Should not find CONFIDENTIAL meeting in UNCLASSIFIED DB
  });
});
```

### 8.3 Penetration Testing

**Test Scenarios:**
1. **Cross-Classification Data Access:** Attempt to query CONFIDENTIAL data using UNCLASSIFIED credentials
2. **SQL Injection:** Attempt to bypass RLS policies (if using RLS architecture)
3. **Privilege Escalation:** Attempt to escalate clearance level via session manipulation
4. **Network Isolation Bypass:** Attempt to access SECRET DB from internet-facing endpoint

**Expected Results:**
- All unauthorized access attempts should be denied
- All attempts should be logged to audit trail
- Critical attempts should trigger real-time alerts

---

## 9. Disaster Recovery and Backup

### 9.1 Backup Strategy Per Classification

**UNCLASSIFIED:**
- Automated daily backups at 2:00 AM UTC
- 7-day retention
- Geo-redundant storage (GRS)
- Microsoft-managed encryption keys

**CONFIDENTIAL:**
- Automated daily backups at 2:00 AM UTC
- 30-day retention
- Geo-redundant storage (GRS)
- Customer-managed encryption keys (CMK) in Key Vault

**SECRET:**
- Automated daily backups at 2:00 AM UTC
- 90-day retention
- Geo-redundant storage (GRS) with immutable storage (WORM)
- HSM-backed customer-managed keys (Premium Key Vault)

### 9.2 Cross-Classification Restore Validation

**Challenge:** Ensuring backups do not mix classifications during restore.

**Validation Procedure:**
1. Restore UNCLASSIFIED backup to temporary instance
2. Run validation query: `SELECT DISTINCT classification FROM meetings;`
3. Expected result: Only `UNCLASSIFIED` rows
4. If validation fails, abort restore and alert security team

---

## 10. Compliance Certification

### 10.1 IL5 Certification Checklist

- [ ] **Physical Separation:** Separate database instances per classification
- [ ] **Network Isolation:** SECRET DB has no internet egress
- [ ] **Encryption at Rest:** CMK with HSM-backed keys for SECRET
- [ ] **Access Control:** Azure AD group-based clearance enforcement
- [ ] **Audit Logging:** 7-year retention for SECRET audit logs
- [ ] **Backup Segregation:** Separate backup policies per classification
- [ ] **Penetration Testing:** Third-party security assessment passed
- [ ] **ATO Documentation:** IL5 compliance artifacts submitted

### 10.2 SOC 2 Type II Control Mappings

| Control | Implementation | Evidence |
|---------|----------------|----------|
| AC-4 | Network segmentation prevents cross-classification flow | NSG rules, firewall configs |
| AC-6 | Least privilege via Azure AD groups | RBAC policy documentation |
| AU-2 | All database access logged | Audit log sample reports |
| SC-7 | VNet isolation for SECRET database | Network topology diagrams |
| SC-28 | CMK encryption for CONFIDENTIAL/SECRET | Key Vault configuration |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-14 | Security Architect | Initial enterprise data isolation architecture |

**Classification:** UNCLASSIFIED  
**Distribution:** DOD IT Leadership, Security Architects, Compliance Team  
**Review Cycle:** Quarterly (or after major architecture changes)
