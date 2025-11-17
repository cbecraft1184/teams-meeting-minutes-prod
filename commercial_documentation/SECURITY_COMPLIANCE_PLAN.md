# Security & Compliance Plan
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Comprehensive security architecture and compliance framework for SOC 2 Type II, DISA SRG IL5, and DOD RMF authorization in Azure Commercial

**Last Updated:** November 13, 2025  
**Status:** Implementation Guide  
**Audience:** Security engineers, compliance leads, Authorizing Officials, ISSOs/ISSMs

---

## Executive Summary

### Purpose

This document defines the complete security and compliance implementation strategy for deploying the DOD Teams Meeting Minutes Management System in Azure Commercial environments with SECRET classification handling capability.

### Scope

**In Scope:**
- SOC 2 Type II baseline controls (421 controls)
- DISA SRG Cloud Computing Security Requirements Guide (IL5)
- DOD Risk Management Framework (RMF) authorization
- Classification handling (Standard, Enhanced, Premium tiers)
- CAC/PIV authentication enforcement
- Continuous monitoring and audit logging
- Incident response procedures
- POA&M management

**Out of Scope:**
- TOP SECRET classification handling
- Physical security controls (data center security)
- Personnel security clearance adjudication
- Offensive security operations

### Security Posture

```yaml
Classification Support: Standard, Enhanced, Premium tiers
Impact Level: IL5 (DOD)
Compliance Frameworks:
  - SOC 2 Type II
  - DISA SRG Level 5
  - NIST 800-53 Rev 5 (High Baseline)
  - DOD RMF
  - FISMA
Authentication: CAC/PIV (PIV-I acceptable with waiver)
Authorization Model: Azure AD groups + RBAC
Encryption:
  - Data at Rest: AES-256
  - Data in Transit: TLS 1.2+
  - Key Management: Azure Key Vault (FIPS 140-2 Level 2)
```

---

## Reference Architecture

### Security Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│              Azure Commercial - IL5 Boundary           │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 User Access Layer                            │ │
│  │  ┌───────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │ CAC/PIV   │  │ Azure AD     │  │ Conditional Access   │ │ │
│  │  │ Auth      │─▶│ (GCC High)   │─▶│ Policies             │ │ │
│  │  │           │  │              │  │ - MFA Required       │ │ │
│  │  └───────────┘  └──────────────┘  │ - Compliant Device   │ │ │
│  │                                    │ - Geo-Restriction    │ │ │
│  │                                    └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                        │
│                           ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            Azure Front Door + WAF (PCI DSS)               │ │
│  │  - DDoS Protection                                           │ │
│  │  - SSL/TLS Termination (TLS 1.2+)                           │ │
│  │  - OWASP Top 10 Protection                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                        │
│                           ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │         App Service Environment v3 (Isolated)                │ │
│  │                                                               │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ Meeting Minutes App (Node.js)                        │   │ │
│  │  │  - SECRET Classification Handling                    │   │ │
│  │  │  - Group-based Access Control                       │   │ │
│  │  │  - Audit Logging (All Operations)                   │   │ │
│  │  │  - Secrets from Key Vault                           │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                        │
│                           ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │    Data Layer (Encrypted at Rest - AES-256)                  │ │
│  │                                                               │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐│ │
│  │  │ Azure Database for   │  │ Azure Key Vault              ││ │
│  │  │ PostgreSQL           │  │ (FIPS 140-2 Level 2)         ││ │
│  │  │ - Private Endpoint   │  │ - Customer-Managed Keys      ││ │
│  │  │ - TDE Enabled        │  │ - Access Policies            ││ │
│  │  │ - Backup Encrypted   │  │ - Audit Logging              ││ │
│  │  └──────────────────────┘  └──────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                        │
│                           ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │         Monitoring & Audit Layer                             │ │
│  │                                                               │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │ │
│  │  │ Azure Monitor  │  │ Log Analytics  │  │ M365 Audit    │ │ │
│  │  │ - Metrics      │  │ - SIEM         │  │ - 90-day      │ │ │
│  │  │ - Alerts       │  │ - Queries      │  │ - Export      │ │ │
│  │  └────────────────┘  └────────────────┘  └───────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘

            ┌──────────────────────────────────────┐
            │   Integration Security Boundaries     │
            ├──────────────────────────────────────┤
            │ Microsoft Graph API (GCC High)        │
            │ - OAuth 2.0 Token Validation          │
            │ - Rate Limiting                       │
            │ - Audit Logging                       │
            │                                       │
            │ Azure OpenAI Service (GCC High)       │
            │ - API Key Rotation                    │
            │ - Data Residency (US Gov)             │
            │ - No Training on Customer Data        │
            └──────────────────────────────────────┘
```

### Security Control Families

| Control Family | NIST 800-53 | Implementation Owner | Status |
|----------------|-------------|---------------------|--------|
| **Access Control (AC)** | 25 controls | App Team + Azure AD Admin | Required |
| **Awareness & Training (AT)** | 5 controls | Security Team | Required |
| **Audit & Accountability (AU)** | 12 controls | App Team + Azure Monitor | Required |
| **Security Assessment (CA)** | 9 controls | ISSO/ISSM | Required |
| **Configuration Mgmt (CM)** | 14 controls | DevOps Team | Required |
| **Contingency Planning (CP)** | 13 controls | Operations Team | Required |
| **Identification & Auth (IA)** | 11 controls | Azure AD Admin | Required |
| **Incident Response (IR)** | 10 controls | SOC Team | Required |
| **Maintenance (MA)** | 6 controls | Operations Team | Required |
| **Media Protection (MP)** | 8 controls | Data Steward | Required |
| **Physical & Environmental (PE)** | Inherited | Azure Government | Inherited |
| **Planning (PL)** | 9 controls | ISSO/ISSM | Required |
| **Personnel Security (PS)** | Inherited | HR + Security | Inherited |
| **Risk Assessment (RA)** | 10 controls | Risk Manager | Required |
| **System & Services Acquisition (SA)** | 22 controls | Program Manager | Required |
| **System & Communications (SC)** | 51 controls | App Team + Azure Networking | Required |
| **System & Information Integrity (SI)** | 23 controls | Security Team | Required |

---

## Detailed Implementation Plan

### Phase 1: SOC 2 Type II Foundation (Weeks 1-4)

**Step 1.1: Azure AD Conditional Access Policies**

```powershell
# CAC/PIV Certificate Authentication Policy
New-AzureADMSConditionalAccessPolicy `
  -DisplayName "DOD Meeting Minutes - CAC/PIV Required" `
  -State "Enabled" `
  -Conditions @{
    Applications = @{
      IncludeApplications = "<APP_ID>"
    }
    Users = @{
      IncludeUsers = "All"
    }
  } `
  -GrantControls @{
    BuiltInControls = @("mfa")
    AuthenticationStrength = "phishingResistant"
  }

# Device Compliance Policy
New-AzureADMSConditionalAccessPolicy `
  -DisplayName "DOD Meeting Minutes - Compliant Device Required" `
  -State "Enabled" `
  -Conditions @{
    Applications = @{
      IncludeApplications = "<APP_ID>"
    }
    Users = @{
      IncludeUsers = "All"
    }
  } `
  -GrantControls @{
    BuiltInControls = @("compliantDevice", "domainJoinedDevice")
    _Operator = "OR"
  }

# Geo-Location Restriction (US Only)
New-AzureADMSConditionalAccessPolicy `
  -DisplayName "DOD Meeting Minutes - US Geographic Restriction" `
  -State "Enabled" `
  -Conditions @{
    Applications = @{
      IncludeApplications = "<APP_ID>"
    }
    Locations = @{
      IncludeLocations = "All"
      ExcludeLocations = "<NAMED_LOCATION_US>"
    }
  } `
  -GrantControls @{
    BuiltInControls = @("block")
  }
```

**Step 1.2: Azure Key Vault Configuration (FIPS 140-2)**

```bash
# Create Key Vault with FIPS 140-2 HSM
az keyvault create \
  --name "dod-meeting-minutes-kv" \
  --resource-group "meeting-minutes-rg" \
  --location "usgovvirginia" \
  --sku "Premium" \
  --enabled-for-deployment true \
  --enabled-for-disk-encryption true \
  --enabled-for-template-deployment true \
  --enable-purge-protection true \
  --retention-days 90

# Enable diagnostic logging
az monitor diagnostic-settings create \
  --resource "/subscriptions/<SUB>/resourceGroups/meeting-minutes-rg/providers/Microsoft.KeyVault/vaults/dod-meeting-minutes-kv" \
  --name "AuditLogs" \
  --logs '[{"category":"AuditEvent","enabled":true,"retentionPolicy":{"enabled":true,"days":365}}]' \
  --workspace "<LOG_ANALYTICS_WORKSPACE_ID>"

# Create customer-managed key for database encryption
az keyvault key create \
  --vault-name "dod-meeting-minutes-kv" \
  --name "postgres-encryption-key" \
  --kty "RSA-HSM" \
  --size 4096 \
  --ops encrypt decrypt \
  --protection "hsm"

# Set access policy for app service managed identity
az keyvault set-policy \
  --name "dod-meeting-minutes-kv" \
  --object-id "<APP_SERVICE_MANAGED_IDENTITY>" \
  --secret-permissions get list \
  --key-permissions get unwrapKey wrapKey
```

**Step 1.3: Database Encryption Configuration**

```bash
# Enable customer-managed key encryption
az postgres flexible-server update \
  --resource-group "meeting-minutes-rg" \
  --name "meeting-minutes-db" \
  --geo-redundant-backup Enabled \
  --backup-retention 35 \
  --data-encryption-type "CustomerManaged" \
  --data-encryption-key-uri "https://dod-meeting-minutes-kv.vault.usgovcloudapi.net/keys/postgres-encryption-key"

# Enable SSL enforcement
az postgres flexible-server parameter set \
  --resource-group "meeting-minutes-rg" \
  --server-name "meeting-minutes-db" \
  --name "ssl_min_protocol_version" \
  --value "TLSv1.2"

# Enable connection logging
az postgres flexible-server parameter set \
  --resource-group "meeting-minutes-rg" \
  --server-name "meeting-minutes-db" \
  --name "log_connections" \
  --value "on"

az postgres flexible-server parameter set \
  --resource-group "meeting-minutes-rg" \
  --server-name "meeting-minutes-db" \
  --name "log_disconnections" \
  --value "on"
```

### Phase 2: Classification Handling Implementation (Weeks 3-6)

**Step 2.1: Database-Level Classification Enforcement**

**File**: `server/middleware/classification-guard.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { meetingMinutes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getUserClearanceLevel } from './auth';

export async function classificationGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const meetingId = parseInt(req.params.id);
  const user = req.user!;
  
  // Get meeting minutes classification
  const minutes = await db.query.meetingMinutes.findFirst({
    where: eq(meetingMinutes.meetingId, meetingId)
  });
  
  if (!minutes) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  // Get user clearance level from Azure AD groups
  const userClearance = await getUserClearanceLevel(user.accessToken);
  
  // Classification hierarchy: SECRET > CONFIDENTIAL > UNCLASSIFIED
  const clearanceLevels = {
    'UNCLASSIFIED': 1,
    'CONFIDENTIAL': 2,
    'SECRET': 3
  };
  
  const requiredLevel = clearanceLevels[minutes.classification];
  const userLevel = clearanceLevels[userClearance];
  
  if (userLevel < requiredLevel) {
    // AUDIT LOG: Unauthorized access attempt
    console.error(`SECURITY: Unauthorized access attempt`, {
      user: user.email,
      userClearance,
      requiredClearance: minutes.classification,
      meetingId,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    });
    
    return res.status(403).json({ 
      error: 'Insufficient clearance level',
      required: minutes.classification,
      userLevel: userClearance
    });
  }
  
  // Successful access - log for audit
  console.info(`AUDIT: Classified data access`, {
    user: user.email,
    clearance: userClearance,
    classification: minutes.classification,
    meetingId,
    timestamp: new Date().toISOString()
  });
  
  next();
}

async function getUserClearanceLevel(accessToken: string): Promise<string> {
  const client = getAuthenticatedClient(accessToken);
  
  // Get user's Azure AD group memberships
  const groups = await client
    .api('/me/memberOf')
    .select('displayName')
    .get();
  
  const groupNames = groups.value.map((g: any) => g.displayName);
  
  // Check clearance level groups (highest to lowest)
  if (groupNames.includes('SECRET_Clearance_Group')) {
    return 'SECRET';
  } else if (groupNames.includes('CONFIDENTIAL_Clearance_Group')) {
    return 'CONFIDENTIAL';
  } else {
    return 'UNCLASSIFIED';
  }
}
```

**Step 2.2: Classification Markings on Documents**

**File**: `server/services/document-generator.ts` (modify)

```typescript
import { Document, Paragraph, TextRun, AlignmentType, BorderStyle } from 'docx';

function addClassificationHeader(
  doc: Document,
  classification: string
): void {
  const classificationColors = {
    'UNCLASSIFIED': '00FF00', // Green
    'CONFIDENTIAL': 'FFA500', // Orange
    'SECRET': 'FF0000' // Red
  };
  
  const header = new Paragraph({
    alignment: AlignmentType.CENTER,
    border: {
      top: { style: BorderStyle.DOUBLE, size: 6, color: classificationColors[classification] },
      bottom: { style: BorderStyle.DOUBLE, size: 6, color: classificationColors[classification] }
    },
    children: [
      new TextRun({
        text: `${classification}`,
        bold: true,
        size: 32,
        color: classificationColors[classification],
        allCaps: true
      })
    ]
  });
  
  // Add to document header
  doc.addSection({
    headers: {
      default: header
    }
  });
}

function addClassificationFooter(
  doc: Document,
  classification: string
): void {
  // Similar to header
  // Add page numbers + classification marking
}
```

### Phase 3: Audit Logging & Monitoring (Weeks 5-8)

**Step 3.1: Comprehensive Audit Logging**

**File**: `server/middleware/audit-logger.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppInsights } from 'applicationinsights';

interface AuditEvent {
  timestamp: string;
  eventType: string;
  user: string;
  action: string;
  resource: string;
  classification?: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

export function auditLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  
  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      eventType: 'API_ACCESS',
      user: req.user?.email || 'anonymous',
      action: `${req.method} ${req.path}`,
      resource: req.path,
      success: res.statusCode < 400,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.session?.id || 'none'
    };
    
    // Add classification if accessing classified data
    if (req.params.id && req.path.includes('/meetings')) {
      auditEvent.classification = res.locals.classification;
    }
    
    // Send to Azure Monitor
    AppInsights.defaultClient.trackEvent({
      name: 'AuditLog',
      properties: auditEvent
    });
    
    // Also log to console for Log Analytics ingestion
    console.log('AUDIT:', JSON.stringify(auditEvent));
    
    return originalSend.call(this, data);
  };
  
  next();
}
```

**Step 3.2: Azure Monitor Alerting**

```bash
# Create action group for security alerts
az monitor action-group create \
  --name "SecurityTeam" \
  --resource-group "meeting-minutes-rg" \
  --short-name "SecOps" \
  --email-receiver name="SecurityOps" email="security-ops@dod.mil"

# Alert: Unauthorized access attempts
az monitor metrics alert create \
  --name "UnauthorizedAccessAttempts" \
  --resource-group "meeting-minutes-rg" \
  --scopes "/subscriptions/<SUB>/resourceGroups/meeting-minutes-rg/providers/Microsoft.Web/sites/meeting-minutes-app" \
  --condition "count customMetrics/UnauthorizedAccess > 5" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --action "SecurityTeam" \
  --severity 2

# Alert: Abnormal data access patterns
az monitor metrics alert create \
  --name "AbnormalDataAccessPattern" \
  --resource-group "meeting-minutes-rg" \
  --scopes "/subscriptions/<SUB>/resourceGroups/meeting-minutes-rg" \
  --condition "count customMetrics/ClassifiedDataAccess > 1000" \
  --window-size 1h \
  --evaluation-frequency 15m \
  --action "SecurityTeam" \
  --severity 3
```

### Phase 4: Incident Response Procedures (Weeks 7-10)

**Step 4.1: Incident Response Workflow**

```yaml
Severity Levels:
  Critical (P1):
    - Data breach (classified data exposed)
    - Unauthorized access to SECRET data
    - Complete system compromise
    Response Time: 15 minutes
    
  High (P2):
    - Unauthorized access attempts (5+ in 15 min)
    - Service disruption affecting >50% users
    - Suspected insider threat
    Response Time: 1 hour
    
  Medium (P3):
    - Malware detection
    - Policy violation
    - Performance degradation
    Response Time: 4 hours
    
  Low (P4):
    - Single failed login
    - Configuration drift
    - Minor policy deviation
    Response Time: 24 hours

Incident Response Steps:
  1. DETECT:
     - Azure Monitor alerts trigger
     - Security team notified via email/SMS
     - Incident ticket created in ServiceNow
     
  2. ASSESS:
     - ISSO/ISSM reviews logs
     - Classification level determined
     - Scope of impact assessed
     - Containment strategy defined
     
  3. CONTAIN:
     - Isolate affected systems
     - Revoke compromised credentials
     - Block malicious IP addresses
     - Enable enhanced logging
     
  4. ERADICATE:
     - Remove malware/backdoors
     - Patch vulnerabilities
     - Reset compromised accounts
     - Update firewall rules
     
  5. RECOVER:
     - Restore from clean backups
     - Verify system integrity
     - Re-enable affected services
     - Monitor for recurrence
     
  6. LESSONS LEARNED:
     - Root cause analysis
     - Update procedures
     - Submit POA&M items
     - Brief stakeholders
```

**Step 4.2: Automated Incident Response**

**File**: `scripts/incident-response/block-user.sh`

```bash
#!/bin/bash
# Emergency script to block compromised user account

USER_EMAIL=$1

if [ -z "$USER_EMAIL" ]; then
  echo "Usage: $0 <user-email>"
  exit 1
fi

echo "🚨 EMERGENCY: Blocking user $USER_EMAIL"

# Revoke all sessions
az ad user update \
  --id "$USER_EMAIL" \
  --account-enabled false

# Revoke all refresh tokens
az ad user revoke-token \
  --id "$USER_EMAIL"

# Log incident
curl -X POST "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX" \
  -H 'Content-Type: application/json' \
  -d "{\"text\":\"🚨 INCIDENT: User $USER_EMAIL blocked due to security incident\"}"

echo "✅ User blocked successfully"
echo "📋 Next steps:"
echo "1. Review audit logs: az monitor activity-log list --correlation-id <ID>"
echo "2. Create incident ticket in ServiceNow"
echo "3. Notify ISSO/ISSM"
```

---

## Controls & Compliance Alignment

### SOC 2 Type II Control Mapping

**AC-2: Account Management**

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| AC-2(1) Automated System Account Management | Azure AD automated provisioning | Azure AD audit logs |
| AC-2(2) Removal of Temporary Accounts | 30-day expiration policy | PowerShell script |
| AC-2(3) Disable Inactive Accounts | 90-day inactivity check | Automated script |
| AC-2(4) Automated Audit Actions | Azure Monitor logging | Log Analytics queries |

**AC-3: Access Enforcement**

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| AC-3 Access Enforcement | Azure AD Conditional Access | CA policy export |
| AC-3(7) Role-Based Access Control | Group-based permissions | AD group membership |
| AC-3(10) Audited Override | Manual approval workflow | Audit logs |

**AU-2: Audit Events**

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| AU-2 Audit Events | Comprehensive logging (AC, AU, IA events) | Log configuration |
| AU-2(3) Reviews and Updates | Quarterly log review | Review documentation |
| AU-3 Audit Record Content | JSON structured logs with all required fields | Sample logs |
| AU-4 Audit Storage Capacity | 1 year retention, auto-scaling | Storage metrics |
| AU-6 Audit Review | Weekly automated analysis | SIEM queries |
| AU-9 Protection of Audit Information | Append-only logs, encryption | Azure Policy |
| AU-12 Audit Generation | Application, database, OS logs | Log sources list |

**IA-2: Identification and Authentication**

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| IA-2(1) Network Access to Privileged Accounts | MFA required | CA policy |
| IA-2(2) Network Access to Non-Privileged Accounts | MFA required | CA policy |
| IA-2(3) Local Access to Privileged Accounts | N/A (cloud-only) | System architecture |
| IA-2(8) Network Access to Privileged Accounts - Replay Resistant | CAC/PIV certificate auth | Authentication config |
| IA-2(11) Remote Access - Separate Device | CAC/PIV separate device | PIV reader required |
| IA-2(12) CAC/PIV | Certificate-based authentication | Azure AD config |

**SC-7: Boundary Protection**

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| SC-7 Boundary Protection | Azure Firewall + NSG | Network diagram |
| SC-7(3) Access Points | Centralized ingress via App Gateway | Architecture doc |
| SC-7(4) External Telecommunications Services | Azure ExpressRoute (GCC High) | Circuit config |
| SC-7(5) Deny by Default / Allow by Exception | Default deny NSG rules | NSG rule export |
| SC-7(8) Route Traffic to Authenticated Proxy | Azure Front Door | WAF config |

### DISA SRG IL5 Requirements

| SRG Requirement | Implementation | Validation |
|-----------------|----------------|------------|
| **SRG-APP-000001** Application must enforce approved authorizations | Azure AD RBAC + classification guard | Test cases |
| **SRG-APP-000033** CAC/PIV authentication required | Azure AD certificate auth | Authentication flow test |
| **SRG-APP-000089** Audit all account modifications | Azure AD audit logs | Log query |
| **SRG-APP-000141** Encrypt data at rest | TDE + CMK (AES-256) | Encryption verification |
| **SRG-APP-000142** Encrypt data in transit | TLS 1.2+ enforced | SSL Labs test |
| **SRG-APP-000266** Session timeout (15 minutes idle) | Express session config | Configuration file |
| **SRG-APP-000316** Unique session identifiers | UUID v4 session IDs | Session inspection |
| **SRG-APP-000319** Protect audit information | Append-only logs, RBAC | Azure Policy compliance |

---

## Validation & Acceptance Criteria

### Security Acceptance Criteria

**SAC-1: CAC/PIV Authentication**
- ✅ Users authenticate via PIV certificate
- ✅ Non-PIV authentication blocked
- ✅ Certificate validation against DOD PKI
- ✅ Revoked certificates rejected

**SAC-2: Classification Enforcement**
- ✅ Users cannot access data above their clearance level
- ✅ Unauthorized access attempts logged and blocked
- ✅ Classification markings visible on all documents
- ✅ Downgrade operations prohibited

**SAC-3: Encryption**
- ✅ All data encrypted at rest (AES-256)
- ✅ All connections use TLS 1.2 or higher
- ✅ No plaintext secrets in code or logs
- ✅ Key rotation every 90 days

**SAC-4: Audit Logging**
- ✅ All authentication attempts logged
- ✅ All data access logged with classification level
- ✅ All administrative actions logged
- ✅ Logs retained for 1 year minimum

**SAC-5: Incident Response**
- ✅ Security team alerted within 15 minutes of P1 incident
- ✅ Compromised accounts revoked within 30 minutes
- ✅ Incident response runbooks documented and tested
- ✅ Post-incident reviews conducted within 72 hours

### Compliance Testing Runbook

**Test 1: CAC/PIV Enforcement**
```bash
# Test Case: Non-PIV authentication should be blocked
# Expected: 401 Unauthorized

curl -X GET https://meeting-minutes.app.mil/api/meetings \
  -H "Authorization: Bearer <PASSWORD_AUTH_TOKEN>"

# Expected Result:
# HTTP 401
# Error: "CAC/PIV authentication required"
```

**Test 2: Classification Guard**
```bash
# Test Case: CONFIDENTIAL user cannot access SECRET data
# Setup: User in CONFIDENTIAL_Clearance_Group, Meeting classified SECRET

# Expected Result:
# HTTP 403
# Error: "Insufficient clearance level"
# Audit log entry created
```

**Test 3: Audit Log Completeness**
```bash
# Query Log Analytics for last hour of activity
az monitor log-analytics query \
  --workspace "<WORKSPACE_ID>" \
  --analytics-query "AuditLog | where TimeGenerated > ago(1h) | project TimeGenerated, User, Action, Success"

# Verify:
# - All API calls logged
# - User identity captured
# - Success/failure recorded
# - Timestamp in UTC
```

---

## Appendices

### Appendix A: POA&M Template

```yaml
POA&M Item #001:
  Control: AC-2(3) Disable Inactive Accounts
  Finding: Automated script for 90-day inactivity not fully deployed
  Risk Level: Medium
  Scheduled Completion: 2025-12-15
  Milestone 1:
    Description: Develop PowerShell script
    Due Date: 2025-11-30
    Status: In Progress
  Milestone 2:
    Description: Test in pilot environment
    Due Date: 2025-12-07
    Status: Not Started
  Milestone 3:
    Description: Deploy to production
    Due Date: 2025-12-15
    Status: Not Started
  Compensating Controls:
    - Manual quarterly review of inactive accounts
    - 30-day temporary account expiration enforced
  Resources Required:
    - 1 DevOps engineer (20 hours)
    - Test environment access
```

### Appendix B: Continuous Monitoring Plan

**Monitoring Frequency:**
- Real-time: Security alerts, failed authentications, unauthorized access
- Daily: Vulnerability scans, configuration drift detection
- Weekly: Access review, privilege escalation checks
- Monthly: Full security assessment, penetration testing prep
- Quarterly: Compliance audit, POA&M review

**Key Metrics:**
- Failed authentication rate (<1% target)
- Unauthorized access attempts (0 target)
- Mean time to detect (MTTD): <15 minutes
- Mean time to respond (MTTR): <1 hour for P1
- Patch compliance: >95% within 30 days
- Configuration compliance: >98%

### Appendix C: Security Roles & Responsibilities

| Role | Responsibilities | Clearance Required |
|------|------------------|-------------------|
| **ISSO** | Day-to-day security operations, POA&M management | SECRET |
| **ISSM** | Security program oversight, AO interface | SECRET |
| **Authorizing Official (AO)** | Risk acceptance, ATO issuance | SECRET |
| **System Owner** | Resource allocation, mission requirements | SECRET |
| **SIEM Administrator** | Log monitoring, alert tuning | SECRET |
| **Incident Response Lead** | Coordinate IR activities, forensics | SECRET |
| **Developers** | Secure coding, vulnerability remediation | CONFIDENTIAL |
| **DevOps Engineers** | Infrastructure security, patching | CONFIDENTIAL |

---

## Production Readiness Gates

### Gate 1: Authentication & Authorization

**Required Before Production:**
- ✅ CAC/PIV authentication enforced (100% of users)
- ✅ Non-PIV authentication blocked and logged
- ✅ Azure AD Conditional Access policies deployed
- ✅ Multi-factor authentication required for all accounts
- ✅ Geo-restriction to US enforced

**Validation:**
- Attempt login with username/password (should fail)
- Attempt login from non-US IP (should fail)
- Verify CAC/PIV certificate validation against DOD PKI
- Test MFA bypass attempts (should fail)
- Review 100% authentication success rate with CAC/PIV

### Gate 2: Classification Controls

**Required Before Production:**
- ✅ All classification access controls tested and validated
- ✅ Classification downgrade prevention enforced
- ✅ Unauthorized access attempts blocked (403 response)
- ✅ All unauthorized attempts logged to audit trail
- ✅ Visual classification markers on all content

**Validation:**
- UNCLASSIFIED user attempts SECRET access (verify 403)
- CONFIDENTIAL user attempts SECRET access (verify 403)
- Attempt classification downgrade via API (verify blocked)
- Review audit logs: 100% of blocked attempts logged
- Validate classification badges visible on all pages

### Gate 3: Encryption & Key Management

**Required Before Production:**
- ✅ TLS 1.2+ enforced on all connections
- ✅ Database encrypted at rest with customer-managed keys
- ✅ Azure Key Vault configured with FIPS 140-2 HSM
- ✅ Key rotation schedule established (90 days)
- ✅ No secrets hardcoded in code or config

**Validation:**
- SSL Labs scan: A+ rating required
- Database encryption verified (customer-managed key)
- Secret scan: 0 hardcoded secrets in codebase
- Test key rotation procedure
- Verify Key Vault audit logging enabled

### Gate 4: Audit Logging & Monitoring

**Required Before Production:**
- ✅ All security events logged (auth, access, admin actions)
- ✅ Logs retained for minimum 1 year
- ✅ Real-time alerting configured for security incidents
- ✅ SIEM integration complete (Azure Monitor + Log Analytics)
- ✅ Incident response team trained on alert handling

**Validation:**
- Trigger test security event, verify alert within 15 minutes
- Query audit logs: verify 100% event capture
- Test log retention: confirm 1-year minimum
- Validate SIEM dashboard shows all security metrics
- Execute tabletop incident response drill

### Gate 5: Compliance & ATO

**Required Before Production:**
- ✅ SOC 2 Type II controls implemented (421/421)
- ✅ DISA SRG IL5 requirements met
- ✅ All POA&M items have remediation plans
- ✅ Security Assessment Report (SAR) completed
- ✅ Authority to Operate (ATO) granted by Authorizing Official

**Validation:**
- Control assessment: 100% implemented or risk-accepted
- POA&M review: all critical/high items closed or mitigated
- Third-party penetration test: all findings remediated
- SAR reviewed and accepted by AO
- ATO memo signed and filed

### Gate 6: Incident Response Readiness

**Required Before Production:**
- ✅ Incident response procedures documented and tested
- ✅ On-call rotation established with 24/7 coverage
- ✅ Security team trained on IR runbooks
- ✅ Communication plan established (ISSO, ISSM, AO, users)
- ✅ Forensics tools and processes in place

**Validation:**
- Execute P1 incident drill (simulated data breach)
- Measure MTTD <15 minutes, MTTR <1 hour
- Test account suspension automation
- Verify notification chain (all stakeholders notified)
- Review and update runbooks based on drill lessons learned

**Production Deployment Approval:**  
Requires sign-off from: Authorizing Official (AO), ISSO, ISSM, System Owner

---

**Document Version:** 1.0  
**Last Reviewed:** November 13, 2025  
**Next Review:** Quarterly or upon ATO package submission  
**Approval Required:** ISSO, ISSM, Authorizing Official
