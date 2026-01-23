# Teams Meeting Minutes - AI-Powered System

## Overview
This project delivers an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial, deeply integrated with Microsoft 365. Its primary purpose is to automate and streamline the capture, generation, review, and distribution of meeting minutes. Key capabilities include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, SharePoint archival, and per-user meeting visibility management. The system enhances productivity within Microsoft 365 environments by automating the meeting documentation process and supports multi-session meetings by creating separate records and minutes linked to a canonical parent meeting.

## User Preferences
- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## System Architecture
The system is a full-stack application featuring a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence, designed for scalability and integration within the Microsoft ecosystem.

### UI/UX Decisions
The frontend utilizes React with Fluent UI React Components to offer a native Microsoft Teams look and feel, ensuring a consistent user experience. Organizations can upload custom logos for document branding, which are then embedded in DOCX and PDF exports.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, using TanStack Query for state management and Wouter for routing.
- **Backend**: Node.js + Express (TypeScript, ESM) with Azure AD JWT validation via MSAL for authentication. A PostgreSQL-backed durable queue manages background jobs.
- **Data Storage**: PostgreSQL (Neon for development, Azure Database for PostgreSQL for production) managed by Drizzle ORM, with a schema supporting `meetings`, `meeting_minutes`, `action_items`, and `job_queue`.
- **Microsoft Graph Integration**: Uses Microsoft Graph v1.0 for real-time meeting completion capture via webhooks, calendar delta sync, and transcript access, including specific handling for multi-session meetings and organizer ID retrieval.
- **AI Integration**: Leverages Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription) for processing transcripts, generating structured minutes, and identifying action items.
- **Document Generation**: Supports DOCX (using `docx`) and PDF (using `pdf-lib`) formats for exporting minutes.

### System Design Choices
- **Authentication**: Azure AD JWT validation with MSAL for secure token handling.
- **Job Processing**: A resilient, distributed job queue ensures reliable handling of background tasks.
- **Multi-Session Support**: Implements a parent/child architecture in the database, linking distinct meeting sessions to a canonical parent meeting.
- **Processing Thresholds**: All meeting duration or word count thresholds have been removed to ensure all meetings with transcripts are processed. An admin reprocess endpoint (`POST /api/admin/meetings/:id/reprocess`) allows regeneration of minutes.
- **Action Item Permissions**: Action items can only be updated by the assigned person, meeting organizer, or admin users. A schema change added `assignee_email` to the `action_items` table to support this model.
- **Speaker Identification**: Speaker names are extracted directly from WebVTT transcript format and matched to attendee emails using normalized string comparison and token matching.
- **Multi-Tenant Isolation**: All major tables (`meetings`, `meeting_minutes`, `action_items`, `job_queue`) include `tenant_id` columns with indexes for efficient filtering and endpoint-level enforcement.
- **Share Links (Org-Internal)**: Users can create secure, organization-internal share links for archived meetings with features like tenant isolation, configurable expiration, revocation support, and comprehensive audit logging.
- **SharePoint Archival Tracking**: The `meeting_minutes` table tracks `archival_status`, `archival_error`, `archived_at`, and `archival_attempts`.
- **Admin Job Queue Management**: Administrators can monitor and manage failed background jobs via API endpoints for statistics, listing, details, and retrying.

## External Dependencies

### Microsoft Services
- **Microsoft 365**: Teams, SharePoint, Exchange.
- **Azure Active Directory**: For authentication and authorization.
- **Microsoft Graph API**: For integration with Teams, user data, calendar, call records, SharePoint, and sending emails.

### Azure Services
- **Azure OpenAI**: Provides AI capabilities (GPT-4o, Whisper).
- **Azure Container Apps**: For hosting and auto-scaling.
- **Azure Container Registry**: For Docker image storage.
- **Azure Database for PostgreSQL**: Managed database service.
- **Application Insights**: For monitoring and logging.
- **Google Cloud Storage (GCS)**: For logo persistence.

### Third-Party Libraries
- **Frontend**: React, Wouter, Fluent UI React Components, TanStack Query.
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client.
- **AI**: OpenAI SDK.
- **Documents**: `docx`, `pdf-lib`.

## Production Bug Fixes (December 2025 - January 2026)

### Security Critical
1. **Teams Bot Tenant Isolation** (`teamsBot.ts`): Messaging extension query now filters by `tenantId` to prevent cross-tenant data leakage. Extracts tenant from `channelData.tenant.id` or `conversation.tenantId`.
2. **Restore Endpoint Auth Bypass** (`routes.ts`): Added `canViewMeeting()` check to `/api/meetings/:id/restore` to prevent users from restoring meetings they cannot access.
3. **Stats Endpoint Tenant Isolation** (`routes.ts`): CRITICAL FIX (Jan 2026) - `/api/stats` endpoint was calling `storage.getAllMeetings()` without tenant filtering, exposing cross-tenant meeting counts. Now properly filters by user's tenant using `getMeetingsByTenant()`, `getMinutesByTenant()`, and new `getActionItemsByTenant()` methods.

### Reliability Improvements  
3. **Rate Limit Detection** (`azureOpenAI.ts`): `isRateLimitError()` now checks `error.status` and `error.response.status` fields for Azure SDK 429 responses, not just message strings.
4. **Transient Error Retry** (`azureOpenAI.ts`): p-retry catch blocks now use `isClientError()` helper - only abort on 4xx (except 429), allow retries for 5xx/network/JSON parse failures.
5. **Graceful Shutdown** (`index.ts`): Added proper `gracefulShutdown()` function that closes HTTP server and database pool to prevent resource leaks. Also added `.catch()` on startup promise.
6. **Storage Not-Found Guards** (`storage.ts`): `updateShareLink()` and `retryJob()` now throw errors when ID not found, preventing undefined returns.

### Data Integrity
7. **AssigneeEmail Persistence** (`minutesGenerator.ts`): Action items now include `assigneeEmail` field for downstream permission checks.
8. **Attendee Content Comparison** (`minutesGenerator.ts`): `hasAttendeesChanged` logic now compares actual names, not just array length, to detect when attendee list content changes.
9. **Transaction Wrapping** (`minutesGenerator.ts`): All DB operations (meeting update, minutes insert, action items insert, status update) are now wrapped in a single `db.transaction()` for atomicity - if any operation fails, all changes are rolled back.

### Database Schema Fixes (January 2026)
10. **Multi-Session Meeting ID Conflict** (`sync-prod-schema.sql`): CRITICAL FIX - Dropped unique index `meetings_online_meeting_id_canonical_idx` that prevented multi-session meetings from sharing the same `online_meeting_id`. Multi-session meetings (recurring Teams meetings) legitimately share the same Teams meeting ID across multiple database records. The sync script now includes `DROP INDEX IF EXISTS meetings_online_meeting_id_canonical_idx` to prevent this issue on fresh deployments.

## Debugging Lessons Learned
- **attendeesPresent format**: Always `{name, email}[]` - map to `.name` before `.join()` for display
- **API path matching**: Use `req.originalUrl` for auth bypass checks under `/api/*` mount paths
- **AI response validation**: Always use `Array.isArray()` before array operations on AI-generated data
- **Azure SDK errors**: Check `error.status` for HTTP status codes, not just string parsing

## Documentation (December 30, 2025)

### Key Documents
- **docs/DEMO_USER_SETUP_GUIDE.md**: Internal tenant member setup for demos (replaces old B2B guest guide)
- **docs/TEST_EXECUTION_RESULTS.md**: Production test results (100% pass rate, 18/18 tests on 3 meetings)
- **docs/END_TO_END_TEST_PLAN.md**: Complete E2E test plan (updated to match actual implementation)
- **docs/EMAIL_ARCHIVE_FINAL_REPORT.md**: Email/SharePoint feature verification (PRODUCTION VERIFIED)
- **docs/ARCHITECTURE.md**: System architecture overview
- **docs/PROCESSING_VALIDATION.md**: Processing thresholds (2 min duration, 25 words minimum)
- **docs/DEPLOYMENT_CHECKLIST.md**: Azure deployment procedures
- **docs/TEAMS_SSO_CHECKLIST.md**: Teams SSO configuration

### Job Queue Types (Actual Implementation)
- `process_call_record`: Handle call record webhook notifications
- `enrich_meeting`: Fetch transcript and attendee data from Graph
- `generate_minutes`: AI processing with Azure OpenAI GPT-4o
- `send_email`: Email distribution via Graph API
- `upload_sharepoint`: Document archival to SharePoint
- `sync_azure_groups`: Azure AD group synchronization

### Reference Information
- **App ID**: 6d94baf3-1ed6-4d34-8401-71c724305571
- **App Version**: 1.0.24
- **Tenant Domain**: ChrisBecraft.onmicrosoft.com
- **Production URL**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io

### Demo User Setup
Demo participants should be set up as **internal tenant members** (not B2B guests) with Microsoft 365 Business Basic licenses for full Teams app access. See `docs/DEMO_USER_SETUP_GUIDE.md` for detailed instructions.