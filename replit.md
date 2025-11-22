# Teams Meeting Minutes - AI-Powered System

## Overview

AI-powered Microsoft Teams meeting minutes management system deployed on Azure Commercial with full Microsoft 365 integration.

**Key Capabilities:**
- Automatic Teams meeting capture via Microsoft Graph webhooks
- AI-powered minutes generation (Azure OpenAI GPT-4o + Whisper)
- Review and approval workflow with configurable settings
- Document export (DOCX/PDF)
- Email distribution and SharePoint archival
- Durable job queue for reliable background processing

## User Preferences

- Simple, everyday language
- Focus on Azure Commercial deployment
- Clear documentation for demo and production environments
- Iterative development with small updates

## System Architecture

### Frontend
- **Framework**: React + TypeScript, Vite
- **UI Components**: Fluent UI React Components (native Teams design system)
- **Styling**: Fluent UI makeStyles with design tokens (supporting light/dark/high contrast themes)
- **State Management**: TanStack Query for server state
- **Routing**: Wouter (lightweight client-side routing)
- **Key Pages**: Dashboard, Meetings list, Archive search
- **Design Decision**: Fluent UI provides a native Teams look and feel with accessibility. TanStack Query ensures real-time updates and efficient data handling.

### Backend
- **Runtime**: Node.js + Express (TypeScript, ESM modules)
- **API Pattern**: RESTful JSON API (`/api/*` prefix)
- **Authentication**: Azure AD JWT validation via MSAL (production); Mock users (development)
- **Job Processing**: PostgreSQL-backed durable queue with retry, crash recovery, and idempotency
- **Middleware**: JSON parsing, logging, authentication, webhook validation
- **Design Decision**: Express for simplicity and Azure compatibility. A PostgreSQL queue provides transactional guarantees without external message brokers. Dual authentication modes support both production and local development.

### Data Storage
- **Database**: PostgreSQL (Neon serverless for development)
- **ORM**: Drizzle ORM with TypeScript schemas
- **Core Tables**: `meetings`, `meeting_minutes`, `action_items`, `users`, `meeting_templates`, `graph_webhook_subscriptions`, `user_group_cache`, `teams_conversation_references`, `sent_messages`, `message_outbox`, `job_queue`, `app_settings` (12 tables total)
- **Design Decision**: Drizzle ORM for zero-runtime overhead. A database-backed job queue provides transactional guarantees and idempotency. Strict schema validation is enforced for all database writes.

### Microsoft Graph Integration
- **API Version**: Microsoft Graph v1.0
- **Primary Resources**: `/communications/onlineMeetings`, `/communications/callRecords`, `/users/{userId}/memberOf`, `/sites/{siteId}/drive`
- **Webhooks**: 48-hour subscriptions with 12-hour renewal
- **Authentication**: Azure AD OAuth with token caching
- **Design Decision**: Webhook subscriptions enable real-time meeting capture.

### AI Integration
- **Primary**: Azure OpenAI Service (GPT-4o for minutes, Whisper for transcription)
- **Fallback**: Replit AI (development only)
- **Processing Pipeline**: Extracts transcript, generates structured minutes (summary, discussions, decisions), extracts action items.
- **Design Decision**: Azure OpenAI for commercial readiness. Replit AI provides a development fallback.

### Background Job System
- **Queue**: PostgreSQL `job_queue` table
- **Job Types**: `enrich_meeting`, `generate_minutes`, `send_email`, `upload_sharepoint`
- **Features**: Idempotency, automatic retry (max 3 attempts), crash recovery, dead-letter queue, transactional outbox pattern for exactly-once delivery.
- **Design Decision**: PostgreSQL queue for reliability and reduced external dependencies.

### Document Generation
- **Formats**: DOCX (editable) and PDF (archival)
- **Libraries**: `docx` for DOCX, `pdf-lib` for PDF
- **Content Structure**: Title page, attendee list, agenda/discussion, decisions, action items, timestamp.

## Development Environment

### Local Development
- Replit with hot-reload (Vite HMR)
- Mock authentication (no Azure AD required)
- In-memory or Neon PostgreSQL database
- Replit AI for minutes generation (no Azure OpenAI needed)

### Demo Deployment
- Azure Commercial Cloud (East US)
- Azure App Service (Basic tier for demo, Standard for production)
- Azure Database for PostgreSQL (Burstable for demo, General Purpose for production)
- Azure OpenAI Service
- Application Insights for monitoring

**Cost**: $92/month (demo), $383/month (100 users production)

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
- **Frontend**: React, Wouter, Fluent UI React Components, Tailwind CSS, TanStack Query
- **Backend**: Express, Drizzle ORM, MSAL, Microsoft Graph Client
- **AI**: OpenAI SDK (Azure + Replit compatible)
- **Documents**: `docx`, `pdf-lib`
- **Utilities**: `date-fns`, `zod`, `nanoid`

## Security

- **Authentication**: Azure AD OAuth 2.0
- **Transport**: HTTPS/TLS 1.2+
- **Data**: Encryption at rest (Azure default)
- **Access**: Azure AD group-based permissions
- **Monitoring**: Application Insights with real-time alerting

## Recent Changes

- **November 2025 (Email Distribution Implementation)**: Implemented Microsoft Graph API email distribution (COMPLETED ✓)
  - **server/services/emailDistribution.ts**: Implemented production sendViaGraphAPI method
    - Uses app-only authentication via acquireTokenByClientCredentials
    - Calls Microsoft Graph /users/{senderEmail}/sendMail endpoint
    - Proper base64 encoding for attachments (DOCX/PDF)
    - Robust error handling with retry propagation to durable queue
  - **server/services/configValidator.ts**: Added GRAPH_SENDER_EMAIL configuration
  - **COMMERCIAL_DEMO_DEPLOYMENT.md**: Added GRAPH_SENDER_EMAIL to Phase 3.2 environment variables
  - **Required Azure AD Permissions**: Application requires Mail.Send permission with admin consent
  - **Architecture Review**: PASSED - Production-ready, secure, consistent with SharePoint integration patterns
- **November 2025 (Documentation Updates)**: Fixed deployment documentation errors and added tenant requirements (COMPLETED ✓)
  - **COMMERCIAL_DEMO_DEPLOYMENT.md**: 
    - Fixed environment variables (added _PROD suffix), build process, database table count (12 tables)
    - Added comprehensive tenant requirements section explaining that demo users must be in the same Office 365 tenant
    - Added Microsoft 365 Developer Program setup instructions (FREE 25 E5 licenses for 90 days)
    - Added demo user setup options with cost comparison
    - Added bulk CSV import instructions for creating demo accounts
  - **DEPLOYMENT_ARCHITECTURE.md**: Updated database schema to include all 12 tables, added TOP_SECRET classification level
  - **DEPLOYMENT_SUMMARY.md**: Updated from 9 to 12 tables, removed deprecated adaptive_card_outbox reference
  - **README.md**: Removed NAVY references, added local development setup, corrected tech stack (Fluent UI)
  - **replit.md**: Updated core tables list to reflect all 12 tables
- **November 2025 (Documentation - Commercial Azure)**: Complete deployment documentation for Azure Commercial (COMPLETED ✓)
  - **COMMERCIAL_DEMO_DEPLOYMENT.md**: Comprehensive step-by-step deployment guide
    - 5-phase deployment procedure (Azure resources, Azure AD, code deployment, Teams integration, testing)
    - Cost estimates: $92/month (demo), $383/month (100 users production)
    - Rollback procedures for application and database
    - Comprehensive troubleshooting guide
    - GitHub Actions CI/CD workflow
  - **DEPLOYMENT_SUMMARY.md**: Documentation package overview
    - Deployment timeline (4-6 hours active work)
    - Cost summary and optimization strategies
    - Quick reference guide
- **November 2025 (Task 7)**: Configurable approval workflow with admin settings (COMPLETED ✓)
  - Admin Settings Panel with workflow toggles
  - Auto-approval logic when approval disabled
  - Distribution orchestrator respecting all toggle settings
  - Development user switcher for testing roles
- **November 2025 (Task 6)**: Complete Fluent UI v9 migration - native Teams design system (COMPLETED ✓)
  - Full component migration to Fluent UI React Components
  - 100% Fluent UI makeStyles with design tokens
  - Complete Shadcn/Radix removal
- **November 2025 (Task 5)**: Production-grade telemetry for Adaptive Card delivery system (COMPLETED ✓)
  - Per-recipient error isolation
  - Error classification system (PERMANENT/TRANSIENT/UNKNOWN)
  - DOD-compliant telemetry (PII-safe logging)
- **November 2025 (Task 4)**: Strict schema validation for all database writes (COMPLETED ✓)
  - All CRUD operations validated before database writes
  - Schema rules for meetings, minutes, action items
