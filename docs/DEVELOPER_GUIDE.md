# Developer Guide

## Teams Meeting Minutes Application

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Audience:** Software Developers, DevOps Engineers, Solution Architects  
**Platform:** Azure Commercial Cloud (Not applicable to Azure Government or other sovereign clouds)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Project Structure](#project-structure)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Authentication Flow](#authentication-flow)
9. [AI Integration](#ai-integration)
10. [Microsoft Graph Integration](#microsoft-graph-integration)
11. [Background Job Processing](#background-job-processing)
12. [Testing](#testing)
13. [Debugging](#debugging)
14. [Deployment](#deployment)
15. [Contributing](#contributing)

---

## 1. Introduction

### Purpose

This Developer Guide provides technical documentation for developers working on the Teams Meeting Minutes application. It covers architecture, APIs, development workflows, and best practices.

### Prerequisites

Before starting development, ensure you have:

- Node.js 18.x or higher
- Git
- PostgreSQL (local installation or Azure Database for PostgreSQL)
- Azure Commercial subscription (for Azure OpenAI and Graph API)
- Microsoft 365 Commercial tenant (recommended for development)

### Related Documentation

| Document | Purpose |
|----------|---------|
| User Guide | End-user documentation |
| Admin Guide | Administrative procedures |
| Installation Manual | Deployment procedures |
| Troubleshooting Guide | Problem resolution |

---

## 2. Development Environment Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/teams-meeting-minutes.git
cd teams-meeting-minutes
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

Create a `.env` file with development settings:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/teams_minutes

# Azure AD (for production auth)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Session
SESSION_SECRET=your-random-secret-string

# Development Mode
NODE_ENV=development
USE_MOCK_SERVICES=true
```

### Step 4: Initialize Database

```bash
npm run db:push
```

### Step 5: Start Development Server

```bash
npm run dev
```

The application runs at `http://localhost:5000`.

### Mock Services

In development mode (`USE_MOCK_SERVICES=true`), the application uses mock implementations for:

- Microsoft Graph API calls
- Azure OpenAI responses
- User authentication (mock users available)

Use the user switcher in the UI to test different roles.

---

## 3. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    React Application                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │    │
│  │  │ Pages    │  │Components│  │ Contexts │  │ TanStack     │ │    │
│  │  │          │  │          │  │          │  │ Query        │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────────┐
│                         Server Layer                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Express Server                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │    │
│  │  │ Routes   │  │Middleware│  │ Services │  │ Job Worker   │ │    │
│  │  │          │  │ (Auth)   │  │          │  │              │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│    PostgreSQL     │   │   Azure OpenAI    │   │  Microsoft Graph  │
│    (Drizzle ORM)  │   │   (GPT-4o)        │   │  API              │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

### Request Flow

1. User interacts with React frontend in Teams
2. Frontend makes API calls via TanStack Query
3. Express middleware validates JWT and permissions
4. Route handler processes request
5. Service layer interacts with external APIs/database
6. Response returned to frontend

### Background Processing Flow

1. Graph webhook notifies app of meeting end
2. Meeting record created/updated in database
3. Job queued for transcript fetching
4. Job queued for AI minutes generation
5. On approval, jobs queued for email/SharePoint

---

## 4. Project Structure

```
teams-meeting-minutes/
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # React contexts (Teams, Theme)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility libraries
│   │   ├── pages/              # Page components
│   │   └── App.tsx             # Main application component
│   └── index.html
├── server/                     # Backend Express application
│   ├── middleware/             # Express middleware
│   ├── services/               # Business logic services
│   │   ├── aiService.ts        # Azure OpenAI integration
│   │   ├── graphService.ts     # Microsoft Graph API
│   │   ├── documentService.ts  # DOCX/PDF generation
│   │   └── meetingOrchestrator.ts  # Meeting processing
│   ├── routes.ts               # API route definitions
│   ├── storage.ts              # Database interface
│   ├── db.ts                   # Database connection
│   └── index.ts                # Server entry point
├── shared/                     # Shared code
│   └── schema.ts               # Database schema (Drizzle)
├── docs/                       # Documentation
├── teams-app/                  # Teams app manifest
└── package.json
```

### Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle ORM database schema definitions |
| `server/routes.ts` | All API endpoint definitions |
| `server/storage.ts` | Database abstraction layer |
| `client/src/App.tsx` | Main React component and routing |
| `client/src/contexts/TeamsContext.tsx` | Teams SDK integration |

---

## 5. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool and dev server |
| Fluent UI | 9.x | Microsoft design system |
| TanStack Query | 5.x | Data fetching and caching |
| Wouter | 3.x | Client-side routing |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x | Runtime environment |
| Express | 4.x | HTTP server framework |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | Latest | Database ORM |
| MSAL Node | 2.x | Azure AD authentication |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database |
| Drizzle ORM | Schema management and queries |
| Local PostgreSQL | Development database |
| Azure Database for PostgreSQL | Production database (Azure Commercial) |

### External Services

| Service | Purpose |
|---------|---------|
| Azure OpenAI | GPT-4o for minutes generation |
| Microsoft Graph | Teams, Calendar, SharePoint integration |
| Azure AD | Authentication and authorization |

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   users     │       │    meetings     │       │ meeting_minutes │
├─────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)     │       │ id (PK)         │       │ id (PK)         │
│ email       │       │ title           │◄──────│ meeting_id (FK) │
│ display_name│       │ start_date      │       │ summary         │
│ role        │       │ end_date        │       │ key_discussions │
│ clearance   │       │ status          │       │ decisions       │
│ tenant_id   │       │ classification  │       │ status          │
└─────────────┘       │ organizer_email │       │ approved_by     │
                      │ tenant_id       │       └─────────────────┘
                      └─────────────────┘
                              │
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────┐           ┌─────────────────────┐
│    action_items     │           │   meeting_events    │
├─────────────────────┤           ├─────────────────────┤
│ id (PK)             │           │ id (PK)             │
│ meeting_id (FK)     │           │ meeting_id (FK)     │
│ title               │           │ event_type          │
│ assignee            │           │ title               │
│ due_date            │           │ description         │
│ priority            │           │ actor_email         │
│ status              │           │ actor_name          │
└─────────────────────┘           │ metadata            │
                                  │ created_at          │
                                  └─────────────────────┘
```

### Core Tables

**meetings** - Stores meeting metadata

```typescript
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  title: varchar("title").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status").default("scheduled"),
  classification: varchar("classification").default("UNCLASSIFIED"),
  organizerEmail: varchar("organizer_email"),
  // ... additional fields
});
```

**meeting_minutes** - Stores generated minutes

```typescript
export const meetingMinutes = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  meetingId: varchar("meeting_id").references(() => meetings.id),
  summary: text("summary"),
  keyDiscussions: jsonb("key_discussions"),
  decisions: jsonb("decisions"),
  status: varchar("status").default("draft"),
  // ... additional fields
});
```

**action_items** - Stores extracted action items

```typescript
export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  meetingId: varchar("meeting_id").references(() => meetings.id),
  title: text("title").notNull(),
  assignee: varchar("assignee"),
  dueDate: timestamp("due_date"),
  priority: varchar("priority").default("medium"),
  status: varchar("status").default("pending"),
});
```

**meeting_events** - Audit trail for all actions

```typescript
export const meetingEvents = pgTable("meeting_events", {
  id: serial("id").primaryKey(),
  meetingId: varchar("meeting_id").references(() => meetings.id),
  eventType: varchar("event_type").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  actorEmail: varchar("actor_email"),
  actorName: varchar("actor_name"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Running Migrations

```bash
# Push schema changes to database
npm run db:push

# Generate migration files (if needed)
npm run db:generate

# View database in Drizzle Studio
npm run db:studio
```

---

## 7. API Reference

### Authentication

All API endpoints require authentication. In production, JWT tokens from Azure AD are validated. In development with mock services, a session cookie provides authentication.

### Meetings API

**GET /api/meetings**

Returns paginated meetings accessible to the current user with dismiss status.

Query Parameters:
- `limit` - Number of meetings per page (default: all)
- `offset` - Starting position for pagination (default: 0)
- `includeDismissed` - "true" to include dismissed meetings (default: false)
- `sort` - Sorting option: date_asc, date_desc, title_asc, title_desc, status (default: date_desc)

Response:
```json
{
  "meetings": [
    {
      "id": "uuid",
      "title": "Weekly Standup",
      "startDate": "2025-12-04T10:00:00Z",
      "endDate": "2025-12-04T10:30:00Z",
      "status": "completed",
      "classification": "UNCLASSIFIED",
      "hasMinutes": true,
      "isDismissed": false
    }
  ],
  "pagination": {
    "total": 12,
    "offset": 0,
    "limit": 5,
    "hasMore": true
  },
  "dismissedCount": 2
}
```

**POST /api/meetings/:id/dismiss**

Hides a meeting from the current user's view. Per-user dismissal is keyed by (tenantId, meetingId, userEmail) for multi-tenant isolation.

Response:
```json
{
  "success": true,
  "message": "Meeting dismissed",
  "dismissedAt": "2025-12-04T10:00:00Z"
}
```

**POST /api/meetings/:id/restore**

Restores a previously hidden meeting to the user's view.

Response:
```json
{
  "success": true,
  "message": "Meeting restored"
}
```

**GET /api/meetings/:id**

Returns a single meeting with minutes and action items.

**GET /api/meetings/:id/events**

Returns audit events for a meeting.

### Minutes API

**POST /api/meetings/:id/approve**

Approves meeting minutes. Requires Approver or Admin role.

**POST /api/meetings/:id/reject**

Rejects meeting minutes with reason.

Request:
```json
{
  "reason": "Summary needs more detail"
}
```

### Action Items API

**PATCH /api/action-items/:id/status**

Updates action item status.

Request:
```json
{
  "status": "completed"
}
```

### Document Export API

**GET /api/meetings/:id/export/docx**

Downloads meeting minutes as DOCX.

**GET /api/meetings/:id/export/pdf**

Downloads meeting minutes as PDF.

### Stats API

**GET /api/stats**

Returns dashboard statistics.

Response:
```json
{
  "totalMeetings": 42,
  "pendingMinutes": 5,
  "completedMinutes": 35,
  "archivedMeetings": 20
}
```

### Help System API

**POST /api/help/request**

Submits a support request. Includes security hardening:

- **Rate Limiting:** 5 requests per hour per user
- **Input Validation:** Length limits enforced (subject 3-200 chars, description 10-4000 chars)
- **HTML Sanitization:** All HTML tags stripped before processing
- **Category Validation:** Only allowed categories accepted

Request:
```json
{
  "subject": "Need help with action items",
  "category": "general",
  "description": "I cannot find where to update action item status..."
}
```

Allowed categories: `general`, `bug`, `feature`, `access`

Response (Success):
```json
{
  "success": true,
  "message": "Your request has been received. Our support team will respond within 24 hours.",
  "requestId": "help_1733320000000_abc123"
}
```

Response (Rate Limited - 429):
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": "45 minutes"
}
```

Response (Validation Error - 400):
```json
{
  "error": "Subject must be between 3 and 200 characters"
}
```

**Security Implementation Notes:**

The Help API implements defense-in-depth security:

1. **Authentication Gate:** Handler immediately returns 401 if `req.user` is undefined
2. **Rate Limiting:** In-memory per-user tracking with 1-hour sliding window
3. **Input Sanitization:** `stripHtml()` removes all HTML tags via regex `/<[^>]*>/g`
4. **Length Enforcement:** Subject (3-200) and description (10-4000) character limits
5. **Category Whitelist:** Invalid categories default to "general"

```typescript
// Security middleware pattern
const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').trim();
const subject = stripHtml(rawSubject).substring(0, 200);
const validCategories = ['general', 'bug', 'feature', 'access'];
const category = validCategories.includes(rawCategory) ? rawCategory : 'general';
```

---

## 8. Authentication Flow

### Teams SSO Flow

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│  Teams  │      │  App    │      │ Backend │      │Azure AD │
│ Client  │      │Frontend │      │         │      │         │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │
     │ 1. User opens  │                │                │
     │    app in Teams│                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ 2. getAuthToken│                │
     │                │    (silent)    │                │
     │                │<──────────────>│                │
     │                │                │                │
     │                │ 3. API call    │                │
     │                │    with token  │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │ 4. Validate    │
     │                │                │    JWT token   │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │                │                │
     │                │ 5. Response    │                │
     │                │<───────────────│                │
     │                │                │                │
```

### Token Validation

The backend validates tokens using:

1. JWKS (JSON Web Key Set) from Azure AD
2. Issuer validation (must match tenant)
3. Audience validation (must match app ID)
4. Expiry check

```typescript
// server/middleware/authenticateUser.ts
const validateToken = async (token: string) => {
  const decoded = jwt.decode(token, { complete: true });
  const keys = await getSigningKeys();
  const key = keys.find(k => k.kid === decoded.header.kid);
  
  return jwt.verify(token, key.publicKey, {
    algorithms: ['RS256'],
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId
  });
};
```

---

## 9. AI Integration

### Azure OpenAI Configuration

The application uses Azure OpenAI Service with GPT-4o for minutes generation.

```typescript
// server/services/aiService.ts
const openai = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  apiVersion: "2024-02-15-preview"
});
```

### Minutes Generation Prompt

The system prompt instructs GPT-4o to:

1. Extract meeting summary
2. Identify key discussions
3. List decisions made
4. Extract action items with assignees and dates

```typescript
const generateMinutes = async (transcript: string) => {
  const response = await openai.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript }
    ],
    temperature: 0.3,
    max_tokens: 4000
  });
  
  return parseMinutesResponse(response.choices[0].message.content);
};
```

### Processing Validation

Before generating minutes, the system validates:

- Transcript has minimum content (not too short)
- Meeting duration meets threshold
- Participants were present

See `docs/PROCESSING_VALIDATION.md` for detailed rules.

---

## 10. Microsoft Graph Integration

### Graph Client Setup

```typescript
// server/services/graphService.ts
const getGraphClient = (accessToken: string) => {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
};
```

### Key API Operations

**Get Calendar Events:**
```typescript
const events = await client
  .api('/me/calendar/events')
  .filter(`start/dateTime ge '${startDate}'`)
  .get();
```

**Get Call Record:**
```typescript
const callRecord = await client
  .api(`/communications/callRecords/${callId}`)
  .get();
```

**Get Transcript:**
```typescript
const transcript = await client
  .api(`/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
  .get();
```

### Webhook Subscription

```typescript
const subscription = await client
  .api('/subscriptions')
  .post({
    changeType: 'created',
    notificationUrl: `${appUrl}/webhooks/graph/callRecords`,
    resource: '/communications/callRecords',
    expirationDateTime: expiryDate,
    clientState: secretState
  });
```

---

## 11. Background Job Processing

### Job Queue Architecture

The application uses a PostgreSQL-backed job queue for reliable background processing.

```typescript
// Job table structure
export const jobQueue = pgTable("job_queue", {
  id: serial("id").primaryKey(),
  type: varchar("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status").default("pending"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastError: text("last_error"),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

### Job Types

| Type | Purpose |
|------|---------|
| `fetch_transcript` | Fetch transcript from Graph API |
| `generate_minutes` | Generate AI minutes |
| `send_email` | Distribute minutes via email |
| `archive_sharepoint` | Archive to SharePoint |

### Job Worker

The job worker runs as part of the main process (when `ENABLE_JOB_WORKER=true`):

```typescript
// server/services/jobWorker.ts
const processJobs = async () => {
  while (running) {
    const job = await claimNextJob();
    if (job) {
      try {
        await executeJob(job);
        await markCompleted(job);
      } catch (error) {
        await markFailed(job, error);
      }
    }
    await sleep(1000);
  }
};
```

---

## 12. Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   └── utils/
├── integration/
│   └── api/
└── e2e/
    └── playwright/
```

### Writing Tests

```typescript
// Example API test
describe('GET /api/meetings', () => {
  it('returns meetings for authenticated user', async () => {
    const response = await request(app)
      .get('/api/meetings')
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});
```

---

## 13. Debugging

### Development Tools

| Tool | Purpose |
|------|---------|
| VS Code | Recommended IDE |
| Drizzle Studio | Database browser |
| React DevTools | Frontend debugging |
| Network tab | API inspection |

### Logging

The application uses structured logging:

```typescript
console.log(`[Service] Operation completed`, { 
  meetingId, 
  duration: Date.now() - start 
});
```

### Common Debug Scenarios

**API returning 401:**
- Check token is present in Authorization header
- Verify token hasn't expired
- Check `USE_MOCK_SERVICES` in development

**Database errors:**
- Run `npm run db:push` to sync schema
- Check `DATABASE_URL` is correct
- Verify database is accessible

**AI not generating:**
- Check Azure OpenAI credentials
- Verify deployment name matches
- Check API rate limits

---

## 14. Deployment

### Build for Production

```bash
npm run build
```

This creates:
- `dist/` - Compiled server code
- `dist/public/` - Built frontend assets

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

### Azure Container Apps

See Installation Manual for detailed Azure deployment steps.

### Environment Variables for Production

Ensure all production environment variables are set:
- Use Azure Key Vault for secrets
- Set `NODE_ENV=production`
- Set `USE_MOCK_SERVICES=false`

---

## 15. Contributing

### Code Style

- Use TypeScript for all new code
- Follow existing patterns and conventions
- Use Fluent UI components for frontend
- Add data-testid attributes to interactive elements

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Run linting and tests locally
4. Submit PR with clear description
5. Address review feedback
6. Merge after approval

### Commit Messages

Follow conventional commits:

```
feat: add action item status tracking
fix: resolve modal display issue
docs: update API documentation
refactor: simplify job worker logic
```

---

## Appendix: Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AZURE_TENANT_ID` | Yes | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Yes | App registration client ID |
| `AZURE_CLIENT_SECRET` | Yes | App registration secret |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | GPT-4o deployment name |
| `SESSION_SECRET` | Yes | Session encryption key |
| `NODE_ENV` | No | `development` or `production` |
| `USE_MOCK_SERVICES` | No | Use mock services (dev only) |
| `ENABLE_JOB_WORKER` | No | Enable background jobs |
| `ENABLE_GRAPH_WEBHOOKS` | No | Enable Graph webhooks |
| `SHAREPOINT_SITE_URL` | No | SharePoint site for archival |
| `SHAREPOINT_LIBRARY` | No | SharePoint document library |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 4, 2025 | System | Initial release |

---

*This document is confidential and intended for authorized developers only.*
