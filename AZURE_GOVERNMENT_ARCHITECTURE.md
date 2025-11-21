# Azure Government Architecture for NAVY ERP - Meeting Minutes System

## Document Purpose

This document provides Azure Government subscription requirements for NAVY ERP deployment of the Teams Meeting Minutes AI system. Use this for subscription quotes and compliance review.

---

## Executive Summary

**System:** AI-powered Microsoft Teams meeting minutes management for NAVY ERP personnel  
**Classification:** Controlled Unclassified Information (CUI) - Impact Level 4 (IL4)  
**Target Environment:** Azure Government (US Gov Virginia or US Gov Texas)  
**Deployment Timeline:** Commercial demo first, then Azure Government production  
**User Base:** 20 users (pilot), scalable to 500+ (full deployment)

---

## Compliance Requirements

### Required Authorizations

| Requirement | Status | Details |
|------------|--------|---------|
| **FedRAMP High** | Required | Azure Government has active P-ATO |
| **DoD IL4 Provisional Authorization** | Required | DISA PA active for Azure Government |
| **DFARS 252.204-7012** | Required | For contractor CUI data |
| **NIST SP 800-171** | Required | 110 security controls for CUI |
| **FISMA Moderate** | Required | Federal information security baseline |

### Data Classification

**Impact Level 4 (IL4):**
- Controlled Unclassified Information (CUI)
- For Official Use Only (FOUO)
- Law Enforcement Sensitive (LES)
- NAVY operational planning data
- Personnel-identifiable meeting transcripts

**Not Classified:**
- No SECRET, TOP SECRET, or SCI data
- No weapons systems information
- No intelligence operations data

### Personnel Requirements

**IL4 Access:**
- All administrators and operators must be **U.S. persons**
- Background investigation (Tier 1 minimum) for system administrators
- Azure Government personnel are already screened

**No Additional Screening Needed For:**
- Microsoft Graph API (operates in Microsoft 365 GCC High)
- Azure OpenAI Service (FedRAMP High + IL4 authorized)
- Azure App Service (fully managed)

---

## Azure Government Architecture

### Network Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           Microsoft 365 GCC High (IL4 Environment)              │
│  • Teams (GCC High tenant)                                       │
│  • SharePoint Online (GCC High)                                  │
│  • Exchange Online (GCC High)                                    │
│  • Microsoft Graph API (https://graph.microsoft.us)             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ OAuth 2.0 + Microsoft Graph API
                        │ (TLS 1.2+, DoD-approved ciphers)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Government - US Gov Virginia                  │
│  Region: USGov Virginia (primary) or USGov Texas (DR)           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Azure App Service (Linux, Node.js 18 LTS)                 │ │
│  │  • SKU: Premium v3 P1v3 (2 vCore, 8 GB RAM)                │ │
│  │  • Auto-scale: 2-5 instances                               │ │
│  │  • Private endpoints + VNet integration                    │ │
│  │  • Always-on enabled                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Azure Database for PostgreSQL (Flexible Server)           │ │
│  │  • SKU: General Purpose D4s_v3 (4 vCore, 16 GB RAM)        │ │
│  │  • Storage: 128 GB SSD (auto-grow enabled)                 │ │
│  │  • High Availability: Zone-redundant                       │ │
│  │  • Backup: 35-day retention, geo-redundant                 │ │
│  │  • Private endpoint (VNet-injected)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Azure OpenAI Service (IL4 Authorized - Sept 2024)         │ │
│  │  • Model: GPT-4o (128K context)                            │ │
│  │  • Model: Whisper (audio transcription)                    │ │
│  │  • Private endpoint                                        │ │
│  │  • Managed identity authentication                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Azure Key Vault (Premium SKU - FIPS 140-2 Level 2 HSM)   │ │
│  │  • Secrets: Graph API credentials, OpenAI keys             │ │
│  │  • Managed identity access                                 │ │
│  │  • Private endpoint                                        │ │
│  │  • 90-day soft delete, purge protection enabled            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Azure Bot Service (Teams Channel)                         │ │
│  │  • F0 (Free tier - 10K messages/month)                     │ │
│  │  • Teams channel only                                      │ │
│  │  • Webhook endpoint in App Service                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Application Insights (Log Analytics workspace)            │ │
│  │  • 90-day retention                                        │ │
│  │  • Structured logging (PII-safe)                           │ │
│  │  • Alerting for errors and performance                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Virtual Network (10.0.0.0/16)                             │ │
│  │  • Subnet 1: App Service (10.0.1.0/24)                     │ │
│  │  • Subnet 2: PostgreSQL (10.0.2.0/24)                      │ │
│  │  • Subnet 3: Private endpoints (10.0.3.0/24)               │ │
│  │  • Network Security Groups (NSG) on all subnets            │ │
│  │  • Azure Firewall for egress filtering                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoint Configuration

**Azure Government Endpoints:**
- **Azure Portal:** https://portal.azure.us
- **Microsoft Graph API:** https://graph.microsoft.us
- **Microsoft Entra ID:** https://login.microsoftonline.us
- **Resource Manager:** https://management.usgovcloudapi.net

**Microsoft 365 GCC High Endpoints:**
- **Teams Web:** https://teams.microsoft.us
- **SharePoint Admin:** https://[tenant]-admin.sharepoint.us
- **Exchange Admin:** https://outlook.office365.us

---

## Resource Requirements

### Compute Resources

**Azure App Service Plan:**
- **SKU:** Premium v3 P1v3
- **Specs:** 2 vCore, 8 GB RAM, 250 GB storage
- **Auto-scale:** 2-5 instances (target: 70% CPU/memory)
- **Networking:** VNet integration + private endpoints
- **OS:** Linux (Ubuntu 22.04 LTS)
- **Runtime:** Node.js 18 LTS
- **Justification:** Premium tier required for VNet integration and private endpoints (IL4 requirement)

**Azure Database for PostgreSQL Flexible Server:**
- **Tier:** General Purpose
- **SKU:** D4s_v3 (4 vCore, 16 GB RAM)
- **Storage:** 128 GB SSD (with auto-grow to 1 TB)
- **High Availability:** Zone-redundant (99.99% SLA)
- **Backup:** 35-day retention, geo-redundant to USGov Texas
- **Version:** PostgreSQL 16
- **Networking:** Private endpoint only (no public access)
- **Justification:** General Purpose tier provides zone redundancy and private networking

**Azure OpenAI Service:**
- **SKU:** Standard S0
- **Models:**
  - GPT-4o: 100K TPM (tokens per minute) provisioned throughput
  - Whisper: 20 requests per minute
- **Networking:** Private endpoint only
- **Justification:** IL4 authorized as of September 2024 (DISA approval)

### Storage Requirements

**PostgreSQL Database:**
- **Initial:** 10 GB (meetings, minutes, job queue)
- **Growth:** ~2 GB/month (20 users, 50 meetings/month)
- **1-year projection:** 34 GB
- **Provisioned:** 128 GB (headroom for growth)

**Application Insights:**
- **Retention:** 90 days
- **Volume:** ~5 GB/month (structured logs, telemetry)
- **Workspace:** Dedicated Log Analytics workspace

**No Azure Storage Account:**
- All documents stored in SharePoint GCC High
- No blob storage, file shares, or queues required

### Networking Resources

**Virtual Network:**
- **Address Space:** 10.0.0.0/16 (65,536 IPs)
- **Subnets:**
  - App Service: 10.0.1.0/24 (256 IPs)
  - PostgreSQL: 10.0.2.0/24 (256 IPs)
  - Private Endpoints: 10.0.3.0/24 (256 IPs)
- **DNS:** Azure Private DNS Zones for private endpoints

**Network Security Groups:**
- Deny all inbound by default
- Allow HTTPS (443) from Microsoft 365 GCC High IP ranges
- Allow outbound to Microsoft Graph API, Azure OpenAI
- Logging enabled to Log Analytics

**Azure Firewall (Optional but Recommended):**
- Standard SKU
- Application rules for allowed egress (graph.microsoft.us, openai.azure.com)
- Threat intelligence enabled

---

## Security Controls (NIST SP 800-171)

### Access Control (AC)

| Control | Implementation |
|---------|---------------|
| **AC-2: Account Management** | Azure Entra ID (GCC High tenant), MFA required |
| **AC-3: Access Enforcement** | Azure RBAC, Azure AD groups, application-level access control |
| **AC-6: Least Privilege** | Managed identities, no service account passwords |
| **AC-17: Remote Access** | TLS 1.2+ only, DoD-approved ciphers |

### Audit and Accountability (AU)

| Control | Implementation |
|---------|---------------|
| **AU-2: Audit Events** | Application Insights structured logging, Azure Activity Log |
| **AU-3: Content of Audit Records** | Timestamp, user ID, event type, success/failure (PII-safe) |
| **AU-6: Audit Review** | Log Analytics queries, automated alerting |
| **AU-11: Audit Retention** | 90 days Application Insights, 1 year Activity Log |

### System and Communications Protection (SC)

| Control | Implementation |
|---------|---------------|
| **SC-7: Boundary Protection** | VNet, NSGs, Azure Firewall, private endpoints |
| **SC-8: Transmission Confidentiality** | TLS 1.2+ for all communications |
| **SC-12: Cryptographic Key Management** | Azure Key Vault (FIPS 140-2 Level 2 HSM) |
| **SC-13: Cryptographic Protection** | AES-256 encryption at rest (Azure default) |
| **SC-28: Protection of Data at Rest** | Transparent Data Encryption (TDE) for PostgreSQL |

### Identification and Authentication (IA)

| Control | Implementation |
|---------|---------------|
| **IA-2: User Identification** | Azure Entra ID OAuth 2.0 + SAML 2.0 |
| **IA-5: Authenticator Management** | Azure Key Vault for service credentials, no hardcoded secrets |
| **IA-8: Identification and Authentication (Non-Org Users)** | N/A - NAVY personnel only |

### Incident Response (IR)

| Control | Implementation |
|---------|---------------|
| **IR-4: Incident Handling** | Application Insights alerts, Azure Monitor action groups |
| **IR-5: Incident Monitoring** | Real-time log streaming, automated alerting |
| **IR-6: Incident Reporting** | Integration with NAVY CSIRT (manual process) |

---

## Cost Estimate (Azure Government)

### Monthly Costs (20 Users - Pilot)

| Service | SKU | Quantity | Unit Cost | Monthly Cost |
|---------|-----|----------|-----------|--------------|
| **App Service Plan** | Premium v3 P1v3 | 2 instances (avg) | $150/instance | $300 |
| **PostgreSQL Flexible Server** | General Purpose D4s_v3 | 1 server + HA replica | $175/server | $350 |
| **PostgreSQL Storage** | 128 GB SSD | 128 GB | $0.12/GB | $15 |
| **PostgreSQL Backup** | Geo-redundant | 128 GB | $0.10/GB | $13 |
| **Azure OpenAI** | GPT-4o | 1M tokens/month | $0.015/1K tokens | $15 |
| **Azure OpenAI** | Whisper | 100 hours/month | $0.006/minute | $36 |
| **Application Insights** | Standard | 5 GB/month | $2.30/GB | $12 |
| **Key Vault** | Premium (HSM) | 10K operations | $0.10/10K ops | $1 |
| **Bot Service** | Free tier | 10K messages | Free | $0 |
| **VNet** | Standard | 1 VNet | Free | $0 |
| **Private Endpoints** | Standard | 3 endpoints | $7.50/endpoint | $23 |
| **NSG** | Standard | 3 NSGs | Free | $0 |
| **DNS Zones** | Private | 3 zones | $0.50/zone | $2 |
| **Outbound Data Transfer** | Standard | 10 GB/month | $0.087/GB | $1 |
| | | | **TOTAL (Pilot):** | **$768/month** |

### Annual Cost (20 Users)

- **Monthly:** $768
- **Annual:** $9,216
- **3-Year Reserved Instances Savings:** ~$3,685 (40% off compute)
- **3-Year Total (with RI):** $21,863

### Scaling to 500 Users (Full Deployment)

| Service | Change | Monthly Cost |
|---------|--------|--------------|
| **App Service** | 5 instances (peak) | $750 |
| **PostgreSQL** | D8s_v3 (8 vCore, 32 GB) + HA | $875 |
| **PostgreSQL Storage** | 512 GB SSD | $61 |
| **Azure OpenAI** | 10M tokens/month + 500 hours audio | $200 |
| **Application Insights** | 20 GB/month | $46 |
| **Data Transfer** | 50 GB/month | $5 |
| | **TOTAL (500 users):** | **$2,025/month** |
| | **Annual (500 users):** | **$24,300** |

### Cost Optimization Strategies

1. **Reserved Instances (1-3 year):**
   - App Service: 40% savings
   - PostgreSQL: 60% savings (3-year)
   - **Estimated savings:** $8,000-12,000 annually

2. **Auto-scaling:**
   - Scale down to 2 instances during off-hours (6 PM - 6 AM)
   - **Estimated savings:** $1,200 annually

3. **Azure Hybrid Benefit:**
   - Not applicable (Linux App Service)

4. **Spot Instances:**
   - Not recommended for production IL4 workloads

**Total Optimized Cost (500 users, 3-year RI):**
- **Year 1:** $24,300
- **Years 2-3:** $16,200/year (with RI savings)
- **3-Year Total:** $56,700 (vs. $72,900 without RI)

---

## Disaster Recovery

### Recovery Objectives

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour

### DR Strategy

**Primary Region:** US Gov Virginia  
**DR Region:** US Gov Texas

**Database Replication:**
- Zone-redundant HA within primary region (automatic failover)
- Geo-redundant backups to DR region (35-day retention)
- Point-in-time restore available (any time within 35 days)

**Application Recovery:**
- Infrastructure-as-Code (Bicep templates)
- Automated deployment via Azure DevOps
- Full environment rebuild: 2-3 hours

**Failover Procedure:**
1. Database geo-restore to US Gov Texas (1-2 hours)
2. Deploy App Service to DR region (30 minutes)
3. Update DNS (propagation: 5-15 minutes)
4. Validate functionality (30 minutes)
5. **Total RTO:** 3-4 hours

**Data Loss:**
- HA failover: 0 data loss (synchronous replication)
- Geo-restore: Up to 1 hour of data (RPO = 1 hour)

---

## Monitoring and Alerting

### Application Insights Metrics

**Performance Metrics:**
- API response times (95th percentile < 500ms)
- Database query duration (95th percentile < 200ms)
- Azure OpenAI latency (95th percentile < 5s)
- Job queue processing time

**Availability Metrics:**
- Application uptime (target: 99.9%)
- Database availability (target: 99.99%)
- Failed requests rate (threshold: < 0.1%)

**Business Metrics:**
- Meetings captured per day
- Minutes generated per day
- Approval rate
- Distribution success rate

### Alerting Rules

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| **App unavailable** | 3 failed health checks in 5 min | Critical | Page on-call, auto-restart |
| **Database connection failure** | Any failure | Critical | Page on-call, check NSG |
| **High error rate** | > 5% in 10 min | High | Email + Teams notification |
| **Slow API responses** | 95th percentile > 2s | Medium | Email notification |
| **Job queue backlog** | > 100 pending jobs | Medium | Email notification |
| **OpenAI rate limit** | 429 errors | Low | Email notification |

### Log Retention

- **Application Insights:** 90 days
- **Azure Activity Log:** 1 year (compliance requirement)
- **NSG Flow Logs:** 30 days
- **PostgreSQL Audit Logs:** 90 days

---

## Deployment Prerequisites

### Azure Government Subscription

**Required Access:**
- Azure Government subscription with Owner or Contributor role
- Subscription must be in USGov Virginia or USGov Texas region
- Cost center approval for estimated $768/month (pilot)

### Microsoft 365 GCC High Tenant

**Required Licenses (per user):**
- Microsoft 365 E3 GCC High (or E5 GCC High)
- Azure AD Premium P1 (included in E3/E5)
- Teams (included in E3/E5)

**Tenant Configuration:**
- Global Administrator access for initial setup
- Teams Administrator for app deployment
- SharePoint Administrator for document library creation

### Azure AD App Registrations (2 required)

**1. Microsoft Graph API Integration:**
- **Permissions:**
  - `OnlineMeetings.ReadWrite.All` (Application)
  - `OnlineMeetingTranscript.Read.All` (Application)
  - `OnlineMeetingRecording.Read.All` (Application)
  - `User.Read.All` (Application)
  - `Mail.Send` (Application)
  - `Sites.ReadWrite.All` (Application - SharePoint)
- **Grant admin consent:** Required

**2. Teams Bot Registration:**
- **Bot Framework registration** in Azure Government
- **Teams channel** enabled
- **Messaging endpoint:** https://[app-name].azurewebsites.us/api/webhooks/bot

### Personnel Requirements

**Deployment Team (minimum):**
- 1x Azure Administrator (IL4 clearance)
- 1x Application Administrator (IL4 clearance)
- 1x NAVY liaison (for user onboarding)

**Ongoing Operations:**
- 1x Application Administrator (part-time, 5-10 hrs/month)
- NAVY IT support for user issues

---

## Compliance Documentation Required

### From Microsoft (via Service Trust Portal)

1. **FedRAMP High Package:**
   - System Security Plan (SSP)
   - Security Assessment Report (SAR)
   - Plan of Action and Milestones (POA&M)
   - Continuous Monitoring reports

2. **DoD IL4 Package:**
   - DISA Provisional Authorization letter
   - DoD Cloud Computing SRG attestation
   - Network architecture diagrams

3. **Azure OpenAI Authorization:**
   - DISA authorization memo (dated Sept 3, 2024)
   - IL4/IL5 usage guidance

### From Deployment Team

1. **System Security Plan (SSP) - Application Level:**
   - Application architecture
   - Data flow diagrams
   - Security controls mapping (NIST SP 800-171)
   - Incident response plan

2. **Risk Assessment:**
   - FIPS 199 categorization (Moderate confidentiality/integrity/availability)
   - Privacy Impact Assessment (PIA)
   - CUI handling procedures

3. **Authority to Operate (ATO) Package:**
   - Continuous monitoring plan
   - Configuration management plan
   - Security control testing results
   - NAVY CSIRT incident response procedures

**Timeline for ATO:**
- Package preparation: 4-6 weeks
- NAVY review and approval: 8-12 weeks
- **Total:** 3-4 months (can run pilot during review)

---

## Migration Path: Commercial Demo → Azure Government

### Phase 1: Commercial Demo (Azure Commercial)

**Timeline:** 4-6 weeks  
**Purpose:** Demonstrate capability to NAVY stakeholders  
**Environment:** Azure Commercial (East US), Microsoft 365 Commercial  
**Users:** 5-10 demo users (non-CUI data only)  
**Cost:** ~$150-200/month

### Phase 2: Azure Government Pilot (IL4)

**Timeline:** 8-12 weeks  
**Purpose:** Validate Azure Government deployment with 20 users  
**Environment:** Azure Government (US Gov Virginia), M365 GCC High  
**Users:** 20 NAVY personnel (CUI allowed)  
**Cost:** ~$768/month  
**ATO Status:** Parallel ATO package development

### Phase 3: Production Deployment

**Timeline:** 4-6 months (post-ATO)  
**Purpose:** Full NAVY ERP deployment  
**Environment:** Azure Government (HA + DR)  
**Users:** 500+ NAVY personnel  
**Cost:** ~$2,025/month

---

## Appendix: Azure Government vs. Commercial Differences

| Feature | Azure Commercial | Azure Government |
|---------|------------------|------------------|
| **Portal** | portal.azure.com | portal.azure.us |
| **Graph API** | graph.microsoft.com | graph.microsoft.us |
| **Auth Endpoint** | login.microsoftonline.com | login.microsoftonline.us |
| **Teams** | teams.microsoft.com | teams.microsoft.us |
| **Compliance** | FedRAMP High (civilian) | FedRAMP High + DoD IL4/IL5 |
| **Data Residency** | Global (US regions available) | US-only (CONUS) |
| **Personnel** | Standard screening | U.S. persons (IL4+) |
| **Service Availability** | 200+ services | ~140 services (growing) |
| **Regions** | 60+ worldwide | 6 US regions |

---

## Document Control

- **Version:** 1.0
- **Date:** November 21, 2024
- **Classification:** UNCLASSIFIED
- **Distribution:** NAVY ERP subscription office, Azure Government sales
- **Next Review:** Before production ATO submission
- **Point of Contact:** [To be filled by deployment team]

---

**FOR OFFICIAL USE ONLY (FOUO)**  
**This document contains information that may be exempt from public release under the Freedom of Information Act (5 U.S.C. 552). It is to be controlled, stored, handled, transmitted, distributed, and disposed of in accordance with DoD policy relating to FOUO information and is not to be released to the public or other personnel who do not have a valid need-to-know without prior approval of an authorized DoD official.**
