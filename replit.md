# DOD Teams Meeting Minutes Management System

## Overview
This project is an autonomous, Microsoft-native solution for managing Microsoft Teams meeting minutes within DOD deployments, designed for 300,000 users. It automatically captures completed Teams meetings via Microsoft Graph API webhooks, processes recordings and transcripts using AI, and distributes approved minutes to attendees. The system focuses on automated workflow for meeting minutes, operating independently of general AI tools like CapraGPT/DON-GPT, yet coexisting with them. The project prioritizes commercial testing before deployment to DOD environments to ensure technology stack validation and debug in an open environment. The ultimate goal is a large-scale deployment in Azure Government (GCC High) for DOD production, emphasizing security, compliance, and integration with existing DOD infrastructure.

## User Preferences
I prefer simple language and clear, concise explanations.
I want iterative development with frequent, small updates.
Ask before making major architectural changes or introducing new dependencies.
Do not make changes to files outside the explicitly specified project scope.
Prioritize security and compliance, especially regarding DOD standards.
Ensure all AI processing uses Azure OpenAI in Gov Cloud.
All classification markings must follow DOD standards.
I want the agent to assume the role of an expert architect/developer.
I prefer to focus on high-level features and architectural decisions rather than granular implementation details.

## System Architecture

### UI/UX Decisions
The frontend uses React with TypeScript, Wouter for routing, Shadcn UI with Radix primitives for components, and Tailwind CSS following Microsoft Fluent design principles. It incorporates a dual UI theme system (Microsoft Teams + IBM Carbon look-and-feel) and a DOD-grade professional appearance with classification badges. The design emphasizes information clarity, accessibility (WCAG 2.1 AA compliant), responsiveness, and dark mode support.

### Technical Implementations
The backend is built with Node.js and Express. Data storage is PostgreSQL (Azure Database for PostgreSQL or Replit-hosted) with Drizzle ORM. Microsoft Graph API is used for Teams meeting capture, SharePoint integration for document archival, and Teams webhooks for real-time events. AI processing is handled by Azure OpenAI (Gov Cloud deployment). Document generation supports DOCX and PDF export.

### Feature Specifications
Key features include:
- **Automatic Meeting Capture**: Webhook-based integration with Microsoft Graph API.
- **AI-Powered Minutes**: Transcription and minute generation using Azure OpenAI.
- **Approval Workflow**: States for pending review, approved, and rejected.
- **Email Distribution**: Approved minutes sent to attendees with attachments.
- **Classification Support**: UNCLASSIFIED, CONFIDENTIAL, SECRET levels with proper marking and access control.
- **SharePoint Archival**: Automatic archival with metadata to DOD SharePoint.
- **Action Item Tracking**: Automatic extraction and management.
- **Meeting Templates**: Pre-configured templates for various meeting types.
- **DOD Compliance**: Adherence to security classifications, audit trails, and formatting standards.

### System Design Choices
- **Access Control**: Azure AD group-based multi-level access control for 300,000+ users, utilizing Clearance-Level and Role groups. Implements a fail-closed security model with performance caching (session and database cache with 15-minute TTL).
- **Data Model**: Includes `Meeting`, `Meeting Minutes`, and `Action Items` entities with clear relationships and fields for classification, status, and processing.
- **Microsoft Teams Integration**: Uses Graph API for webhooks, access to recordings/transcripts, and attendee info.
- **SharePoint Integration**: Authenticated via OAuth with Sites.Selected permission, uses correct Graph API paths, archives minutes with metadata, and supports graceful degradation.
- **Azure OpenAI Integration**: Deployed within Azure Government (GCC High), used for summarization, extraction, and detection tasks, ensuring data remains within the Gov Cloud boundary.
- **Deployment Options**: Azure Government (GCC High) (Azure App Service/Elastic Beanstalk, Azure Database for PostgreSQL for production) and Replit (for dev/testing).

## External Dependencies
- **Microsoft Teams**: For scheduling and conducting meetings.
- **Microsoft Graph API**: For capturing meeting events, accessing recordings/transcripts, retrieving attendee information, and email distribution.
- **Azure AD**: For authentication (SSO) and group-based access control.
- **SharePoint**: For document storage and archival, specifically DOD instances.
- **Azure OpenAI Service**: For AI-powered minute generation and processing (deployed in Azure Government (GCC High) for production).
- **PostgreSQL**: Database for storing application data (Azure Database for PostgreSQL for production, Replit-hosted for dev).
- **Azure Government (Azure App Service, Elastic Beanstalk, RDS, Secrets Manager, Application Load Balancer)**: For production hosting and infrastructure.