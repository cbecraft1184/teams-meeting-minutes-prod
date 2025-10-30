# DOD Teams Meeting Minutes Management System

## Project Overview
A fully autonomous Microsoft-native solution for creating, capturing, distributing, and archiving Microsoft Teams meeting minutes designed for DOD deployments. The system integrates with Microsoft Teams via Graph API, generates AI-powered meeting minutes, and archives documentation to SharePoint.

## Deployment Requirements
- **Hosting**: AWS Gov Cloud (no external dependencies)
- **Microsoft Teams**: DOD internal Teams deployment
- **AI Processing**: Azure OpenAI Service (deployed in Gov Cloud)
- **Document Storage**: SharePoint (DOD instance)
- **Packaging**: Must be installable in pre-existing DOD Teams environments

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
1. **Meeting Capture**: Webhook-based integration with Microsoft Teams
2. **AI-Powered Minutes**: Automated transcription and minute generation using Azure OpenAI
3. **Classification Support**: UNCLASSIFIED, CONFIDENTIAL, SECRET levels
4. **SharePoint Archival**: Automatic document archival with metadata
5. **Search & Filter**: Advanced search across archived meeting minutes
6. **Action Item Tracking**: Automatic extraction and management of action items
7. **DOD Compliance**: Security classifications, audit trails, proper formatting

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

### Classification Handling
- Visual classification indicators on all documents
- Default classification levels configurable
- Proper marking on exported documents
- Classification-based access controls ready

### Data Protection
- All data remains within Gov Cloud
- SharePoint integration for secure archival
- Audit trail for all operations
- No external API dependencies

## Development Workflow

### Current Status
- ✅ Data schemas defined
- ✅ Frontend UI complete with all components
- ✅ SharePoint integration configured
- ⏳ Backend API implementation pending
- ⏳ Azure OpenAI integration pending
- ⏳ Microsoft Graph API integration pending

### Next Steps
1. Implement backend API endpoints
2. Configure Microsoft Graph API for Teams webhooks
3. Set up Azure OpenAI Service connection
4. Implement document generation (DOCX/PDF)
5. Add SharePoint upload functionality
6. Test end-to-end meeting capture workflow
7. Deploy to AWS Gov Cloud
8. Package for DOD Teams installation

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
