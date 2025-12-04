# Administrator Guide

## Teams Meeting Minutes Application

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Audience:** IT Administrators, System Administrators, Microsoft 365 Administrators  
**Platform:** Azure Commercial Cloud (Not applicable to Azure Government or other sovereign clouds)

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [Administrator Responsibilities](#administrator-responsibilities)
4. [User Management](#user-management)
5. [Role-Based Access Control](#role-based-access-control)
6. [Configuration Management](#configuration-management)
7. [Monitoring and Health Checks](#monitoring-and-health-checks)
8. [Security Administration](#security-administration)
9. [Backup and Recovery](#backup-and-recovery)
10. [Maintenance Procedures](#maintenance-procedures)
11. [Audit and Compliance](#audit-and-compliance)
12. [Capacity Planning](#capacity-planning)
13. [Support Escalation](#support-escalation)

---

## 1. Introduction

### Purpose

This Administrator Guide provides IT administrators with comprehensive information for managing the Teams Meeting Minutes application. It covers day-to-day administration tasks, security management, user access control, monitoring, and maintenance procedures.

### Scope

This guide applies to:

- IT Administrators responsible for the application
- Microsoft 365 Administrators managing Teams integration
- Security administrators overseeing access control
- Support personnel handling escalated issues

### Related Documentation

| Document | Purpose |
|----------|---------|
| User Guide | End-user instructions (available in-app) |
| Installation Manual | Initial deployment and setup |
| Developer Guide | Technical architecture and customization |
| Troubleshooting Guide | Problem diagnosis and resolution |

---

## 2. System Overview

### Application Purpose

The Teams Meeting Minutes application automatically captures Microsoft Teams meetings and generates AI-powered meeting minutes. The system integrates with Microsoft 365 to provide:

- Automatic meeting detection when Teams calls end
- AI-generated meeting summaries, discussions, decisions, and action items
- Approval workflows for quality control
- Document export in DOCX and PDF formats
- SharePoint archival for long-term storage
- Email distribution of approved minutes

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Microsoft Teams                           │
│                 (End User Interface)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Azure Container Apps                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Web App     │  │ API Server  │  │ Background Worker   │  │
│  │ (React)     │  │ (Express)   │  │ (Job Processing)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
│ PostgreSQL    │   │ Azure OpenAI  │   │ Microsoft Graph   │
│ Database      │   │ (GPT-4o)      │   │ API               │
└───────────────┘   └───────────────┘   └───────────────────┘
```

### Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React, Fluent UI | User interface within Teams |
| Backend | Node.js, Express | API server and business logic |
| Database | PostgreSQL | Data persistence |
| AI Engine | Azure OpenAI GPT-4o | Minutes generation |
| Integration | Microsoft Graph API | Teams, Calendar, SharePoint access |
| Authentication | Azure AD, MSAL | Single sign-on |

---

## 3. Administrator Responsibilities

### Daily Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| Monitor health dashboard | Daily | Check application status and error rates |
| Review job queue | Daily | Ensure background jobs are processing |
| Check disk/database usage | Daily | Monitor storage capacity |

### Weekly Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| Review audit logs | Weekly | Check for unusual activity or errors |
| Verify backup completion | Weekly | Confirm database backups succeeded |
| Update user permissions | As needed | Process access requests |

### Monthly Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| Security review | Monthly | Review access logs and permissions |
| Performance analysis | Monthly | Analyze response times and usage patterns |
| Capacity planning | Monthly | Project future resource needs |

### Quarterly Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| Secret rotation | Quarterly | Rotate API keys and credentials |
| Disaster recovery test | Quarterly | Verify backup restoration process |
| Access audit | Quarterly | Review and recertify user access |

---

## 4. User Management

### User Provisioning

Users are automatically provisioned through Azure AD integration. When a user first accesses the application through Teams:

1. Azure AD authenticates the user
2. The application creates a user profile
3. Default role (Viewer) is assigned
4. User can access meetings they organized or attended

### Manual Role Assignment

To assign elevated roles:

1. Access the application database or admin interface
2. Locate the user in the `users` table
3. Update the `role` field to the appropriate value:
   - `viewer` - Default, read-only access to own meetings
   - `approver` - Can approve/reject meeting minutes
   - `auditor` - Read-only access to all meetings
   - `admin` - Full administrative access

### User Deprovisioning

When a user leaves the organization:

1. Azure AD account is disabled (handled by HR/IT)
2. User can no longer authenticate to the application
3. Historical data (meetings, minutes) is retained for compliance
4. Consider anonymizing user data if required by policy

### Guest User Support

The application supports Azure AD B2B guest users:

1. Guest must be invited to the Azure AD tenant
2. Guest authenticates using their home organization credentials
3. Access is limited to meetings they were invited to
4. Guests cannot be assigned Approver or Admin roles

### Multi-Tenant Administration

For organizations with multiple Azure AD tenants:

**Tenant Isolation:**
- Each tenant's data is completely isolated
- Users can only see meetings from their own tenant
- Cross-tenant access is not supported

**Tenant Identification:**
- Tenant ID is extracted from Azure AD token
- All database queries are filtered by tenant ID
- API responses only include tenant-specific data

**Adding a New Tenant:**
1. Tenant administrator grants consent for the application
2. Users from that tenant can immediately access the app
3. No additional configuration required

### Approval Workflow Oversight

Administrators should monitor the approval workflow to ensure timely processing.

**Monitoring Pending Approvals:**

```sql
-- View all pending minutes older than 3 days
SELECT m.title, m.start_date, mm.status, mm.created_at
FROM meetings m
JOIN meeting_minutes mm ON m.id = mm.meeting_id
WHERE mm.status = 'pending_review'
AND mm.created_at < NOW() - INTERVAL '3 days';
```

**Approval Metrics to Track:**
- Average time from generation to approval
- Number of rejections vs. approvals
- Meetings with stale pending status

**Handling Stuck Approvals:**
1. Contact the meeting organizer
2. Escalate to alternative approver if needed
3. Admin can approve if authorized

---

## 5. Role-Based Access Control

### Role Hierarchy

```
Admin (Full Access)
  │
  ├── Approver (Approve + View)
  │     │
  │     └── Viewer (View Own)
  │
  └── Auditor (View All, Read-Only)
```

### Role Permissions Matrix

| Permission | Viewer | Approver | Auditor | Admin |
|------------|--------|----------|---------|-------|
| View own meetings | Yes | Yes | Yes | Yes |
| View all meetings | No | No | Yes | Yes |
| View meeting minutes | Yes | Yes | Yes | Yes |
| Approve minutes | No | Yes | No | Yes |
| Reject minutes | No | Yes | No | Yes |
| Download documents | Yes | Yes | Yes | Yes |
| Update action items | Yes | Yes | No | Yes |
| View audit history | Yes | Yes | Yes | Yes |
| Access settings | No | No | No | Yes |
| Manage users | No | No | No | Yes |

### Classification-Based Access

In addition to roles, access is controlled by security classification:

| Classification | Description | Access Rule |
|----------------|-------------|-------------|
| UNCLASSIFIED | No restrictions | All users |
| CONFIDENTIAL | Business sensitive | Users with CONFIDENTIAL clearance or higher |
| SECRET | Highly sensitive | Users with SECRET clearance |

Classification is determined by Azure AD group membership.

---

## 6. Configuration Management

### Environment Profiles

The application supports multiple environment configurations:

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| Development | Local development and testing | `NODE_ENV=development`, mock services enabled |
| Test/Staging | Pre-production validation | `NODE_ENV=production`, test Azure resources |
| Production | Live system | `NODE_ENV=production`, production Azure resources |

**Development vs. Production Settings:**

| Setting | Development | Production |
|---------|-------------|------------|
| `USE_MOCK_SERVICES` | `true` | `false` |
| `ENABLE_JOB_WORKER` | `false` (optional) | `true` |
| `ENABLE_GRAPH_WEBHOOKS` | `false` | `true` |
| Database | Local PostgreSQL | Azure Database for PostgreSQL |
| Azure OpenAI | Optional (uses mock) | Required |
| Microsoft Graph | Mock responses | Real API calls |

### Environment Variables

The application is configured through environment variables. Critical settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AZURE_TENANT_ID` | Azure AD tenant identifier | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_ID` | Application registration ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_SECRET` | Application secret | (stored securely) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI service URL | `https://xxx.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | OpenAI API key | (stored securely) |
| `AZURE_OPENAI_DEPLOYMENT` | GPT-4o deployment name | `gpt-4o` |
| `SESSION_SECRET` | Session encryption key | (random 32+ character string) |

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_JOB_WORKER` | `false` | Enable background job processing |
| `ENABLE_GRAPH_WEBHOOKS` | `false` | Enable real-time meeting notifications |
| `ENABLE_CLEANUP_SCHEDULER` | `false` | Enable automatic data cleanup |
| `USE_MOCK_SERVICES` | `false` | Use mock services (development only) |

### Changing Configuration

1. Update environment variables in Azure Container Apps or deployment platform
2. Restart the application to apply changes
3. Verify changes in application logs
4. Test affected functionality

**Warning:** Never change configuration in production without testing in a non-production environment first.

### Graph Webhook Management

The application uses Microsoft Graph webhooks to receive real-time notifications when meetings end.

**Webhook Lifecycle:**

1. **Registration:** Webhook is registered on application startup (if `ENABLE_GRAPH_WEBHOOKS=true`)
2. **Validation:** Microsoft Graph sends validation request that app must respond to
3. **Expiration:** Webhooks expire after 4230 minutes (~3 days) and must be renewed
4. **Renewal:** Application automatically renews webhooks before expiration

**Monitoring Webhook Status:**

Check webhook health in application logs:
```
[Webhook Routes] Registering webhook routes...
[Webhook Routes] Registered: GET/POST /webhooks/graph/callRecords
```

**Webhook Failure Handling:**

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Registration failed | No meetings appear after calls | Check `CallRecords.Read.All` permission, admin consent |
| Validation failed | 400 errors in logs | Verify app URL is accessible from internet |
| Renewal failed | Meetings stop appearing after 3 days | Restart application to re-register |
| Notification rejected | Meetings delayed | Check application health, database connectivity |

**Manual Webhook Management:**

```bash
# List current subscriptions (via Graph Explorer or API)
GET https://graph.microsoft.com/v1.0/subscriptions

# Delete a subscription
DELETE https://graph.microsoft.com/v1.0/subscriptions/{id}
```

### SharePoint Archival Configuration

When minutes are approved, they can be automatically archived to SharePoint.

**Configuration:**

| Variable | Description |
|----------|-------------|
| `SHAREPOINT_SITE_URL` | Full URL to SharePoint site |
| `SHAREPOINT_LIBRARY` | Document library name |

**Validating Archival:**

1. Approve a meeting's minutes
2. Check the History tab for "Archived to SharePoint" event
3. Verify document appears in SharePoint library
4. Check job queue for any failed archival jobs

**Archival Failure Handling:**

| Issue | Resolution |
|-------|------------|
| Permission denied | Grant app Sites.ReadWrite.All permission |
| Library not found | Verify library name matches exactly |
| Site not accessible | Check site URL and network connectivity |
| File already exists | Archival uses unique naming to prevent conflicts |

---

## 7. Monitoring and Health Checks

### Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Basic health check | `200 OK` |
| `GET /api/health` | API health with details | JSON with component status |

### Key Metrics to Monitor

| Metric | Healthy Range | Alert Threshold |
|--------|---------------|-----------------|
| Response time (P95) | < 500ms | > 2000ms |
| Error rate | < 1% | > 5% |
| Database connections | < 80% pool | > 90% pool |
| Memory usage | < 70% | > 85% |
| Job queue depth | < 100 | > 500 |
| Failed jobs | < 5/hour | > 20/hour |

### Application Insights

The application integrates with Azure Application Insights for:

- Request tracking and performance monitoring
- Exception and error logging
- Dependency tracking (database, external APIs)
- Custom metrics and events

### Log Locations

| Log Type | Location | Retention |
|----------|----------|-----------|
| Application logs | Azure Container Apps logs | 30 days |
| Audit logs | Database `meeting_events` table | Indefinite |
| Authentication logs | Azure AD sign-in logs | 30 days |

---

## 8. Security Administration

### Authentication Security

The application uses Azure AD for authentication with:

- OAuth 2.0 / OpenID Connect
- Teams Single Sign-On (SSO)
- JWT token validation
- Token refresh handling

### Secret Management

| Secret | Storage | Rotation Frequency |
|--------|---------|-------------------|
| Azure Client Secret | Azure Key Vault / Environment | 90 days |
| Database Password | Azure Key Vault / Environment | 90 days |
| OpenAI API Key | Azure Key Vault / Environment | 90 days |
| Session Secret | Environment | 180 days |

### Secret Rotation Procedure

1. Generate new secret in Azure Portal
2. Update the secret in Key Vault or environment configuration
3. Deploy the updated configuration
4. Verify application functionality
5. Revoke the old secret after 24 hours

### Network Security

| Control | Implementation |
|---------|----------------|
| HTTPS only | Enforced by Azure Container Apps |
| Database access | Private endpoint or IP allowlist |
| API rate limiting | 100 requests/minute per user |
| CORS | Restricted to Teams domains |

### Security Incident Response

If a security incident is suspected:

1. **Contain:** Disable affected accounts or services
2. **Investigate:** Review audit logs and authentication logs
3. **Remediate:** Rotate affected secrets, patch vulnerabilities
4. **Report:** Follow organizational incident reporting procedures
5. **Review:** Conduct post-incident review and update controls

---

## 9. Backup and Recovery

### Automated Backups

Azure Database for PostgreSQL provides:

- Point-in-time recovery (up to 35 days)
- Geo-redundant backup storage
- Automatic daily backups

### Backup Verification

Monthly backup verification procedure:

1. Request a restore to a test environment
2. Verify data integrity and completeness
3. Test application functionality against restored data
4. Document results

### Recovery Procedures

**Database Recovery:**

1. Access Azure Portal > PostgreSQL server
2. Select "Restore" from the toolbar
3. Choose restore point (time-based)
4. Specify target server name
5. Wait for restoration to complete
6. Update application configuration to use restored database
7. Verify data and functionality

**Application Recovery:**

1. Redeploy from container registry
2. Verify environment configuration
3. Test health endpoints
4. Validate user authentication

### Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| Application | 1 hour | N/A (stateless) |
| Database | 4 hours | 1 hour |
| Full system | 4 hours | 1 hour |

---

## 10. Maintenance Procedures

### Scheduled Maintenance Windows

- **Preferred window:** Weekends, 02:00-06:00 UTC
- **Notification:** 48 hours advance notice to stakeholders
- **Duration:** Maximum 4 hours

### Database Maintenance

**Schema updates:**

```bash
# Development/Test
npm run db:push

# Production (via Azure Cloud Shell)
npm run db:push --force
```

**Performance maintenance:**

- Automatic vacuuming is enabled by Azure
- Index maintenance is handled automatically
- Monitor for slow queries in Application Insights

### Application Updates

1. Build new container image
2. Push to Azure Container Registry
3. Update Container App with new image revision
4. Monitor deployment for errors
5. Rollback if issues detected

### Certificate Management

Azure Container Apps handles TLS certificates automatically for:

- Default `*.azurecontainerapps.io` domain
- Custom domains with managed certificates

Certificate renewal is automatic.

---

## 11. Audit and Compliance

### Audit Trail

All significant actions are logged in the `meeting_events` table:

| Event Type | Description |
|------------|-------------|
| `minutes_generated` | AI generated meeting minutes |
| `minutes_approved` | Minutes approved by user |
| `minutes_rejected` | Minutes rejected with reason |
| `email_sent` | Minutes distributed via email |
| `archived_to_sharepoint` | Minutes saved to SharePoint |
| `action_item_updated` | Action item status changed |

### Audit Log Fields

Each event includes:

- Event type and timestamp
- Actor (user who performed action)
- Meeting reference
- Metadata (details specific to event type)
- Tenant ID (for multi-tenant isolation)

### Compliance Reports

Generate compliance reports by querying the database:

```sql
-- All events for a specific meeting
SELECT * FROM meeting_events 
WHERE meeting_id = 'xxx' 
ORDER BY created_at;

-- All approval actions by a user
SELECT * FROM meeting_events 
WHERE actor_email = 'user@company.com' 
AND event_type = 'minutes_approved';
```

### Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|-----------------|-----------------|
| Meeting metadata | 7 years | Automatic cleanup |
| Meeting minutes | 7 years | Automatic cleanup |
| Audit events | 7 years | Automatic cleanup |
| User sessions | 24 hours | Automatic expiry |
| Job queue | 30 days | Automatic cleanup |

---

## 12. Capacity Planning

### Current Resource Allocation

| Resource | Specification | Current Usage |
|----------|---------------|---------------|
| Container App CPU | 0.5 - 2 vCPU | Monitor in Azure Portal |
| Container App Memory | 1 - 4 GB | Monitor in Azure Portal |
| Database | Standard_B1ms | Monitor in Azure Portal |
| Database Storage | 32 GB | Monitor in Azure Portal |

### Scaling Triggers

| Metric | Scale Up Trigger | Scale Down Trigger |
|--------|------------------|-------------------|
| CPU | > 70% for 5 min | < 30% for 10 min |
| Memory | > 80% for 5 min | < 40% for 10 min |
| Requests | > 100/sec | < 20/sec |

### Growth Planning

Estimate resource needs based on:

- **Users:** 1 vCPU per 500 concurrent users
- **Meetings:** 1 GB storage per 10,000 meetings
- **AI processing:** 1 Azure OpenAI TPM per 100 daily meetings

---

## 13. Support Escalation

### Support Tiers

| Tier | Responsibility | Contact |
|------|----------------|---------|
| L1 | User assistance, basic troubleshooting | Help desk |
| L2 | Application administration, configuration | IT Admin team |
| L3 | Development, complex issues | Development team |

### Escalation Criteria

**Escalate to L2:**
- Issue affects multiple users
- Requires configuration changes
- Authentication or access issues
- Performance degradation

**Escalate to L3:**
- Application errors requiring code changes
- Database corruption or data loss
- Integration failures (Graph API, OpenAI)
- Security vulnerabilities

### Support Information to Collect

When escalating issues, gather:

1. User email and tenant
2. Meeting ID (if applicable)
3. Error messages or screenshots
4. Steps to reproduce
5. Time of occurrence
6. Browser/client version

---

## Appendix A: Quick Reference

### Common Administrative URLs

| Resource | URL |
|----------|-----|
| Azure Portal | https://portal.azure.com |
| Teams Admin Center | https://admin.teams.microsoft.com |
| Azure AD Admin | https://aad.portal.azure.com |
| Application Insights | Azure Portal > Application Insights |

### Common Commands

```bash
# View application logs
az containerapp logs show --name <app-name> --resource-group <rg>

# Restart application
az containerapp revision restart --name <app-name> --resource-group <rg>

# Scale application
az containerapp update --name <app-name> --resource-group <rg> --min-replicas 2 --max-replicas 5

# Database connection test
psql -h <server>.postgres.database.azure.com -U <user> -d <database>
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Action Item** | A task extracted from meeting minutes with assignee and due date |
| **Azure AD** | Azure Active Directory, Microsoft's identity platform |
| **B2B Guest** | External user invited to the Azure AD tenant |
| **Container App** | Azure's serverless container hosting service |
| **Graph API** | Microsoft's unified API for Microsoft 365 services |
| **JWT** | JSON Web Token, used for authentication |
| **MSAL** | Microsoft Authentication Library |
| **OBO Flow** | On-Behalf-Of authentication flow for delegated permissions |
| **SSO** | Single Sign-On, seamless authentication |
| **TPM** | Tokens Per Minute, Azure OpenAI rate limit unit |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 4, 2025 | System | Initial release |

---

*This document is confidential and intended for authorized administrators only.*
