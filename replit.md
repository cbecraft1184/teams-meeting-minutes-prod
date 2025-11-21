# Teams Meeting Minutes - Demo Pilot System

## Overview

An AI-powered Microsoft Teams meeting minutes management system for demonstration pilots. The application automatically captures Teams meetings via webhooks, generates AI-powered meeting minutes using Azure OpenAI, and manages approval workflow with SharePoint archival.

**Current Use:** Two separate 20-user demo pilots (Commercial + NAVY ERP)

**Key Capabilities:**
- Automatic Teams meeting capture via Microsoft Graph webhooks
- AI-powered minutes generation (Azure OpenAI GPT-4o + Whisper)
- Review and approval workflow
- Document export (DOCX/PDF)
- Email distribution and SharePoint archival
- Durable job queue for reliable background processing

## User Preferences

- Simple, everyday language
- Demo-focused scope (not production-scale)
- Clear separation between commercial and NAVY demos
- Iterative development with small updates

## Demo Pilots

### Commercial Demo (`commercial_demo/`)
- **Target:** Commercial enterprises
- **Users:** 20 maximum
- **Duration:** 4-6 weeks
- **Environment:** Azure Commercial (East US)
- **Documentation:** commercial_demo/README.md

### NAVY ERP Demo (`navy_demo/`)
- **Target:** NAVY ERP personnel
- **Users:** 20 maximum
- **Duration:** 4-6 weeks
- **Tenant:** ABC123987.onmicrosoft.com
- **Environment:** Azure Commercial (East US) - Demo only
- **Documentation:** navy_demo/README.md

## System Architecture

### Frontend
- **Framework**: React + TypeScript, Vite
- **UI Components**: Radix UI + Shadcn UI (New York style)
- **Styling**: Tailwind CSS with light/dark theme support
- **State Management**: TanStack Query for server state
- **Routing**: Wouter (lightweight client-side routing)
- **Key Pages**: Dashboard, Meetings list, Archive search

**Design Decision**: Radix UI + Shadcn UI provides accessible, composable components. TanStack Query handles automatic background refetching and cache invalidation for real-time meeting updates.

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API (`/api/*` prefix)
- **Authentication**: 
  - Production: Azure AD JWT validation via MSAL
  - Development: Mock users (`config/mockUsers.json`)
- **Job Processing**: PostgreSQL-backed durable queue with retry and crash recovery
- **Middleware**: JSON parsing, logging, authentication, webhook validation

**Design Decision**: Express for simplicity and Azure compatibility. PostgreSQL queue eliminates external message broker dependency while providing ACID guarantees. Dual authentication mode supports both production and local development.

### Data Storage
- **Database**: PostgreSQL (Neon serverless for development)
- **ORM**: Drizzle ORM with TypeScript schemas
- **Core Tables**:
  - `meetings`: Meeting metadata and status
  - `meeting_minutes`: AI-generated minutes with approval workflow
  - `action_items`: Extracted action items with assignments
  - `job_queue`: Background job processing with idempotency
  - `graph_webhook_subscriptions`: Microsoft Graph webhook lifecycle
  - `user_group_cache`: Cached Azure AD groups (15-min TTL)

**Design Decision**: Drizzle ORM for zero-runtime overhead and PostgreSQL feature support. Database-backed job queue provides transactional guarantees without external dependencies.

### Microsoft Graph Integration
- **API Version**: Microsoft Graph v1.0
- **Primary Resources**:
  - `/communications/onlineMeetings` - Meeting metadata
  - `/communications/callRecords` - Recordings and transcripts
  - `/users/{userId}/memberOf` - Azure AD groups
  - `/sites/{siteId}/drive` - SharePoint upload
- **Webhooks**: 48-hour subscriptions with 12-hour renewal
- **Authentication**: Azure AD OAuth with token caching

**Design Decision**: Webhook subscriptions provide real-time meeting capture without polling. Background renewal prevents subscription expiration.

### AI Integration
- **Primary**: Azure OpenAI Service
  - GPT-4o for minutes generation
  - Whisper for transcription
- **Fallback**: Replit AI (development only)
- **Processing Pipeline**:
  1. Extract transcript from callRecord
  2. Generate structured minutes (summary, discussions, decisions)
  3. Extract action items with assignments
  4. Retry logic with exponential backoff

**Design Decision**: Azure OpenAI for commercial use. Replit AI fallback enables local development without Azure credentials.

### Background Job System
- **Queue**: PostgreSQL `job_queue` table
- **Job Types**:
  - `enrich_meeting`: Fetch recordings/transcripts
  - `generate_minutes`: AI processing
  - `send_email`: Distribution
  - `upload_sharepoint`: Archival
- **Features**:
  - Idempotency via unique keys
  - Automatic retry (max 3 attempts)
  - Crash recovery on server restart
  - Dead-letter queue for failed jobs

**Design Decision**: PostgreSQL queue eliminates external dependencies and provides transactional guarantees. Idempotency prevents duplicate processing if webhook delivers twice.

### Document Generation
- **Formats**: DOCX (editable) and PDF (archival)
- **Libraries**: `docx` for DOCX, `pdf-lib` for PDF
- **Content Structure**:
  - Title page with meeting details
  - Attendee list
  - Agenda/discussion points
  - Decisions and action items
  - Generated timestamp

**Design Decision**: Both formats serve different purposes - DOCX for collaborative editing, PDF for immutable archival.

## Development Environment

### Local Development
- Replit with hot-reload (Vite HMR)
- Mock authentication (no Azure AD required)
- In-memory or Neon PostgreSQL database
- Replit AI for minutes generation (no Azure OpenAI needed)

### Demo Deployment
- Azure Commercial Cloud (East US)
- Azure App Service (Basic tier)
- Azure Database for PostgreSQL (Basic tier)
- Azure OpenAI Service
- Application Insights for monitoring

**Cost**: ~$150-200/month per demo environment

## External Dependencies

### Microsoft Services
- **Microsoft 365**: Teams, SharePoint, Exchange
- **Azure Active Directory**: Authentication and authorization
- **Microsoft Graph API**: Teams integration, user data, SharePoint access

### Azure Services
- **Azure OpenAI**: GPT-4o and Whisper models
- **Azure App Service**: Application hosting
- **Azure Database for PostgreSQL**: Data persistence
- **Application Insights**: Monitoring and logging

### Third-Party Libraries
- **Frontend**: React, Wouter, Shadcn UI, Tailwind CSS, TanStack Query
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client
- **AI**: OpenAI SDK (Azure + Replit compatible)
- **Documents**: docx, pdf-lib
- **Utilities**: date-fns, zod, nanoid

## Security (Demo Environment)

- **Authentication**: Azure AD OAuth 2.0
- **Transport**: HTTPS/TLS 1.2+
- **Data**: Encryption at rest (Azure default)
- **Access**: Azure AD group-based permissions
- **Isolation**: Demo data only, no production integration

**Note**: Demo environments use standard Azure security. Production deployment would require additional compliance certifications (SOC 2 for commercial, ATO for NAVY).

## Recent Changes

- **November 2025 (Task 4)**: Added strict schema validation for all database writes (COMPLETED ✓)
  - **Validation Coverage**: All CRUD operations validated before database writes
    - Meeting endpoints: POST /api/meetings, PATCH /api/meetings/:id
    - Minutes endpoints: PATCH /api/minutes/:id
    - Action items: POST /api/action-items, PATCH /api/action-items/:id
    - Internal services: minutesGenerator.ts (both success and failure paths)
  - **Schema Rules**:
    - Meetings: Email validation, 1-500 attendees, title 1-500 chars, duration regex
    - Minutes: Summary 1-5000 chars, 1-500 attendees, max 100 discussions/decisions
    - Action Items: Task 1-1000 chars, assignee email or "Unassigned", future dates only
  - **Key Fixes** (multiple architect iterations):
    - Added validation to PATCH endpoints using .partial() schemas
    - Fixed minutesGenerator failure path to use schema-compliant placeholders
    - Implemented proper date coercion using z.union() for JSON ISO strings
    - All validation bypasses eliminated - zero unvalidated database writes
  - **Error Handling**: 400 responses with detailed field-level Zod error messages
- **November 2025 (Task 3)**: Implemented transactional outbox pattern for exactly-once delivery
  - Zero duplicates, zero message loss, crash-safe with exponential backoff (1m→5m→15m)
  - Production-grade reliability tested and verified
- **November 2025 (Tasks 1-2)**: Security hardening and database cleanup
  - Eliminated plaintext secret logging
  - Added TTL and 2AM cleanup scheduler for conversation references
- **November 2025**: Documentation restructured for demo pilots
- All old production-scale documentation removed
- Created separate folders for commercial and NAVY demos
- Updated scope to reflect 20-user pilots
- Removed ATO/FedRAMP/enterprise references

---

**For detailed demo-specific information, see:**
- Commercial Demo: `commercial_demo/README.md`
- NAVY ERP Demo: `navy_demo/README.md`
