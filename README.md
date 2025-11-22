# Teams Meeting Minutes - AI-Powered System

Automated Microsoft Teams meeting minutes generation using Azure OpenAI for demonstration and production use on **Azure Commercial**.

**Target:** 20-user demo pilots, scalable to enterprise (100+ users)  
**Cloud:** Azure Commercial (East US)  
**Deployment:** Native Teams plugin with full Microsoft 365 integration

---

## Features

### Automatic Teams Meeting Capture
- Detects when Teams meeting ends via Microsoft Graph webhooks
- Captures recordings and transcripts automatically
- Processes meeting data in 2-3 minutes

### AI-Powered Minutes Generation
- Azure OpenAI (GPT-4o) generates structured meeting minutes
- Extracts: summary, key discussions, decisions, action items
- Minimal editing required (<10 minutes)

### Approval & Distribution Workflow
- Review and approve/reject minutes in Teams
- Configurable auto-approval settings
- Email distribution (DOCX/PDF attachments)
- Automatic SharePoint archival
- Adaptive Cards sent to Teams chat

### Action Item Tracking
- Dashboard shows all assigned action items
- Assignment and due date tracking
- Status updates and notifications
- Priority levels (low/medium/high)

---

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **UI Library:** Fluent UI React Components v9 (native Teams design system)
- **Styling:** Griffel (makeStyles) with Fluent UI design tokens
- **State Management:** TanStack Query v5
- **Routing:** Wouter
- **Teams Integration:** @microsoft/teams-js SDK

### Backend
- **Runtime:** Node.js 18 LTS
- **Framework:** Express + TypeScript
- **Database:** PostgreSQL 16 (Azure Database for PostgreSQL)
- **ORM:** Drizzle ORM
- **Authentication:** Azure AD OAuth 2.0 (MSAL Node)
- **Microsoft Graph:** @microsoft/microsoft-graph-client
- **AI:** Azure OpenAI Service (GPT-4o + Whisper)
- **Bot:** BotBuilder SDK v4

### Infrastructure
- **Hosting:** Azure App Service (Linux, Node.js 18)
- **Database:** Azure Database for PostgreSQL (Flexible Server)
- **AI:** Azure OpenAI Service
- **Monitoring:** Azure Application Insights
- **Security:** Azure Key Vault, Azure AD

---

## Local Development Setup

### Prerequisites
- Node.js 18.x LTS
- npm 9.x or later
- PostgreSQL database (local or Neon)
- Azure AD app registration (optional, can use mock mode)

### Environment Setup

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd teams-meeting-minutes
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   Note: This project uses a single root `package.json` that manages all dependencies.

3. **Configure environment variables:**
   
   Create `.env` file (development uses mock services by default):
   ```bash
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/meetings"
   SESSION_SECRET="your-session-secret"
   
   # Use mock services (no Azure AD or OpenAI required)
   USE_MOCK_SERVICES=true
   NODE_ENV=development
   
   # Optional: Real Azure services (for production-like testing)
   # GRAPH_CLIENT_ID_DEV="<Azure AD app client ID>"
   # GRAPH_CLIENT_SECRET_DEV="<Azure AD client secret>"
   # GRAPH_TENANT_ID_DEV="<Azure AD tenant ID>"
   # AZURE_OPENAI_ENDPOINT_DEV="<Azure OpenAI endpoint>"
   # AZURE_OPENAI_API_KEY_DEV="<Azure OpenAI API key>"
   # AZURE_OPENAI_DEPLOYMENT_DEV="gpt-4o"
   ```

4. **Initialize database:**
   ```bash
   npm run db:push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```
   
   Application runs at `http://localhost:5000`

### Mock Mode (Development)
By default, the application runs in mock mode:
- **Mock users:** Pre-configured test users (no Azure AD required)
- **Mock AI:** Replit AI generates minutes (no Azure OpenAI required)
- **Mock Graph:** Simulated Microsoft Graph API responses
- **Full functionality:** Complete approval workflow, action items, search

Switch users in development using the user switcher in the top-right corner.

---

## Azure Commercial Deployment

### Demo Deployment (20 users)
**Estimated Cost:** $92/month  
**Timeline:** 4-6 hours

**[→ View Complete Deployment Guide (COMMERCIAL_DEMO_DEPLOYMENT.md)](COMMERCIAL_DEMO_DEPLOYMENT.md)**

### Production Deployment (100 users)
**Estimated Cost:** $383/month  
**Features:** Auto-scaling, high availability, monitoring

**Resources:**
- App Service: Standard S1 (2 instances)
- PostgreSQL: General Purpose D2s_v3
- Azure OpenAI: GPT-4o + Whisper
- Application Insights: Standard tier

---

## Documentation

### Deployment
- **[Commercial Demo Deployment Guide](COMMERCIAL_DEMO_DEPLOYMENT.md)** - Step-by-step Azure deployment
- **[Deployment Summary](DEPLOYMENT_SUMMARY.md)** - Quick reference and cost estimates
- **[Architecture Documentation](DEPLOYMENT_ARCHITECTURE.md)** - System architecture and tech stack

### Development
- **[Project Overview](replit.md)** - System architecture, preferences, recent changes
- **Environment Setup:** See "Local Development Setup" above
- **Database Schema:** See `shared/schema.ts` (12 tables)

---

## Database Schema (12 Tables)

1. **meetings** - Meeting metadata and Microsoft Graph integration
2. **meeting_minutes** - AI-generated minutes with approval workflow
3. **action_items** - Extracted action items with assignments
4. **users** - User profiles and Azure AD permissions
5. **meeting_templates** - Reusable meeting templates
6. **graph_webhook_subscriptions** - Microsoft Graph webhook lifecycle
7. **user_group_cache** - Cached Azure AD groups (15-min TTL)
8. **teams_conversation_references** - Teams bot conversation state
9. **sent_messages** - Audit log of sent Teams messages
10. **message_outbox** - Transactional outbox for Adaptive Card delivery
11. **job_queue** - Durable background job processing
12. **app_settings** - Application configuration

---

## Security & Compliance

- **Authentication:** Azure AD OAuth 2.0 with MSAL
- **Authorization:** Azure AD group-based permissions (role + classification level)
- **Transport Security:** HTTPS/TLS 1.2+ (Azure-managed certificates)
- **Data Encryption:** At-rest encryption (Azure default)
- **Secret Management:** Azure Key Vault + environment variables
- **Classification Levels:** UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET
- **Audit Logging:** Application Insights structured logs

---

## Support & Contribution

**Issues:** Report via GitHub issues  
**Questions:** See documentation in `COMMERCIAL_DEMO_DEPLOYMENT.md`  
**Updates:** Check `replit.md` for recent changes

---

## License

[Add your license here]

---

**Note:** This system is designed for demonstration and production use on Azure Commercial. For Azure Government (GCC High) deployments, contact your Azure representative for compliance requirements.
