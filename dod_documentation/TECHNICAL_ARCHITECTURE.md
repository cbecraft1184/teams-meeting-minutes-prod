# Technical Architecture
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Comprehensive technical reference for Azure Government (GCC High) deployment with IL5 data segregation and FedRAMP High compliance

**Classification:** UNCLASSIFIED  
**Architecture Status:** Production-ready design for DOD enterprise deployment targeting FedRAMP High ATO

**Last Updated:** November 17, 2025

---

## Architecture Overview

**This document describes the production-ready architecture for DOD enterprise deployment on Azure Government (GCC High):**

✅ **Backend Services (IL5-Compliant Design):**
- PostgreSQL-backed durable job queue with classification-aware routing
- Meeting lifecycle orchestrator with classification enforcement
- Microsoft Graph API integration (GCC High endpoints .us domains)
- Azure OpenAI integration (GCC High deployment) for AI-powered minutes generation
- SharePoint GCC High client for document archival with IL5 metadata
- Email distribution service via Microsoft Graph API (GCC High)
- DOCX and PDF document generation with classification markings
- Azure AD group-based access control with clearance-level enforcement
- CAC/PIV authentication middleware with session management
- **Implementation Timeline:** Weeks 1-8 of deployment

✅ **Database Schema (Classification-Segregated Design):**
- 12-shard PostgreSQL architecture with IL5 segregation
- Physical separation: 6 UNCLASS + 4 CONFIDENTIAL + 2 SECRET shards
- Classification-aware routing and access controls
- Meeting workflow status tracking with security markings
- Action item management with assignee clearance validation
- User clearance level management and session tracking
- **Implementation Timeline:** Week 1 (schema deployment), Week 9-12 (scale validation)

✅ **API Layer (FedRAMP-Compliant Design):**
- RESTful API with classification-based authorization
- Meeting CRUD operations with clearance enforcement
- Minutes generation with classification detection
- Approval workflow with multi-level review
- Action item management with clearance validation
- CAC/PIV authentication endpoints
- Microsoft Graph webhook receivers (GCC High)
- **Implementation Timeline:** Weeks 5-8 (core APIs), Weeks 9-12 (security hardening)

✅ **Frontend (Government-Compliant Design):**
- React application with TypeScript
- Shadcn/Radix UI components (Microsoft Fluent design system)
- Classification banners and security markings
- WCAG 2.1 AA accessibility compliance
- Section 508 compliance features
- Government-grade UI/UX patterns
- **Implementation Timeline:** Weeks 5-12 (UI development), Weeks 13-14 (accessibility testing)

📊 **Architecture Status:**
- FedRAMP High controls: 89% implemented in design, 11% to complete during deployment
- Deployment target: Azure Government (GCC High) - Virginia region
- IL5 compliance: Multi-VNet segregation with network isolation
- Implementation timeline: 16 weeks to production deployment + 16 months ATO process

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Component Architecture](#3-component-architecture)
4. [Access Control Architecture](#4-access-control-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Integration Architecture](#6-integration-architecture)
7. [Security Architecture](#7-security-architecture)
8. [Classification Handling](#8-classification-handling)
9. [FedRAMP Compliance](#9-fedramp-compliance)

---

## 1. System Architecture Overview

### 1.1 High-Level Azure Government Architecture

**Azure Government (GCC High) Deployment Architecture:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       Azure Government (GCC High) Cloud                           │
│                          USGov Virginia Region                                    │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                   Microsoft 365 GCC High Services                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────────┐   │   │
│  │  │ Microsoft    │  │ SharePoint   │  │    Azure AD (GCC High)         │   │   │
│  │  │ Teams        │  │ Online       │  │    - CAC/PIV Authentication    │   │   │
│  │  │ (GCC High)   │  │ (GCC High)   │  │    - Clearance Groups (RBAC)   │   │   │
│  │  │ - Meetings   │  │ - IL5 Sites  │  │    - MFA + Device Compliance   │   │   │
│  │  │ - Webhooks   │  │ - Metadata   │  │    - FIPS 140-2 Validated      │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────────────────────────┘   │   │
│  └─────────┼──────────────────┼──────────────────────────────────────────────┘   │
│            │                  │                                                   │
│            │ Graph API (.us)  │ Graph API (.us)                                   │
│            ▼                  ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                    Azure Front Door Premium (GCC High)                     │   │
│  │                    - Multi-Region Load Balancing                           │   │
│  │                    - WAF v2 (OWASP Top 10 Protection)                      │   │
│  │                    - DDoS Protection Standard                              │   │
│  │                    - TLS 1.2+ Termination (FIPS 140-2)                     │   │
│  │                    - Classification-Based Routing                          │   │
│  └──────────────┬──────────────────┬──────────────────┬──────────────────────┘   │
│                 │                  │                  │                           │
│      ┌──────────▼─────────┐ ┌──────▼────────┐ ┌──────▼──────────┐                │
│      │ UNCLASS VNet       │ │ CONF VNet     │ │ SECRET VNet     │                │
│      │ (10.0.0.0/16)      │ │ (10.10.0.0/16)│ │ (10.20.0.0/16)  │                │
│      │ - NSG: Restricted  │ │ - NSG: High   │ │ - NSG: Maximum  │                │
│      │ - Internet: Allow  │ │ - Internet:   │ │ - Internet: Deny│                │
│      │ - Private Endpoints│ │   Restricted  │ │ - Air-Gapped    │                │
│      └────────────────────┘ └───────────────┘ └─────────────────┘                │
│               │                     │                  │                          │
│  ┌────────────▼──────────────────────▼──────────────────▼─────────────────────┐  │
│  │      Multi-Scale-Unit App Service Environment v3 (ASEv3)                  │  │
│  │                    IL5 Classification Segregation                          │  │
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
│  │  - Node.js 20.x LTS (FIPS-compliant)                                       │  │
│  │  - Express.js API + React SPA                                              │  │
│  │  - 2,500-3,000 concurrent users per instance                               │  │
│  │  - Managed Identity for Azure service authentication                       │  │
│  │  - Classification-aware request routing                                    │  │
│  └─────────────────────┬───────────────────────┬──────────────────────────────┘  │
│                        │                       │                                 │
│                        ▼                       ▼                                 │
│  ┌──────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │ Horizontal Database Sharding     │   │  Azure OpenAI Service (GCC High)    │ │
│  │ (12 PostgreSQL Flexible Servers) │   │  - GPT-4o Model (IL5 Approved)      │ │
│  │ IL5 Physical Segregation         │   │  - Whisper Model (Transcription)    │ │
│  │                                  │   │  - Regional: USGov Virginia         │ │
│  │ UNCLASS: 6 shards                │   │  - Managed Identity Auth            │ │
│  │ - VNet: 10.0.0.0/16              │   │  - 100K TPM Capacity                │ │
│  │ - GP_Gen5_4-8 (baseline)         │   │  - FIPS 140-2 Validated             │ │
│  │ - GP_Gen5_16 (peak)              │   │  - No data retention (zero-day)     │ │
│  │ - TDE: Microsoft-managed keys    │   └─────────────────────────────────────┘ │
│  │ - Retention: 365 days            │                                           │
│  │                                  │   ┌─────────────────────────────────────┐ │
│  │ CONF: 4 shards                   │   │  Azure Key Vault (Standard)         │ │
│  │ - VNet: 10.10.0.0/16             │   │  - Customer-Managed Keys (CMK)      │ │
│  │ - GP_Gen5_4-8 (baseline)         │   │  - CONF database encryption         │ │
│  │ - GP_Gen5_16 (peak)              │   │  - FIPS 140-2 Level 1               │ │
│  │ - TDE: CMK (Key Vault Standard)  │   │  - Purge protection enabled         │ │
│  │ - Retention: 365 days            │   │  - Audit logging enabled            │ │
│  │                                  │   └─────────────────────────────────────┘ │
│  │ SECRET: 2 shards                 │                                           │
│  │ - VNet: 10.20.0.0/16             │   ┌─────────────────────────────────────┐ │
│  │ - GP_Gen5_4-8 (baseline)         │   │  Azure Key Vault Premium (HSM)      │ │
│  │ - GP_Gen5_16 (peak)              │   │  - HSM-backed CMK (FIPS 140-2 L2)   │ │
│  │ - TDE: HSM-backed CMK (Premium)  │   │  - SECRET database encryption       │ │
│  │ - Retention: 365 days            │   │  - Hardware Security Module         │ │
│  │ - No internet egress             │   │  - Purge protection enabled         │ │
│  │ - Air-gapped architecture        │   │  - Audit logging enabled            │ │
│  │                                  │   └─────────────────────────────────────┘ │
│  │ Total Capacity:                  │                                           │
│  │ - 300K+ concurrent connections   │                                           │
│  │ - 120K+ IOPS                     │                                           │
│  │ - Read replicas: 34-56 instances │                                           │
│  └──────────────────────────────────┘                                           │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐     │
│  │        Azure Monitor + Application Insights (GCC High)                  │     │
│  │        - Application Performance Monitoring (APM)                       │     │
│  │        - Security Audit Logs (365-day retention)                        │     │
│  │        - Custom Metrics & Alerts                                        │     │
│  │        - SIEM Integration (Azure Sentinel)                              │     │
│  └─────────────────────────────────────────────────────────────────────────┘     │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

                              Users Access via
                    Microsoft Teams Desktop/Web/Mobile Clients
              (CAC/PIV Authentication via Azure AD SSO - GCC High)
```

### 1.2 IL5 Data Segregation Architecture

**Classification-Based Network Isolation:**

The architecture implements physical segregation of classified data across three isolated Virtual Networks (VNets), each with distinct security postures aligned with DOD IL5 requirements:

**UNCLASSIFIED VNet (10.0.0.0/16):**
- Purpose: UNCLASSIFIED meeting data and processing
- Internet Access: Allowed (with WAF and DDoS protection)
- Encryption: TLS 1.2+ in transit, Microsoft-managed TDE at rest
- Database Shards: 6 independent PostgreSQL servers
- Compute: 6× ASEv3 scale units (600 I3v2 instances at peak)
- NSG Rules: Standard UNCLASS traffic filtering

**CONFIDENTIAL VNet (10.10.0.0/16):**
- Purpose: CONFIDENTIAL meeting data and processing
- Internet Access: Restricted (approved Microsoft services only)
- Encryption: TLS 1.2+ in transit, CMK-backed TDE at rest (Key Vault Standard)
- Database Shards: 4 independent PostgreSQL servers
- Compute: 4× ASEv3 scale units (240 I3v2 instances at peak)
- NSG Rules: Deny-by-default with explicit allow rules

**SECRET VNet (10.20.0.0/16):**
- Purpose: SECRET meeting data and processing
- Internet Access: Denied (air-gapped architecture)
- Encryption: TLS 1.2+ in transit, HSM-backed CMK TDE at rest (Key Vault Premium)
- Database Shards: 2 independent PostgreSQL servers
- Compute: 2× ASEv3 scale units (40 I3v2 instances at peak)
- NSG Rules: Maximum security - no internet egress, private endpoints only
- Audit Logging: Immutable audit logs with 365-day retention

**Cross-Classification Access:**
- Users with SECRET clearance can access UNCLASS, CONF, and SECRET data
- Users with CONFIDENTIAL clearance can access UNCLASS and CONF data
- Users with UNCLASSIFIED clearance can only access UNCLASS data
- Classification downgrade requires explicit approval workflow
- No data flows from higher to lower classification without approval

### 1.3 Azure Government (GCC High) Components

**Production Architecture:**
- **Compute:** Azure App Service Environment v3 (ASEv3) with I3v2 instances
- **Database:** Azure Database for PostgreSQL Flexible Server (v14, GP_Gen5 tier)
- **AI Processing:** Azure OpenAI Service (GPT-4o, GCC High deployment)
- **Load Balancing:** Azure Front Door Premium with WAF v2
- **Networking:** Multi-VNet architecture with private endpoints
- **Security:** Azure Key Vault (Standard for CONF, Premium HSM for SECRET)
- **Monitoring:** Azure Monitor and Application Insights (GCC High)
- **Microsoft 365:** GCC High tenant with Teams, SharePoint, Exchange, Azure AD
- **Identity:** Azure AD with CAC/PIV authentication support

**FIPS 140-2 Compliance:**
- All cryptographic operations use FIPS 140-2 validated modules
- TLS 1.2+ with FIPS-approved cipher suites
- Azure Key Vault Premium: FIPS 140-2 Level 2 HSM
- Azure Key Vault Standard: FIPS 140-2 Level 1
- Node.js: FIPS-compliant OpenSSL configuration
- Database encryption: FIPS-validated AES-256

---

## 2. Technology Stack

### 2.1 Programming Languages

| Language | Version | Usage | FIPS Compliance |
|----------|---------|-------|----------------|
| **TypeScript** | 5.x | Primary language for frontend and backend | N/A (compile-time) |
| **JavaScript** | ES2022+ | Runtime execution (Node.js) | FIPS-compliant OpenSSL |
| **SQL** | PostgreSQL 14 | Database queries and schema | FIPS 140-2 validated encryption |

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
- Shadcn UI - Customizable component system (Microsoft Fluent design)
- Radix UI - Accessible component primitives (Section 508 compliant)
- Lucide React - Icon library
- React Icons - Government-approved icons

**Styling:**
- Tailwind CSS 3.x - Utility-first CSS framework
- PostCSS - CSS processing
- class-variance-authority - Component variants
- tailwind-merge - Class merging utility

**Forms & Validation:**
- React Hook Form 7.x - Form state management
- Zod 3.x - Schema validation with government data patterns
- @hookform/resolvers - Zod integration

**Accessibility:**
- WCAG 2.1 AA compliance (minimum)
- Section 508 compliance features
- Screen reader support (JAWS, NVDA tested)
- Keyboard navigation throughout
- ARIA labels for all interactive elements

**Utilities:**
- date-fns - Date utility functions
- Framer Motion - Animations (minimal, government-appropriate)
- Recharts - Charts and data visualization
- React Resizable Panels - Resizable layouts

### 2.3 Backend Stack

**Runtime & Framework:**
- Node.js 20.x LTS - JavaScript runtime (FIPS-compliant build)
- Express 4.x - Web application framework
- TypeScript 5.x - Type-safe development
- tsx - TypeScript execution

**Database:**
- PostgreSQL 14 - Primary database (Azure Flexible Server, GCC High)
- Drizzle ORM 0.x - TypeScript ORM with type-safe queries
- drizzle-kit - Schema management and migrations
- drizzle-zod - Zod schema generation
- @neondatabase/serverless - PostgreSQL driver

**Authentication:**
- Passport 0.7.x - Authentication middleware
- express-session - Session management (PostgreSQL-backed)
- connect-pg-simple - PostgreSQL session store
- CAC/PIV support via Azure AD SAML/OAuth

**Microsoft Integration (GCC High):**
- @microsoft/microsoft-graph-client - Microsoft Graph API client (GCC High endpoints)
  - Teams meeting access (.us domain)
  - User management and clearance groups
  - Email distribution via Exchange Online
  - SharePoint GCC High access

**AI Integration (GCC High):**
- OpenAI SDK 6.x - Azure OpenAI integration (GCC High deployment)
  - GPT-4o for transcript processing and summarization
  - Whisper for audio transcription
  - Zero-day data retention (no training data)
  - FIPS 140-2 validated encryption

**Document Generation:**
- docx 9.x - DOCX document generation with classification markings
- pdf-lib 1.x - PDF document generation with watermarks
- archiver 7.x - ZIP file creation

**Validation:**
- Zod 3.x - Runtime type validation
- zod-validation-error - Error formatting

**Utilities:**
- p-limit - Concurrent operation limiting
- p-retry - Retry logic with exponential backoff
- lru-cache - LRU caching for session data
- ws - WebSocket support

### 2.4 Development and Security Tools

- ESLint - Code linting with security rules
- Prettier - Code formatting
- TypeScript - Type checking
- Vite - Development server and build tool
- OWASP Dependency Check - Vulnerability scanning
- Snyk - Continuous security monitoring

---

## 3. Component Architecture

### 3.1 Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              React Single Page Application                   │
│              (Classification-Aware UI)                       │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer                                          │
│  ├─ Classification Banner        (persistent security marking)│
│  ├─ Dashboard                    (meeting stats, recent)     │
│  ├─ Meetings List                (classification filters)    │
│  ├─ Meeting Details              (clearance-gated view)      │
│  ├─ Approval Interface           (multi-level review)        │
│  ├─ Action Items Tracker         (assignee clearance check)  │
│  ├─ Search Archive               (classification-scoped)     │
│  └─ Settings                     (user clearance display)    │
├─────────────────────────────────────────────────────────────┤
│  Component Library                                           │
│  ├─ Shadcn UI Components         (government-styled)         │
│  ├─ Classification Badges        (UNCLASS/CONF/SECRET)       │
│  ├─ Security Banners             (persistent markings)       │
│  ├─ Status Indicators            (processing states)         │
│  ├─ Meeting Cards                (classification-aware)      │
│  └─ Sidebar Navigation           (clearance-filtered)        │
├─────────────────────────────────────────────────────────────┤
│  State Management                                            │
│  ├─ TanStack Query               (API cache, sync)           │
│  ├─ React Hooks                  (local state)               │
│  ├─ Theme Context                (government light/dark)     │
│  └─ Clearance Context            (user clearance level)      │
├─────────────────────────────────────────────────────────────┤
│  Routing & Navigation                                        │
│  └─ Wouter                       (client-side routing)       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Express.js Application                          │
│              (Classification-Aware API)                      │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                  │
│  ├─ /api/meetings                (classification-filtered)  │
│  ├─ /api/minutes                 (clearance-gated)          │
│  ├─ /api/action-items            (assignee validation)      │
│  ├─ /api/users                   (clearance management)     │
│  ├─ /api/webhooks/teams          (GCC High webhook receiver)│
│  └─ /api/health                  (health check)             │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                        │
│  ├─ Meeting Orchestrator         (classification routing)   │
│  ├─ Minutes Generator            (AI processing w/ marking) │
│  ├─ Durable Queue Service        (shard-aware job queue)    │
│  ├─ Email Distribution           (Graph API GCC High)       │
│  ├─ SharePoint Client            (IL5 archival)             │
│  ├─ Document Export              (classification watermarks)│
│  ├─ Access Control               (clearance enforcement)    │
│  └─ Classification Detector      (AI-based detection)       │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer                                           │
│  ├─ Drizzle ORM                  (shard-aware queries)      │
│  ├─ PostgreSQL Client            (multi-shard connections)  │
│  ├─ Shard Router                 (classification-based)     │
│  └─ Session Store                (PostgreSQL sessions)      │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                           │
│  ├─ Microsoft Graph Client       (GCC High .us endpoints)   │
│  ├─ Azure OpenAI Client          (GCC High GPT-4o)          │
│  ├─ SharePoint Connector         (IL5 OAuth)                │
│  └─ Webhook Validator            (HMAC signature verify)    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Workflow Engine Architecture

**Classification-Aware Durable Job Queue:**
```typescript
// PostgreSQL-backed job queue with classification routing
interface Job {
  id: string;
  type: 'generate_minutes' | 'send_email' | 'upload_sharepoint';
  payload: Record<string, any>;
  classification: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET';
  shard: number; // Target database shard based on classification
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  createdBy: string; // User ID with clearance validation
  auditLog: AuditEntry[]; // Immutable audit trail
}
```

**Key Features:**
- Classification-aware job routing (UNCLASS → shards 0-5, CONF → shards 6-9, SECRET → shards 10-11)
- Idempotent job processing (unique job keys prevent duplicates)
- Exponential backoff retry (2^attempt minutes, max 3 retries)
- Dead-letter queue for permanently failed jobs
- Graceful shutdown and recovery
- Background worker polling (5 second intervals)
- Audit logging for all job state transitions

---

## 4. Access Control Architecture

### 4.1 Azure AD Group-Based Access Control (GCC High)

**Design Principles:**
- Primary source: Azure AD GCC High groups (authoritative)
- CAC/PIV authentication: Enforced via Azure AD SAML/OAuth
- Performance: Session cache (15-min TTL)
- Security: Fail-closed (deny access if groups unavailable)
- Scalability: No per-user database updates (supports 300,000+ users)
- Audit: Azure AD logs + application access logs (365-day retention)

### 4.2 Clearance-Level Group Structure

**Clearance-Level Groups (Azure AD):**
```
Clearance-UNCLASSIFIED   → Can view UNCLASSIFIED meetings only
Clearance-CONFIDENTIAL   → Can view UNCLASSIFIED + CONFIDENTIAL meetings
Clearance-SECRET         → Can view UNCLASSIFIED + CONFIDENTIAL + SECRET meetings
```

**Hierarchy:** SECRET > CONFIDENTIAL > UNCLASSIFIED

**Role Groups (Azure AD):**
```
Role-Viewer              → View attended meetings only
Role-Editor              → Can edit minutes before approval
Role-Approver            → Can approve/reject meeting minutes
Role-Admin               → Full system access + configuration
Role-Auditor             → Read-only access to all meetings (with clearance)
```

**Combined Access Example:**
```
User: john.doe@dod.mil
Groups: Clearance-SECRET, Role-Approver
Access: Can approve/reject UNCLASS, CONF, and SECRET meeting minutes
```

### 4.3 Microsoft Graph API Integration (GCC High)

**Endpoint (GCC High):**
```http
GET https://graph.microsoft.us/v1.0/users/{userId}/memberOf
Authorization: Bearer {access_token}
```

**Authentication:**
- CAC/PIV via Azure AD (SAML 2.0 or OAuth 2.0)
- Managed Identity for service-to-service authentication
- Access tokens: 1-hour expiration, automatic refresh

**Pagination:**
- Page size: 100 groups per request
- Max iterations: 50 pages (5,000 groups max per user)
- Timeout: 30 seconds total

**Error Handling:**
- Retry on 429 (Too Many Requests) with exponential backoff
- Fail-closed on errors (deny access, log security event)
- Fallback to cached data if available (with staleness warning)

### 4.4 Caching Strategy

```
┌─────────────────┐
│  Azure AD       │ ← Authoritative Source (GCC High)
│  (Graph API)    │    CAC/PIV Authenticated
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Session Cache  │ ← 15-minute TTL
│  (in-memory)    │    Per-user clearance level
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database Cache │ ← Fallback only (staleness flagged)
│  (PostgreSQL)   │    Audit log entry on fallback use
└─────────────────┘
```

**Cache Invalidation:**
- Session expiration (15 minutes)
- Explicit user logout
- Admin-triggered refresh
- Clearance level change detection (via Graph API webhooks)

---

## 5. Data Architecture

### 5.1 Classification-Segregated Database Schema

**Core Tables (Replicated Across All Shards):**
- `users` - User profiles, clearance levels, CAC/PIV identifiers
- `meetings` - Meeting metadata, classification, status
- `meetingMinutes` - Generated minutes content, classification markings
- `actionItems` - Extracted action items, assignee clearance validation
- `graphWebhookSubscriptions` - Teams webhook subscriptions (GCC High)
- `jobQueue` - Durable job queue for workflows (classification-aware)
- `sessions` - User sessions (PostgreSQL store, 24-hour expiration)
- `auditLog` - Immutable audit trail (365-day retention for SECRET)

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

### 5.2 Shard Distribution by Classification

**UNCLASSIFIED Shards (0-5):** 6 shards
- VNet: 10.0.0.0/16
- Encryption: TDE with Microsoft-managed keys
- Retention: 365 days
- Backup: Daily automated backups, 35-day retention

**CONFIDENTIAL Shards (6-9):** 4 shards
- VNet: 10.10.0.0/16
- Encryption: TDE with CMK (Azure Key Vault Standard)
- Retention: 365 days
- Backup: Daily automated backups, 35-day retention
- Audit: All access logged with 365-day retention

**SECRET Shards (10-11):** 2 shards
- VNet: 10.20.0.0/16
- Encryption: TDE with HSM-backed CMK (Azure Key Vault Premium)
- Retention: 365 days
- Backup: Daily automated backups, 35-day retention
- Audit: Immutable audit logs with 365-day retention
- Network: No internet egress, private endpoints only

**Shard Routing Logic:**
```typescript
function getShardId(classification: ClassificationLevel): number {
  switch (classification) {
    case 'UNCLASSIFIED': return Math.floor(Math.random() * 6); // 0-5
    case 'CONFIDENTIAL': return 6 + Math.floor(Math.random() * 4); // 6-9
    case 'SECRET': return 10 + Math.floor(Math.random() * 2); // 10-11
  }
}
```

### 5.3 Data Relationships

```
meetings (1) ─────── (1) meetingMinutes
    │
    ├─────── (*) actionItems
    │
    ├─────── (*) meetingAttendees (clearance validation)
    │
    └─────── (*) auditLog (immutable)
```

### 5.4 Data Retention and Destruction

- **Active meetings:** Indefinite (until archival policy triggers)
- **Archived minutes:** Configurable retention policy (default: 7 years for DOD)
- **Job queue:** 30-day retention for completed jobs
- **Session data:** 24-hour expiration (automatic cleanup)
- **Audit logs:** 
  - UNCLASSIFIED: 365 days
  - CONFIDENTIAL: 365 days
  - SECRET: 365 days (immutable, no deletion allowed)
- **Data destruction:** Secure deletion per DOD 5220.22-M standard

---

## 6. Integration Architecture

### 6.1 Microsoft Teams Integration (GCC High)

**Webhook Subscription (GCC High Graph API):**
```
Microsoft Teams (GCC High) → Graph API Webhook (.us) → Application Endpoint
                                                              │
                                                              ▼
                                                    Validate HMAC signature
                                                              │
                                                              ▼
                                                  Classification detection
                                                              │
                                                              ▼
                                                  Enqueue to correct shard
```

**Meeting Data Retrieval (Graph API .us endpoints):**
- Meeting metadata (title, date, duration, attendees)
- Recording URL (via call records API)
- Transcript URL (via call records API)
- Participant information (clearance level lookup)
- Classification detection (AI-assisted + manual override)

### 6.2 SharePoint Integration (GCC High)

**Authentication:** OAuth 2.0 with Sites.Selected permission (GCC High)

**Upload Process:**
1. Generate DOCX document with classification markings
2. Create folder structure (Year/Month/Classification)
3. Upload document to SharePoint GCC High library
4. Set metadata (classification, meeting date, attendee count, clearance required)
5. Apply information protection labels (UNCLASS/CONF/SECRET)
6. Return SharePoint URL for database storage
7. Audit log entry with document hash

**Folder Structure (IL5-Compliant):**
```
/Meeting Minutes/
  ├─ UNCLASSIFIED/
  │   ├─ 2025/
  │   │   ├─ 01-January/
  │   │   └─ 02-February/
  │   └─ 2026/
  ├─ CONFIDENTIAL/
  │   ├─ 2025/
  │   │   ├─ 01-January/
  │   │   └─ 02-February/
  │   └─ 2026/
  └─ SECRET/
      ├─ 2025/
      │   ├─ 01-January/
      │   └─ 02-February/
      └─ 2026/
```

### 6.3 Azure OpenAI Integration (GCC High)

**Configuration (GCC High Deployment):**
- Endpoint: https://{resource}.openai.azure.us/
- Authentication: Managed Identity (Azure AD)
- Model: GPT-4o (IL5-approved)
- Region: USGov Virginia
- Data residency: US Government cloud only
- Data retention: Zero-day (no training data)

**Processing Pipeline:**
```
Transcript → Azure OpenAI (GCC High) → Minutes Generation
                                     → Action Item Extraction
                                     → Classification Detection
                                     → Security Marking Application
```

**Retry Logic:**
- 7 retries with exponential backoff
- 2-128 second delays
- Rate limit handling (429 errors)
- Fail-safe: Manual review if AI processing fails

### 6.4 Email Distribution (GCC High)

**Method:** Microsoft Graph API sendMail endpoint (GCC High)

**Process:**
1. Generate DOCX and PDF documents with classification markings
2. Apply classification watermarks to PDF
3. Create email with classification banner in subject line
4. Attach documents (encrypted attachments for CONF/SECRET)
5. Send to all meeting attendees (clearance-validated)
6. Track delivery status via Graph API
7. Audit log entry with recipient list

**Classification Handling:**
- UNCLASSIFIED: Standard email with markings
- CONFIDENTIAL: Encrypted email (S/MIME), "CONFIDENTIAL" banner
- SECRET: Encrypted email (S/MIME), "SECRET" banner, restricted distribution

---

## 7. Security Architecture

### 7.1 Authentication (CAC/PIV)

**Primary Method:** Azure AD SSO with CAC/PIV
- CAC/PIV authentication enforced via Azure AD Conditional Access
- SAML 2.0 or OAuth 2.0 integration
- Certificate-based authentication
- Multi-factor authentication (MFA) required
- Device compliance check (managed devices only)
- Single sign-on experience

**Session Management:**
- PostgreSQL-backed sessions (persistent across app restarts)
- 24-hour session timeout (configurable per classification)
- Secure cookie handling (httpOnly, secure, sameSite=strict)
- Session regeneration after privilege escalation
- Concurrent session limit: 3 active sessions per user

### 7.2 Authorization (Clearance-Based)

**Multi-Level Access Control:**
- Clearance level (via Azure AD groups)
- Role-based permissions (via Azure AD groups)
- Meeting attendance verification
- Classification matching (clearance >= meeting classification)
- Time-based access (classification downgrade after archival)

**Access Decision Logic:**
```typescript
function canViewMeeting(user: User, meeting: Meeting): boolean {
  // User must have clearance level >= meeting classification
  const hasClearance = user.clearanceLevel >= meeting.classification;
  
  // User must be attendee OR have auditor/admin role
  const isAttendee = meeting.attendees.includes(user.id);
  const hasAuditorRole = user.roles.includes('Role-Auditor');
  const hasAdminRole = user.roles.includes('Role-Admin');
  const isAuthorized = isAttendee || hasAuditorRole || hasAdminRole;
  
  // Audit all access attempts
  auditLog.create({
    userId: user.id,
    meetingId: meeting.id,
    action: 'VIEW_ATTEMPT',
    granted: hasClearance && isAuthorized,
    timestamp: new Date()
  });
  
  return hasClearance && isAuthorized;
}
```

### 7.3 Data Protection

**Encryption at Rest:**
- **UNCLASSIFIED:** TDE with Microsoft-managed keys (FIPS 140-2)
- **CONFIDENTIAL:** TDE with CMK from Azure Key Vault Standard (FIPS 140-2 Level 1)
- **SECRET:** TDE with HSM-backed CMK from Azure Key Vault Premium (FIPS 140-2 Level 2)
- **Documents:** Azure Blob Storage encryption (GCC High)
- **Backups:** Encrypted backups with same key hierarchy

**Encryption in Transit:**
- TLS 1.2+ for all connections (FIPS-approved cipher suites)
- Certificate pinning for Graph API connections
- Secure WebSocket connections (wss://)
- No downgrade to TLS 1.1 or earlier
- Perfect Forward Secrecy (PFS) enabled

**Secrets Management:**
- Azure Key Vault for all secrets (no environment variables in production)
- Managed Identity for service-to-service authentication
- No secrets in code or configuration files
- Secret rotation: 90-day automatic rotation
- Access policies: Least privilege, time-limited

### 7.4 Compliance and Audit

**Audit Logging (365-Day Retention for SECRET):**
- All authentication attempts (success and failure)
- All authorization decisions
- All data access (read, write, delete)
- All administrative actions
- All classification changes
- All failed access attempts

**Audit Log Structure:**
```typescript
interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userClearance: ClassificationLevel;
  action: string; // VIEW, EDIT, APPROVE, DELETE, etc.
  resourceType: string; // MEETING, MINUTES, ACTION_ITEM
  resourceId: string;
  resourceClassification: ClassificationLevel;
  granted: boolean;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  immutable: boolean; // true for SECRET, prevents deletion
}
```

**Compliance Features:**
- Classification markings on all documents (header, footer, watermark)
- Access control enforcement (fail-closed)
- Data retention policies (7-year default for DOD)
- Audit trail completeness (no gaps)
- Incident response integration (Azure Sentinel)

---

## 8. Classification Handling

### 8.1 Classification Detection

**AI-Assisted Detection:**
- Azure OpenAI (GCC High) analyzes transcript content
- Keyword detection for classified terms
- Participant clearance level analysis
- Meeting subject analysis

**Manual Override:**
- Meeting organizer can set classification during creation
- Approver can adjust classification during review
- Admin can reclassify archived meetings
- All classification changes audit logged

**Classification Decision Logic:**
```typescript
async function detectClassification(meeting: Meeting): Promise<ClassificationLevel> {
  // 1. Check organizer-set classification (if any)
  if (meeting.organizerClassification) {
    return meeting.organizerClassification;
  }
  
  // 2. Analyze participant clearance levels
  const maxClearance = Math.max(...meeting.attendees.map(a => a.clearanceLevel));
  
  // 3. AI-based content analysis
  const aiClassification = await analyzeTranscript(meeting.transcript);
  
  // 4. Take the higher of participant-based or AI-based
  const detected = Math.max(maxClearance, aiClassification);
  
  // 5. Require manual confirmation for CONF/SECRET
  if (detected >= ClassificationLevel.CONFIDENTIAL) {
    await requestManualReview(meeting, detected);
  }
  
  return detected;
}
```

### 8.2 Classification Marking

**Document Markings:**
- **Header:** "UNCLASSIFIED" / "CONFIDENTIAL" / "SECRET" (red, 16pt, bold, all caps)
- **Footer:** "UNCLASSIFIED" / "CONFIDENTIAL" / "SECRET" (red, 16pt, bold, all caps)
- **Watermark:** Diagonal "CONFIDENTIAL" or "SECRET" (for CONF/SECRET only)
- **Metadata:** Classification level embedded in document properties

**UI Markings:**
- Persistent classification banner at top of every page
- Color-coded badges (gray=UNCLASS, yellow=CONF, red=SECRET)
- Meeting cards show classification level prominently
- Search results filtered by user clearance level

### 8.3 Classification Downgrade

**Downgrade Process:**
- Requires admin approval
- Audit log entry with justification
- Notification to all previous attendees
- Document regeneration with new markings
- SharePoint folder move (higher → lower classification folder)

**Upgrade Process:**
- Automatic if content detected as higher classification
- Immediate access restriction (clearance enforcement)
- Notification to approvers
- Document regeneration with new markings
- SharePoint folder move (lower → higher classification folder)

---

## 9. FedRAMP Compliance

### 9.1 FedRAMP High Control Implementation

**Current Status:**
- **67 Controls Fully Implemented** (89%): Technical controls in architecture
- **5 Controls Partially Implemented** (7%): Require organizational processes
- **2 Controls Planned** (3%): Deferred to ATO process

**Fully Implemented Controls (Sample):**
- **AC-2:** Account Management (Azure AD integration)
- **AC-3:** Access Enforcement (clearance-based authorization)
- **AC-6:** Least Privilege (role-based access control)
- **AU-2:** Audit Events (comprehensive audit logging)
- **AU-9:** Protection of Audit Information (immutable logs)
- **IA-2:** Identification and Authentication (CAC/PIV)
- **SC-8:** Transmission Confidentiality (TLS 1.2+)
- **SC-13:** Cryptographic Protection (FIPS 140-2)
- **SC-28:** Protection of Information at Rest (TDE with CMK/HSM)

**Partially Implemented Controls:**
- **AC-1:** Access Control Policy (requires organizational policy signatures)
- **CA-2:** Security Assessments (requires 3PAO assessment)
- **CM-2:** Baseline Configuration (requires CCB establishment)
- **IR-4:** Incident Handling (requires DC3 integration testing)
- **SC-7:** Boundary Protection (requires penetration testing validation)

### 9.2 DISA SRG IL5 Alignment

**IL5 Requirements Met:**
- Physical segregation of classified data (multi-VNet architecture)
- FIPS 140-2 validated cryptography
- CAC/PIV authentication
- Multi-level security (MLS) controls
- Audit logging with 365-day retention
- No internet egress for SECRET data
- HSM-backed encryption for SECRET data

**IL5 Requirements In Progress:**
- Continuous monitoring (Azure Sentinel integration)
- Incident response integration (DC3 ACAS)
- SCAP compliance scanning
- STIG hardening validation

### 9.3 ATO Process Timeline (16 Months)

**Months 1-6: Security Assessment**
- 3PAO selection and Security Assessment Plan (SAP)
- Security assessment execution (vulnerability scanning, penetration testing)
- Security Assessment Report (SAR) generation
- HIGH/CRITICAL finding remediation
- Continuous monitoring implementation

**Months 7-12: Documentation & Governance**
- System Security Plan (SSP) finalization (1,500+ pages)
- Plan of Action & Milestones (POA&M) management
- Incident Response Plan testing
- Contingency Plan testing (backup/restore)
- Configuration Management Board (CCB) establishment
- Security training completion

**Months 13-16: Authorization**
- ATO package submission to Authorizing Official (AO)
- AO review and risk assessment
- Final authorization decision (Authority to Operate)
- Transition to production operations (Phase 2)
- Continuous monitoring activation

_See POAM_DOCUMENT.md for detailed remediation plan and FEDRAMP_CONTROL_MATRIX.md for complete control mapping_

---

## 10. Performance and Scalability

### 10.1 Performance Characteristics

**API Response Times (Target):**
- Meeting list (UNCLASSIFIED): <300ms
- Meeting list (CONFIDENTIAL): <400ms (additional clearance checks)
- Meeting list (SECRET): <500ms (maximum security overhead)
- Meeting details: <300ms
- Minutes generation: <2 minutes (AI processing)
- Document generation: <5 seconds

**Concurrent Users:**
- Baseline: 10,000 concurrent users (3 ASEv3 units, 18 instances)
- Peak: 300,000 concurrent users (12 ASEv3 units, 880 instances)
- Auto-scaling: Based on CPU (>70%), memory (>80%), queue depth (>100 jobs)

### 10.2 Scalability Architecture

**Horizontal Scaling:**
- Stateless API servers (infinite horizontal scaling)
- Classification-aware load balancing (Azure Front Door)
- Database connection pooling (PgBouncer)
- Read replicas: 34 instances (baseline) to 56 instances (peak)

**Vertical Scaling:**
- Database: GP_Gen5_4 (baseline) to GP_Gen5_16 (peak)
- Compute: I3v2 instances (8 vCPU, 32 GB RAM)
- Auto-scaling based on metrics (CPU, memory, queue depth)

**Bottlenecks and Mitigations:**
- Azure OpenAI rate limits → Over-provisioning (100K TPM), queue buffering
- Microsoft Graph API throttling → Retry logic, request batching
- PostgreSQL connection limit → Connection pooling, read replicas
- Network bandwidth (SECRET VNet) → Private endpoints, regional proximity

### 10.3 Load Testing Plan

**Phase 1: Baseline Validation (Week 14)**
- Target: 10,000 concurrent users
- Duration: 4 hours sustained load
- Metrics: Response time, error rate, resource utilization

**Phase 2: Peak Validation (Month 6 of ATO)**
- Target: 50,000 concurrent users
- Duration: 8 hours sustained load
- Metrics: Auto-scaling behavior, database performance, AI processing throughput

**Phase 3: Stress Testing (Month 9 of ATO)**
- Target: 300,000 concurrent users (design maximum)
- Duration: 12 hours sustained load
- Metrics: System stability, data integrity, failover capabilities

---

## 11. Monitoring and Observability

### 11.1 Azure Monitor Integration (GCC High)

**Log Analytics Workspace:**
- Centralized logging for all components
- 365-day retention for all logs
- Kusto Query Language (KQL) for analysis
- Integration with Azure Sentinel for SIEM

**Application Insights:**
- Application performance monitoring (APM)
- Distributed tracing across services
- Custom metrics and alerts
- Real-time performance dashboard

**Metrics Collected:**
- API request rate (per classification level)
- API error rate (per endpoint)
- Response time percentiles (p50, p95, p99)
- Job queue depth (per shard)
- Job processing time (per job type)
- Authentication success/failure rate
- Authorization denial rate
- Database connections (per shard)
- CPU/Memory utilization (per instance)

### 11.2 Security Monitoring

**Azure Sentinel Integration:**
- Real-time threat detection
- Automated incident response
- Integration with DC3 ACAS
- Custom analytics rules for classification violations

**Security Alerts:**
- Failed CAC/PIV authentication attempts (>5 in 5 minutes)
- Authorization denial for classified meetings (potential data leak attempt)
- Unusual access patterns (user accessing meetings outside normal hours)
- Classification downgrade attempts (requires investigation)
- Bulk data export attempts (potential exfiltration)

### 11.3 Disaster Recovery

**Backup Strategy:**
- Database: Automated daily backups, 35-day retention
- Geo-redundant backup replication (USGov Virginia → USGov Texas)
- Point-in-time recovery (7-35 day window)
- Backup encryption: Same key hierarchy as production data

**Recovery Objectives:**
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours (daily backups)
- **Failover Region:** USGov Texas (secondary Azure Government region)

**Failover Procedures:**
1. DNS failover to backup region (Azure Front Door automatic)
2. Restore database from latest backup (geo-redundant)
3. Deploy application to backup environment (automated via CI/CD)
4. Verify connectivity to Microsoft 365 GCC High services
5. Resume normal operations (validate with smoke tests)

---

## 12. Deployment and Operations

### 12.1 CI/CD Pipeline

**Build Pipeline:**
- GitHub Actions for CI/CD (GCC High compatible)
- Automated testing: Unit, integration, security scanning
- OWASP Dependency Check for vulnerability scanning
- SAST/DAST security scanning
- Build artifacts: Docker containers (FIPS-compliant base images)

**Deployment Pipeline:**
- Blue-Green deployment strategy (zero-downtime)
- Automated database migrations (Drizzle Kit)
- Smoke tests after deployment
- Automatic rollback on failure
- Classification-specific deployment (UNCLASS → CONF → SECRET)

### 12.2 Operational Procedures

**Change Management:**
- Configuration Management Board (CCB) approval required
- Change requests documented in Azure DevOps
- Impact analysis for classification handling changes
- Rollback plan for all changes

**Incident Response:**
- Integration with Azure Sentinel for automated detection
- Escalation to DC3 for security incidents
- Incident response playbooks for common scenarios
- Post-incident review and lessons learned

**Continuous Monitoring:**
- 24/7 monitoring via Azure Monitor
- On-call rotation for critical alerts
- Monthly security reviews
- Quarterly compliance assessments

---

**Document Classification:** UNCLASSIFIED  
**Version:** 1.0 (DOD Edition)  
**Last Updated:** November 2025  
**Next Review:** May 2026
