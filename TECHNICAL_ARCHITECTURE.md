# Technical Architecture
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Comprehensive technical reference documenting the development prototype architecture, technology stack, and access control design

**Application Status:** Development prototype with implemented (but untested) backend code - requires comprehensive testing, frontend completion, and security hardening before production deployment

**Last Updated:** November 2025

---

## Implementation Status

**This document describes a development prototype with implemented but untested code:**

⚠️ **Backend Services (Code Implemented, Zero Tests):**
- PostgreSQL-backed durable job queue with retry logic and dead-letter queue
- Meeting lifecycle orchestrator with transactional control
- Microsoft Graph API integration (webhooks, meeting capture, attendee lookup)
- Azure OpenAI integration for AI-powered minutes generation
- SharePoint client for document archival with metadata
- Email distribution service via Microsoft Graph API
- DOCX and PDF document generation
- Azure AD group-based access control with session caching
- Authentication middleware with session management
- **Testing Status:** No unit tests, no integration tests, no e2e tests

⚠️ **Database Schema (Defined, Not Validated):**
- Data model with 7 core tables defined in code
- Support for classification levels (UNCLASSIFIED, CONFIDENTIAL, SECRET)
- Meeting workflow status tracking
- Action item management
- User and session management
- **Validation Status:** Not tested at production scale, migrations not validated

⚠️ **API Layer (Implemented, Not Tested):**
- RESTful API with 15+ endpoints
- Meeting CRUD operations
- Minutes generation and approval workflow
- Action item management
- User authentication endpoints
- Microsoft Graph webhook receivers
- **Testing Status:** No automated tests, edge cases not validated

❌ **Frontend (60-70% Incomplete):**
- React application structure partially implemented
- Shadcn/Radix UI components configured
- Many user-facing features not implemented
- Dual-theme system not complete
- Accessibility features not implemented

📊 **Current Status:**
- Development environment: Prototype running on Replit
- Production deployment: NOT READY - requires 16-24 weeks additional work
- Required work: Comprehensive testing, frontend completion, security hardening, bug fixes

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Component Architecture](#3-component-architecture)
4. [Access Control Architecture](#4-access-control-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Integration Architecture](#6-integration-architecture)
7. [Security Architecture](#7-security-architecture)

---

## 1. System Architecture Overview

### 1.1 High-Level Production Architecture

**Note:** This section describes the production-ready multi-scale-unit architecture designed for Azure Government (GCC High) deployment. The current development prototype uses a simplified configuration on Replit. See SCALABILITY_ARCHITECTURE.md for detailed capacity planning.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       Azure Government (GCC High) Cloud                           │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                      Microsoft 365 GCC High Services                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────────┐   │   │
│  │  │ Microsoft    │  │ SharePoint   │  │    Azure AD                    │   │   │
│  │  │ Teams        │  │ Online       │  │    - CAC/PIV Authentication    │   │   │
│  │  │ - Meetings   │  │ - IL5 Sites  │  │    - Clearance Groups (RBAC)   │   │   │
│  │  │ - Webhooks   │  │ - Metadata   │  │    - MFA + Device Compliance   │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────────────────────────┘   │   │
│  └─────────┼──────────────────┼──────────────────────────────────────────────┘   │
│            │                  │                                                   │
│            │ Graph API (.us)  │ Graph API (.us)                                   │
│            ▼                  ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                    Azure Front Door (Premium)                              │   │
│  │                    - Global Load Balancing                                 │   │
│  │                    - WAF + DDoS Protection                                 │   │
│  │                    - TLS 1.2+ Termination                                  │   │
│  │                    - Classification-Based Routing                          │   │
│  └──────────────┬──────────────────┬──────────────────┬──────────────────────┘   │
│                 │                  │                  │                           │
│      ┌──────────▼─────────┐ ┌──────▼────────┐ ┌──────▼──────────┐                │
│      │ UNCLASS VNet       │ │ CONF VNet     │ │ SECRET VNet     │                │
│      │ (10.0.0.0/16)      │ │ (10.10.0.0/16)│ │ (10.20.0.0/16)  │                │
│      │                    │ │               │ │ (No Egress)     │                │
│      └────────────────────┘ └───────────────┘ └─────────────────┘                │
│               │                     │                  │                          │
│  ┌────────────▼──────────────────────▼──────────────────▼─────────────────────┐  │
│  │           Multi-Scale-Unit App Service Environment (ASEv3)                 │  │
│  │                                                                             │  │
│  │  BASELINE (10K users):           PEAK (300K users):                        │  │
│  │  ┌──────────────────────┐        ┌──────────────────────────────────────┐ │  │
│  │  │ 3× ASEv3 Scale Units │        │ 12× ASEv3 Scale Units                │ │  │
│  │  │ - 1 UNCLASS (12 I3v2)│        │ - 6 UNCLASS (600 I3v2 total)         │ │  │
│  │  │ - 1 CONF (4 I3v2)    │        │ - 4 CONF (240 I3v2 total)            │ │  │
│  │  │ - 1 SECRET (2 I3v2)  │        │ - 2 SECRET (40 I3v2 total)           │ │  │
│  │  │ Total: 18 instances  │        │ Total: 880 instances                 │ │  │
│  │  └──────────────────────┘        └──────────────────────────────────────┘ │  │
│  │                                                                             │  │
│  │  Each I3v2 Instance:                                                        │  │
│  │  - 8 vCPU, 32 GB RAM                                                        │  │
│  │  - Node.js 20.x + Express.js API + React SPA                               │  │
│  │  - 2,500-3,000 concurrent users per instance                               │  │
│  │  - Managed Identity for Azure service authentication                       │  │
│  └─────────────────────┬───────────────────────┬──────────────────────────────┘  │
│                        │                       │                                 │
│                        ▼                       ▼                                 │
│  ┌──────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │ Horizontal Database Sharding     │   │  Azure OpenAI Service (GCC High)    │ │
│  │ (12 PostgreSQL Flexible Servers) │   │  - GPT-4o + Whisper Models          │ │
│  │                                  │   │  - Regional Deployment (Virginia)   │ │
│  │ UNCLASS: 6 shards                │   │  - Managed Identity Auth            │ │
│  │ - GP_Gen5_4-8 (baseline)         │   │  - 100K TPM Capacity                │ │
│  │ - GP_Gen5_16 (peak)              │   └─────────────────────────────────────┘ │
│  │ - TDE w/ Microsoft-managed keys  │                                           │
│  │                                  │   ┌─────────────────────────────────────┐ │
│  │ CONF: 4 shards                   │   │  Azure Key Vault Premium (HSM)      │ │
│  │ - GP_Gen5_4-8 (baseline)         │   │  - Customer-Managed Keys (CMK)      │ │
│  │ - GP_Gen5_16 (peak)              │   │  - SECRET database encryption       │ │
│  │ - TDE w/ CMK (Key Vault Standard)│   │  - FIPS 140-2 Level 2               │ │
│  │                                  │   │  - Purge protection enabled         │ │
│  │ SECRET: 2 shards                 │   └─────────────────────────────────────┘ │
│  │ - GP_Gen5_4-8 (baseline)         │                                           │
│  │ - GP_Gen5_16 (peak)              │                                           │
│  │ - TDE w/ HSM-backed CMK (Premium)│                                           │
│  │ - No internet egress             │                                           │
│  │                                  │                                           │
│  │ Total Capacity:                  │                                           │
│  │ - 300K+ concurrent connections   │                                           │
│  │ - 120K+ IOPS                     │                                           │
│  │ - Read replicas: 34-56 instances │                                           │
│  └──────────────────────────────────┘                                           │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              Azure Monitor + Application Insights                    │   │
│  │              - Application Performance Monitoring                    │   │
│  │              - Security Audit Logs                                   │   │
│  │              - Custom Metrics & Alerts                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                              Users Access via
                    Microsoft Teams Desktop/Web/Mobile Clients
                         (Authenticated via Azure AD SSO)
```

### 1.2 Azure Government Deployment

**Production Architecture Components:**
- **Compute:** Azure App Service (P3v3, 2-20 instances with auto-scaling)
- **Database:** Azure Database for PostgreSQL Flexible Server (v14, General Purpose D4s with HA)
- **AI Processing:** Azure OpenAI Service (GPT-4, GCC High deployment)
- **Load Balancing:** Azure Application Gateway with WAF_v2
- **Networking:** VNET with private endpoints for database access
- **Security:** Azure Key Vault for secrets, Managed Identities for service authentication
- **Monitoring:** Azure Monitor and Application Insights
- **Microsoft 365:** GCC High tenant with Teams, SharePoint, Exchange, Azure AD

**Pilot Architecture Components:**
- **Compute:** Azure App Service (B3, single instance)
- **Database:** Azure Database for PostgreSQL Flexible Server (v14, Burstable B2s)
- **AI Processing:** Azure OpenAI Service (GPT-4, 10K TPM capacity)
- **Load Balancing:** Built-in App Service load balancing
- **Security:** Same as production (Azure Key Vault, Managed Identities)
- **Monitoring:** Azure Monitor with 30-day retention
- **Microsoft 365:** Same GCC High tenant as production

---

## 2. Technology Stack

### 2.1 Programming Languages

| Language | Version | Usage |
|----------|---------|-------|
| **TypeScript** | 5.x | Primary language for frontend and backend |
| **JavaScript** | ES2022+ | Runtime execution (Node.js) |
| **SQL** | PostgreSQL dialect | Database queries and schema |

### 2.2 Frontend Stack

**Framework & Build Tools:**
- React 18.x - UI component framework
- TypeScript 5.x - Type-safe JavaScript
- Vite 5.x - Build tool and dev server
- Wouter 3.x - Lightweight React router

**State Management:**
- TanStack Query v5 (React Query) - Server state management, caching, synchronization
- React Hooks - Local component state

**UI Components:**
- Shadcn UI - Customizable component system
- Radix UI - Accessible component primitives (dialogs, dropdowns, popovers, etc.)
- Lucide React - Icon library
- React Icons - Company logos

**Styling:**
- Tailwind CSS 3.x - Utility-first CSS framework
- PostCSS - CSS processing
- class-variance-authority - Component variants
- tailwind-merge - Class merging utility

**Forms & Validation:**
- React Hook Form 7.x - Form state management
- Zod 3.x - Schema validation
- @hookform/resolvers - Zod integration

**Utilities:**
- date-fns - Date utility functions
- Framer Motion - Animations
- Recharts - Charts and data visualization
- React Resizable Panels - Resizable layouts

### 2.3 Backend Stack

**Runtime & Framework:**
- Node.js 20.x - JavaScript runtime
- Express 4.x - Web application framework
- TypeScript 5.x - Type-safe development
- tsx - TypeScript execution

**Database:**
- PostgreSQL 14 - Primary database (Azure Flexible Server)
- Drizzle ORM 0.x - TypeScript ORM with type-safe queries
- drizzle-kit - Schema management tools
- drizzle-zod - Zod schema generation
- @neondatabase/serverless - PostgreSQL driver

**Authentication:**
- Passport 0.7.x - Authentication middleware
- express-session - Session management
- connect-pg-simple - PostgreSQL session store

**Microsoft Integration:**
- @microsoft/microsoft-graph-client - Microsoft Graph API client
  - Teams meeting access
  - User management
  - Email distribution
  - SharePoint access

**AI Integration:**
- OpenAI SDK 6.x - Azure OpenAI integration
  - GPT-4 for transcript processing
  - Meeting summarization
  - Action item extraction

**Document Generation:**
- docx 9.x - DOCX document generation
- pdf-lib 1.x - PDF document generation
- archiver 7.x - ZIP file creation

**Validation:**
- Zod 3.x - Runtime type validation
- zod-validation-error - Error formatting

**Utilities:**
- p-limit - Concurrent operation limiting
- p-retry - Retry logic with exponential backoff
- lru-cache - LRU caching
- ws - WebSocket support

### 2.4 Development Tools

- ESLint - Code linting
- Prettier - Code formatting
- TypeScript - Type checking
- Vite - Development server and build tool

---

## 3. Component Architecture

### 3.1 Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Single Page Application           │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer                                          │
│  ├─ Dashboard                    (meeting stats, recent)    │
│  ├─ Meetings List                (all meetings, filters)    │
│  ├─ Meeting Details              (view/edit minutes)        │
│  ├─ Approval Interface           (approve/reject workflow)  │
│  ├─ Action Items Tracker         (task management)          │
│  ├─ Search Archive               (advanced search)          │
│  └─ Settings                     (configuration)            │
├─────────────────────────────────────────────────────────────┤
│  Component Library                                           │
│  ├─ Shadcn UI Components         (buttons, cards, etc)      │
│  ├─ Classification Badges        (security levels)          │
│  ├─ Status Indicators            (processing states)        │
│  ├─ Meeting Cards                (summary display)          │
│  └─ Sidebar Navigation           (app navigation)           │
├─────────────────────────────────────────────────────────────┤
│  State Management                                            │
│  ├─ TanStack Query               (API cache, sync)          │
│  ├─ React Hooks                  (local state)              │
│  └─ Theme Context                (dark/light mode)          │
├─────────────────────────────────────────────────────────────┤
│  Routing & Navigation                                        │
│  └─ Wouter                       (client-side routing)      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Express.js Application                   │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                  │
│  ├─ /api/meetings                (CRUD operations)          │
│  ├─ /api/minutes                 (generate, retrieve)       │
│  ├─ /api/action-items            (manage tasks)             │
│  ├─ /api/users                   (user management)          │
│  ├─ /api/webhooks/teams          (Teams event receiver)     │
│  └─ /api/health                  (health check)             │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                        │
│  ├─ Meeting Orchestrator         (workflow coordination)    │
│  ├─ Minutes Generator            (AI processing)            │
│  ├─ Durable Queue Service        (job management)           │
│  ├─ Email Distribution           (Graph API email)          │
│  ├─ SharePoint Client            (document archival)        │
│  ├─ Document Export              (DOCX/PDF generation)      │
│  └─ Access Control               (permissions)              │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer                                           │
│  ├─ Drizzle ORM                  (type-safe queries)        │
│  ├─ PostgreSQL Client            (database connection)      │
│  └─ Session Store                (PostgreSQL sessions)      │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                           │
│  ├─ Microsoft Graph Client       (Teams API)                │
│  ├─ Azure OpenAI Client          (GPT-4 API)                │
│  ├─ SharePoint Connector         (OAuth authenticated)      │
│  └─ Webhook Validator            (signature verification)   │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Workflow Engine Architecture

**Durable Job Queue:**
```typescript
// PostgreSQL-backed job queue with retry logic
interface Job {
  id: string;
  type: 'generate_minutes' | 'send_email' | 'upload_sharepoint';
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  maxRetries: number;
  nextRetryAt: Date | null;
}
```

**Key Features:**
- Idempotent job processing (unique job keys prevent duplicates)
- Exponential backoff retry (2^attempt minutes, max 3 retries)
- Dead-letter queue for permanently failed jobs
- Graceful shutdown and recovery
- Background worker polling (5 second intervals)

---

## 4. Access Control Architecture

### 4.1 Azure AD Group-Based Access Control

**Design Principles:**
- Primary source: Azure AD groups (authoritative)
- Performance: Session cache (15-min TTL)
- Security: Fail-closed (deny access if groups unavailable)
- Scalability: No per-user database updates (supports 300,000+ users)
- Audit: Azure AD logs + application access logs

### 4.2 Group Structure

**Clearance-Level Groups:**
```
Clearance-UNCLASSIFIED   → Can view UNCLASSIFIED meetings
Clearance-CONFIDENTIAL   → Can view UNCLASSIFIED + CONFIDENTIAL
Clearance-SECRET         → Can view UNCLASSIFIED + CONFIDENTIAL + SECRET
```

**Hierarchy:** SECRET > CONFIDENTIAL > UNCLASSIFIED

**Role Groups:**
```
Role-Viewer              → View attended meetings only
Role-Editor              → Can edit minutes before approval
Role-Approver            → Can approve/reject meeting minutes
Role-Admin               → Full system access + configuration
```

### 4.3 Microsoft Graph API Integration

**Endpoint:**
```http
GET https://graph.microsoft.com/v1.0/users/{userId}/memberOf
```

**Pagination:**
- Page size: 100 groups per request
- Max iterations: 50 pages (5,000 groups max per user)
- Timeout: 30 seconds total

**Error Handling:**
- Retry on 429 (Too Many Requests) with exponential backoff
- Fail-closed on errors (deny access)
- Fallback to cached data if available

### 4.4 Caching Strategy

```
┌─────────────────┐
│  Azure AD       │ ← Authoritative Source
│  (Graph API)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Session Cache  │ ← 15-minute TTL
│  (in-memory)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database Cache │ ← Optional fallback
│  (PostgreSQL)   │
└─────────────────┘
```

**Cache Invalidation:**
- Session expiration (15 minutes)
- Explicit user logout
- Admin-triggered refresh

---

## 5. Data Architecture

### 5.1 Database Schema

**Core Tables:**
- `users` - User profiles and authentication
- `meetings` - Meeting metadata and status
- `meetingMinutes` - Generated minutes content
- `actionItems` - Extracted action items with assignees
- `graphWebhookSubscriptions` - Teams webhook subscriptions
- `jobQueue` - Durable job queue for workflows
- `sessions` - User sessions (PostgreSQL store)

**Classification Levels (Enum):**
```sql
CREATE TYPE classification_level AS ENUM (
  'UNCLASSIFIED',
  'CONFIDENTIAL',
  'SECRET'
);
```

**Status Types (Enum):**
```sql
CREATE TYPE meeting_status AS ENUM (
  'scheduled',
  'completed',
  'processing',
  'ready_for_review',
  'archived'
);

CREATE TYPE minutes_status AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'rejected'
);
```

### 5.2 Data Relationships

```
meetings (1) ─────── (1) meetingMinutes
    │
    └─────── (*) actionItems
    │
    └─────── (*) meetingAttendees
```

### 5.3 Data Retention

- Active meetings: Indefinite
- Archived minutes: Configurable retention policy
- Job queue: 30-day retention for completed jobs
- Session data: 24-hour expiration
- Audit logs: 7-year retention (compliance requirement)

---

## 6. Integration Architecture

### 6.1 Microsoft Teams Integration

**Webhook Subscription:**
```
Microsoft Teams → Graph API Webhook → Application Endpoint
                                              │
                                              ▼
                                    Validate signature
                                              │
                                              ▼
                                    Enqueue processing job
```

**Meeting Data Retrieval:**
- Meeting metadata (title, date, duration, attendees)
- Recording URL (via call records API)
- Transcript URL (via call records API)
- Participant information

### 6.2 SharePoint Integration

**Authentication:** OAuth 2.0 with Sites.Selected permission

**Upload Process:**
1. Generate DOCX document from approved minutes
2. Create folder structure (Year/Month/Classification)
3. Upload document to SharePoint library
4. Set metadata (classification, meeting date, attendee count)
5. Return SharePoint URL for database storage

**Folder Structure:**
```
/Meeting Minutes/
  ├─ 2025/
  │   ├─ 01-January/
  │   │   ├─ UNCLASSIFIED/
  │   │   ├─ CONFIDENTIAL/
  │   │   └─ SECRET/
  │   └─ 02-February/
  │       └─ ...
  └─ 2026/
```

### 6.3 Azure OpenAI Integration

**Configuration:**
- Production: Azure OpenAI (Gov Cloud deployment)
- Development: Replit AI or Azure OpenAI commercial

**Processing Pipeline:**
```
Transcript → Azure OpenAI → Minutes Generation
                          → Action Item Extraction
                          → Classification Detection
```

**Retry Logic:**
- 7 retries with exponential backoff
- 2-128 second delays
- Rate limit handling (429 errors)

### 6.4 Email Distribution

**Method:** Microsoft Graph API (sendMail endpoint)

**Process:**
1. Generate DOCX and PDF documents
2. Create email with attachments
3. Send to all meeting attendees
4. Track delivery status (optional)

---

## 7. Security Architecture

### 7.1 Authentication

**Primary Method:** Azure AD SSO
- SAML 2.0 or OAuth 2.0 integration
- Automatic user provisioning
- Single sign-on experience

**Session Management:**
- PostgreSQL-backed sessions (persistent)
- 24-hour session timeout
- Secure cookie handling (httpOnly, secure, sameSite)

### 7.2 Authorization

**Multi-Level Access Control:**
- Clearance level (via Azure AD groups)
- Role-based permissions (via Azure AD groups)
- Meeting attendance verification
- Classification matching

**Access Decision:**
```typescript
canViewMeeting(user, meeting) {
  // User must have clearance level >= meeting classification
  const hasClearance = userClearance >= meetingClassification;
  
  // User must be attendee OR have auditor/admin role
  const isAuthorized = isAttendee || hasAuditorRole || hasAdminRole;
  
  return hasClearance && isAuthorized;
}
```

### 7.3 Data Protection

**Encryption at Rest:**
- Database: PostgreSQL native encryption
- Documents: Azure Blob Storage encryption
- Backups: Encrypted backups

**Encryption in Transit:**
- TLS 1.2+ for all connections
- Certificate pinning for Graph API
- Secure WebSocket connections

**Secrets Management:**
- Environment variables for development
- Azure Key Vault for production
- No secrets in code or configuration files

### 7.4 Compliance

**Audit Logging:**
- All access attempts logged
- All modifications tracked
- User actions recorded
- Failed authorization attempts logged

**Compliance Features:**
- Classification markings on all documents
- Access control enforcement
- Data retention policies
- Audit trail completeness

---

## 8. Performance and Scalability

### 8.1 Performance Characteristics

**API Response Times (Target):**
- Meeting list: <500ms
- Meeting details: <300ms
- Minutes generation: <2 minutes (AI processing)
- Document generation: <5 seconds

**Concurrent Users:**
- Auto-scaling capacity: Up to 300,000 concurrent users with Azure auto-scaling
- Tested at: Not yet load tested
- Horizontal scaling: Stateless API design enables automatic scaling based on demand

### 8.2 Caching Strategy

**Session Cache:** 15-minute TTL for Azure AD group membership

**Query Cache:** TanStack Query on frontend (configurable TTL)

**Static Assets:** CDN for frontend assets (optional)

### 8.3 Scalability Considerations

**Horizontal Scaling:**
- Stateless API servers (can scale infinitely)
- PostgreSQL connection pooling
- Load balancer distribution

**Vertical Scaling:**
- Database: Azure Database for PostgreSQL SKU sizing
- Compute: Azure App Service Plan scaling (B3, P3v3, etc.)

**Bottlenecks:**
- Azure OpenAI rate limits (mitigated with retry logic)
- Microsoft Graph API throttling (mitigated with retry logic)
- PostgreSQL connection limit (mitigated with pooling)

---

## 9. Monitoring and Observability

### 9.1 Logging

**Log Levels:**
- ERROR: System errors, exceptions
- WARN: Degraded performance, retries
- INFO: Normal operations, job completion
- DEBUG: Detailed diagnostics (development only)

**Log Storage:**
- Azure Monitor and Log Analytics
- Application Insights for application logs
- Centralized logging with Azure Monitor Logs

### 9.2 Metrics

**Application Metrics:**
- API request rate
- API error rate
- Response time percentiles (p50, p95, p99)
- Job queue depth
- Job processing time

**Infrastructure Metrics:**
- CPU utilization
- Memory usage
- Database connections
- Disk I/O

### 9.3 Alerting

**Critical Alerts:**
- Application down
- Database connection failures
- Authentication failures
- Job queue backlog exceeding threshold

**Warning Alerts:**
- High error rate (>5%)
- Slow response times (>2s p95)
- Low disk space (<20%)
- SSL certificate expiration (<30 days)

---

## 10. Disaster Recovery

### 10.1 Backup Strategy

**Database Backups:**
- Automated daily backups (Azure Database for PostgreSQL Flexible Server)
- Point-in-time recovery (7-35 day window, configurable)
- Geo-redundant backup replication (production)

**Document Backups:**
- SharePoint versioning and recycle bin
- Azure Blob Storage versioning (optional document cache)

### 10.2 Recovery Objectives

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 24 hours

### 10.3 Failover Procedures

1. DNS failover to backup region
2. Restore database from latest backup
3. Deploy application to backup environment
4. Verify connectivity to Microsoft services
5. Resume normal operations

---

**Document Classification:** IBM Internal - Technical Reference  
**Version:** 1.0  
**Last Updated:** November 2025
