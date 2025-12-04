# Teams Meeting Minutes - AI-Powered System

## Overview

This project delivers an AI-powered Microsoft Teams meeting minutes management system for Azure Commercial with full Microsoft 365 integration. Its primary purpose is to automate and streamline the process of capturing, generating, reviewing, and distributing meeting minutes. Key capabilities include automatic meeting capture, AI-driven minutes generation, a configurable review and approval workflow, document export (DOCX/PDF), automated email distribution, and SharePoint archival. The system aims to enhance productivity within Microsoft 365 environments.

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