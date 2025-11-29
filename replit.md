# Teams Meeting Minutes - AI-Powered System

## Overview

This project delivers an AI-powered Microsoft Teams meeting minutes management system designed for deployment on Azure Commercial with full Microsoft 365 integration. Its primary purpose is to automate and streamline the process of capturing, generating, reviewing, and distributing meeting minutes.

Key capabilities include:
- Automatic meeting capture using Microsoft Graph webhooks.
- AI-driven minutes generation leveraging Azure OpenAI's GPT-4o and Whisper.
- A configurable review and approval workflow.
- Document export in DOCX and PDF formats.
- Automated email distribution and SharePoint archival.
- A durable job queue ensures reliable background processing.

The system aims to enhance productivity within Microsoft 365 environments by providing an efficient, integrated solution for meeting management.

## User Preferences

- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## System Architecture

The system is built as a full-stack application with a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence.

### Frontend
- **Framework**: React + TypeScript with Vite.
- **UI Components**: Fluent UI React Components for native Teams look and feel, supporting light/dark/high contrast themes.
- **State Management**: TanStack Query for efficient server state handling.
- **Routing**: Wouter for lightweight client-side navigation.

### Backend
- **Runtime**: Node.js + Express (TypeScript, ESM modules) providing a RESTful JSON API.
- **Authentication**: Azure AD JWT validation via MSAL for production, with mock users for development.
- **Job Processing**: A PostgreSQL-backed durable queue handles background jobs with retry, crash recovery, and idempotency.

### Data Storage
- **Database**: PostgreSQL (Neon serverless for development, Azure Database for PostgreSQL for production).
- **ORM**: Drizzle ORM with TypeScript schemas for robust data management across 12 core tables including `meetings`, `meeting_minutes`, `action_items`, and `job_queue`.

### Microsoft Graph Integration
- Utilizes Microsoft Graph v1.0 for real-time meeting capture via 48-hour webhooks (with 12-hour renewal), accessing resources like `/communications/onlineMeetings` and `/sites/{siteId}/drive`. Authentication uses Azure AD OAuth with token caching.

### AI Integration
- Leverages Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription) as the primary AI provider, with Replit AI as a development fallback. The pipeline extracts transcripts, generates structured minutes, and identifies action items.

### Background Job System
- A PostgreSQL `job_queue` table manages durable background tasks such as `enrich_meeting`, `generate_minutes`, `send_email`, and `upload_sharepoint`, ensuring idempotency, automatic retries, and crash recovery.

### Document Generation
- Supports DOCX (editable) using `docx` and PDF (archival) using `pdf-lib`, structuring content with title pages, attendees, agenda, decisions, and action items.

## External Dependencies

### Microsoft Services
- **Microsoft 365**: Teams, SharePoint, Exchange for core integration.
- **Azure Active Directory**: For authentication and authorization.
- **Microsoft Graph API**: Enables deep integration with Teams, user data, and SharePoint.

### Azure Services
- **Azure OpenAI**: Provides AI capabilities (GPT-4o, Whisper).
- **Azure Container Apps**: Hosts the application with auto-scaling.
- **Azure Container Registry**: Stores container images.
- **Azure Database for PostgreSQL**: Provides managed database services.
- **Application Insights**: For monitoring and logging.

### Third-Party Libraries
- **Frontend**: React, Wouter, Fluent UI React Components, TanStack Query.
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client.
- **AI**: OpenAI SDK.
- **Documents**: `docx`, `pdf-lib`.

## Recent Changes

### November 29, 2025 - Full Meeting Lifecycle Tracking (COMPLETED ✓)

**Enhancement:** Dual webhook subscriptions now track meetings from scheduling through archival.

**Features Added:**
1. **Dual Webhook Subscriptions**: System creates two Graph API subscriptions:
   - `/communications/callRecords` - Detects when meetings END (triggers transcript fetch)
   - `/communications/onlineMeetings` - Detects when meetings are SCHEDULED (early tracking)
2. **Calendar Sync Service**: `calendarSyncService.ts` syncs existing scheduled meetings on startup
3. **Exponential Backoff**: Transcript fetch retries at 5, 15, 45 minute intervals (Graph API eventual consistency)
4. **POST Validation Handling**: Both webhook handlers support validation token in POST requests

**Key Files:**
- `server/services/graphSubscriptionManager.ts` - Dual subscription creation with retry logic
- `server/routes/webhooks.ts` - Handlers for both callRecords and onlineMeetings
- `server/services/calendarSyncService.ts` - Manual calendar sync capability
- `server/services/callRecordEnrichment.ts` - Exponential backoff for transcript fetching
- `docs/END_TO_END_TEST_PLAN.md` - Comprehensive test documentation

**Webhook Endpoints:**
- Call Records: `/webhooks/graph/callRecords` (meeting completion)
- Online Meetings: `/webhooks/graph/teams/meetings` (meeting scheduling)

**Meeting Lifecycle Flow:**
1. User schedules Teams meeting → onlineMeetings webhook → Meeting created in DB (status: scheduled)
2. Meeting occurs with transcription enabled
3. Meeting ends → callRecords webhook → Enrichment job queued
4. Transcript fetched (with retry backoff) → AI minutes generated
5. Approval workflow → Email distribution → SharePoint archival