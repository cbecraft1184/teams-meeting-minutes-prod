# Teams Meeting Minutes - AI-Powered System

## Overview

This project provides an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial, deeply integrated with Microsoft 365. Its core function is to automate and streamline the capture, generation, review, and distribution of meeting minutes. Key features include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, SharePoint archival, and per-user meeting visibility management. The system aims to significantly enhance productivity within Microsoft 365 environments by automating the meeting documentation process. The system also supports multi-session meetings, creating separate records and minutes for each distinct session while linking them to a canonical parent meeting.

## User Preferences

- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## System Architecture

The system is a full-stack application comprising a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence. It's designed for scalability and integration within the Microsoft ecosystem.

### UI/UX Decisions
The frontend uses React with Fluent UI React Components to provide a native Microsoft Teams look and feel, ensuring a consistent user experience.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, using TanStack Query for state management and Wouter for routing.
- **Backend**: Node.js + Express (TypeScript, ESM) with Azure AD JWT validation via MSAL for authentication. A PostgreSQL-backed durable queue manages background jobs with robust features like retry, crash recovery, and idempotency.
- **Data Storage**: PostgreSQL (Neon for development, Azure Database for PostgreSQL for production) managed by Drizzle ORM, with a schema supporting core entities like `meetings`, `meeting_minutes`, `action_items`, and `job_queue`.
- **Microsoft Graph Integration**: Utilizes Microsoft Graph v1.0 for real-time meeting completion capture via webhooks and calendar delta sync for scheduling. It also handles transcript access via the correct Graph API endpoints, including specific handling for multi-session meetings and organizer ID retrieval.
- **AI Integration**: Leverages Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription) to process transcripts, generate structured minutes, and identify action items. Processing is validated to optimize AI cost.
- **Document Generation**: Supports DOCX (using `docx`) and PDF (using `pdf-lib`) formats for exporting structured minutes.
- **Multi-Session Support**: Implements a parent/child architecture in the database, linking distinct meeting sessions to a canonical parent meeting. This ensures each session is processed independently while maintaining a logical grouping.

### System Design Choices
- **Authentication**: Azure AD JWT validation is central, with MSAL for secure token handling.
- **Job Processing**: A resilient, distributed job queue ensures background tasks (like AI processing and document generation) are handled reliably.
- **Transcript Access**: Critical fix implemented to correctly access transcripts using `/users/{organizerId}/onlineMeetings/{meetingId}/transcripts` and a fallback mechanism, ensuring application access policies are in place.
- **Processing Thresholds**: All thresholds for meeting duration or word count have been removed, ensuring every meeting with a transcript is processed, regardless of its length. An admin reprocess endpoint (`POST /api/admin/meetings/:id/reprocess`) allows regeneration of minutes.

## External Dependencies

### Microsoft Services
- **Microsoft 365**: Teams, SharePoint, Exchange (for calendar sync and email distribution).
- **Azure Active Directory**: For authentication and authorization.
- **Microsoft Graph API**: For integration with Teams, user data, calendar, call records, SharePoint, and sending emails.

### Azure Services
- **Azure OpenAI**: Provides AI capabilities (GPT-4o for minutes generation, Whisper for transcription).
- **Azure Container Apps**: For hosting and auto-scaling the application.
- **Azure Container Registry**: For storing Docker images.
- **Azure Database for PostgreSQL**: Managed database service for production data.
- **Application Insights**: For monitoring and logging.

### Third-Party Libraries
- **Frontend**: React, Wouter, Fluent UI React Components, TanStack Query.
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client.
- **AI**: OpenAI SDK.
- **Documents**: `docx`, `pdf-lib`.

## Recent Changes (December 2025)

### Multi-Session Meeting Support (December 11, 2025)
**Parent/Child Architecture:**
- **Database Schema**: Added `parent_meeting_id` (varchar, nullable FK to meetings.id) and `session_number` (integer, default 1)
- **Canonical Meetings**: Calendar-synced meetings have `parent_meeting_id IS NULL` (they are canonical parents)
- **Child Sessions**: When a new call record arrives for a meeting that already has a callRecordId, system creates a child record
- **Partial Unique Indexes**: Replaced unique constraints with partial indexes scoped to canonical meetings
- **Migration Applied**: `migrations/add_multi_session_support.sql` executed on production

### Generate Minutes Button (December 11, 2025)
- Added "Generate Minutes" button to meeting details modal
- Appears when meeting is completed but has no minutes
- Calls `POST /api/admin/meetings/:id/reprocess` endpoint
- Shows loading state and toast notifications

## Azure Resources & Credentials Reference

### Azure AD Application
| Property | Value |
|----------|-------|
| App Name | Meeting Minutes App |
| App ID (Client ID) | `71383692-c5c6-40cc-94cf-96c97fed146c` |
| Tenant ID | Use `AZURE_TENANT_ID` secret |
| App ID URI | `api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/71383692-c5c6-40cc-94cf-96c97fed146c` |

### Required Azure AD Permissions
| Permission | Type | Purpose |
|------------|------|---------|
| `Calendars.Read` | Delegated | Read user calendars for meeting sync |
| `CallRecords.Read.All` | Application | Receive webhook notifications for call records |
| `OnlineMeetings.Read.All` | Application | Access meeting transcripts and recordings |
| `Mail.Send` | Application | Send meeting minutes via email |
| `Sites.ReadWrite.All` | Application | Upload documents to SharePoint |
| `User.Read` | Delegated | Get current user profile |

### Production Infrastructure
| Resource | Name | Location |
|----------|------|----------|
| Resource Group | `rg-teams-minutes` | East US 2 |
| Container App | `teams-minutes-app` | East US 2 |
| Container Registry | `crteamsminutes.azurecr.io` | East US 2 |
| PostgreSQL | `teams-minutes-db.postgres.database.azure.com` | East US 2 |
| Subscription ID | `17f080ac-db85-4c7d-a12e-fc88bf22b2bc` | - |

### Environment Secrets (Container App)
| Secret Name | Purpose |
|-------------|---------|
| `AZURE_TENANT_ID` | Azure AD tenant for authentication |
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_CLIENT_SECRET` | App registration client secret |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI service endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | GPT-4o deployment name |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption key |
| `GRAPH_SENDER_EMAIL` | Licensed mailbox for sending emails |

### Database Access

**Development (Neon):**
- Uses `DATABASE_URL` from Replit secrets
- Schema sync: `npm run db:push`

**Production (Azure PostgreSQL):**
```bash
# Connect via psql
PGPASSWORD='<password>' psql -h teams-minutes-db.postgres.database.azure.com -U adminuser -d teams_minutes_db

# Apply migrations
PGPASSWORD='<password>' psql -h teams-minutes-db.postgres.database.azure.com -U adminuser -d teams_minutes_db -f migrations/<migration>.sql
```

### Azure CLI Access from Replit
```bash
# Device code authentication
az login --use-device-code

# Set subscription
az account set --subscription "17f080ac-db85-4c7d-a12e-fc88bf22b2bc"

# Build and push container
az acr build --registry crteamsminutes --image teams-minutes:latest .

# Update Container App
az containerapp update --name teams-minutes-app --resource-group rg-teams-minutes --image crteamsminutes.azurecr.io/teams-minutes:latest
```

### Teams Application Access Policy
Required for accessing meeting transcripts/recordings:
```powershell
New-CsApplicationAccessPolicy -Identity "MeetingMinutesPolicy" -AppIds "71383692-c5c6-40cc-94cf-96c97fed146c" -Description "Allow Meeting Minutes app to access transcripts"
Grant-CsApplicationAccessPolicy -PolicyName "MeetingMinutesPolicy" -Global
```

## Admin Workflows

### Generate Minutes (Reprocess)
For meetings with transcripts but no minutes:
1. Open meeting in Teams desktop app (not web preview)
2. Go to Minutes tab
3. Click "Generate Minutes" button
4. Wait for processing to complete

**API Endpoint**: `POST /api/admin/meetings/:id/reprocess`

### Manual Database Reprocess
```sql
-- Check meeting status
SELECT id, title, status, enrichment_status, LENGTH(transcript_content) as transcript_len
FROM meetings WHERE id = '<meeting-id>';

-- Enqueue minutes generation job
INSERT INTO job_queue (id, job_type, payload, idempotency_key, status, max_retries, created_at) 
VALUES (gen_random_uuid(), 'generate_minutes', '{"meetingId": "<meeting-id>"}'::jsonb, 
        'generate_minutes:<meeting-id>', 'pending', 3, NOW())
ON CONFLICT (idempotency_key) DO NOTHING;
```

## Teams App vs Web Preview

**Important**: The Meeting Minutes app runs embedded in Microsoft Teams using Teams JS SDK for SSO authentication. The Replit web preview runs in standalone mode without Teams context.

- **Teams Desktop/Web**: Full functionality with SSO authentication
- **Replit Web Preview**: Limited functionality, Teams SDK will timeout (expected)

Testing must be done in the actual Teams desktop or web client after deployment.