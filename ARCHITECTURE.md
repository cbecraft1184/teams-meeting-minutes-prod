# System Architecture
## DOD Teams Meeting Minutes Management System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DOD Network Boundary                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        AWS Gov Cloud VPC                                │ │
│  │                                                                          │ │
│  │  ┌──────────────────┐                 ┌──────────────────┐             │ │
│  │  │  Load Balancer   │◄────────────────┤   CloudWatch     │             │ │
│  │  │   (ALB/NLB)      │                 │   Monitoring     │             │ │
│  │  └────────┬─────────┘                 └──────────────────┘             │ │
│  │           │                                                              │ │
│  │  ┌────────▼─────────────────────────────────────────────┐              │ │
│  │  │                Application Tier                       │              │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │              │ │
│  │  │  │  Node.js Application Servers (Auto-scaling)     │ │              │ │
│  │  │  │  - Express.js API                                │ │              │ │
│  │  │  │  - React SPA (served)                            │ │              │ │
│  │  │  │  - Session Management                            │ │              │ │
│  │  │  └──────────┬──────────────────────────────────────┘ │              │ │
│  │  └─────────────┼──────────────────────────────────────────┘              │ │
│  │                │                                                          │ │
│  │  ┌─────────────▼─────────────────────────────────────────┐              │ │
│  │  │                  Data Tier                             │              │ │
│  │  │  ┌──────────────────────┐  ┌──────────────────────┐  │              │ │
│  │  │  │  PostgreSQL RDS      │  │   S3 Bucket          │  │              │ │
│  │  │  │  (encrypted)         │  │   (document cache)   │  │              │ │
│  │  │  │  - Meeting data      │  │   - Encrypted        │  │              │ │
│  │  │  │  - Minutes           │  │   - Versioning       │  │              │ │
│  │  │  │  - Action items      │  │                      │  │              │ │
│  │  │  └──────────────────────┘  └──────────────────────┘  │              │ │
│  │  └────────────────────────────────────────────────────────┘              │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                      Azure Gov Cloud Services                             │ │
│  │  ┌──────────────────────┐         ┌──────────────────────┐              │ │
│  │  │  Azure OpenAI        │         │  Microsoft Graph API │              │ │
│  │  │  Service             │         │  (Teams Integration) │              │ │
│  │  │  - GPT-4 Deployment  │         │  - Meeting events    │              │ │
│  │  │  - Gov Cloud Region  │         │  - Transcripts       │              │ │
│  │  └──────────────────────┘         └──────────────────────┘              │ │
│  │                                                                          │ │
│  │  ┌──────────────────────────────────────────────────────┐              │ │
│  │  │           SharePoint Online (DOD Tenant)             │              │ │
│  │  │           - Document Libraries                        │              │ │
│  │  │           - Metadata & Classification                 │              │ │
│  │  │           - Access Control                            │              │ │
│  │  └──────────────────────────────────────────────────────┘              │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

                              Users Access via
                    Microsoft Teams Desktop/Web/Mobile Clients
```

### Component Architecture

#### Frontend Layer
```
┌─────────────────────────────────────────────────────────────┐
│                      React Single Page Application           │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer                                          │
│  ├─ Dashboard                    (meeting stats, recent)    │
│  ├─ Meetings List                (all meetings, filters)    │
│  ├─ Search Archive               (advanced search)          │
│  ├─ Settings                     (configuration)            │
│  └─ Meeting Details Modal        (tabbed interface)         │
├─────────────────────────────────────────────────────────────┤
│  Component Library                                           │
│  ├─ Shadcn UI Components         (buttons, cards, etc)      │
│  ├─ Classification Badges        (security levels)          │
│  ├─ Status Indicators            (processing states)        │
│  ├─ Meeting Cards                (summary display)          │
│  └─ Sidebar Navigation           (app navigation)           │
├─────────────────────────────────────────────────────────────┤
│  State Management                                            │
│  ├─ TanStack Query               (API cache, sync)          │
│  ├─ React Hooks                  (local state)              │
│  └─ Theme Context                (dark/light mode)          │
├─────────────────────────────────────────────────────────────┤
│  Routing & Navigation                                        │
│  └─ Wouter                       (client-side routing)      │
└─────────────────────────────────────────────────────────────┘
```

#### Backend Layer
```
┌─────────────────────────────────────────────────────────────┐
│                     Express.js Application                   │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                  │
│  ├─ /api/meetings                (CRUD operations)          │
│  ├─ /api/minutes                 (generate, retrieve)       │
│  ├─ /api/action-items            (manage tasks)             │
│  ├─ /api/stats                   (dashboard metrics)        │
│  ├─ /api/search                  (archive search)           │
│  └─ /api/webhooks/teams          (Teams event receiver)     │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                        │
│  ├─ Meeting Service              (meeting lifecycle)        │
│  ├─ Minutes Generator            (AI processing)            │
│  ├─ SharePoint Service           (document archival)        │
│  ├─ Teams Integration            (Graph API client)         │
│  └─ Document Exporter            (DOCX/PDF generation)      │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer                                           │
│  ├─ Storage Interface            (abstraction)              │
│  ├─ PostgreSQL Client            (ORM/raw queries)          │
│  └─ Cache Layer                  (session, temp data)       │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                           │
│  ├─ Microsoft Graph Client       (Teams API)                │
│  ├─ SharePoint Connector         (OAuth authenticated)      │
│  ├─ Azure OpenAI Client          (GPT-4 API)                │
│  └─ Webhook Validator            (signature verification)   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

#### Meeting Capture Flow
```
┌──────────────┐       Webhook Event       ┌──────────────┐
│ MS Teams     │─────────────────────────►│  Application │
│ (Meeting     │  meeting.ended            │  Webhook     │
│  Ends)       │                           │  Handler     │
└──────────────┘                           └──────┬───────┘
                                                  │
                                                  │ 1. Validate signature
                                                  │ 2. Extract meeting ID
                                                  │ 3. Create DB record
                                                  ▼
                                           ┌──────────────┐
                                           │  Graph API   │
                                           │  Request     │
                                           │  - Get       │
                                           │    recording │
                                           │  - Get       │
                                           │    transcript│
                                           └──────┬───────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │  Processing  │
                                           │  Queue       │
                                           │  (async)     │
                                           └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┴─────────────────────────┐
                    │                                                         │
                    ▼                                                         ▼
         ┌──────────────────┐                                    ┌───────────────────┐
         │ Azure OpenAI     │                                    │  Document         │
         │ - Summarize      │                                    │  Generation       │
         │ - Extract items  │                                    │  - DOCX template  │
         │ - Identify       │                                    │  - PDF export     │
         │   decisions      │                                    │  - Classification │
         └────────┬─────────┘                                    └─────────┬─────────┘
                  │                                                        │
                  ▼                                                        │
         ┌──────────────────┐                                             │
         │  Database        │◄────────────────────────────────────────────┘
         │  - Save minutes  │
         │  - Action items  │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  SharePoint      │
         │  Upload          │
         │  - Set metadata  │
         │  - Apply perms   │
         └──────────────────┘
```

#### User Search Flow
```
┌─────────────┐        Search Request        ┌──────────────┐
│   User      │───────────────────────────►  │  Frontend    │
│  (Browser)  │                               │  React App   │
└─────────────┘                               └──────┬───────┘
                                                     │
                                                     │ TanStack Query
                                                     ▼
                                              ┌──────────────┐
                                              │  API         │
                                              │  /api/search │
                                              └──────┬───────┘
                                                     │
                              ┌──────────────────────┴────────────────────┐
                              │                                           │
                              ▼                                           ▼
                       ┌──────────────┐                          ┌───────────────┐
                       │  PostgreSQL  │                          │  SharePoint   │
                       │  Full-text   │                          │  Search API   │
                       │  Search      │                          │  (optional)   │
                       └──────┬───────┘                          └───────┬───────┘
                              │                                           │
                              └──────────────────┬────────────────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  Aggregate   │
                                          │  & Filter    │
                                          │  Results     │
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  Response    │
                                          │  with        │
                                          │  Pagination  │
                                          └──────────────┘
```

### Security Architecture

#### Authentication & Authorization Flow
```
┌─────────────┐                          ┌──────────────────┐
│   User      │                          │  Microsoft       │
│             │──1. Login Request──────►│  Identity        │
│             │                          │  Platform        │
│             │◄─2. OAuth Redirect──────│  (Azure AD)      │
└─────────────┘                          └──────────────────┘
      │
      │ 3. ID Token + Access Token
      ▼
┌─────────────────────────────────────────────────────────┐
│              Application Server                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Verify Token                                    │   │
│  │  - Signature validation                          │   │
│  │  - Expiry check                                  │   │
│  │  - Claims verification                           │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Session Creation                                │   │
│  │  - Store user context                            │   │
│  │  - Set security level                            │   │
│  │  - Create session cookie                         │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │                                    │
└─────────────────────┼────────────────────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  User Session    │
            │  - Encrypted     │
            │  - HTTP-only     │
            │  - Secure flag   │
            └──────────────────┘
```

#### Data Classification Enforcement
```
┌──────────────────────────────────────────────────────────┐
│                Classification Layers                      │
├──────────────────────────────────────────────────────────┤
│  Application Layer                                        │
│  ├─ UI Badge Display          (visual indication)        │
│  ├─ Form Validation           (enforce rules)            │
│  └─ Export Headers            (document marking)         │
├──────────────────────────────────────────────────────────┤
│  API Layer                                                │
│  ├─ Request Validation        (check permissions)        │
│  ├─ Response Filtering        (redact if needed)         │
│  └─ Audit Logging             (all access recorded)      │
├──────────────────────────────────────────────────────────┤
│  Database Layer                                           │
│  ├─ Row-level Security        (PostgreSQL RLS)           │
│  ├─ Encryption at Rest        (AES-256)                  │
│  └─ Metadata Storage          (classification field)     │
├──────────────────────────────────────────────────────────┤
│  Storage Layer (SharePoint)                               │
│  ├─ Document Properties       (classification metadata)  │
│  ├─ Access Control Lists      (permission inheritance)   │
│  └─ DLP Policies              (data loss prevention)     │
└──────────────────────────────────────────────────────────┘
```

### Deployment Architecture

#### AWS Gov Cloud Infrastructure
```
┌─────────────────────────────────────────────────────────────┐
│                        Region: us-gov-west-1                 │
├─────────────────────────────────────────────────────────────┤
│  Availability Zone A          │  Availability Zone B         │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐│
│  │  Public Subnet          │  │  │  Public Subnet          ││
│  │  ┌──────────────────┐   │  │  │  ┌──────────────────┐   ││
│  │  │  NAT Gateway     │   │  │  │  │  NAT Gateway     │   ││
│  │  └──────────────────┘   │  │  │  └──────────────────┘   ││
│  └─────────────────────────┘  │  └─────────────────────────┘│
│                                │                              │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐│
│  │  Private Subnet (App)   │  │  │  Private Subnet (App)   ││
│  │  ┌──────────────────┐   │  │  │  ┌──────────────────┐   ││
│  │  │  EC2 Instance    │   │  │  │  │  EC2 Instance    │   ││
│  │  │  (Auto-scaling)  │   │  │  │  │  (Auto-scaling)  │   ││
│  │  └──────────────────┘   │  │  │  └──────────────────┘   ││
│  └─────────────────────────┘  │  └─────────────────────────┘│
│                                │                              │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐│
│  │  Private Subnet (Data)  │  │  │  Private Subnet (Data)  ││
│  │  ┌──────────────────┐   │  │  │  ┌──────────────────┐   ││
│  │  │  RDS Primary     │───┼──┼──┼─►│  RDS Standby     │   ││
│  │  │  (PostgreSQL)    │   │  │  │  │  (Replica)       │   ││
│  │  └──────────────────┘   │  │  │  └──────────────────┘   ││
│  └─────────────────────────┘  │  └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Scalability & Performance

#### Auto-scaling Configuration
- **Application Tier**: 2-10 instances based on CPU and memory utilization
- **Database**: Read replicas for query distribution
- **Caching**: Redis cluster for session management and temporary data
- **CDN**: CloudFront (Gov Cloud) for static asset delivery

#### Performance Targets
- **API Response Time**: <200ms (p95)
- **Page Load Time**: <2 seconds (p95)
- **Meeting Processing**: <5 minutes per hour of recording
- **Search Results**: <500ms for typical queries
- **Concurrent Users**: 1000+ simultaneous connections

### Disaster Recovery

#### Backup Strategy
- **Database**: Automated daily snapshots, 30-day retention
- **Documents**: S3 versioning enabled, cross-region replication
- **Configuration**: Infrastructure-as-Code in version control
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours

#### High Availability
- Multi-AZ deployment for all critical components
- Health checks with automatic failover
- Database replication with automatic promotion
- Graceful degradation for non-critical features

---

**Document Classification**: UNCLASSIFIED  
**Last Updated**: October 30, 2025  
**Version**: 1.0
