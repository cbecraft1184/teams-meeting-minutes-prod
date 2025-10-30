# DOD Teams Meeting Minutes Management System

## Project Overview
A fully autonomous Microsoft-native solution for capturing, processing, distributing, and archiving Microsoft Teams meeting minutes designed for DOD deployments. 

**IMPORTANT**: Meetings are scheduled and conducted in Microsoft Teams (NOT in this application). This app automatically captures completed Teams meetings via Microsoft Graph API webhooks, processes recordings/transcripts with AI, and distributes approved minutes to attendees.

## Deployment Requirements
- **Hosting**: AWS (commercial) or AWS Gov Cloud (for DOD production)
- **Microsoft Teams**: DOD internal Teams deployment
- **AI Processing**: Azure OpenAI Service (Azure Gov Cloud for production)
- **Document Storage**: SharePoint (DOD instance)
- **Database**: PostgreSQL (AWS RDS or Replit-hosted)
- **Packaging**: Must be installable in pre-existing DOD Teams environments

## Deployment Options
1. **AWS Deployment** (Production): See `AWS_DEPLOYMENT_GUIDE.md`
   - AWS ECS Fargate or Elastic Beanstalk
   - AWS RDS PostgreSQL
   - AWS Secrets Manager
   - Application Load Balancer with HTTPS
   - Supports AWS Gov Cloud for DOD compliance
2. **Replit Deployment** (Testing/Dev): See `IMPLEMENTATION_GUIDE.md`
   - Quick deployment for testing
   - Built-in PostgreSQL and secrets management
   - Auto-scaling deployment

## Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **UI Components**: Shadcn UI with Radix primitives
- **Styling**: Tailwind CSS with Microsoft Fluent design principles
- **State Management**: TanStack Query (React Query v5)
- **Design System**: DOD-grade professional appearance with classification badges

### Backend
- **Runtime**: Node.js with Express
- **Storage**: In-memory (development) / PostgreSQL (production)
- **Microsoft Integration**:
  - Microsoft Graph API for Teams meeting capture
  - SharePoint connector for document archival
  - Teams webhook for real-time meeting events
- **AI Processing**: Azure OpenAI (Gov Cloud deployment)
- **Document Generation**: DOCX and PDF export capabilities

### Key Features
1. **Automatic Meeting Capture**: Webhook-based integration captures completed Teams meetings via Microsoft Graph API
2. **AI-Powered Minutes**: Automated transcription and minute generation using Azure OpenAI (Gov Cloud)
3. **Approval Workflow**: Pending review, approved, rejected states for quality control
4. **Email Distribution**: Approved minutes automatically distributed to all attendees with DOCX/PDF attachments
5. **Classification Support**: UNCLASSIFIED, CONFIDENTIAL, SECRET levels with proper document marking
6. **SharePoint Archival**: Automatic document archival with metadata to DOD SharePoint
7. **Action Item Tracking**: Automatic extraction and management of action items
8. **Meeting Templates**: Pre-configured templates for briefings, status reviews, planning sessions, etc.
9. **DOD Compliance**: Security classifications, audit trails, proper formatting per DOD standards

## Data Model

### Meeting
- id, title, description
- scheduledAt, duration
- attendees (array)
- status: scheduled, in_progress, completed, archived
- classificationLevel: UNCLASSIFIED, CONFIDENTIAL, SECRET
- recordingUrl, transcriptUrl

### Meeting Minutes
- id, meetingId (reference)
- summary, keyDiscussions (array), decisions (array)
- attendeesPresent (array)
- processingStatus: pending, transcribing, generating, completed, failed
- sharepointUrl, docxUrl, pdfUrl

### Action Items
- id, meetingId, minutesId (references)
- task, assignee, dueDate
- priority: high, medium, low
- status: pending, in_progress, completed

## Integration Architecture

### Microsoft Teams Integration
The solution uses Microsoft Graph API to:
1. Register webhooks for meeting events (created, started, ended)
2. Access meeting recordings and transcripts
3. Retrieve attendee information
4. Fetch meeting metadata

### SharePoint Integration
Connected via Replit SharePoint connector:
- Authenticated using OAuth with Sites.Selected permission
- Automatically archives completed minutes
- Maintains proper folder structure and metadata
- Supports DOD document classification standards

### Azure OpenAI Integration (Gov Cloud)
- Deployable within AWS Gov Cloud environment
- Uses GPT models for:
  - Transcript summarization
  - Key discussion extraction
  - Decision identification
  - Action item detection
- No data leaves Gov Cloud boundary

## User Interface

### Pages
1. **Dashboard**: Statistics cards, recent meetings, quick actions
2. **All Meetings**: Complete meeting list with advanced filters
3. **Search Archive**: Date range, classification, and keyword search
4. **Settings**: Teams webhook config, SharePoint setup, AI processing options

### Components
- Classification badges (color-coded security levels)
- Status badges (scheduled, in progress, completed, archived)
- Processing status indicators (with animations)
- Meeting cards with hover interactions
- Detailed meeting modal with tabs (Overview, Minutes, Action Items, Attachments)
- Statistics cards with icons
- Professional sidebar navigation

### Design Principles
- Microsoft Fluent design system
- Government-grade professionalism
- Information clarity with proper hierarchy
- Accessible (WCAG 2.1 AA compliant)
- Responsive across all devices
- Dark mode support

## Security & Compliance

### Access Control Model
The system implements **multi-level access control** designed for 300,000+ DOD Teams users:

#### Role-Based Access
- **Viewer** (default): Can view meetings they attended, subject to clearance level
- **Approver**: Same as viewer + can approve/reject meeting minutes
- **Auditor**: Can view ALL meetings (entire archive), subject to clearance level
- **Admin**: Full system access + user management + configuration

#### Clearance-Based Filtering
All users (including admin and auditor) can only view meetings at or below their clearance level:
- **UNCLASSIFIED**: Can view UNCLASSIFIED meetings only
- **CONFIDENTIAL**: Can view UNCLASSIFIED and CONFIDENTIAL meetings
- **SECRET**: Can view UNCLASSIFIED, CONFIDENTIAL, and SECRET meetings
- **TOP_SECRET**: Can view all classification levels

#### Attendee-Based Filtering
- **Regular users (viewer/approver)**: Can ONLY see meetings they attended
- **Auditors**: Can see ALL meetings within their clearance level (full archive access)
- **Admins**: Can see ALL meetings within their clearance level

#### Authentication
- Microsoft Teams SSO via Azure AD
- JWT token validation with Microsoft Graph API
- Automatic user provisioning on first login (default: viewer role, UNCLASSIFIED clearance)
- Admins must manually assign clearance levels and roles

#### Search & Archive Access
- Search results automatically filtered by user's access level
- Auditors can search entire archive (subject to clearance)
- Regular users only search meetings they attended
- All access attempts logged for audit trail

### Classification Handling
- Visual classification indicators on all documents
- Default classification levels configurable
- Proper marking on exported documents
- Classification-based access controls enforced at API level

### Data Protection
- All data remains within Gov Cloud
- SharePoint integration for secure archival
- Audit trail for all operations (access attempts logged)
- No external API dependencies

## Development Workflow

### Current Status
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Data schemas defined (meetings, minutes, action items, templates)
- ✅ Frontend UI with dashboard, meeting list, search, and settings
- ✅ Meeting details modal with tabbed interface
- ✅ Approval workflow (pending_review → approved/rejected)
- ✅ Email distribution service (Microsoft Graph API for production, console logging for dev)
- ✅ Document export (DOCX/PDF) with DOD-compliant classification headers/footers
- ✅ Meeting templates system (5 default DOD templates)
- ✅ SharePoint integration connector configured
- ⏳ Microsoft Graph API webhook implementation (backend endpoint exists, needs production credentials)
- ⏳ Azure OpenAI Service integration (service class exists, needs Gov Cloud credentials)

### Next Steps (Production Deployment)
1. Configure Microsoft Graph API credentials (Tenant ID, Client ID, Secret) in AWS Gov Cloud
2. Register webhook subscriptions for Teams meeting events (created, started, ended)
3. Configure Azure OpenAI Service endpoint and API key (Gov Cloud region)
4. Set up SharePoint site and document library permissions
5. Implement automatic SharePoint upload on approval
6. Test end-to-end workflow with real Teams meetings
7. Configure email SMTP settings for production (or use Graph API send mail)
8. Deploy to AWS Gov Cloud with proper security hardening
9. Package as Teams app for DOD Teams installation

## Environment Variables (Production)

```
# Microsoft Graph API
MICROSOFT_TENANT_ID=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# Azure OpenAI (Gov Cloud)
AZURE_OPENAI_ENDPOINT=https://your-service.openai.azure.us/
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_DEPLOYMENT=gpt-4

# SharePoint
SHAREPOINT_SITE_URL=https://yourorg.sharepoint.com/sites/meetings
SHAREPOINT_LIBRARY=Meeting Minutes

# Application
SESSION_SECRET=xxx
NODE_ENV=production
```

## Testing Strategy
- Component testing for UI elements
- Integration testing for API endpoints
- End-to-end testing for complete workflows
- Security testing for classification handling
- Compliance validation for DOD standards

## Known Constraints
- Must work within DOD network environment
- No external internet dependencies in production
- All AI processing must use Azure OpenAI in Gov Cloud
- SharePoint permissions must align with DOD security policies
- Classification markings must follow DOD standards
