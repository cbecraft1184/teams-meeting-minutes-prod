# Teams Meeting Minutes - AI-Powered System

## Overview

This project delivers an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial with full Microsoft 365 integration. Its primary purpose is to automate and streamline the process of capturing, generating, reviewing, and distributing meeting minutes. Key capabilities include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, SharePoint archival, and per-user meeting visibility management with pagination. The system aims to enhance productivity within Microsoft 365 environments.

## User Preferences

- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates
- **Production-exclusive codebase: All code must be configured for Azure production**

## System Architecture

The system is a full-stack application featuring a React-based frontend, a Node.js Express backend, and PostgreSQL for data persistence.

### Frontend
- **Framework**: React + TypeScript with Vite.
- **UI Components**: Fluent UI React Components for native Teams look and feel.
- **State Management**: TanStack Query.
- **Routing**: Wouter.

### Backend
- **Runtime**: Node.js + Express (TypeScript, ESM).
- **Authentication**: Azure AD JWT validation via MSAL.
- **Job Processing**: A PostgreSQL-backed durable queue handles background jobs with retry, crash recovery, and idempotency, using a lease-based worker for distributed locking.

### Data Storage
- **Database**: PostgreSQL (Azure Database for PostgreSQL for production).
- **ORM**: Drizzle ORM with TypeScript schemas across 12 core tables (e.g., `meetings`, `meeting_minutes`, `action_items`, `job_queue`).

### Microsoft Graph Integration
- Utilizes Microsoft Graph v1.0 for real-time meeting completion capture via a single `/communications/callRecords` webhook. Meeting scheduling is detected via calendar delta sync.

### AI Integration
- **Azure OpenAI Service** (GPT-4o for minutes generation, Whisper for transcription) - REQUIRED for all environments.
- The pipeline extracts transcripts, generates structured minutes, and identifies action items, with processing validation to prevent unnecessary AI costs.

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
- **AI**: OpenAI SDK (Azure OpenAI).
- **Documents**: `docx`, `pdf-lib`.

## Production Configuration

### Required Azure AD App Permissions
The app registration in Azure AD requires these **application permissions** with **admin consent**:

| Permission | Purpose |
|------------|---------|
| `CallRecords.Read.All` | Subscribe to callRecords webhook for meeting end detection |
| `Calendars.Read` | Delta sync for meeting scheduling |
| `OnlineMeetings.Read.All` | Read meeting details and transcripts |
| `User.Read.All` | Read user profiles for attendee information |
| `Mail.Send` | Send automated email distribution (optional) |
| `Sites.ReadWrite.All` | SharePoint document archival (optional) |

### Environment Variables
**Required for production (Azure Container Apps):**
- `USE_MOCK_SERVICES=false` - Disables mock data, uses real Graph API and Azure OpenAI
- `ENABLE_JOB_WORKER=true` - Enables background job processing
- `APP_URL` - Azure Container Apps URL (e.g., https://your-app.azurecontainerapps.io)
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key (REQUIRED)
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL (REQUIRED)
- `AZURE_OPENAI_DEPLOYMENT` - Azure OpenAI deployment name (REQUIRED)
- `AZURE_TENANT_ID` - Azure AD tenant ID
- `AZURE_CLIENT_ID` - Azure AD application client ID
- `AZURE_CLIENT_SECRET` - Azure AD client secret

**Required for Graph webhooks:**
- `ENABLE_GRAPH_WEBHOOKS=true` - Enables Graph API webhook subscriptions
- Requires `CallRecords.Read.All` permission with admin consent

**Optional for full functionality:**
- `SHAREPOINT_SITE_URL` - SharePoint site URL for document archival
- `SHAREPOINT_LIBRARY` - SharePoint document library name
- `GRAPH_SENDER_EMAIL` - Email sender address for automated emails

## Deployment

### Azure Container Apps Deployment
1. Code is developed and tested locally
2. On Git push, automated deployment to Azure Container Apps via GitHub Actions
3. Docker image built and pushed to Azure Container Registry
4. Container App updated with new image

### Required Azure Resources
- Azure Container Apps environment
- Azure Container Registry
- Azure Database for PostgreSQL
- Azure OpenAI Service
- Azure AD App Registration with appropriate permissions
