# Complete System Manifest
## DOD Teams Meeting Minutes Management System

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Classification:** UNCLASSIFIED

---

## Azure Government Cloud Resources

### Resource Group
```yaml
Name: rg-teams-minutes-prod
Location: usgovvirginia
Tags:
  Environment: Production
  Classification: SECRET
  System: TeamsMeetingMinutes
  Owner: DOD-CIO
```

---

## 1. Networking Resources

### Virtual Network
| Resource | Value |
|----------|-------|
| Name | vnet-teams-minutes |
| Address Space | 10.0.0.0/16 |
| DNS Servers | Azure-provided |

### Subnets
| Name | CIDR | Purpose |
|------|------|---------|
| subnet-public | 10.0.1.0/24 | Application Gateway |
| subnet-app | 10.0.2.0/24 | App Service VNET Integration |
| subnet-data | 10.0.3.0/24 | PostgreSQL Private Endpoint |
| subnet-mgmt | 10.0.4.0/24 | Bastion / Management |

### Network Security Groups
| NSG | Applied To | Rules |
|-----|-----------|-------|
| nsg-app | subnet-app | Allow 443 from subnet-public |
| nsg-data | subnet-data | Allow 5432 from subnet-app only |

### Public IPs
| Name | SKU | Allocation | Purpose |
|------|-----|-----------|---------|
| pip-appgw | Standard | Static | Application Gateway |

---

## 2. Compute Resources

### App Service Plan
```yaml
Name: plan-teams-minutes
SKU: P3v3
OS: Linux
Workers: 2 (min) - 20 (max, auto-scaling)
Region: usgovvirginia
```

### Web App
```yaml
Name: app-teams-minutes-prod
Runtime: Node.js 20
HTTPS Only: true
TLS Version: 1.2
Custom Domain: teams-minutes.dod.mil
VNET Integration: subnet-app
```

### Container Registry
```yaml
Name: acrteamsminutes
SKU: Premium
Location: usgovvirginia
Admin Enabled: false
```

### Auto-Scaling Rules
```yaml
Metric: CPU Percentage
Scale Out When: > 70% for 5 minutes
Scale Out By: 2 instances
Scale In When: < 30% for 10 minutes
Scale In By: 1 instance
Min Instances: 2
Max Instances: 20
```

---

## 3. Database Resources

### Azure Database for PostgreSQL
```yaml
Name: psql-teams-minutes-prod
Version: 14
Tier: GeneralPurpose
SKU: Standard_D4s_v3
vCores: 4
Memory: 16 GB
Storage: 256 GB (auto-grow enabled)
Backup Retention: 30 days
Geo-Redundant Backup: Enabled
High Availability: Zone-redundant (zones 1 & 2)
Public Access: Disabled
Private Endpoint: subnet-data
```

### Database
```yaml
Name: teams_minutes
Owner: pgadmin
Encoding: UTF8
Collation: en_US.utf8
```

---

## 4. AI Services

### Azure OpenAI
```yaml
Name: openai-teams-minutes-prod
SKU: S0
Location: usgovvirginia
Public Network Access: Disabled
Private Endpoint: subnet-app
```

### Deployed Models
| Model | Version | Capacity (TPM) | Purpose |
|-------|---------|----------------|---------|
| gpt-4 | 0613 | 100,000 | Meeting minutes generation |
| gpt-4 | 0613 | 100,000 | Action item extraction |

---

## 5. Security Resources

### Key Vault
```yaml
Name: kv-teams-minutes-prod
SKU: Standard
Soft Delete: Enabled (90 days retention)
Purge Protection: Enabled
Public Access: Disabled
Network ACLs: Allow subnet-app only
```

### Stored Secrets
| Secret Name | Purpose |
|-------------|---------|
| DATABASE-URL | PostgreSQL connection string |
| AZURE-AD-CLIENT-ID | Azure AD app registration ID |
| AZURE-AD-CLIENT-SECRET | Azure AD app secret |
| AZURE-AD-TENANT-ID | Azure AD tenant ID |
| AZURE-OPENAI-ENDPOINT | OpenAI endpoint URL |
| AZURE-OPENAI-KEY | OpenAI API key |
| SESSION-SECRET | Express session secret |
| SHAREPOINT-SITE-URL | SharePoint archive site |

### Managed Identity
```yaml
Name: id-teams-minutes-app
Type: User-assigned
Permissions:
  - Key Vault: Get/List secrets
  - PostgreSQL: Reader
  - Container Registry: AcrPull
```

### Application Gateway
```yaml
Name: appgw-teams-minutes
SKU: WAF_v2
Tier: WAF_v2
Capacity: 2 instances
Public IP: pip-appgw
WAF Mode: Prevention
Rule Set: OWASP 3.2
Cookie-based Affinity: Enabled
```

---

## 6. Monitoring Resources

### Log Analytics Workspace
```yaml
Name: law-teams-minutes
Retention: 90 days
Daily Cap: 10 GB
Location: usgovvirginia
```

### Application Insights
```yaml
Name: app-insights-teams-minutes
Type: web
Workspace: law-teams-minutes
Sampling: Adaptive (default)
```

### Azure Sentinel
```yaml
Enabled: true
Workspace: law-teams-minutes
Data Connectors:
  - Azure Activity
  - Azure AD Identity Protection
  - Microsoft 365 (Teams/SharePoint)
  - Threat Intelligence
  - Azure Security Center
```

### Alert Rules
| Alert | Metric | Condition | Action |
|-------|--------|-----------|--------|
| High Error Rate | HTTP 5xx | > 5% for 5 min | Email admin@dod.mil |
| High CPU | CPU % | > 80% for 5 min | Email admin@dod.mil |
| High Memory | Memory % | > 85% for 5 min | Email admin@dod.mil |
| DB Connection Failures | Failed Connections | > 10 for 5 min | Email dba@dod.mil |
| OpenAI Rate Limit | API Errors | > 50 for 1 min | Email admin@dod.mil |

---

## 7. Microsoft 365 Integration

### Azure AD App Registration
```yaml
Name: DOD-Teams-Minutes-System
Application ID: <Generated>
Tenant: <Your DOD Tenant>
Redirect URI: https://teams-minutes.dod.mil/auth/callback
```

### API Permissions (Application)
| API | Permission | Purpose |
|-----|------------|---------|
| Microsoft Graph | OnlineMeetings.Read.All | Read meeting metadata |
| Microsoft Graph | OnlineMeetingRecording.Read.All | Access recordings |
| Microsoft Graph | OnlineMeetingTranscript.Read.All | Access transcripts |
| Microsoft Graph | Calendars.Read | Read schedules |
| Microsoft Graph | User.Read.All | Read attendee info |
| Microsoft Graph | Mail.Send | Email distribution |
| Microsoft Graph | Sites.ReadWrite.All | SharePoint archival |
| Microsoft Graph | Group.Read.All | Clearance groups |

### SharePoint Site
```yaml
URL: https://dod.sharepoint.us/sites/TeamsMeetingMinutes
Title: Meeting Minutes Archive
Template: Team Site
Owner: admin@dod.mil

Document Library:
  Name: Minutes Archive
  Versioning: Enabled (50 versions)
  Content Approval: Required
  
Metadata Columns:
  - Classification: Choice (UNCLASSIFIED/CONFIDENTIAL/SECRET)
  - MeetingDate: DateTime
  - Organizer: Text
  - ApprovalStatus: Choice (Pending/Approved/Rejected)
  - Approver: Person
  - ApprovedDate: DateTime
```

---

## 8. Application Code

### Repository Structure
```
/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   ├── lib/           # Utilities
│   │   └── hooks/         # Custom hooks
│   └── package.json
│
├── server/                # Express backend
│   ├── routes.ts         # API routes
│   ├── auth.ts           # Authentication
│   ├── storage.ts        # Database interface
│   ├── graph.ts          # Microsoft Graph API
│   ├── openai.ts         # Azure OpenAI
│   ├── sharepoint.ts     # SharePoint integration
│   └── index.ts          # Entry point
│
├── shared/               # Shared code
│   └── schema.ts         # Database schema & types
│
├── config/               # Configuration
│   └── mockUsers.json    # Dev/demo users
│
├── db/                   # Database
│   └── migrations/       # Drizzle migrations
│
└── docs/                 # Documentation
    ├── MICROSOFT_DEMO_SETUP_GUIDE.md
    ├── AZURE_GOV_IMPLEMENTATION_PLAN.md
    └── COMPLETE_SYSTEM_MANIFEST.md
```

### Package Dependencies

#### Frontend (client/package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "wouter": "^3.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "lucide-react": "^0.300.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

#### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "express-session": "^1.17.0",
    "@neondatabase/serverless": "^0.9.0",
    "drizzle-orm": "^0.29.0",
    "drizzle-zod": "^0.5.0",
    "zod": "^3.22.0",
    "@microsoft/microsoft-graph-client": "^3.0.0",
    "@azure/identity": "^4.0.0",
    "@azure/keyvault-secrets": "^4.7.0",
    "openai": "^4.20.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "docx": "^8.5.0",
    "pdf-lib": "^1.17.0",
    "archiver": "^6.0.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "drizzle-kit": "^0.20.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/express-session": "^1.17.0",
    "@types/passport": "^1.0.0",
    "@types/jsonwebtoken": "^9.0.0"
  }
}
```

### Environment Variables
```bash
# Application
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database
DATABASE_URL=<from Key Vault>

# Azure AD
AZURE_AD_CLIENT_ID=<from Key Vault>
AZURE_AD_CLIENT_SECRET=<from Key Vault>
AZURE_AD_TENANT_ID=<from Key Vault>
AZURE_AD_AUTHORITY=https://login.microsoftonline.us/<TENANT_ID>
GRAPH_API_ENDPOINT=https://graph.microsoft.us

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=<from Key Vault>
AZURE_OPENAI_KEY=<from Key Vault>
AZURE_OPENAI_DEPLOYMENT=gpt-4

# SharePoint
SHAREPOINT_SITE_URL=<from Key Vault>

# Session
SESSION_SECRET=<from Key Vault>

# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=<from Azure>
```

### Database Schema (Drizzle ORM)
```typescript
// Tables
- users: User accounts and profiles
- meetings: Teams meeting metadata
- meeting_minutes: Generated minutes
- action_items: Extracted action items
- access_logs: Audit trail

// Relationships
- meetings 1:1 meeting_minutes
- meeting_minutes 1:N action_items
- users 1:N meeting_minutes (as organizer)
- users 1:N meeting_minutes (as approver)
```

---

## 9. Third-Party Services

### Microsoft Services
| Service | Tier | Purpose |
|---------|------|---------|
| Microsoft 365 GCC High | E5 | Teams, SharePoint, Exchange |
| Azure AD Premium | P2 | Authentication, conditional access |
| Microsoft Graph API | v1.0 | Meeting data access |

### Azure Government Services
| Service | Purpose |
|---------|---------|
| App Service | Application hosting |
| PostgreSQL | Database |
| OpenAI | AI processing |
| Key Vault | Secrets management |
| Application Gateway | Load balancing, WAF |
| Monitor | Logging, metrics |
| Sentinel | SIEM |

---

## 10. Development & CI/CD Tools

### Development Tools
```yaml
IDE: Visual Studio Code
Version Control: Git
Container Runtime: Docker Desktop
API Testing: Postman / Thunder Client
Database Client: pgAdmin 4 / Azure Data Studio
```

### CI/CD Pipeline (Azure DevOps)
```yaml
Source Control: Azure Repos (Git)
Build Pipeline:
  - npm install
  - npm run build
  - npm test
  - docker build
  - docker push to ACR

Release Pipeline:
  - Pull image from ACR
  - Deploy to App Service (staging)
  - Run integration tests
  - Manual approval gate
  - Deploy to App Service (production)
  - Health check validation
```

### Required CLI Tools
```bash
- az (Azure CLI) - v2.50+
- docker - v24.0+
- node - v20.x
- npm - v10.x
- git - v2.40+
```

---

## 11. Security & Compliance

### Certificates
| Type | Issuer | Purpose | Expiration |
|------|--------|---------|------------|
| TLS Certificate | DOD PKI | HTTPS (*.dod.mil) | Annual renewal |
| Code Signing | DOD PKI | Application signing | Annual renewal |
| Service Principal | Azure AD | API authentication | 24 months |

### Compliance Frameworks
```yaml
- SOC 2 Type II Authorization
- enterprise security standards Rev 5
- DISA STIG (Windows/Linux/Database)
- DFARS 252.204-7012
- ITAR Compliance
- CIS Benchmarks
```

### Security Controls
```yaml
Encryption:
  - TLS 1.2+ for all communications
  - Database encryption at rest (AES-256)
  - Key Vault for secret management
  - Managed identities (no passwords)

Access Control:
  - Azure AD SSO with MFA
  - Role-based access control (RBAC)
  - Clearance-based group membership
  - Least privilege principle

Monitoring:
  - Azure Sentinel (SIEM)
  - Application Insights
  - Log Analytics (90-day retention)
  - Security Center alerts

Network Security:
  - Private endpoints for all data services
  - Network Security Groups (NSGs)
  - Web Application Firewall (WAF)
  - DDoS Protection Standard
```

---

## 12. Operational Requirements

### Staffing
| Role | Count | Responsibilities |
|------|-------|------------------|
| System Administrator | 2 | Infrastructure, deployments |
| Database Administrator | 1 | Database management, backups |
| Security Engineer | 1 | Security monitoring, incidents |
| Application Support | 2 | User support, issue resolution |
| DevOps Engineer | 1 | CI/CD, automation |

### Service Level Objectives (SLOs)
```yaml
Availability: 99.9% (8.76 hours downtime/year)
Response Time (p95): < 500ms
Response Time (p99): < 1000ms
Error Rate: < 0.1%
MTTR (Mean Time To Repair): < 4 hours
```

### Backup & Recovery
```yaml
Database Backups:
  - Frequency: Continuous (PITR)
  - Retention: 30 days
  - RPO: 15 minutes
  - RTO: 4 hours

Application Backups:
  - Frequency: Daily
  - Retention: 30 days
  - Stored: Azure Storage (GRS)

Disaster Recovery:
  - Geo-replication: Enabled
  - Failover Region: usgovtexas
  - DR Testing: Quarterly
```

---

## 13. Capacity Planning

### Current Capacity (300,000 users)
```yaml
Compute:
  - App Service: 2-20 instances (P3v3)
  - CPU: 4 cores × 20 = 80 cores max
  - Memory: 14 GB × 20 = 280 GB max

Database:
  - vCores: 4
  - Memory: 16 GB
  - Storage: 256 GB (auto-grow)
  - Connections: 200 max concurrent

OpenAI:
  - TPM: 100,000 tokens/minute
  - Monthly Est: 100,000 meetings × 50k tokens = 5B tokens
  - Cost: ~$3,000-5,000/month

Network:
  - Bandwidth: 1 Gbps
  - Public IP: Static (DDoS protected)
```

### Growth Projections
| Year | Users | Meetings/Month | Storage (GB) | Monthly Cost |
|------|-------|----------------|--------------|--------------|
| 2025 | 300,000 | 100,000 | 500 | $6,000 |
| 2026 | 450,000 | 150,000 | 750 | $9,000 |
| 2027 | 600,000 | 200,000 | 1,000 | $12,000 |

---

## 14. Cost Summary

### Monthly Operational Costs (Estimated)
| Service | Cost |
|---------|------|
| App Service (P3v3 × 2) | $876 |
| PostgreSQL (D4s_v3) | $580 |
| Azure OpenAI | $3,000-5,000 |
| Application Gateway (WAF) | $246 |
| Key Vault | $10 |
| Monitor + Sentinel | $200 |
| Storage (GRS) | $50 |
| Network Egress | $100 |
| **Total** | **$5,062-7,062** |

### Annual Costs
```yaml
Infrastructure: $60,000-85,000
Microsoft 365 E5 (300,000 concurrent users): Contact Microsoft
Azure AD Premium P2: Included with M365 E5
Support (Premier): $10,000-50,000
Training: $25,000
Total Annual: $95,000-160,000 (infrastructure only)
```

---

## 15. Contacts & Support

### Microsoft Support
```yaml
Azure Government Support:
  - Portal: https://portal.azure.us
  - Phone: 1-800-867-1389
  - Tier: Premier Support

Microsoft 365 GCC High:
  - Portal: https://admin.microsoft.us
  - Phone: 1-800-865-9408
  - Hours: 24/7
```

### Internal Contacts
```yaml
System Owner: <Name>, <Email>
ISSO: <Name>, <Email>
Technical Lead: <Name>, <Email>
Security Team: <Email>
Help Desk: <Email>, <Phone>
```

---

## Document Control

**Prepared By:** System Implementation Team  
**Reviewed By:** Security Office, ISSO  
**Approved By:** Authorizing Official  
**Classification:** UNCLASSIFIED  
**Distribution:** Limited to authorized personnel  
**Next Review:** Quarterly or upon significant changes

---

**END OF MANIFEST**
