# DOD Meeting Minutes Management System

## Overview

An autonomous Microsoft Teams meeting minutes management system designed for Department of Defense operations. The application automatically captures Teams meetings via webhooks, enriches meeting data with recordings and transcripts from Microsoft Graph API, generates AI-powered meeting minutes using Azure OpenAI, and manages the complete approval workflow with SharePoint archival.

**Key Capabilities:**
- Automatic Teams meeting capture via Microsoft Graph webhooks
- AI-powered transcription and minutes generation (Azure OpenAI or Replit AI fallback)
- Multi-level security classification (UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET)
- Role-based access control via Azure AD groups
- Document export (DOCX/PDF) with DOD-compliant classification headers
- Email distribution and SharePoint archival
- Durable job queue for reliable background processing

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, Vite build system
- **UI Components**: Radix UI primitives with custom shadcn/ui components (New York style)
- **Styling**: Tailwind CSS with custom design tokens supporting light/dark themes
- **State Management**: TanStack Query (React Query) for server state, local component state for UI
- **Routing**: Wouter (lightweight client-side routing)
- **Key Pages**: Dashboard, Meetings list, Archive search, Settings

**Design Decision**: Chose Radix UI + shadcn/ui for accessible, composable components that meet government accessibility requirements (Section 508 compliance). TanStack Query provides automatic background refetching and cache invalidation for real-time meeting updates.

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API with `/api/*` prefix
- **Authentication**: Multi-mode authentication system:
  - **Production**: Azure AD JWT token validation via MSAL
  - **Development**: Mock users from `config/mockUsers.json`
- **Job Processing**: PostgreSQL-backed durable queue with automatic retry and crash recovery
- **Middleware Stack**: JSON body parsing, request logging, authentication, webhook validation

**Design Decision**: Express chosen for simplicity and Azure integration compatibility. Durable queue in PostgreSQL eliminates need for separate message broker (Redis/SQS) while providing transactional guarantees. Authentication middleware supports both production (Azure AD) and development (mock) modes for seamless local testing.

### Data Storage
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Schema Design**:
  - `meetings`: Core meeting records with classification levels
  - `meeting_minutes`: AI-generated minutes with approval workflow
  - `action_items`: Extracted action items with assignment tracking
  - `job_queue`: Durable background job queue with idempotency
  - `graph_webhook_subscriptions`: Microsoft Graph webhook lifecycle management
  - `user_group_cache`: Cached Azure AD group memberships (15-min TTL)
- **Enums**: PostgreSQL enums for classification levels, statuses, roles (type safety)

**Design Decision**: Drizzle ORM chosen over Prisma for zero-runtime overhead and better PostgreSQL feature support (enums, JSONB). Neon serverless provides auto-scaling and connection pooling. Database-backed job queue eliminates external dependencies while providing ACID guarantees.

### Authentication & Authorization
- **Identity Provider**: Azure Active Directory (Microsoft Entra ID)
- **Token Flow**: 
  - **User Authentication**: Authorization code flow with PKCE (Teams SSO tokens)
  - **Service Authentication**: Client credentials flow (application-only access)
- **Token Management**: LRU cache (1000 tokens, 55-min TTL) with automatic refresh
- **JWT Validation**: JWKS client with 24-hour key cache, validates Azure AD signatures
- **Access Control Layers**:
  1. **Attendee-based**: Users see only meetings they attended
  2. **Classification-based**: Clearance level derived from Azure AD groups
  3. **Role-based**: Admin/approver/viewer/auditor roles from Azure AD groups
- **Group Sync**: Lazy-load Azure AD groups on authentication, cache in database (15-min TTL)

**Design Decision**: Dual authentication mode supports both production (Azure AD) and development (mock users). Azure AD groups are the source of truth for permissions, with database fallback for offline/demo scenarios. Attendee filtering ensures compartmentalization even within same clearance level.

### Microsoft Graph Integration
- **API Version**: Microsoft Graph v1.0
- **Primary Resources**:
  - `/communications/onlineMeetings` - Meeting metadata and lifecycle
  - `/communications/callRecords` - Post-meeting recordings and transcripts
  - `/users/{userId}/memberOf` - Azure AD group memberships
  - `/sites/{siteId}/drive` - SharePoint document upload
- **Webhook Architecture**:
  - Subscription lifecycle: 48-hour expiration, 12-hour renewal buffer
  - Validation: Client state tokens for notification authenticity
  - Event handling: Queued processing with exponential backoff (5, 15, 45 min)
- **Pagination**: Handles up to 50 pages (5,000 items max per collection)
- **Throttling**: Exponential backoff on 429 responses, respects Retry-After headers

**Design Decision**: Webhook subscriptions provide real-time meeting capture without polling. Background renewal job prevents subscription expiration. Eventual consistency handling (202 Accepted, 404 Not Found) accommodates Microsoft Graph propagation delays (recordings/transcripts take 5-45 minutes post-meeting).

### AI Integration
- **Production**: Azure OpenAI Service in Azure Government Cloud
  - Models: GPT-4o for minutes generation, Whisper for transcription
  - Endpoint: Government-specific endpoints for IL5 compliance
  - API Version: 2024-02-15-preview
- **Development Fallback**: Replit AI Integrations (GPT-5)
  - Automatic fallback when Azure credentials unavailable
  - Compatible OpenAI API interface
- **Processing Pipeline**:
  1. Extract transcript from callRecord or use mock data
  2. Generate structured minutes (summary, key discussions, decisions)
  3. Extract action items with assignments and deadlines
  4. Retry logic: 3 attempts with exponential backoff on rate limits

**Design Decision**: Azure OpenAI Government Cloud required for FedRAMP High authorization. Replit AI fallback enables local development without Azure credentials. Structured JSON output from AI ensures consistent parsing and database storage.

### Background Job System
- **Queue Backend**: PostgreSQL `job_queue` table (ACID transactions)
- **Job Types**:
  - `enrich_meeting`: Fetch callRecord, recordings, transcripts
  - `generate_minutes`: AI-powered minutes generation
  - `send_email`: Distribute minutes to attendees
  - `upload_sharepoint`: Archive approved minutes
- **Features**:
  - Idempotency via unique keys (prevents duplicate processing)
  - Automatic retry with exponential backoff (max 3 attempts)
  - Crash recovery: Resumes stuck jobs on server restart
  - Dead-letter queue: Permanently failed jobs for manual review
- **Scheduler**: In-memory interval timers (1-hour subscription renewal, 30-min enrichment catch-up)

**Design Decision**: PostgreSQL-backed queue eliminates external dependencies (SQS, Redis) while providing transactional guarantees. Idempotency keys prevent duplicate minutes generation if webhook delivers twice. Crash recovery ensures no meetings are lost during deployments.

### Document Generation
- **Export Formats**: DOCX (editable) and PDF (archival)
- **Libraries**: 
  - DOCX: `docx` library with custom DOD templates
  - PDF: `pdf-lib` for programmatic generation
- **DOD Compliance Features**:
  - Classification banners (header/footer on every page)
  - Controlled dissemination markings
  - Automatic classification inheritance from meeting
  - Metadata embedding (author, classification, creation date)
- **Content Structure**: Title page, attendee list, agenda, minutes, action items, signatures

**Design Decision**: Both formats required for different use cases - DOCX for collaborative editing, PDF for immutable archival. Classification banners on every page meet DOD marking requirements. Generated documents match government standard formats (DD Forms inspiration).

### Deployment Architecture
- **Development**: Replit with hot-reload (Vite HMR)
- **Production Target**: Azure App Service (Premium P1v3 tier)
- **Infrastructure**: Bicep templates for Azure Government Cloud deployment
- **Components**:
  - App Service: Auto-scaling (1-3 instances), private VNet integration
  - PostgreSQL: Flexible Server B2ms with PgBouncer, 256GB storage
  - Storage: Standard GRS for meeting recordings/documents
  - Azure Front Door: WAF with DDoS protection
  - Key Vault: Secret management with private endpoints
  - Application Insights: Observability and performance monitoring

**Design Decision**: Azure Government Cloud required for IL5 data (SECRET classification). App Service provides managed runtime with auto-scaling. Azure Front Door adds WAF protection and global load balancing. Private endpoints ensure no public internet exposure for data tier.

## External Dependencies

### Microsoft Cloud Services
- **Azure Active Directory (Microsoft Entra ID)**
  - Purpose: User authentication and authorization
  - Integration: MSAL library for token acquisition, JWKS for JWT validation
  - Secrets: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`
  
- **Microsoft Graph API**
  - Purpose: Teams meeting data, user profiles, SharePoint access
  - Endpoints: `https://graph.microsoft.com/v1.0`
  - Authentication: OAuth 2.0 bearer tokens from Azure AD
  - Rate Limits: 10,000 requests/10 minutes per app, throttled at tenant level

- **Microsoft Teams**
  - Purpose: Meeting source and SSO provider
  - Integration: Teams Tab app with SSO authentication
  - Deployment: Manifest deployment to Microsoft Teams admin center

- **SharePoint Online**
  - Purpose: Long-term document archival
  - Integration: Microsoft Graph Files API
  - Structure: Organized by classification level and date

### Azure Services
- **Azure OpenAI Service**
  - Purpose: AI-powered minutes generation and transcription
  - Models: GPT-4o (minutes), Whisper (speech-to-text)
  - Region: Azure Government Cloud (usgovvirginia, usgovarizona)
  - Secrets: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`

- **Azure Storage**
  - Purpose: Meeting recordings, attachments, exported documents
  - Type: Blob storage with lifecycle policies (hot → cool → archive)
  - Redundancy: Geo-redundant storage (GRS)

- **Azure Key Vault**
  - Purpose: Centralized secret management
  - Integration: Managed identity for secret retrieval
  - Secrets: API keys, connection strings, certificates

### Database
- **Neon PostgreSQL (Development)**
  - Purpose: Serverless PostgreSQL for local/staging
  - Features: Auto-scaling, branching, connection pooling
  - Secret: `DATABASE_URL`

- **Azure Database for PostgreSQL (Production)**
  - Purpose: Production database in Azure Government
  - Tier: Flexible Server B2ms (burstable, 2 vCPU, 4GB RAM)
  - Features: PgBouncer connection pooling, automated backups, point-in-time restore

### Third-Party Libraries
- **Authentication**: `@azure/msal-node` (Microsoft Authentication Library)
- **API Client**: `@microsoft/microsoft-graph-client`
- **AI**: `openai` (compatible with both Azure OpenAI and Replit AI)
- **Database**: `drizzle-orm`, `@neondatabase/serverless`
- **Document Generation**: `docx`, `pdf-lib`
- **Utilities**: `date-fns` (date formatting), `zod` (schema validation), `nanoid` (ID generation)

### Development Services
- **Replit AI Integrations**
  - Purpose: Development fallback for AI features (no Azure credentials needed)
  - Model: GPT-5
  - Automatic activation: When `AI_INTEGRATIONS_OPENAI_API_KEY` present

- **Mock Services**
  - Purpose: Local development without Microsoft cloud dependencies
  - Configuration: `USE_MOCK_SERVICES=true`
  - Mock Data: `config/mockUsers.json` for test users

### Compliance & Security
- **FedRAMP Controls**: 75 priority controls, 67 implemented (89% coverage)
- **Classification Levels**: UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET
- **Audit Trail**: All user actions logged with Azure AD identity
- **Data Residency**: Azure Government Cloud (US-only data centers)
- **Encryption**: TLS 1.2+ in transit, AES-256 at rest (FIPS 140-2 validated modules)