# Commercial Meeting Minutes Demo Pilot

## Executive Summary

**Purpose:** Demonstrate an AI-powered meeting minutes management system for Microsoft Teams to commercial enterprise stakeholders.

**Scope:** Proof-of-concept pilot with up to 20 participants to validate:
- Automatic capture of Teams meeting recordings and transcripts
- AI-powered generation of meeting minutes using Azure OpenAI
- Email distribution of approved minutes to attendees
- SharePoint archival integration

**Target Audience:** Commercial enterprise decision-makers and end-users evaluating automation capabilities for meeting documentation.

**Environment:** Azure Commercial (single region) with demo data and limited integration scope.

**Success Criteria:**
- Successful capture of 5+ demo meetings
- AI-generated minutes requiring minimal manual editing
- Participants can review, approve, and distribute minutes
- SharePoint archival works correctly
- Positive feedback from pilot participants

---

## Pilot Scope & Constraints

### Participants
- Maximum 20 commercial enterprise users
- Demo accounts in customer's Microsoft 365 tenant
- No production data

### Duration
- 4-6 week pilot period
- Weekly check-ins for feedback

### Data Boundaries
- Demo meetings only (no sensitive/classified content)
- Test SharePoint site (not production NAVY ERP SharePoint)
- Sample meeting data for testing

### Excluded from Demo
- Production enterprise deployment
- SOC 2 certification
- Multi-region deployment
- Auto-scaling for large user bases
- Integration with production enterprise systems
- Enterprise SLA agreements

---

## Demo Architecture

### Simplified Infrastructure (Azure Commercial)

**Core Components:**
- **Azure App Service**: Hosts the web application (single region: East US)
- **PostgreSQL Database**: Stores meeting metadata, minutes, and user data
- **Azure OpenAI**: GPT-4o for minute generation, Whisper for transcription
- **Microsoft Graph API**: Captures Teams meetings via webhooks
- **SharePoint Integration**: Archives approved minutes to demo SharePoint site

**Authentication:**
- Azure AD integration
- Participant accounts: Customer tenant users

**Security:**
- Demo environment only
- No classified data handling
- Standard Azure security features

---

## Technical Implementation

### Frontend
- React + TypeScript
- Wouter routing
- Shadcn UI components
- Tailwind CSS with Microsoft Fluent design

### Backend
- Node.js + Express
- Drizzle ORM with PostgreSQL
- Microsoft Graph API webhooks
- Azure OpenAI integration

### Data Model
- Meetings (Teams meeting metadata)
- Meeting Minutes (AI-generated content, approval status)
- Action Items (extracted from minutes)

### Key Features for Demo
1. **Automatic Meeting Capture** - Webhook listens for completed Teams meetings
2. **AI Minute Generation** - Azure OpenAI processes transcript → structured minutes
3. **Review Workflow** - Participants review and approve/edit minutes
4. **Email Distribution** - Approved minutes sent to attendees
5. **SharePoint Archival** - Minutes saved to demo SharePoint library

---

## Demo Environment Setup

### Prerequisites
- Azure subscription (East US region)
- Azure AD tenant access
- Demo SharePoint site
- 20 test user accounts

### Deployment Steps
1. Deploy infrastructure to Azure using provided Bicep templates
2. Configure Azure AD app registration for Graph API
3. Set up demo SharePoint site with proper permissions
4. Configure Azure OpenAI models (GPT-4o, Whisper)
5. Seed database with sample data
6. Create test user accounts

### Configuration
- Environment: `demo`
- Region: `eastus`
- Naming prefix: `commercial-demo`
- Admin email: Pilot coordinator email

---

## Demo Runbook

### Pre-Demo Checklist
- [ ] All 20 participant accounts created
- [ ] Demo SharePoint site accessible
- [ ] Azure OpenAI quota confirmed
- [ ] Sample meetings scheduled
- [ ] Application deployed and tested
- [ ] Backup demo recording prepared

### Demo Scenarios

**Scenario 1: Automatic Capture (10 minutes)**
- Schedule Teams meeting with 3-5 participants
- Conduct mock meeting with agenda
- End meeting, wait 2-3 minutes
- Show automatic capture in dashboard

**Scenario 2: AI Minute Generation (15 minutes)**
- Display captured meeting
- Trigger AI processing
- Show generated minutes (attendees, agenda, decisions, action items)
- Demonstrate editing capability

**Scenario 3: Approval & Distribution (10 minutes)**
- Review AI-generated minutes
- Approve minutes
- Show email sent to attendees
- Verify SharePoint archival

**Scenario 4: Action Item Tracking (10 minutes)**
- Display extracted action items
- Show assignment and due dates
- Demonstrate tracking across meetings

### Fallback Scripts
If live demo fails:
- Pre-recorded video walkthrough
- Screenshots of each workflow step
- Sample minutes documents

---

## Pilot Compliance & Security

### Demo Environment Safeguards
- Isolated from production systems
- No classified or sensitive data
- Standard Azure security (HTTPS, encryption at rest)
- Access limited to pilot participants

### Data Handling
- Meeting recordings stored temporarily (auto-delete after 30 days)
- Transcripts processed in Azure OpenAI (no data retention)
- Generated minutes stored in demo database only
- Participants acknowledge demo/test data only

### Not Included in Demo
- ATO (Authority to Operate) process
- NIST 800-53 compliance validation
- Classified data handling
- Multi-level security clearances
- Production NAVY network integration

---

## Next Steps & Evaluation

### Pilot Feedback Collection
- Weekly participant surveys
- Post-demo questionnaire
- One-on-one stakeholder interviews
- Technical performance metrics

### Evaluation Criteria
- **Usability**: Can users navigate and use the system easily?
- **Accuracy**: Do AI-generated minutes require minimal editing?
- **Time Savings**: How much time saved vs. manual minute-taking?
- **Integration**: Do Teams/SharePoint integrations work seamlessly?
- **Reliability**: Does the system capture and process meetings consistently?

### Production Considerations (if pilot succeeds)
- ATO process for production NAVY deployment
- Integration with production NAVY ERP SharePoint
- Scale planning for wider NAVY organization
- Classified data handling requirements
- GCC High migration for production use
- Multi-region deployment planning

### Decision Points
- **Week 2**: Initial feedback review
- **Week 4**: Mid-pilot assessment
- **Week 6**: Final evaluation and go/no-go for production planning

---

## User Preferences

- Simple language and clear explanations
- Iterative development with small updates
- Focus on demo scenarios, not enterprise architecture
- Prioritize working demo over production features
- Ask before major changes

---

## Technology Stack

### Frontend
- React 18 + TypeScript
- Wouter (routing)
- Shadcn UI + Radix primitives
- Tailwind CSS
- TanStack Query (data fetching)

### Backend
- Node.js + Express
- PostgreSQL with Drizzle ORM
- Microsoft Graph API
- Azure OpenAI (GPT-4o, Whisper)

### Infrastructure (Demo)
- Azure App Service (East US)
- Azure Database for PostgreSQL
- Azure OpenAI Service
- Application Insights (monitoring)

---

## Demo Pilot Timeline

**Week 1:** Infrastructure deployment, participant onboarding  
**Week 2-3:** Active demo usage, scenario testing  
**Week 4:** Mid-pilot review, adjustments  
**Week 5-6:** Final testing, feedback collection  
**Week 7:** Evaluation and next steps decision

---

**This is a demonstration pilot to prove the concept. Production deployment (if approved) would follow a separate planning and authorization process.**
