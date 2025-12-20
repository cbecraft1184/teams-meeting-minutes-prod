# Teams Meeting Minutes - AI-Powered System

## Overview
This project delivers an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial, deeply integrated with Microsoft 365. Its primary purpose is to automate and streamline the capture, generation, review, and distribution of meeting minutes. Key capabilities include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, SharePoint archival, and per-user meeting visibility management. The system enhances productivity within Microsoft 365 environments by automating the meeting documentation process and supports multi-session meetings by creating separate records and minutes linked to a canonical parent meeting.

## User Preferences
- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## Azure CLI Authentication (Replit Environment)

### Service Principal Login (Recommended - Non-Interactive)
Use this method for scripts and automated tasks:

```bash
az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID"
```

### Production Database Access
After logging in, get the production database URL:

```bash
PROD_DB_URL=$(az containerapp secret show --name teams-minutes-app --resource-group rg-teams-minutes-demo --secret-name database-url --query "value" -o tsv)
export DATABASE_URL="$PROD_DB_URL"
```

### Run Scripts Against Production
Example - run the attendee backfill:

```bash
npx tsx scripts/backfill-attendees.ts --dry-run  # Preview changes
npx tsx scripts/backfill-attendees.ts            # Apply changes
```

### Device Code Login (Interactive - For User Auth)
Use when you need user-level permissions:

1. ```bash
   az login --use-device-code
   ```
2. Go to https://microsoft.com/devicelogin and enter the code shown
3. Complete MFA authentication

### Get Access Token for API Calls
```bash
TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
curl -X POST "https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/admin/meetings/{meetingId}/reprocess" \
  -H "Authorization: Bearer $TOKEN"
```

## System Architecture
The system is a full-stack application featuring a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence, designed for scalability and integration within the Microsoft ecosystem.

### UI/UX Decisions
The frontend utilizes React with Fluent UI React Components to offer a native Microsoft Teams look and feel, ensuring a consistent user experience.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, using TanStack Query for state management and Wouter for routing.
- **Backend**: Node.js + Express (TypeScript, ESM) with Azure AD JWT validation via MSAL for authentication. A PostgreSQL-backed durable queue manages background jobs.
- **Data Storage**: PostgreSQL (Neon for development, Azure Database for PostgreSQL for production) managed by Drizzle ORM, with a schema supporting `meetings`, `meeting_minutes`, `action_items`, and `job_queue`.
- **Microsoft Graph Integration**: Uses Microsoft Graph v1.0 for real-time meeting completion capture via webhooks, calendar delta sync, and transcript access, including specific handling for multi-session meetings and organizer ID retrieval.
- **AI Integration**: Leverages Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription) for processing transcripts, generating structured minutes, and identifying action items.
- **Document Generation**: Supports DOCX (using `docx`) and PDF (using `pdf-lib`) formats for exporting minutes.
- **Multi-Session Support**: Implements a parent/child architecture in the database, linking distinct meeting sessions to a canonical parent meeting.

### System Design Choices
- **Authentication**: Azure AD JWT validation with MSAL for secure token handling.
- **Job Processing**: A resilient, distributed job queue ensures reliable handling of background tasks.
- **Transcript Access**: Correctly accesses transcripts using `/users/{organizerId}/onlineMeetings/{meetingId}/transcripts` with a fallback mechanism and requires application access policies.
- **Processing Thresholds**: All meeting duration or word count thresholds have been removed to ensure all meetings with transcripts are processed. An admin reprocess endpoint (`POST /api/admin/meetings/:id/reprocess`) allows regeneration of minutes.
- **Action Item Permissions**: Action items can only be updated by the assigned person, meeting organizer, or admin users. A schema change added `assignee_email` to the `action_items` table to support this model.
- **Attendee Data Format**: The `attendeesPresent` field in meeting_minutes uses object format `{name: string, email: string}` to tie display names with email addresses. Migration from legacy string[] format completed December 2025. Helper functions in `shared/attendeeHelpers.ts` provide normalization and lookup utilities.
- **Speaker Identification**: The system extracts speaker names directly from WebVTT transcript format (`<v Speaker Name>`) as the source of truth, NOT from the attendee/invitee list (which often contains usernames like "Mairajali75" instead of real names like "Mairaj Ali"). Speaker names are then matched to attendee emails using normalized string comparison and token matching.
- **Share Links (Org-Internal)**: Users can create share links for archived meetings that are restricted to their organization (Azure AD tenant). Links include tenant isolation, expiration (7 days default), and access tracking.

### Share Link Feature (Org-Internal Sharing)
The system supports secure sharing of archived meeting minutes within an organization:

**Security Model** (Updated December 2025):
- Share links are scoped to the creator's Azure AD tenant (tenantId)
- Tenant isolation: Server verifies accessor's tenantId matches the link's tenantId
- Clearance level validation: Links can require minimum clearance (UNCLASSIFIED → CONFIDENTIAL → SECRET → TOP_SECRET)
- Configurable expiration: 1-30 days (default 7 days)
- Revocation support: Links can be revoked with reason tracking
- Comprehensive audit logging: All access attempts (granted/denied) logged with IP, user-agent, and denial reasons
- Case-insensitive clearance comparison for Azure AD compatibility

**API Endpoints**:
- `POST /api/meetings/:id/share` - Creates share link with optional expiryDays and requiredClearanceLevel
- `GET /api/share/:token` - Retrieves meeting data (validates tenant, clearance, expiry, revocation)
- `DELETE /api/share/:token` - Deactivates a share link

**Database Schema**:
- `share_links` table: token, meetingId, tenantId, createdByEmail, createdByName, expiresAt, isActive, requiredClearanceLevel, revokedAt, revokedBy, revokeReason, accessCount, lastAccessedAt, lastAccessorEmail
- `share_link_audit_log` table: shareLinkId, meetingId, tenantId, accessorEmail, accessorName, accessorTenantId, accessorClearanceLevel, ipAddress, userAgent, accessGranted, denialReason, accessedAt

**Frontend**:
- Share button appears on archived meeting cards
- ShareDialog shows org-internal notice and copy-to-clipboard functionality
- `/share/:token` route displays shared meeting details

### Multi-Tenant Isolation (Added December 2025)
All major tables now include `tenant_id` columns with indexes for efficient filtering:
- `meetings.tenant_id` - Isolates meetings by organization
- `meeting_minutes.tenant_id` - Isolates minutes by organization
- `action_items.tenant_id` - Isolates action items by organization
- `job_queue.tenant_id` - Associates jobs with tenant context

**Endpoint-Level Enforcement**:
- `GET /api/meetings` - Uses `getMeetingsByTenant()` for non-admin users
- `GET /api/meetings/:id` - Uses `getMeetingForTenant()` for non-admin users
- `POST /api/meetings/:id/share` - Uses `getMeetingForTenant()` for non-admin users
- Admin users bypass tenant filtering for cross-tenant administration scenarios

### SharePoint Archival Status Tracking (Added December 2025)
The `meeting_minutes` table tracks SharePoint archival state:
- `archival_status`: pending | uploading | success | failed
- `archival_error`: Error message if archival failed
- `archived_at`: Timestamp of successful archival
- `archival_attempts`: Number of retry attempts

### Admin Job Queue Management (Added December 2025)
Administrators can monitor and manage failed background jobs:

**API Endpoints**:
- `GET /api/admin/jobs/stats` - Job queue statistics (pending, processing, failed, dead-letter, completed counts)
- `GET /api/admin/jobs?status=failed` - List jobs by status
- `GET /api/admin/jobs/:id` - Get single job details
- `POST /api/admin/jobs/:id/retry` - Retry a failed/dead-letter job (resets scheduling metadata)

**Database Schema**:
- `job_queue` extended with: meetingId, deadLetteredAt, resolvedAt, resolvedBy for tracking job lifecycle

### Logo Upload System (Added December 2025)
Organizations can upload custom logos for document branding:

**Features**:
- GCS-backed object storage for logo persistence
- Magic byte image type detection (PNG: 0x89504E47, JPG: 0xFFD8FF, GIF: 0x474946, BMP: 0x424D)
- Logos embedded in DOCX and PDF exports
- Settings page UI for logo upload/preview

**Storage**:
- Logos stored in object storage under `public/logos/` directory
- Logo URL stored in `app_settings.logo_url`

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

### Third-Party Libraries
- **Frontend**: React, Wouter, Fluent UI React Components, TanStack Query.
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client.
- **AI**: OpenAI SDK.
- **Documents**: `docx`, `pdf-lib`.

## Future Roadmap Documentation

### SaaS Deployment Models
Three deployment models to meet diverse customer requirements:
- **Managed SaaS**: We host everything, customer data in our infrastructure
- **BYOI (Bring Your Own Infrastructure)**: We run the app, customer owns data
- **Licensed/Self-Hosted**: Customer runs everything in their environment

**Full Documentation**: See [docs/SAAS_ROADMAP.md](docs/SAAS_ROADMAP.md)

### Meeting Attachment Capture
Comprehensive system for capturing calendar files, chat files, whiteboards, and screen share content.

**Full Documentation**: See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)