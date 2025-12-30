# Teams Meeting Minutes AI - Architecture Documentation

**Version:** 1.0  
**Date:** December 2025  
**Classification:** Unclassified  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Diagrams](#3-architecture-diagrams)
4. [Component Details](#4-component-details)
5. [Azure Services](#5-azure-services)
6. [Microsoft 365 Integration](#6-microsoft-365-integration)
7. [Security Architecture](#7-security-architecture)
8. [Data Flow](#8-data-flow)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Appendix: Database Schema](#10-appendix-database-schema)

---

## 1. Executive Summary

The Teams Meeting Minutes AI system is an enterprise-grade Microsoft Teams application that automates the capture, generation, review, and distribution of meeting minutes. Built for Azure Commercial Cloud deployment, the system integrates deeply with Microsoft 365 services to provide a seamless experience within the Teams platform.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| Automatic Meeting Detection | Real-time detection of meeting completion via Microsoft Graph webhooks |
| AI-Powered Minutes Generation | GPT-4o powered analysis of meeting transcripts |
| Configurable Approval Workflow | Multi-level review and approval before distribution |
| Document Export | Professional DOCX and PDF document generation |
| Automated Distribution | Email delivery to attendees upon approval |
| SharePoint Archival | Automatic upload to designated SharePoint document library |
| Role-Based Access Control | Granular permissions based on organizational roles |
| Classification Support | Data classification levels for sensitive content |

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MICROSOFT 365 CLOUD                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Teams     │  │  Exchange   │  │ SharePoint  │  │  Calendar   │        │
│  │   Client    │  │   Online    │  │   Online    │  │    (Graph)  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          │  Microsoft Graph API v1.0       │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AZURE COMMERCIAL CLOUD                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Azure Container Apps                            │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Application Container                      │  │   │
│  │  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │   │
│  │  │  │  React   │  │   Express    │  │   Background Worker    │  │  │   │
│  │  │  │ Frontend │◄─┤   REST API   │◄─┤   (Lease-Based Lock)   │  │  │   │
│  │  │  │          │  │              │  │                        │  │  │   │
│  │  │  └──────────┘  └──────────────┘  └────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│           ┌────────────────────────┼────────────────────────┐              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ Azure Database  │    │  Azure OpenAI   │    │  Azure Active   │        │
│  │ for PostgreSQL  │    │   (GPT-4o)      │    │   Directory     │        │
│  │                 │    │                 │    │   (Entra ID)    │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript | Single Page Application |
| UI Framework | Fluent UI React | Native Teams look and feel |
| State Management | TanStack Query v5 | Server state synchronization |
| Backend | Node.js + Express | RESTful API server |
| Database | PostgreSQL (Azure Commercial) | Relational data persistence |
| ORM | Drizzle ORM | Type-safe database access |
| AI | Azure OpenAI (GPT-4o) | Minutes generation |
| Authentication | Microsoft Entra ID + MSAL | Enterprise SSO |
| Hosting | Azure Container Apps | Serverless containers |

---

## 3. Architecture Diagrams

### 3.1 System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    AZURE COMMERCIAL CLOUD                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐    │
│   │                        AZURE CONTAINER APPS ENVIRONMENT                       │    │
│   │                                                                               │    │
│   │   ┌─────────────────────────────────────────────────────────────────────┐    │    │
│   │   │                    CONTAINER APP: teams-minutes-app                  │    │    │
│   │   │                                                                      │    │    │
│   │   │  ┌────────────────┐   ┌────────────────┐   ┌──────────────────┐    │    │    │
│   │   │  │   FRONTEND     │   │    BACKEND     │   │  JOB WORKER      │    │    │    │
│   │   │  │                │   │                │   │                  │    │    │    │
│   │   │  │  React SPA     │   │  Express.js    │   │  Lease-based     │    │    │    │
│   │   │  │  Fluent UI     │   │  REST API      │   │  distributed     │    │    │    │
│   │   │  │  TypeScript    │   │  TypeScript    │   │  lock worker     │    │    │    │
│   │   │  │                │   │                │   │                  │    │    │    │
│   │   │  │  Port 5000     │   │  Port 5000     │   │  Polls: 5s       │    │    │    │
│   │   │  │  (Vite)        │   │  (Express)     │   │  Lease: 15s      │    │    │    │
│   │   │  └────────────────┘   └────────────────┘   └──────────────────┘    │    │    │
│   │   │                                                                      │    │    │
│   │   │  Ingress: HTTPS (TLS 1.2+) via Azure managed certificate            │    │    │
│   │   └─────────────────────────────────────────────────────────────────────┘    │    │
│   │                                                                               │    │
│   └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                        │
│   ┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────┐   │
│   │  AZURE DATABASE FOR    │   │    AZURE OPENAI        │   │   AZURE AD         │   │
│   │  POSTGRESQL            │   │                        │   │   (Entra ID)       │   │
│   │                        │   │  Model: GPT-4o         │   │                    │   │
│   │  • Flexible Server     │   │  Deployment: Custom    │   │  • Multi-tenant    │   │
│   │  • SSL Required        │   │  API Version: 2024-02  │   │  • B2B Guests      │   │
│   │  • 12 Core Tables      │   │  Max Tokens: 8192      │   │  • SSO (MSAL)      │   │
│   │  • Durable Job Queue   │   │  Retry: Exponential    │   │  • Groups Sync     │   │
│   │                        │   │                        │   │                    │   │
│   └────────────────────────┘   └────────────────────────┘   └────────────────────┘   │
│                                                                                        │
│   ┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────┐   │
│   │  AZURE CONTAINER       │   │   APPLICATION          │   │   AZURE KEY VAULT  │   │
│   │  REGISTRY              │   │   INSIGHTS             │   │   (Optional)       │   │
│   │                        │   │                        │   │                    │   │
│   │  • Docker images       │   │  • Request logging     │   │  • Secret storage  │   │
│   │  • CI/CD integration   │   │  • Error tracking      │   │  • Key rotation    │   │
│   │  • Vulnerability scan  │   │  • Performance metrics │   │  • Managed identity│   │
│   │                        │   │                        │   │                    │   │
│   └────────────────────────┘   └────────────────────────┘   └────────────────────┘   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Meeting Lifecycle Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MEETING LIFECYCLE DATA FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────┐                                                                          
 │   USER      │                                                                          
 │  Schedules  │                                                                          
 │  Meeting    │                                                                          
 └──────┬──────┘                                                                          
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          1. MEETING DETECTION                                        │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Teams Calendar  │────────►│ Calendar Delta  │────────►│  Meeting Created    │    │  
 │  │ Event Created   │         │ Sync (Polling)  │         │  in Database        │    │  
 │  └─────────────────┘         └─────────────────┘         │  Status: scheduled  │    │  
 │                                                          └─────────────────────┘    │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
                                       │                                                   
                                       ▼                                                   
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          2. MEETING COMPLETION                                       │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Meeting Ends    │────────►│ Graph Webhook   │────────►│ callRecords         │    │  
 │  │ (Teams Client)  │         │ Notification    │         │ Webhook Received    │    │  
 │  └─────────────────┘         └─────────────────┘         └──────────┬──────────┘    │  
 │                                                                     │               │  
 │                                                          ┌──────────▼──────────┐    │  
 │                                                          │ Enqueue Enrichment  │    │  
 │                                                          │ Job (Durable Queue) │    │  
 │                                                          └─────────────────────┘    │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
                                       │                                                   
                                       ▼                                                   
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          3. TRANSCRIPT ENRICHMENT                                    │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Job Worker      │────────►│ Fetch callRecord│────────►│ Fetch Transcript    │    │  
 │  │ Processes Job   │         │ from Graph API  │         │ from Graph API      │    │  
 │  └─────────────────┘         └─────────────────┘         └──────────┬──────────┘    │  
 │                                                                     │               │  
 │                               ┌─────────────────────────────────────┘               │  
 │                               ▼                                                      │  
 │               ┌───────────────────────────────────────┐                             │  
 │               │      PROCESSING VALIDATION            │                             │  
 │               │  • Duration ≥ 2 minutes               │                             │  
 │               │  • Transcript ≥ 25 words              │                             │  
 │               │  • Transcript available               │                             │  
 │               └───────────────────────────────────────┘                             │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
                                       │                                                   
                                       ▼                                                   
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          4. AI MINUTES GENERATION                                    │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Transcript      │────────►│ Azure OpenAI    │────────►│ Structured Minutes  │    │  
 │  │ Content         │         │ GPT-4o          │         │ Generated           │    │  
 │  └─────────────────┘         └─────────────────┘         └─────────────────────┘    │  
 │                                                                                      │  
 │  ┌───────────────────────────────────────────────────────────────────────────────┐  │  
 │  │  OUTPUT:                                                                       │  │  
 │  │  • Summary (executive overview)                                                │  │  
 │  │  • Key Discussions (major topics)                                              │  │  
 │  │  • Decisions Made (action decisions)                                           │  │  
 │  │  • Action Items (tasks with assignees, due dates, priorities)                  │  │  
 │  └───────────────────────────────────────────────────────────────────────────────┘  │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
                                       │                                                   
                                       ▼                                                   
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          5. APPROVAL WORKFLOW                                        │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Minutes Created │────────►│ Pending Review  │────────►│ Approver Reviews    │    │  
 │  │ Status: pending │         │ Notification    │         │ in Teams App        │    │  
 │  └─────────────────┘         └─────────────────┘         └──────────┬──────────┘    │  
 │                                                                     │               │  
 │                    ┌────────────────────────────────────────────────┤               │  
 │                    ▼                                                ▼               │  
 │         ┌─────────────────┐                           ┌─────────────────────┐       │  
 │         │    APPROVED     │                           │     REJECTED        │       │  
 │         │  Proceed to     │                           │   Return for        │       │  
 │         │  Distribution   │                           │   Revision          │       │  
 │         └─────────────────┘                           └─────────────────────┘       │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
                                       │                                                   
                                       ▼                                                   
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │                          6. DISTRIBUTION & ARCHIVAL                                  │  
 │  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────────┐    │  
 │  │ Generate DOCX   │────────►│ Send Email via  │────────►│ Upload to           │    │  
 │  │ and PDF         │         │ Exchange/Graph  │         │ SharePoint          │    │  
 │  └─────────────────┘         └─────────────────┘         └─────────────────────┘    │  
 │                                                                                      │  
 │  ┌───────────────────────────────────────────────────────────────────────────────┐  │  
 │  │  RECIPIENTS:                                                                   │  │  
 │  │  • All meeting attendees receive email with DOCX attachment                    │  │  
 │  │  • PDF archived in SharePoint document library                                 │  │  
 │  │  • Meeting status updated to "archived"                                        │  │  
 │  └───────────────────────────────────────────────────────────────────────────────┘  │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
```

### 3.3 Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION & AUTHORIZATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────┐                                                                         
 │    USER      │                                                                         
 │  Opens App   │                                                                         
 │  in Teams    │                                                                         
 └──────┬───────┘                                                                         
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │ STEP 1: TEAMS SSO TOKEN ACQUISITION                                                 │  
 │                                                                                      │  
 │  ┌───────────────┐        ┌───────────────┐        ┌───────────────────────────┐    │  
 │  │ Teams Client  │───────►│ @microsoft/   │───────►│ Teams SSO Token           │    │  
 │  │               │        │ teams-js SDK  │        │ (audience: app-id-uri)    │    │  
 │  └───────────────┘        └───────────────┘        └───────────────────────────┘    │  
 │                                                                                      │  
 │  api://[hostname]/[client-id]                                                        │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │ STEP 2: TOKEN VALIDATION (Backend)                                                  │  
 │                                                                                      │  
 │  ┌───────────────┐        ┌───────────────┐        ┌───────────────────────────┐    │  
 │  │ Express       │───────►│ JWT Validation│───────►│ Verify:                   │    │  
 │  │ Middleware    │        │ (MSAL/jwks)   │        │ • Signature (JWKS)        │    │  
 │  └───────────────┘        └───────────────┘        │ • Issuer (tenant)         │    │  
 │                                                    │ • Audience (app-id-uri)   │    │  
 │                                                    │ • Expiration              │    │  
 │                                                    └───────────────────────────┘    │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │ STEP 3: ON-BEHALF-OF (OBO) TOKEN EXCHANGE                                           │  
 │                                                                                      │  
 │  ┌───────────────┐        ┌───────────────┐        ┌───────────────────────────┐    │  
 │  │ Teams SSO     │───────►│ Entra ID      │───────►│ Graph API Token           │    │  
 │  │ Token         │        │ Token Endpoint│        │ (scope: .default)         │    │  
 │  └───────────────┘        └───────────────┘        └───────────────────────────┘    │  
 │                                                                                      │  
 │  Scope: https://graph.microsoft.com/.default                                         │  
 │  Grant: urn:ietf:params:oauth:grant-type:jwt-bearer                                  │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │ STEP 4: USER & GROUP RESOLUTION                                                     │  
 │                                                                                      │  
 │  ┌───────────────┐        ┌───────────────┐        ┌───────────────────────────┐    │  
 │  │ Graph API     │───────►│ /me/memberOf  │───────►│ User Groups Retrieved     │    │  
 │  │ Request       │        │ Endpoint      │        │ (15-min cache TTL)        │    │  
 │  └───────────────┘        └───────────────┘        └───────────────────────────┘    │  
 │                                                                                      │  
 │  Group Pattern: Clearance-{LEVEL}, Role-{ROLE}                                       │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
        │                                                                                  
        ▼                                                                                  
 ┌─────────────────────────────────────────────────────────────────────────────────────┐  
 │ STEP 5: AUTHORIZATION CHECK                                                         │  
 │                                                                                      │  
 │  ┌───────────────────────────────────────────────────────────────────────────────┐  │  
 │  │                          ROLE-BASED ACCESS CONTROL                            │  │  
 │  │                                                                               │  │  
 │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │  
 │  │  │   Admin     │  │  Approver   │  │   Auditor   │  │   Viewer    │          │  │  
 │  │  │             │  │             │  │             │  │             │          │  │  
 │  │  │ • Full CRUD │  │ • Approve   │  │ • Read All  │  │ • Read Own  │          │  │  
 │  │  │ • Config    │  │ • Reject    │  │ • Audit Log │  │ • Download  │          │  │  
 │  │  │ • Override  │  │ • Read All  │  │             │  │             │          │  │  
 │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘          │  │  
 │  └───────────────────────────────────────────────────────────────────────────────┘  │  
 │                                                                                      │  
 │  ┌───────────────────────────────────────────────────────────────────────────────┐  │  
 │  │                       CLASSIFICATION-BASED ACCESS                             │  │  
 │  │                                                                               │  │  
 │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐   │  │  
 │  │  │  TOP_SECRET   │  │    SECRET     │  │ CONFIDENTIAL  │  │ UNCLASSIFIED │   │  │  
 │  │  │               │  │               │  │               │  │              │   │  │  
 │  │  │ TOP_SECRET    │  │ SECRET        │  │ CONFIDENTIAL  │  │ Any User     │   │  │  
 │  │  │ clearance     │  │ clearance+    │  │ clearance+    │  │              │   │  │  
 │  │  │ required      │  │               │  │               │  │              │   │  │  
 │  │  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────┘   │  │  
 │  └───────────────────────────────────────────────────────────────────────────────┘  │  
 └─────────────────────────────────────────────────────────────────────────────────────┘  
```

### 3.4 Microsoft Graph Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                      MICROSOFT GRAPH API INTEGRATION SURFACE                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │        TEAMS MEETING MINUTES APP        │
                    │                                         │
                    │    ┌───────────────────────────────┐    │
                    │    │    Graph Client (MSAL v2)     │    │
                    │    │    Token Caching Enabled      │    │
                    │    └───────────────┬───────────────┘    │
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │       MICROSOFT GRAPH API v1.0          │
                    │       https://graph.microsoft.com       │
                    └─────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
         ▼                               ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   CALENDAR & EVENTS │     │  CALL RECORDS       │     │   USER & GROUPS     │
│                     │     │  (Webhooks)         │     │                     │
│  Permissions:       │     │                     │     │  Permissions:       │
│  • Calendars.Read   │     │  Permissions:       │     │  • User.Read        │
│                     │     │  • CallRecords.     │     │  • GroupMember.Read │
│  Endpoints:         │     │    Read.All         │     │    .All             │
│  GET /me/events     │     │                     │     │                     │
│  GET /me/calendar/  │     │  Webhook:           │     │  Endpoints:         │
│    calendarView     │     │  /communications/   │     │  GET /me            │
│                     │     │    callRecords      │     │  GET /me/memberOf   │
│  Usage:             │     │                     │     │  GET /users/{id}    │
│  Calendar delta     │     │  Expiry: 48 hours   │     │                     │
│  sync for meeting   │     │  Renewal: 12 hours  │     │  Usage:             │
│  scheduling         │     │                     │     │  User profile and   │
│                     │     │  Usage:             │     │  group membership   │
│                     │     │  Detect meeting     │     │  for RBAC           │
│                     │     │  completion         │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                               │                               │
         │                               │                               │
         ▼                               ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   ONLINE MEETINGS   │     │   MAIL (SMTP)       │     │   SHAREPOINT        │
│   & TRANSCRIPTS     │     │                     │     │                     │
│                     │     │  Permissions:       │     │  Permissions:       │
│  Permissions:       │     │  • Mail.Send        │     │  • Sites.ReadWrite  │
│  • OnlineMeetings.  │     │                     │     │    .All             │
│    Read             │     │  Endpoint:          │     │                     │
│  • OnlineMeeting    │     │  POST /me/send      │     │  Endpoints:         │
│    Transcription.   │     │    Mail             │     │  GET /sites/{id}    │
│    Read.All         │     │                     │     │  POST /drive/items  │
│                     │     │  Usage:             │     │                     │
│  Endpoints:         │     │  Distribute         │     │  Usage:             │
│  GET /communications│     │  approved minutes   │     │  Archive minutes    │
│    /onlineMeetings  │     │  to attendees       │     │  documents to       │
│    /{id}/trans-     │     │                     │     │  document library   │
│    cripts           │     │                     │     │                     │
│  GET /communications│     │                     │     │                     │
│    /callRecords/    │     │                     │     │                     │
│    {id}             │     │                     │     │                     │
│                     │     │                     │     │                     │
│  Usage:             │     │                     │     │                     │
│  Fetch meeting      │     │                     │     │                     │
│  details and        │     │                     │     │                     │
│  transcripts        │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              WEBHOOK SUBSCRIPTION MANAGEMENT                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   ┌───────────────────────────────────────────────────────────────────────────────┐    │
│   │                         CALL RECORDS WEBHOOK                                   │    │
│   │                                                                                │    │
│   │   Resource:        /communications/callRecords                                 │    │
│   │   Change Type:     created                                                     │    │
│   │   Notification URL: https://[app-url]/webhooks/graph/callRecords              │    │
│   │                                                                                │    │
│   │   Expiration:      48 hours (maximum allowed)                                  │    │
│   │   Renewal:         Automatic at 12-hour intervals                              │    │
│   │                                                                                │    │
│   │   Purpose:         Detect when Teams meetings end                              │    │
│   │                    Trigger enrichment job queue                                │    │
│   │                                                                                │    │
│   └───────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
│   ┌───────────────────────────────────────────────────────────────────────────────┐    │
│   │                         VALIDATION ENDPOINT                                    │    │
│   │                                                                                │    │
│   │   Method:          GET & POST                                                  │    │
│   │   Path:            /webhooks/graph/callRecords                                 │    │
│   │                                                                                │    │
│   │   GET:             Returns validationToken (subscription creation)             │    │
│   │   POST:            Receives change notifications with clientState              │    │
│   │                    Validates clientState for security                          │    │
│   │                    Acknowledges within 3 seconds (HTTP 202)                    │    │
│   │                                                                                │    │
│   └───────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Details

### 4.1 Frontend Components

| Component | Description | Technology |
|-----------|-------------|------------|
| App Shell | Main application container with sidebar navigation | React + Fluent UI |
| Dashboard | Statistics overview with recent meetings | TanStack Query |
| My Meetings | Filtered list of user's meetings | React + Fluent UI |
| Meeting Details | Modal with tabs for overview, minutes, actions | Fluent UI Dialog |
| Search | Advanced search with date/status filters | Fluent UI Controls |
| Approval Queue | Pending minutes awaiting review (Approvers only) | Role-based rendering |
| Admin Panel | System configuration and user management | Admin role required |

### 4.2 Backend Services

| Service | File | Purpose |
|---------|------|---------|
| Express API | `server/routes.ts` | RESTful endpoints for all operations |
| Graph Calendar Sync | `graphCalendarSync.ts` | Delta sync for calendar events |
| Graph Subscription Manager | `graphSubscriptionManager.ts` | Webhook lifecycle management |
| Call Record Enrichment | `callRecordEnrichment.ts` | Transcript fetching and processing |
| Minutes Generator | `minutesGenerator.ts` | Orchestrates AI generation |
| Azure OpenAI Service | `azureOpenAI.ts` | GPT-4o integration |
| Document Export | `documentExport.ts` | DOCX and PDF generation |
| Email Distribution | `emailDistribution.ts` | Graph Mail API integration |
| SharePoint Client | `sharepointClient.ts` | Document upload and archival |
| Durable Queue | `durableQueue.ts` | PostgreSQL-backed job queue |
| Job Worker | `jobWorker.ts` | Lease-based distributed processor |

### 4.3 Background Job System

The system uses a PostgreSQL-backed durable queue for reliable background processing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND JOB ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      JOB TYPES                                       │   │
│   │                                                                      │   │
│   │   • process_call_record  - Handle webhook notification               │   │
│   │   • enrich_meeting       - Fetch transcript from Graph API           │   │
│   │   • generate_minutes     - Call Azure OpenAI for AI processing       │   │
│   │   • send_email           - Distribute minutes via Exchange           │   │
│   │   • upload_sharepoint    - Archive to SharePoint library             │   │
│   │   • sync_azure_groups    - Refresh user group membership             │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      JOB QUEUE TABLE                                 │   │
│   │                                                                      │   │
│   │   id               UUID (PK)                                         │   │
│   │   job_type         Text (enum)                                       │   │
│   │   idempotency_key  Text (unique) - prevents duplicate processing     │   │
│   │   payload          JSONB - job-specific data                         │   │
│   │   status           pending → processing → completed/failed           │   │
│   │   attempt_count    Integer - current retry number                    │   │
│   │   max_retries      Integer - default 3                               │   │
│   │   scheduled_for    Timestamp - for delayed execution                 │   │
│   │   error_message    Text - last failure reason                        │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      WORKER LEASE TABLE                              │   │
│   │                                                                      │   │
│   │   worker_name      Text (PK) - "main_job_worker"                     │   │
│   │   instance_id      Text - unique per container instance              │   │
│   │   acquired_at      Timestamp - lease start                           │   │
│   │   last_heartbeat   Timestamp - liveness check                        │   │
│   │   lease_expires_at Timestamp - automatic expiry (15s)                │   │
│   │                                                                      │   │
│   │   Features:                                                          │   │
│   │   • Only ONE worker active across all container instances            │   │
│   │   • Automatic takeover if worker crashes (no heartbeat)              │   │
│   │   • No advisory locks required (works with Azure PostgreSQL)         │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Azure Services

### 5.1 Required Azure Services

| Service | SKU/Tier | Purpose | Estimated Monthly Cost |
|---------|----------|---------|------------------------|
| Azure Container Apps | Consumption | Application hosting | $0.000012/vCPU-sec |
| Azure Database for PostgreSQL | Flexible Server (Burstable B1ms) | Data persistence | ~$15-30 |
| Azure OpenAI Service | Standard S0 | GPT-4o for AI processing | Pay-per-token |
| Microsoft Entra ID | Standard (included with M365) | Authentication | Included |
| Azure Container Registry | Basic | Docker image storage | ~$5 |
| Application Insights | Basic | Monitoring and logging | ~$2.30/GB ingested |

### 5.2 Optional Azure Services

| Service | Purpose | When Needed |
|---------|---------|-------------|
| Azure Key Vault | Secret management | Production deployments |
| Azure Front Door | Global load balancing | Multi-region deployments |
| Azure Monitor | Advanced observability | Enterprise monitoring |

### 5.3 Azure OpenAI Token Consumption Estimate

| Meeting Type | Avg Transcript Words | Input Tokens | Output Tokens | Est. Cost |
|--------------|---------------------|--------------|---------------|-----------|
| Short (30 min) | 3,000 | ~4,000 | ~1,500 | ~$0.07 |
| Medium (1 hour) | 7,000 | ~9,000 | ~2,000 | ~$0.14 |
| Long (2 hours) | 15,000 | ~20,000 | ~3,000 | ~$0.29 |

*Based on GPT-4o pricing: $5/1M input tokens, $15/1M output tokens*

### 5.4 Workload Sizing Recommendations

| Organization Size | Daily Meetings | Container Apps Config | PostgreSQL Tier | Est. Monthly Cost |
|-------------------|----------------|----------------------|-----------------|-------------------|
| Small (< 100 users) | 5-20 | 0.5 vCPU, 1 Gi, 1-2 replicas | Burstable B1ms | ~$50-80 |
| Medium (100-500 users) | 20-100 | 1 vCPU, 2 Gi, 2-5 replicas | Burstable B2s | ~$120-200 |
| Large (500+ users) | 100+ | 2 vCPU, 4 Gi, 5-10 replicas | General Purpose D2s | ~$300-500 |

**Scaling Considerations:**
- Container Apps auto-scales based on HTTP request concurrency (threshold: 100 concurrent)
- Background job worker uses lease-based locking (only ONE active worker per deployment)
- PostgreSQL connection pooling recommended for > 100 concurrent users
- Graph API rate limits: 10,000 requests per 10 minutes per tenant

### 5.5 Important: Approval Workflow Note

The system implements an **explicit approval workflow** where:
1. AI generates minutes automatically after meeting ends
2. Minutes remain in "Pending Review" status until approver action
3. **Email distribution only occurs after explicit user approval** (not automatic)
4. SharePoint archival occurs as part of the post-approval pipeline

This design ensures human oversight of all AI-generated content before distribution.

---

## 6. Microsoft 365 Integration

### 6.1 Required Microsoft Graph Permissions

| Permission | Type | Purpose |
|------------|------|---------|
| `Calendars.Read` | Delegated | Read user calendar events |
| `User.Read` | Delegated | Read user profile |
| `GroupMember.Read.All` | Delegated | Read user group membership |
| `CallRecords.Read.All` | Application | Receive call record webhooks |
| `OnlineMeetings.Read` | Delegated | Read online meeting details |
| `OnlineMeetingTranscript.Read.All` | Application | Access meeting transcripts |
| `Mail.Send` | Delegated | Send distribution emails |
| `Sites.ReadWrite.All` | Delegated | Upload to SharePoint |

### 6.2 Microsoft Entra ID App Registration

**Application Settings:**
- Application (client) ID: `{generated-guid}`
- Supported account types: Accounts in any organizational directory (Multi-tenant)
- Redirect URIs: `https://{app-hostname}/auth/callback`

**Expose an API:**
- Application ID URI: `api://{app-hostname}/{client-id}`
- Scopes: `access_as_user` (Admins and users)
- Authorized client applications:
  - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile)
  - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)

---

## 7. Security Architecture

### 7.1 Authentication Security

| Control | Implementation |
|---------|----------------|
| Transport Security | TLS 1.2+ required for all connections |
| Token Validation | MSAL JWT validation with JWKS |
| OBO Token Exchange | Fail-closed design (returns null on error) |
| Session Management | Encrypted sessions with configurable TTL |
| Secret Storage | Environment variables or Azure Key Vault |

### 7.2 Authorization Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHORIZATION DECISION FLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Request ──► Authenticate ──► Get User ──► Check Role ──►     │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │        ┌───────────────────┐                            │   │
│   │        │  Role Check       │                            │   │
│   │        │  (admin, approver,│                            │   │
│   │        │   auditor, viewer)│                            │   │
│   │        └─────────┬─────────┘                            │   │
│   │                  │                                      │   │
│   │                  ▼                                      │   │
│   │        ┌───────────────────┐                            │   │
│   │        │  Clearance Check  │                            │   │
│   │        │  (TOP_SECRET ≥    │                            │   │
│   │        │   SECRET ≥        │                            │   │
│   │        │   CONFIDENTIAL ≥  │                            │   │
│   │        │   UNCLASSIFIED)   │                            │   │
│   │        └─────────┬─────────┘                            │   │
│   │                  │                                      │   │
│   │                  ▼                                      │   │
│   │        ┌───────────────────┐                            │   │
│   │        │  Meeting Access   │                            │   │
│   │        │  (Organizer or    │                            │   │
│   │        │   Attendee check) │                            │   │
│   │        └─────────┬─────────┘                            │   │
│   │                  │                                      │   │
│   │                  ▼                                      │   │
│   │            ┌──────────┐                                 │   │
│   │            │  ALLOW   │                                 │   │
│   │            │   or     │                                 │   │
│   │            │  DENY    │                                 │   │
│   │            └──────────┘                                 │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Data Classification

| Level | Description | Access Requirement |
|-------|-------------|-------------------|
| UNCLASSIFIED | Public or internal information | Any authenticated user |
| CONFIDENTIAL | Limited distribution | CONFIDENTIAL clearance or higher |
| SECRET | Sensitive information | SECRET clearance or higher |
| TOP_SECRET | Highly restricted | TOP_SECRET clearance only |

---

## 8. Data Flow

### 8.1 Request/Response Flow

```
Client ──► Azure Container Apps ──► Express.js ──► PostgreSQL
                    │
                    ├──► Entra ID (auth)
                    ├──► Microsoft Graph (data)
                    └──► Azure OpenAI (AI)
```

### 8.2 Job Processing Flow

```
Webhook ──► API ──► Durable Queue ──► Job Worker ──► Processing
                         │
                         ├──► Graph API (transcript)
                         ├──► Azure OpenAI (minutes)
                         ├──► Graph Mail (distribution)
                         └──► SharePoint (archival)
```

---

## 9. Deployment Architecture

### 9.1 Azure Container Apps Configuration

```yaml
Container App:
  Name: teams-minutes-app
  Image: teamminutesacr.azurecr.io/teams-minutes:latest
  CPU: 0.5 vCPU
  Memory: 1.0 Gi
  Min Replicas: 1
  Max Replicas: 10
  Scale Rules:
    - Type: HTTP
      Metadata:
        concurrentRequests: 100

Ingress:
  External: true
  Target Port: 5000
  Transport: HTTP
  Allow Insecure: false

Environment Variables:
  - DATABASE_URL (from secret)
  - SESSION_SECRET (from secret)
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_API_KEY (from secret)
  - AZURE_CLIENT_ID
  - AZURE_CLIENT_SECRET (from secret)
  - AZURE_TENANT_ID
```

### 9.2 CI/CD Pipeline (GitHub Actions)

```
Push to main ──► Build Container ──► Push to ACR ──► Deploy to Container Apps
                      │
                      ├── Run tests
                      ├── Build Docker image
                      ├── Tag with commit SHA
                      └── Update Container App revision
```

---

## 10. Appendix: Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User profiles and permissions | id, email, azure_ad_id, role, clearance_level |
| `meetings` | Meeting metadata | id, title, scheduled_at, status, classification_level, organizer_id |
| `meeting_minutes` | Generated minutes | id, meeting_id, summary, processing_status, approval_status |
| `action_items` | Tasks from meetings | id, minutes_id, task, assignee, due_date, status |
| `job_queue` | Background job queue | id, job_type, idempotency_key, status, payload |
| `job_worker_leases` | Distributed locking | worker_name, instance_id, lease_expires_at |
| `graph_subscriptions` | Webhook tracking | id, resource, expiration_date, status |
| `azure_ad_group_cache` | Group membership cache | user_azure_ad_id, group_names, expires_at |

### Entity Relationships

```
users ──┬──< meetings (organizer)
        │
        └──< meeting_attendees

meetings ──< meeting_minutes ──< action_items

job_queue (standalone)
job_worker_leases (standalone)
graph_subscriptions (standalone)
azure_ad_group_cache (users.azure_ad_id reference)
```

---

## Document Information

| Field | Value |
|-------|-------|
| Document Title | Teams Meeting Minutes AI - Architecture Documentation |
| Version | 1.0 |
| Author | Enterprise Architecture Team |
| Status | Draft for Microsoft Review |
| Distribution | Microsoft Azure Team |

---

*This document is intended for technical review and cost estimation purposes. All architecture patterns and service selections are subject to change based on specific deployment requirements and Microsoft recommendations.*
