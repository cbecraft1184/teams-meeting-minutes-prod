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
- Utilizes Microsoft Graph v1.0 for real-time meeting capture via single `/communications/callRecords` webhook (48-hour expiry, 12-hour renewal). Meeting scheduling is detected via calendar delta sync to reduce Graph API load. Authentication uses Azure AD OAuth with token caching.

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

### December 2, 2025 - Optimized Architecture (COMPLETED ✓)

**Enhancement:** Architecture optimized for maximum efficiency without sacrificing features.

**Key Changes:**
1. **Lease-Based Job Worker** (replaces PostgreSQL advisory locks):
   - Uses `job_worker_leases` table for distributed locking without superuser privileges
   - Atomic INSERT...ON CONFLICT with confirmatory SELECT for lease acquisition
   - Automatic lease expiration (15s) with heartbeat every 5s
   - Works with Azure Container Apps horizontal scaling

2. **Single Webhook Pattern** (callRecords only):
   - Uses ONLY `/communications/callRecords` for meeting completion detection
   - Meeting scheduling handled via calendar delta sync (reduces Graph API load)
   - Eliminated duplicate notifications from dual-subscription pattern

3. **Unified Durable Queue** (all background work):
   - All enrichment, AI generation, email, SharePoint jobs flow through durableQueue
   - No in-memory queues - ensures crash recovery
   - Lease-backed worker governs all background processing

**Key Files:**
- `server/services/jobWorker.ts` - Lease-based distributed worker
- `server/services/graphSubscriptionManager.ts` - Single callRecords subscription
- `server/services/callRecordEnrichment.ts` - Uses durable queue for retries
- `server/services/durableQueue.ts` - PostgreSQL-backed job queue
- `shared/schema.ts` - Includes job_worker_leases table

**Webhook Endpoint:**
- Call Records: `/webhooks/graph/callRecords` (meeting completion only)

**Meeting Lifecycle Flow:**
1. User schedules Teams meeting → Calendar sync detects scheduling
2. Meeting occurs with transcription enabled
3. Meeting ends → callRecords webhook → Enrichment job enqueued (durableQueue)
4. Lease-based worker processes job → Transcript fetched → AI minutes generated
5. Approval workflow → Email distribution → SharePoint archival

### November 29, 2025 - Full Meeting Lifecycle Tracking (SUPERSEDED)

**Note:** Architecture updated December 2, 2025. See above for current design.

### December 1, 2025 - DOD/Commercial Processing Validation (COMPLETED ✓)

**Enhancement:** Processing validation prevents unnecessary AI costs for accidental meeting opens and empty transcripts.

**Features Added:**
1. **Processing Thresholds** (applies to both DOD and Commercial):
   - Minimum duration: 5 minutes (filters accidental meeting opens)
   - Minimum transcript content: 50 words (filters empty/minimal transcripts)
   - Transcript availability check (requires transcription enabled)

2. **Audit Trail Fields** (in meetings table):
   - `actualDurationSeconds` - Actual call duration from Graph call record
   - `transcriptWordCount` - Word count in transcript content
   - `processingDecision` - Decision type (processed, skipped_duration, skipped_content, etc.)
   - `processingDecisionReason` - Human-readable explanation
   - `processingDecisionAt` - Timestamp of decision

3. **Admin Override API** (for manually triggering skipped meetings):
   - `POST /api/admin/meetings/:id/force-process` - Manual processing with audit trail
   - `GET /api/admin/meetings/:id/processing-status` - View validation details

**Key Files:**
- `server/services/processingValidation.ts` - Threshold validation logic
- `server/services/callRecordEnrichment.ts` - Integrated validation into enrichment
- `server/routes/webhooks.ts` - Admin override endpoints
- `docs/DOD_PROCESSING_VALIDATION.md` - Full documentation

**Processing Decision Values:**
- `pending` - Validation not yet performed
- `processed` - Met all thresholds, AI processing completed
- `skipped_duration` - Duration below 5 minutes
- `skipped_content` - Transcript under 50 words
- `skipped_no_transcript` - No transcript available
- `manual_override` - Admin manually triggered despite thresholds

### December 2, 2025 - Production Deployment (COMPLETED ✓)

**Enhancement:** Successfully deployed to Azure Container Apps via GitHub Actions.

**Deployment Details:**
- **Production URL**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
- **Container Registry**: teamminutesacr.azurecr.io
- **Resource Group**: rg-teams-minutes-demo
- **Region**: East US 2

**Lessons Learned (Deployment Checklist Created):**
1. Service principal requires Contributor role on Azure subscription
2. GitHub Actions expects `AZURE_CREDENTIALS` as single JSON secret
3. Never commit credentials to git - use `.gitignore` patterns
4. See `docs/DEPLOYMENT_CHECKLIST.md` for complete requirements

**Azure App Registration:**
- Name: Teams Minutes Graph API
- Client ID: 71383692-c5c6-40cc-94cf-96c97fed146c
- Tenant ID: e4be879d-b4b5-4eb7-bdb8-70b31519d985

**GitHub Secrets Required:**
- `AZURE_CREDENTIALS` - JSON with clientId, clientSecret, subscriptionId, tenantId