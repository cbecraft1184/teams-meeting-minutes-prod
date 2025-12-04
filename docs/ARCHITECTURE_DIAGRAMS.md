# Teams Meeting Minutes AI - Visio Diagram Guide

This document provides simplified diagram layouts optimized for recreation in Microsoft Visio or similar diagramming tools.

---

## Diagram 1: High-Level System Architecture

**Diagram Type:** Network/Cloud Architecture  
**Visio Template:** Azure Architecture (recommended)

### Components to Place:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL (TOP ROW)                              │
│                                                                         │
│  [Teams Client]    [Exchange Online]    [SharePoint]    [Calendar]      │
│       ↓                   ↓                  ↓              ↓           │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
                    [Microsoft Graph API]
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      AZURE CONTAINER APPS (MIDDLE)                      │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │              APPLICATION CONTAINER                           │     │
│    │                                                              │     │
│    │   [React Frontend]  ←→  [Express API]  ←→  [Job Worker]     │     │
│    │                                                              │     │
│    └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       AZURE SERVICES (BOTTOM ROW)                       │
│                                                                         │
│   [PostgreSQL]      [Azure OpenAI]      [Entra ID]      [Key Vault]    │
│   (Flexible Server)    (GPT-4o)        (Entra ID)       (Optional)     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visio Shape Recommendations:

| Component | Visio Shape | Color |
|-----------|-------------|-------|
| Teams Client | Microsoft Teams icon | Purple |
| Exchange Online | Mail icon | Blue |
| SharePoint | SharePoint icon | Green |
| Graph API | API gateway | Blue |
| Container App | Container icon | Light blue |
| PostgreSQL | Database cylinder | Blue |
| Azure OpenAI | Brain/AI icon | Purple |
| Entra ID | Shield icon | Blue |

---

## Diagram 2: Meeting Lifecycle Flow

**Diagram Type:** Flowchart/Process Flow  
**Visio Template:** Basic Flowchart

### Process Steps:

```
START
   │
   ▼
┌─────────────────────┐
│ 1. User Schedules   │
│    Teams Meeting    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Calendar Delta   │ ←── Microsoft Graph API
│    Sync Detects     │
│    New Meeting      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Meeting Occurs   │
│    (Transcription   │
│     Enabled)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Meeting Ends     │
│    callRecords      │ ←── Graph Webhook
│    Webhook Fires    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Enrichment Job   │
│    Enqueued         │ ←── Durable Queue
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 6. Fetch Transcript │ ←── Graph API
│    from Graph       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ 7. Processing Validation   │
│    • Duration ≥ 2 min      │
│    • Words ≥ 25            │
│    • Transcript exists     │
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     │  VALID?   │
     └─────┬─────┘
       YES │ NO
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐  ┌─────────────┐
│ Continue │  │ Skip with   │
│          │  │ Audit Log   │
└────┬─────┘  └─────────────┘
     │
     ▼
┌─────────────────────┐
│ 8. AI Processing    │ ←── Azure OpenAI GPT-4o
│    Generate Minutes │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 9. Pending Review   │
│    Approver Notified│
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ APPROVED? │
     └─────┬─────┘
       YES │ NO
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐  ┌──────────┐
│ Approved │  │ Rejected │
└────┬─────┘  │ Return   │
     │        │ for Edit │
     ▼        └──────────┘
┌─────────────────────┐
│ 10. Generate DOCX   │
│     and PDF         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 11. Email to        │ ←── Exchange/Graph Mail
│     All Attendees   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 12. Upload to       │ ←── SharePoint API
│     SharePoint      │
└──────────┬──────────┘
           │
           ▼
         END
```

---

## Diagram 3: Authentication Flow

**Diagram Type:** Sequence Diagram  
**Visio Template:** UML Sequence

### Actors & Lifelines:

1. **User** (Actor)
2. **Teams Client** (System)
3. **Backend API** (System)
4. **Entra ID** (External)
5. **Microsoft Graph** (External)

### Sequence:

```
User          Teams         Backend        Entra ID       Graph API
  │             │              │              │              │
  │──Open App──►│              │              │              │
  │             │              │              │              │
  │             │──Get SSO────►│              │              │
  │             │   Token      │              │              │
  │             │◄─────────────│              │              │
  │             │              │              │              │
  │             │──API Call────────────────►│              │
  │             │  (Bearer Token)            │              │
  │             │              │              │              │
  │             │              │──Validate JWT─────────────►│
  │             │              │◄──────────────────────────│
  │             │              │              │              │
  │             │              │──OBO Token Exchange──────►│
  │             │              │◄─────Graph Token─────────│
  │             │              │              │              │
  │             │              │──Get /me/memberOf────────────────►│
  │             │              │◄─────User Groups─────────────────│
  │             │              │              │              │
  │             │              │──Check Role &─┐              │
  │             │              │  Clearance   │              │
  │             │              │◄─────────────┘              │
  │             │              │              │              │
  │             │◄─Response────│              │              │
  │◄─Display────│              │              │              │
  │             │              │              │              │
```

---

## Diagram 4: Graph API Integration Map

**Diagram Type:** Integration/Component Diagram  
**Visio Template:** Software/System Design

### Layout:

```
                    ┌───────────────────────────────────┐
                    │     TEAMS MEETING MINUTES APP     │
                    │                                   │
                    │   ┌───────────────────────────┐   │
                    │   │    Microsoft Graph        │   │
                    │   │    Client (MSAL v2)       │   │
                    │   └─────────────┬─────────────┘   │
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │   MICROSOFT GRAPH API v1.0        │
                    │   https://graph.microsoft.com     │
                    └───────────────────────────────────┘
                                      │
        ┌─────────────┬───────────────┼───────────────┬─────────────┐
        │             │               │               │             │
        ▼             ▼               ▼               ▼             ▼
   ┌─────────┐   ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌─────────┐
   │CALENDAR │   │CALL     │    │ USER &  │    │  MAIL   │   │SHAREPOINT│
   │ EVENTS  │   │RECORDS  │    │ GROUPS  │    │         │   │         │
   │         │   │         │    │         │    │         │   │         │
   │/me/     │   │/communi-│    │/me      │    │/me/send │   │/sites/  │
   │events   │   │cations/ │    │/me/     │    │Mail     │   │{id}/    │
   │         │   │callRec- │    │memberOf │    │         │   │drive    │
   │         │   │ords     │    │         │    │         │   │         │
   │Calendars│   │         │    │User.Read│    │Mail.Send│   │Sites.   │
   │.Read    │   │CallRec- │    │Group    │    │         │   │ReadWrite│
   │         │   │ords.    │    │Member.  │    │         │   │.All     │
   │         │   │Read.All │    │Read.All │    │         │   │         │
   └─────────┘   └─────────┘    └─────────┘    └─────────┘   └─────────┘
        │             │               │               │             │
        │             │               │               │             │
        ▼             ▼               ▼               ▼             ▼
   ┌─────────┐   ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌─────────┐
   │Calendar │   │Meeting  │    │RBAC     │    │Email    │   │Document │
   │Sync     │   │Detection│    │Auth     │    │Distrib- │   │Archival │
   │         │   │& Trans- │    │         │    │ution    │   │         │
   │         │   │cripts   │    │         │    │         │   │         │
   └─────────┘   └─────────┘    └─────────┘    └─────────┘   └─────────┘
```

---

## Diagram 5: Background Job Processing

**Diagram Type:** Component/Process Diagram  
**Visio Template:** Software Architecture

### Components:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        JOB PROCESSING ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   WEBHOOK    │
    │  ENDPOINT    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                    DURABLE JOB QUEUE                         │
    │                    (PostgreSQL Table)                        │
    │                                                              │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
    │  │ pending  │ │ pending  │ │processing│ │completed │        │
    │  │ enrich   │ │ generate │ │ email    │ │ upload   │        │
    │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
    │                                                              │
    │  Features:                                                   │
    │  • Idempotency (no duplicate processing)                     │
    │  • Retry with exponential backoff                            │
    │  • Dead letter queue for failed jobs                         │
    │  • Crash recovery                                            │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
                               │
                               ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                    JOB WORKER (Lease-Based)                  │
    │                                                              │
    │  ┌─────────────────────────────────────────────────────┐     │
    │  │              WORKER LEASE TABLE                      │     │
    │  │                                                      │     │
    │  │  worker_name: "main_job_worker"                      │     │
    │  │  instance_id: "worker-abc123"                        │     │
    │  │  lease_expires_at: (15 seconds)                      │     │
    │  │  last_heartbeat: (5 second interval)                 │     │
    │  │                                                      │     │
    │  │  Ensures: Only ONE worker active across all          │     │
    │  │           container instances                        │     │
    │  └─────────────────────────────────────────────────────┘     │
    │                                                              │
    │  Poll: Every 5 seconds                                       │
    │  Process: One job at a time                                  │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │   GRAPH API  │   │ AZURE OPENAI │   │  SHAREPOINT  │
    │  (Transcripts│   │   (GPT-4o)   │   │   (Upload)   │
    │   & Email)   │   │              │   │              │
    └──────────────┘   └──────────────┘   └──────────────┘
```

---

## Color Palette for Diagrams

| Component Type | Hex Color | Usage |
|----------------|-----------|-------|
| Azure Services | #0078D4 | Azure branding blue |
| Microsoft 365 | #106EBE | M365 branding |
| Container/App | #68217A | Container apps purple |
| Database | #004578 | Data storage |
| Success/Approved | #107C10 | Green states |
| Warning/Pending | #FFB900 | Yellow/amber states |
| Error/Rejected | #D13438 | Red states |
| Background | #F3F2F1 | Light gray containers |

---

## Export Notes for Microsoft

When converting to Visio:

1. Use **Azure Architecture** stencil for accurate icons
2. Maintain consistent spacing (32px grid recommended)
3. Use official Microsoft color palette
4. Add legend for custom symbols
5. Export as `.vsdx` (Visio 2013+) and `.pdf` for review

---

*Prepared for Microsoft Azure cost estimation review*
