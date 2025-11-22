# Teams Meeting Minutes - Application Architecture & Technology Stack

## Executive Summary

AI-powered Microsoft Teams meeting minutes management system built as a native Teams plugin. Automatically captures Teams meetings via Microsoft Graph webhooks, generates AI-powered minutes using Azure OpenAI, manages approval workflows, and archives to SharePoint.

**Current Use:** Demo pilot for 20 users (extendable to enterprise-scale)

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Microsoft Teams Client                       │
│  (Plugin in Teams Sidebar - Native Fluent UI Integration)       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS/OAuth 2.0
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Azure App Service (Node.js)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Frontend: React + Fluent UI v9 (SPA)                     │  │
│  │  • Dashboard, Meetings List, Search, Settings             │  │
│  │  • Real-time updates via TanStack Query                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Backend: Express + TypeScript                            │  │
│  │  • RESTful API (/api/*)                                   │  │
│  │  • Microsoft Graph integration                            │  │
│  │  • Webhook handlers                                       │  │
│  │  • Azure OpenAI integration                               │  │
│  │  • Job queue processor                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────┬───────────────────────────┬───────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────────────┐
│  Azure Database for     │  │  Microsoft Graph API            │
│  PostgreSQL (Flexible)  │  │  • Teams Meetings               │
│  • Meetings data        │  │  • Calendar Events              │
│  • Minutes & approvals  │  │  • Recordings/Transcripts       │
│  • Action items         │  │  • User/Group Management        │
│  • Job queue            │  │  • SharePoint Upload            │
│  • Webhook state        │  └─────────────────────────────────┘
└─────────────────────────┘              │
              │                           ▼
              │                 ┌─────────────────────────────┐
              │                 │  Azure OpenAI Service       │
              │                 │  • GPT-4o (Minutes)         │
              │                 │  • Whisper (Transcription)  │
              │                 └─────────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
│  • SharePoint Online (Document archival)                         │
│  • Exchange Online (Email distribution)                          │
│  • Azure Bot Framework (Teams messaging)                         │
│  • Application Insights (Monitoring/Logging)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Meeting Capture:**
   - Microsoft Graph webhook notifies app when Teams meeting is created
   - App fetches meeting metadata and stores in PostgreSQL
   - Background job queues enrichment tasks

2. **Meeting Enrichment:**
   - After meeting ends, Graph API fetches call record
   - Retrieves recording and transcript from OneDrive/SharePoint
   - Job queue processes enrichment with retry logic

3. **AI Processing:**
   - Azure OpenAI GPT-4o analyzes transcript
   - Generates: summary, key discussions, decisions, action items
   - Stores in PostgreSQL with "pending_review" status

4. **Approval Workflow:**
   - Designated approvers review minutes in Teams
   - Approve/reject with optional comments
   - Approved minutes trigger distribution jobs

5. **Distribution:**
   - Transactional outbox pattern ensures exactly-once delivery
   - Email sent to all attendees via Exchange
   - Documents uploaded to SharePoint
   - Adaptive Cards sent to Teams chat

---

## Technology Stack

### Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 18.x | UI library |
| **Language** | TypeScript | 5.x | Type safety |
| **Build Tool** | Vite | 5.x | Fast dev server & bundler |
| **UI Library** | Fluent UI React Components | 9.x | Native Teams design system |
| **Styling** | Griffel (makeStyles) | 1.x | Fluent UI CSS-in-JS |
| **State Management** | TanStack Query | 5.x | Server state & caching |
| **Routing** | Wouter | 3.x | Lightweight client-side routing |
| **Forms** | React Hook Form | 7.x | Form validation |
| **Schema Validation** | Zod | 3.x | Runtime type checking |
| **Date Handling** | date-fns | 3.x | Date utilities |
| **Icons** | Fluent UI Icons + Lucide React | Latest | Icon libraries |
| **Teams Integration** | @microsoft/teams-js | 2.x | Teams SDK |

### Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 18.x LTS | JavaScript runtime |
| **Framework** | Express | 4.x | Web server |
| **Language** | TypeScript (ESM) | 5.x | Type safety |
| **Database ORM** | Drizzle ORM | Latest | Type-safe database queries |
| **Database** | PostgreSQL | 16.x | Relational database |
| **Authentication** | MSAL Node | Latest | Azure AD OAuth 2.0 |
| **Microsoft Graph** | @microsoft/microsoft-graph-client | Latest | Graph API SDK |
| **Bot Framework** | BotBuilder SDK | 4.x | Teams bot messaging |
| **AI SDK** | OpenAI SDK | Latest | Azure OpenAI integration |
| **Document Generation** | docx + pdf-lib | Latest | DOCX/PDF export |
| **Validation** | Zod | 3.x | Request validation |
| **Session Management** | express-session + connect-pg-simple | Latest | PostgreSQL-backed sessions |

### Infrastructure & DevOps

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Hosting** | Azure App Service (Linux, Node.js 18) | Application hosting |
| **Database** | Azure Database for PostgreSQL (Flexible Server) | Managed PostgreSQL |
| **AI** | Azure OpenAI Service | GPT-4o & Whisper models |
| **Authentication** | Microsoft Entra ID (Azure AD) | Identity & access management |
| **Bot** | Azure Bot Service | Teams bot registration |
| **Storage** | SharePoint Online | Document archival |
| **Email** | Exchange Online | Email distribution |
| **Monitoring** | Azure Application Insights | Logging & telemetry |
| **Key Management** | Azure Key Vault | Secrets management |
| **CI/CD** | GitHub Actions | Automated deployment |

### Security & Compliance

| Feature | Implementation |
|---------|---------------|
| **Transport Security** | HTTPS/TLS 1.2+ (Azure-managed certificates) |
| **Authentication** | Azure AD OAuth 2.0 with MSAL |
| **Authorization** | Azure AD group-based permissions (role/classification) |
| **Data Encryption** | At-rest encryption (Azure default) |
| **Secret Management** | Azure Key Vault + environment variables |
| **API Security** | JWT validation, webhook signature verification |
| **Data Isolation** | Multi-tenant isolation via Azure AD tenant |
| **Audit Logging** | Application Insights structured logs |
| **Classification** | UNCLASSIFIED/CONFIDENTIAL/SECRET/TOP_SECRET support |

---

## Database Schema

### Core Tables

**meetings** - Meeting metadata and Microsoft Graph integration
```typescript
- id (UUID, PK)
- title, description
- scheduledAt, duration
- attendees (JSONB array)
- status (scheduled/in_progress/completed/cancelled)
- classificationLevel (UNCLASSIFIED/CONFIDENTIAL/SECRET/TOP_SECRET)
- recordingUrl, transcriptUrl
- onlineMeetingId, organizerAadId, callRecordId
- graphSyncStatus, enrichmentStatus
- timestamps
```

**meeting_minutes** - AI-generated minutes with approval workflow
```typescript
- id (UUID, PK)
- meetingId (FK → meetings.id)
- summary (TEXT)
- keyDiscussions (JSONB array)
- decisions (JSONB array)
- attendeesPresent (JSONB array)
- processingStatus (pending/in_progress/completed/failed)
- approvalStatus (pending_review/approved/rejected)
- approvedBy, approvedAt, rejectionReason
- sharepointUrl, docxUrl, pdfUrl
- timestamps
```

**action_items** - Extracted action items with assignments
```typescript
- id (UUID, PK)
- meetingId (FK → meetings.id)
- task (TEXT)
- assignedTo (email or "Unassigned")
- dueDate
- status (pending/in_progress/completed)
- priority (low/medium/high)
- timestamps
```

**job_queue** - Durable background job processing
```typescript
- id (SERIAL, PK)
- jobType (enrich_meeting/generate_minutes/send_email/upload_sharepoint)
- payload (JSONB)
- status (pending/processing/completed/failed/dead_letter)
- attemptCount, maxAttempts
- idempotencyKey (unique constraint)
- scheduledAt, processedAt
- error
- timestamps
```

**graph_webhook_subscriptions** - Microsoft Graph webhook lifecycle
```typescript
- id (UUID, PK)
- subscriptionId (Microsoft Graph subscription ID)
- resource (e.g., /communications/onlineMeetings)
- changeType (created/updated/deleted)
- expirationDateTime
- clientState (security token)
- notificationUrl
- status (active/expired/failed)
- timestamps
```

**user_group_cache** - Cached Azure AD groups (15-min TTL)
```typescript
- id (SERIAL, PK)
- userId (Azure AD object ID)
- groupMemberships (JSONB: role + clearanceLevel)
- expiresAt
- timestamps
```

**users** - User profiles and permissions
```typescript
- id (SERIAL, PK)
- email (unique)
- displayName
- clearanceLevel (UNCLASSIFIED/CONFIDENTIAL/SECRET/TOP_SECRET)
- role (admin/approver/auditor/viewer)
- department, organizationalUnit
- azureAdId (Azure AD object ID)
- azureUserPrincipalName
- tenantId
- lastLogin, lastGraphSync
- timestamps
```

**meeting_templates** - Reusable meeting templates
```typescript
- id (UUID, PK)
- name
- templateType (briefing/planning/status_review/emergency_response/custom)
- agendaTemplate (TEXT)
- classificationLevel
- defaultDuration
- isActive
- timestamps
```

**teams_conversation_references** - Teams bot conversation state
```typescript
- id (UUID, PK)
- userId (Azure AD object ID)
- conversationId, serviceUrl, tenantId
- conversationReference (JSONB, encrypted)
- timestamps
```

**sent_messages** - Audit log of sent Teams messages
```typescript
- id (UUID, PK)
- meetingId (FK → meetings.id)
- recipientUserId
- messageType
- activityId (Teams message ID)
- deliveredAt
- errorMessage
- timestamps
```

**message_outbox** - Transactional outbox for Adaptive Card delivery
```typescript
- id (UUID, PK)
- meetingId (FK → meetings.id)
- recipientUserId
- cardPayload (JSONB)
- status (pending/delivered/failed/dead_letter)
- attemptCount, maxAttempts
- lastAttemptAt, deliveredAt
- errorType, errorMessage
- timestamps
```

**app_settings** - Application configuration
```typescript
- id (VARCHAR, PK)
- value (JSONB)
- description
- updatedAt
```

---

## API Architecture

### RESTful Endpoints

**Meetings**
- `GET /api/meetings` - List meetings (filtered by access control)
- `GET /api/meetings/:id` - Get meeting details
- `POST /api/meetings` - Create meeting (admin only)
- `PATCH /api/meetings/:id` - Update meeting metadata

**Minutes**
- `GET /api/meetings/:id/minutes` - Get minutes for meeting
- `POST /api/minutes/:id/approve` - Approve minutes
- `POST /api/minutes/:id/reject` - Reject minutes with reason
- `GET /api/meetings/:id/export/docx` - Download DOCX (on-demand)
- `GET /api/meetings/:id/export/pdf` - Download PDF (on-demand)

**Action Items**
- `GET /api/action-items` - List all action items
- `GET /api/action-items/:id` - Get action item details
- `POST /api/action-items` - Create action item
- `PATCH /api/action-items/:id` - Update action item status

**Search**
- `GET /api/search` - Search meetings/minutes (date range, keywords, classification)

**Statistics**
- `GET /api/stats` - Dashboard statistics

**Webhooks (Microsoft Graph)**
- `POST /api/webhooks/graph` - Receive Graph notifications
- `POST /api/webhooks/bot` - Receive Bot Framework messages

**Health**
- `GET /health` - Health check endpoint

### Request/Response Format

All endpoints return JSON with consistent structure:

**Success Response:**
```json
{
  "data": { ... },
  "timestamp": "2024-11-21T19:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": { "field": "validation error" },
  "timestamp": "2024-11-21T19:00:00.000Z"
}
```

### Schema Validation

All mutations validated with Drizzle-Zod schemas:
- Meetings: Email validation, 1-500 attendees, title 1-500 chars
- Minutes: Summary 1-5000 chars, max 100 discussions/decisions
- Action Items: Task 1-1000 chars, future dates only

---

## Background Job System

### Job Types

1. **enrich_meeting** - Fetch recordings/transcripts after meeting ends
   - Retries: 3 attempts with exponential backoff
   - Checks: callRecordId availability, recording completion

2. **generate_minutes** - AI processing with Azure OpenAI
   - GPT-4o for minutes generation
   - Whisper for audio transcription (fallback)
   - Validates output schema before saving

3. **send_email** - Email distribution to attendees
   - Uses Exchange Online via Microsoft Graph
   - Includes DOCX/PDF attachments
   - Tracks delivery status

4. **upload_sharepoint** - Archive to SharePoint
   - Uploads DOCX to configured library
   - Stores SharePoint URL in database

5. **send_teams_card** - Adaptive Card delivery (transactional outbox)
   - Per-recipient retry with error classification
   - PERMANENT errors (404, 401) → dead-letter immediately
   - TRANSIENT errors (429, 503) → exponential backoff (1m→5m→15m)

### Job Processing

- **Worker:** Single instance acquires lock via PostgreSQL advisory locks
- **Polling:** Every 5 seconds for pending jobs
- **Idempotency:** Unique keys prevent duplicate processing
- **Crash Recovery:** On restart, resets stuck "processing" jobs to "pending"
- **Dead Letter:** Failed jobs after max attempts move to dead-letter status

---

## Security Architecture

### Authentication Flow

1. User accesses app in Teams
2. Teams SDK initializes with user context
3. Backend validates Azure AD JWT token
4. MSAL fetches Microsoft Graph access token
5. Graph token used for all API calls
6. Session stored in PostgreSQL (connect-pg-simple)

### Authorization Model

**Azure AD Groups → Application Permissions**

Groups define two attributes:
- **Role:** viewer / approver / admin
- **Classification Level:** UNCLASSIFIED / CONFIDENTIAL / SECRET / TOP_SECRET

**Access Rules:**
- Users can only view meetings ≤ their classification level
- Users must be attendees OR have sufficient clearance
- Approvers can approve/reject minutes
- Admins can create meetings and modify settings

**Group Caching:**
- Azure AD groups cached in PostgreSQL (15-min TTL)
- Reduces Graph API calls
- Automatic refresh on cache miss

### Secret Management

**Development:**
- Environment variables in `.env`
- Mock services enabled (`USE_MOCK_SERVICES=true`)

**Production:**
- Azure Key Vault for secrets
- Managed Identity for access (no passwords)
- Environment variables injected by App Service

**Required Secrets:**
- `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID`
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- `DATABASE_URL` (PostgreSQL connection string)
- `SESSION_SECRET` (session encryption key)
- `MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD` (Bot Framework)

---

## Monitoring & Observability

### Application Insights Integration

**Metrics Tracked:**
- Request/response times for all API endpoints
- Job queue processing times
- Microsoft Graph API latency
- Azure OpenAI API latency
- Database query performance

**Custom Events:**
- Meeting capture (webhook received)
- Minutes generation (success/failure)
- Approval actions
- Distribution events (email/SharePoint/Teams)
- Access control decisions

**Structured Logging:**
- All logs include: timestamp, level, component, userId, meetingId
- PII-safe: No full names, no content, only IDs and metadata
- Error classification: PERMANENT / TRANSIENT / UNKNOWN

### Health Checks

`GET /health` returns:
```json
{
  "status": "healthy",
  "database": "connected",
  "jobWorker": "active",
  "uptime": 3600
}
```

---

## Scalability Considerations

### Current Architecture (Demo - 20 users)

- **App Service:** Basic B1 tier (1 core, 1.75 GB RAM)
- **Database:** Basic tier (1 vCore, 2 GB storage)
- **Concurrent:** ~10-20 concurrent requests

### Enterprise Scale (100-1000 users)

**Horizontal Scaling:**
- App Service: Standard S1+ tier with auto-scale (2-10 instances)
- Database: General Purpose tier with read replicas
- Job workers: Dedicated worker instances

**Optimizations:**
- Redis cache for session/user group data
- Azure CDN for static assets
- Database connection pooling (PgBouncer)
- Batch job processing

**Estimated Costs (100 users):**
- App Service (S1): ~$70/month
- PostgreSQL (GP 2 vCores): ~$100/month
- Azure OpenAI (GPT-4o): ~$50/month (usage-based)
- Bot Service: ~$0/month (standard tier free)
- **Total:** ~$220/month

---

## Deployment Requirements

### Azure Resources Needed

1. **Azure App Service** (Linux, Node.js 18)
2. **Azure Database for PostgreSQL** (Flexible Server, v16)
3. **Azure OpenAI Service** (GPT-4o + Whisper models)
4. **Azure Bot Service** (Bot registration)
5. **Azure Application Insights** (Monitoring)
6. **Azure Key Vault** (Optional, for production secrets)
7. **Microsoft Entra ID App Registration** (OAuth + Graph API)
8. **Microsoft 365 E3+ License** (Teams, SharePoint, Exchange)

### Network Requirements

- **Outbound:** HTTPS (443) to:
  - `graph.microsoft.us` (Microsoft Graph API - Azure Government)
  - `login.microsoftonline.us` (Azure AD authentication - Azure Government)
  - `*.openai.usgovcloudapi.net` (Azure OpenAI - Azure Government)
  - `*.botframework.com` (Bot Framework)

- **Inbound:** HTTPS (443) for:
  - Microsoft Graph webhooks
  - Bot Framework messages
  - User access via Teams

### Minimum Prerequisites

- **Azure Subscription** with Owner or Contributor role
- **Microsoft 365 Tenant** with Global Administrator access
- **Teams Administrator** privileges for app deployment
- **Azure CLI** installed locally
- **Node.js 18.x LTS** installed locally
- **Git** for version control

---

## Development vs. Production Differences

| Aspect | Development (Replit) | Production (Azure) |
|--------|---------------------|-------------------|
| **Database** | Neon PostgreSQL (serverless) | Azure Database for PostgreSQL |
| **Authentication** | Mock users (config/mockUsers.json) | Azure AD OAuth 2.0 |
| **Microsoft Graph** | Mock services | Real Graph API calls |
| **Azure OpenAI** | Replit AI fallback | Azure OpenAI Service |
| **Bot Framework** | Mock responses | Real bot messaging |
| **HTTPS** | Replit SSL | Azure App Service SSL |
| **Secrets** | Environment variables | Azure Key Vault |
| **Monitoring** | Console logs | Application Insights |
| **Domain** | `*.replit.dev` | `*.azurewebsites.us` (Azure Government) or custom |

---

## Compliance & Governance

**Current Status: Demo Environment**
- UNCLASSIFIED data only
- No production data
- Standard Azure security

**Production Requirements:**
- **Commercial:** SOC 2 Type II compliance
- **Government:** ATO (Authority to Operate) for DOD
- **Data Residency:** Azure region selection
- **Encryption:** FIPS 140-2 validated modules
- **Audit Logs:** Immutable audit trail
- **Backup/DR:** 99.99% SLA with geo-redundancy

---

## Document Version

- **Version:** 1.0
- **Date:** November 21, 2024
- **Status:** Production-Ready Architecture
- **Next Review:** Before enterprise deployment
