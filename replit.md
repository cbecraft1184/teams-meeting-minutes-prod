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
- **Share Links (Org-Internal)**: Users can create share links for archived meetings that are restricted to their organization (Azure AD tenant). Links include tenant isolation, expiration (7 days default), and access tracking.

### Share Link Feature (Org-Internal Sharing)
The system supports secure sharing of archived meeting minutes within an organization:

**Security Model**:
- Share links are scoped to the creator's Azure AD tenant (tenantId)
- When accessing a shared link, the server verifies the user's tenantId matches the link's tenantId
- Links expire after 7 days by default and can be manually deactivated
- Only the link creator or admins can deactivate a share link

**API Endpoints**:
- `POST /api/meetings/:id/share` - Creates a share link for an archived meeting
- `GET /api/share/:token` - Retrieves meeting data via share token (tenant-verified)
- `DELETE /api/share/:token` - Deactivates a share link

**Database Schema**:
- `share_links` table stores: token, meetingId, tenantId, createdByEmail, createdByName, expiresAt, isActive, accessCount, lastAccessedAt

**Frontend**:
- Share button appears on archived meeting cards
- ShareDialog shows org-internal notice and copy-to-clipboard functionality
- `/share/:token` route displays shared meeting details

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