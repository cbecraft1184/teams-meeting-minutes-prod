# Teams Meeting Minutes - Demo Pilot System

## Overview

This project is an AI-powered Microsoft Teams meeting minutes management system designed for demonstration pilots. It automatically captures Teams meetings, generates AI-powered meeting minutes, and manages an approval workflow with SharePoint archival.

**Key Capabilities:**
- Automatic Teams meeting capture via Microsoft Graph webhooks
- AI-powered minutes generation (Azure OpenAI GPT-4o + Whisper)
- Review and approval workflow with configurable settings
- Document export (DOCX/PDF)
- Email distribution and SharePoint archival
- Durable job queue for reliable background processing

The system supports two separate 20-user demo pilots: one for commercial enterprises and one for NAVY ERP personnel, with clear separation and tailored documentation for each.

## User Preferences

- Simple, everyday language
- Demo-focused scope (not production-scale)
- Clear separation between commercial and NAVY demos
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
- **Core Tables**: `meetings`, `meeting_minutes`, `action_items`, `job_queue`, `graph_webhook_subscriptions`, `user_group_cache`, `app_settings`
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