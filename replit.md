# Teams Meeting Minutes - AI-Powered System

## Overview

This project delivers an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial with full Microsoft 365 integration. Its primary purpose is to automate and streamline the process of capturing, generating, reviewing, and distributing meeting minutes. Key capabilities include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, SharePoint archival, and per-user meeting visibility management with pagination. The system aims to enhance productivity within Microsoft 365 environments.

## User Preferences

- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## System Architecture

The system is a full-stack application featuring a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence.

### Frontend
- **Framework**: React + TypeScript with Vite.
- **UI Components**: Fluent UI React Components for native Teams look and feel.
- **State Management**: TanStack Query.
- **Routing**: Wouter.

### Backend
- **Runtime**: Node.js + Express (TypeScript, ESM).
- **Authentication**: Azure AD JWT validation via MSAL; mock users for development.
- **Job Processing**: A PostgreSQL-backed durable queue handles background jobs with retry, crash recovery, and idempotency, using a lease-based worker for distributed locking.

### Data Storage
- **Database**: PostgreSQL (Neon for dev, Azure Database for PostgreSQL for prod).
- **ORM**: Drizzle ORM with TypeScript schemas across 12 core tables (e.g., `meetings`, `meeting_minutes`, `action_items`, `job_queue`).

### Microsoft Graph Integration
- Utilizes Microsoft Graph v1.0 for real-time meeting completion capture via a single `/communications/callRecords` webhook. Meeting scheduling is detected via calendar delta sync.

### AI Integration
- Leverages Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription) as the primary AI provider, with Replit AI as a development fallback. The pipeline extracts transcripts, generates structured minutes, and identifies action items, with processing validation to prevent unnecessary AI costs.

### Document Generation
- Supports DOCX (using `docx`) and PDF (using `pdf-lib`) formats for structured minutes output.

## Testing and Quality Assurance

**CRITICAL: All features must be tested before deployment recommendations.**

- **Test Documentation**: See `docs/TESTING.md` for comprehensive test cases and checklists
- **Pre-Deployment Gate**: No deployment without completing smoke test checklist
- **Regression Prevention**: CSS/layout changes require visual verification in browser

### Required Pre-Deployment Checks
1. Run end-to-end tests on all modal tabs (Overview, Minutes, Action Items, Attachments, History)
2. Verify modal opens correctly (not blank/collapsed)
3. Test all interactive elements (buttons, dropdowns, forms)
4. Capture test evidence (screenshots/logs)
5. Document any known issues with waivers

### Key Test Areas
- Meeting Details Modal display and all tabs
- Action item status changes and event logging
- Document export (DOCX/PDF)
- History/Timeline event display
- Authentication and access control
- Help System search and Contact Support form

## External Dependencies

### Microsoft Services
- **Microsoft 365**: Teams, SharePoint, Exchange.
- **Azure Active Directory**: For authentication and authorization.
- **Microsoft Graph API**: For integration with Teams, user data, and SharePoint.

### Azure Services
- **Azure OpenAI**: Provides AI capabilities (GPT-4o, Whisper).
- **Azure Container Apps**: For application hosting and auto-scaling.
- **Azure Container Registry**: For container image storage.
- **Azure Database for PostgreSQL**: For managed database services.
- **Application Insights**: For monitoring and logging.

### Third-Party Libraries
- **Frontend**: React, Wouter, Fluent UI React Components, TanStack Query.
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client.
- **AI**: OpenAI SDK.
- **Documents**: `docx`, `pdf-lib`.

## Recent Changes (December 2025)

### Security Improvements
- **Token Validation**: Replaced deprecated `decodeToken()` with `validateAccessToken()` for secure JWT signature verification in all authentication middleware
- **Secrets Management**: Moved sensitive credentials (AZURE_OPENAI_API_KEY, WEBHOOK_VALIDATION_SECRET) to Azure Container App encrypted secrets

### Bug Fixes
- **Job Worker Scanning**: Fixed `scanForEndedMeetings()` to correctly filter by `enrichmentStatus` instead of `transcriptUrl`, preventing repeated job enqueue attempts for already-enriched meetings
- **Job Queue Logging**: Silenced verbose "Job already exists" logs that were cluttering production logs; these are expected idempotency checks
- **Meeting Enrichment Logic**: Updated job enqueue to only log when jobs are actually created (not duplicates)

### Database Schema
- Added missing columns to `document_templates`: `is_system`, `config`, `created_at`, `updated_at`
- Added missing columns to `meeting_events`: title, description, actor fields, metadata, `occurred_at`
- Created `meeting_event_type` enum with proper values
- All 16 database tables verified with correct schema alignment

### Processing Thresholds Removed (December 10, 2025)
- **ALL THRESHOLDS REMOVED**: No longer skip meetings based on duration or word count
- Every meeting with a transcript is processed, regardless of how short
- `MIN_DURATION_SECONDS` set to 0 (was 120 seconds)
- `MIN_TRANSCRIPT_WORDS` set to 0 (was 25 words)
- No minimum transcript length in minutesGenerator (removed 50-char check)
- Only requirement: transcript must exist (can't generate minutes from nothing)
- Fixed TypeScript type errors in meetingOrchestrator.ts (minutes property was array, should be single object)
- **Admin Reprocess Endpoint**: `POST /api/admin/meetings/:id/reprocess` - Deletes existing minutes and regenerates them for any meeting with a transcript. Requires admin role.

### Multi-Session Meeting Support
- When a call record comes in for a meeting that already has a callRecordId, the system creates a NEW meeting record
- Each session gets a unique ID with title like "Meeting Name (Session 2)"
- Session number is calculated based on existing sessions with same teamsJoinLink or iCalUid
- One-to-one relationship: each meeting record has exactly one minutes record

### Graph API Transcript Access Fix (December 10, 2025)
- **CRITICAL FIX**: Changed transcript/recording endpoints from unsupported `/communications/onlineMeetings/{id}/transcripts` to correct `/users/{organizerId}/onlineMeetings/{meetingId}/transcripts`
- **Organizer ID**: Now fetches organizer ID from callRecord and persists to `organizer_aad_id` column for reuse
- **Error Handling**: Graceful handling of missing recordings/transcripts with proper logging
- **Application Access Policy**: Created Teams Application Access Policy (`MeetingMinutesPolicy`) to grant app access to meeting transcripts/recordings
  - PowerShell commands used:
    ```powershell
    New-CsApplicationAccessPolicy -Identity "MeetingMinutesPolicy" -AppIds "71383692-c5c6-40cc-94cf-96c97fed146c" -Description "Allow Meeting Minutes app to access transcripts"
    Grant-CsApplicationAccessPolicy -PolicyName "MeetingMinutesPolicy" -Global
    ```
- **Meeting ID Format**: Direct endpoint uses URL-encoded thread ID (`19:meeting_xxx@thread.v2`), but Graph API requires base64-encoded format for some endpoints
- **getAllTranscripts Fallback**: Implemented fallback using `/users/{organizerId}/onlineMeetings/getAllTranscripts(meetingOrganizerUserId='{organizerId}')` endpoint when direct endpoint fails with Bad Request
- **VTT Text Response Handling**: Fixed Graph client to return text (not JSON) for transcript content URLs - detects `text/vtt` content type or `/content` URL pattern

### Production Status (December 6, 2025)
- **Authentication**: Multi-tenant JWT validation working correctly
- **Calendar Sync**: OBO flow and Graph API integration functional
- **Job Worker**: Lease-based distributed locking operational
- **Health Check**: Production endpoint returns 200 OK

### Email & SharePoint Testing (December 7, 2025)
- **SharePoint Client Fix**: Replaced Replit connector token acquisition with Azure MSAL client credentials flow for production compatibility
- **E2E Test Plans**: Created comprehensive test documentation for Email Distribution and SharePoint Archive
- **Code Review**: Completed 3x review of email and archive services, documented findings
- **Documentation Created**:
  - `docs/EMAIL_ARCHIVE_E2E_TEST_PLAN.md` - 16 test cases covering all scenarios
  - `docs/AZURE_E2E_TEST_EXECUTION.md` - Step-by-step Azure testing instructions
  - `docs/CODE_REVIEW_FINDINGS.md` - Security and production readiness review
  - `docs/EMAIL_ARCHIVE_FINAL_REPORT.md` - Final approval package for deployment

### Email Distribution Configuration
- Uses Microsoft Graph `/users/{sender}/sendMail` endpoint
- Requires `GRAPH_SENDER_EMAIL` environment variable (must be a licensed mailbox)
- Requires `Mail.Send` Azure AD application permission with admin consent
- Sends DOCX and PDF attachments to all meeting attendees

### SharePoint Archive Configuration
- Uses Microsoft Graph `/drives/{driveId}/root:/{path}:/content` for upload
- Requires `SHAREPOINT_SITE_URL` and `SHAREPOINT_LIBRARY` environment variables
- Requires `Sites.ReadWrite.All` or `Sites.Selected` Azure AD permission
- Creates folder structure: `YYYY/MM-Month/Classification/`
- Sets custom metadata columns: Classification, MeetingDate, AttendeeCount, MeetingID

## Azure CLI Access from Replit

**IMPORTANT**: To use Azure CLI from Replit, use device code authentication:

1. Run: `az login --use-device-code`
2. A code will be displayed (e.g., `EHML6JR5G`)
3. Go to https://microsoft.com/devicelogin
4. Enter the code and authenticate with Azure credentials
5. Return to Replit - the CLI will be authenticated

**Production Resources**:
- **Container App**: `teams-minutes-app` in `rg-teams-minutes`
- **Database**: `teams-minutes-db.postgres.database.azure.com`
- **Container Registry**: `crteamsminutes.azurecr.io`
- **Subscription ID**: `17f080ac-db85-4c7d-a12e-fc88bf22b2bc`

**Deployment Commands**:
```bash
# Build and push container
az acr build --registry crteamsminutes --image teams-minutes:latest .

# Update Container App
az containerapp update --name teams-minutes-app --resource-group rg-teams-minutes --image crteamsminutes.azurecr.io/teams-minutes:latest
```

**Alternative**: Trigger deployment via GitHub Actions with `workflow_dispatch` to `azure-deploy.yml`.