# Teams Meeting Minutes V2 - Strategic Roadmap

**Document Version**: 1.0  
**Created**: January 3, 2026  
**Status**: APPROVED FOR PLANNING  
**Target Audience**: Development Team, Product Management, Stakeholders

---

## Executive Summary

This document outlines a comprehensive roadmap to evolve the Teams Meeting Minutes application from its current stable V1 state to a best-in-class enterprise solution for both Commercial and Government (GovCloud) environments. The roadmap is organized into four strategic phases spanning 12 months, with each phase building upon the previous to deliver incremental value while maintaining system stability.

### Current State (V1)
- Fully functional meeting minutes automation system
- 100% test pass rate in production (18/18 tests, 3 archived meetings)
- Core features: meeting detection, AI summarization, approval workflow, email/SharePoint distribution
- Multi-tenant isolation with Azure AD authentication
- Azure OpenAI GPT-4o integration

### Target State (V2)
- FedRAMP High/DoD IL4-IL5 compliance ready
- Enterprise-grade governance and administration
- Advanced AI capabilities with knowledge graphs
- Competitive differentiation against Otter.ai, Fireflies.ai, Microsoft Copilot

---

## Phase Overview

| Phase | Timeline | Focus Area | Key Deliverables |
|-------|----------|------------|------------------|
| Phase 1 | Q1 (Months 1-3) | Foundation & Compliance | FedRAMP controls, attendee identity, multi-region architecture |
| Phase 2 | Q2 (Months 4-6) | Enterprise Features | RBAC, analytics, integrations |
| Phase 3 | Q3 (Months 7-9) | AI Enhancements | Knowledge graph, redaction, sentiment analysis |
| Phase 4 | Q4 (Months 10-12) | Differentiation | Compliance reports, AI coaching, mobile app |

---

## Phase 1: Foundation & Compliance Hardening

**Timeline**: Months 1-3 (Q1)  
**Theme**: Build the security and compliance foundation required for Government deployment

### 1.1 FedRAMP/DoD Compliance Framework

#### 1.1.1 Customer-Managed Keys (CMK)
**Priority**: CRITICAL  
**Effort**: 3-4 weeks

**Current State**: Data encrypted with Azure-managed keys  
**Target State**: Customer-controlled encryption with Azure Key Vault HSM

**Technical Requirements**:
- Implement double-key encryption for data at rest
- Azure Key Vault Premium (HSM-backed) integration
- Key rotation automation (90-day cycle)
- Key access audit logging
- Emergency key recovery procedures

**Database Changes**:
```sql
-- New table for key management metadata
CREATE TABLE encryption_keys (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_vault_url TEXT NOT NULL,
  key_name TEXT NOT NULL,
  key_version TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);
```

**Acceptance Criteria**:
- [ ] All meeting data encrypted with tenant-specific keys
- [ ] Key rotation completes without service interruption
- [ ] Audit logs capture all key access events
- [ ] Recovery procedures tested and documented

---

#### 1.1.2 Boundary Protection (SC-7)
**Priority**: CRITICAL  
**Effort**: 2-3 weeks

**Requirements**:
- Network microsegmentation with Azure Private Endpoints
- Web Application Firewall (WAF) on Application Gateway
- DDoS protection enabled
- Egress filtering to approved destinations only
- Virtual Network service endpoints for Azure services

**Architecture**:
```
Internet → Azure Front Door (WAF) → Private Endpoint → Container App
                                                          ↓
                                    Private Endpoint → PostgreSQL
                                    Private Endpoint → Key Vault
                                    Private Endpoint → Storage
```

**Acceptance Criteria**:
- [ ] No public endpoints for backend services
- [ ] All traffic flows through WAF
- [ ] Egress whitelist enforced
- [ ] Network flow logs captured in Sentinel

---

#### 1.1.3 Continuous Monitoring & SIEM Integration
**Priority**: CRITICAL  
**Effort**: 2-3 weeks

**Requirements**:
- Azure Sentinel workspace deployment
- Custom detection rules for security events
- Automated POA&M (Plan of Action & Milestones) tracking
- Azure Policy enforcement for compliance drift
- Security Center integration with regulatory compliance dashboard

**Key Detections to Implement**:
| Detection | Trigger | Response |
|-----------|---------|----------|
| Cross-tenant access attempt | Query includes foreign tenant_id | Block + Alert |
| Bulk data export | >100 records in single request | Log + Review |
| Admin privilege escalation | Role change to admin | Approval required |
| Failed authentication spike | >10 failures in 5 minutes | Temporary lockout |
| Sensitive data access | Classification = SECRET+ | Audit log |

**Acceptance Criteria**:
- [ ] All security events flow to Sentinel
- [ ] Automated alerts for critical events
- [ ] Compliance dashboard shows FedRAMP control status
- [ ] POA&M items auto-tracked from findings

---

#### 1.1.4 ATO Accelerator Package
**Priority**: HIGH  
**Effort**: 4-6 weeks (parallel with development)

**Deliverables**:
1. **System Security Plan (SSP)**: Complete documentation of security controls
2. **Control Inheritance Matrix**: Mapping of Azure/Microsoft controls inherited
3. **Software Bill of Materials (SBOM)**: All dependencies with vulnerability status
4. **Penetration Test Report**: Third-party security assessment
5. **Vulnerability Management Plan**: Patching cadence and procedures
6. **Incident Response Plan**: Breach notification and containment procedures

**Acceptance Criteria**:
- [ ] SSP covers all FedRAMP High controls
- [ ] SBOM generated automatically in CI/CD
- [ ] No critical/high vulnerabilities unaddressed
- [ ] IRP tested via tabletop exercise

---

### 1.2 Attendee Identity Completion

**Priority**: CRITICAL  
**Effort**: 2-3 weeks

**Current Problem**: Only display names captured from Graph call records; emails missing for many attendees

**Solution**: Merge data from multiple sources

**Data Sources**:
1. Call Record participants (names, sometimes partial)
2. Calendar event attendees (names + emails)
3. Transcript speaker identification (names)
4. Azure AD user lookup (resolve names to emails)

**Technical Implementation**:

```typescript
interface EnrichedAttendee {
  displayName: string;
  email: string;
  userId?: string;           // Azure AD object ID
  role?: 'organizer' | 'presenter' | 'attendee';
  clearanceLevel?: string;   // NEW: For government
  attendanceStatus: 'attended' | 'invited' | 'declined' | 'unknown';
  joinTime?: Date;
  leaveTime?: Date;
  speakingDuration?: number; // Seconds spoken (from transcript)
}
```

**Database Changes**:
```sql
-- Enhanced attendees storage
ALTER TABLE meetings ADD COLUMN enriched_attendees JSONB;
ALTER TABLE meetings ADD COLUMN attendance_reconciled_at TIMESTAMP;
```

**Matching Algorithm**:
1. Start with calendar invitees (name + email)
2. Match call record participants by normalized name
3. Match transcript speakers by token similarity
4. Lookup unmatched names in Azure AD
5. Flag unresolved for manual review

**Acceptance Criteria**:
- [ ] >95% of attendees have email addresses
- [ ] Attendance status tracked (joined/invited/declined)
- [ ] Speaking duration calculated per attendee
- [ ] Unresolved attendees flagged in UI

---

### 1.3 Multi-Level Approval Workflows

**Priority**: CRITICAL  
**Effort**: 3-4 weeks

**Current State**: Single approval step (approved/rejected)  
**Target State**: Configurable multi-stage approval chains

**Use Cases**:
- Government: Drafter → Reviewer → Classification Officer → Release Authority
- Enterprise: Note-taker → Manager → Legal (if sensitive) → Distribution
- Simple: Auto-approve after 48 hours if no action

**Database Schema**:
```sql
-- Approval workflow templates
CREATE TABLE approval_workflows (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL, -- Array of approval stages
  auto_approve_hours INTEGER, -- Auto-approve if null = disabled
  applies_to JSONB, -- Conditions: classification, organizer, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Example stages JSONB:
-- [
--   {"stage": 1, "name": "Initial Review", "approvers": ["role:reviewer"], "sla_hours": 24},
--   {"stage": 2, "name": "Classification Check", "approvers": ["role:classification_officer"], "sla_hours": 8},
--   {"stage": 3, "name": "Release Authority", "approvers": ["user:specific@gov.mil"], "sla_hours": 48}
-- ]

-- Approval tracking per minutes
CREATE TABLE approval_stages (
  id VARCHAR PRIMARY KEY,
  minutes_id VARCHAR REFERENCES meeting_minutes(id),
  workflow_id VARCHAR REFERENCES approval_workflows(id),
  stage_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, skipped
  assigned_to TEXT[], -- Emails of potential approvers
  approved_by TEXT,
  approved_at TIMESTAMP,
  comments TEXT,
  attachments JSONB, -- Evidence files
  sla_deadline TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI Requirements**:
- Workflow designer for admins
- Stage-by-stage approval interface
- SLA countdown timers
- Escalation notifications
- Delegation support (out of office)

**Acceptance Criteria**:
- [ ] Configurable 1-5 stage workflows
- [ ] Role-based and user-based approvers
- [ ] SLA tracking with escalation
- [ ] Audit trail for each stage
- [ ] Email notifications at each stage

---

### 1.4 Multi-Region Architecture

**Priority**: CRITICAL  
**Effort**: 4-6 weeks

**Current State**: Single region (East US 2)  
**Target State**: Active-active multi-region with automatic failover

**Architecture**:
```
                    Azure Front Door (Global Load Balancer)
                              ↓
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
      East US 2          West US 2         Gov Virginia
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Container   │   │ Container   │   │ Container   │
    │ App         │   │ App         │   │ App         │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
    ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
    │ PostgreSQL  │   │ PostgreSQL  │   │ PostgreSQL  │
    │ (Primary)   │◄──│ (Read Rep)  │   │ (Gov)       │
    └─────────────┘   └─────────────┘   └─────────────┘
```

**Components**:
1. **Azure Front Door Premium**: Global routing, WAF, health probes
2. **Azure Database for PostgreSQL - Hyperscale**: Read replicas
3. **Azure Container Apps**: Per-region deployment
4. **Azure Service Bus**: Cross-region job coordination
5. **Azure Blob Storage**: Geo-redundant document storage

**Failover Scenarios**:
| Scenario | Detection | Response | RTO |
|----------|-----------|----------|-----|
| Region outage | Health probe failure | Route to secondary | <60s |
| Database primary failure | Connection errors | Promote replica | <5min |
| Container crash | Liveness probe | Restart container | <30s |

**Acceptance Criteria**:
- [ ] Traffic automatically routes around failures
- [ ] Database failover tested and documented
- [ ] Zero data loss during failover
- [ ] Recovery procedures in runbook

---

### 1.5 Feature Flags System

**Priority**: HIGH  
**Effort**: 1-2 weeks

**Purpose**: Enable gradual rollout of V2 features without affecting V1 stability

**Database Schema**:
```sql
CREATE TABLE feature_flags (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT false,
  enabled_tenants TEXT[], -- Specific tenants with access
  enabled_percentage INTEGER DEFAULT 0, -- Percentage rollout
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Initial flags for V2 features
INSERT INTO feature_flags (id, name, description) VALUES
  ('ff_multi_approval', 'multi_stage_approval', 'Multi-stage approval workflows'),
  ('ff_analytics', 'cross_meeting_analytics', 'Analytics dashboard'),
  ('ff_knowledge_graph', 'ai_knowledge_graph', 'AI knowledge graph linking'),
  ('ff_redaction', 'auto_redaction', 'Automatic PII/classified redaction');
```

**Service Implementation**:
```typescript
class FeatureFlagService {
  async isEnabled(flagName: string, tenantId: string): Promise<boolean> {
    const flag = await this.getFlag(flagName);
    if (!flag) return false;
    if (flag.enabled_globally) return true;
    if (flag.enabled_tenants?.includes(tenantId)) return true;
    if (flag.enabled_percentage > 0) {
      return this.hashTenant(tenantId) % 100 < flag.enabled_percentage;
    }
    return false;
  }
}
```

**Acceptance Criteria**:
- [ ] Feature flags checked at runtime
- [ ] Admin UI to manage flags
- [ ] Per-tenant and percentage rollout supported
- [ ] Flag changes take effect without restart

---

## Phase 2: Enterprise Features

**Timeline**: Months 4-6 (Q2)  
**Theme**: Deliver features expected by large enterprise customers

### 2.1 Granular Role-Based Access Control (RBAC)

**Priority**: HIGH  
**Effort**: 3-4 weeks

**Current Roles**: admin, approver, auditor, viewer  
**Target State**: Customizable roles with granular permissions

**Permission Model**:
```typescript
interface Permission {
  resource: 'meetings' | 'minutes' | 'action_items' | 'users' | 'settings' | 'analytics';
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'distribute' | 'export';
  scope: 'own' | 'team' | 'department' | 'organization';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean; // Cannot be deleted
}
```

**Database Schema**:
```sql
CREATE TABLE roles (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_roles (
  id VARCHAR PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id VARCHAR REFERENCES roles(id),
  scope_type TEXT, -- 'team', 'department', 'organization'
  scope_value TEXT, -- Team ID, Department name, etc.
  granted_by TEXT,
  granted_at TIMESTAMP DEFAULT NOW()
);
```

**Predefined Roles**:
| Role | Key Permissions |
|------|-----------------|
| Super Admin | All permissions, all scopes |
| Tenant Admin | All permissions within tenant |
| Department Manager | Full access to department meetings |
| Meeting Organizer | Full access to own meetings |
| Reviewer | Read + approve assigned meetings |
| Compliance Officer | Read all + export + analytics |
| Read-Only | Read assigned meetings only |

**Acceptance Criteria**:
- [ ] Custom roles can be created per tenant
- [ ] Permissions checked at API and UI level
- [ ] Scope-based access (own/team/dept/org)
- [ ] Role assignment audit logged

---

### 2.2 Cross-Meeting Analytics Dashboard

**Priority**: HIGH  
**Effort**: 4-5 weeks

**Features**:
1. **Meeting Volume Metrics**: Meetings per day/week/month, by organizer, by team
2. **Action Item Tracking**: Completion rates, overdue items, assignee workload
3. **Decision Tracking**: Decisions made, follow-up rates
4. **Participation Analytics**: Attendance rates, speaking time distribution
5. **AI Quality Metrics**: Summary accuracy ratings, user feedback

**Database Schema**:
```sql
-- Materialized view for fast analytics
CREATE MATERIALIZED VIEW meeting_analytics AS
SELECT 
  m.tenant_id,
  DATE_TRUNC('day', m.scheduled_at) as meeting_date,
  m.organizer_email,
  COUNT(DISTINCT m.id) as meeting_count,
  AVG(m.actual_duration_seconds) as avg_duration,
  COUNT(DISTINCT a.id) as action_items_created,
  COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as action_items_completed
FROM meetings m
LEFT JOIN action_items a ON a.meeting_id = m.id
GROUP BY m.tenant_id, DATE_TRUNC('day', m.scheduled_at), m.organizer_email;

-- Refresh schedule
CREATE INDEX ON meeting_analytics (tenant_id, meeting_date);
```

**API Endpoints**:
```
GET /api/analytics/overview          -- Dashboard summary
GET /api/analytics/meetings/trends   -- Meeting volume over time
GET /api/analytics/action-items      -- Action item metrics
GET /api/analytics/participants      -- Participation analytics
GET /api/analytics/search            -- Full-text search across transcripts
```

**UI Components**:
- Executive dashboard with KPI cards
- Interactive charts (Recharts library)
- Drill-down from metrics to individual meetings
- Export to Excel/PDF

**Acceptance Criteria**:
- [ ] Dashboard loads in <2 seconds
- [ ] Data updates within 1 hour of meeting completion
- [ ] Export to Excel and PDF working
- [ ] Mobile-responsive layout

---

### 2.3 ServiceNow/Jira Integration

**Priority**: HIGH  
**Effort**: 3-4 weeks

**Use Case**: Automatically create tickets from action items

**Integration Flow**:
```
Action Item Created → Integration Check → Create Ticket → Store Ticket ID
                                ↓
                    ServiceNow/Jira API
```

**Database Schema**:
```sql
CREATE TABLE integration_configs (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  integration_type TEXT NOT NULL, -- 'servicenow', 'jira', 'planner'
  config JSONB NOT NULL, -- Connection details (encrypted)
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Link action items to external tickets
ALTER TABLE action_items ADD COLUMN external_ticket_id TEXT;
ALTER TABLE action_items ADD COLUMN external_ticket_url TEXT;
ALTER TABLE action_items ADD COLUMN external_system TEXT;
```

**Configuration Options**:
| Setting | Description |
|---------|-------------|
| API URL | ServiceNow/Jira instance URL |
| Authentication | OAuth2 or API key |
| Project/Queue | Where to create tickets |
| Priority Mapping | Map action item priority to ticket priority |
| Auto-Sync | Sync status changes bidirectionally |
| Assignment | Map assignees to external users |

**Acceptance Criteria**:
- [ ] One-click setup wizard for each integration
- [ ] Action items sync to external system
- [ ] Status changes sync bidirectionally
- [ ] Manual sync option available

---

### 2.4 Microsoft Purview Integration

**Priority**: HIGH  
**Effort**: 2-3 weeks

**Purpose**: Apply sensitivity labels and enable eDiscovery

**Features**:
1. **Sensitivity Labels**: Auto-apply based on content classification
2. **Retention Policies**: Enforce document retention per policy
3. **eDiscovery**: Make meeting data searchable for legal holds
4. **Data Loss Prevention**: Block distribution of sensitive content

**Implementation**:
```typescript
// Apply sensitivity label to exported document
async function applySensitivityLabel(
  documentPath: string, 
  classificationLevel: string
): Promise<void> {
  const labelId = getLabelIdForClassification(classificationLevel);
  
  await graphClient
    .api(`/sites/{siteId}/drive/items/{itemId}/assignSensitivityLabel`)
    .post({ sensitivityLabelId: labelId });
}

// Classification to Label mapping
const labelMapping = {
  'UNCLASSIFIED': 'General',
  'CONFIDENTIAL': 'Confidential', 
  'SECRET': 'Highly Confidential',
  'TOP_SECRET': 'Top Secret - Restricted'
};
```

**Acceptance Criteria**:
- [ ] Sensitivity labels applied on SharePoint upload
- [ ] Retention policies enforced
- [ ] Content searchable in eDiscovery
- [ ] DLP policies block unauthorized sharing

---

### 2.5 Power Automate Connector

**Priority**: HIGH  
**Effort**: 2-3 weeks

**Purpose**: Enable custom workflows triggered by meeting events

**Triggers**:
| Trigger | Payload |
|---------|---------|
| Meeting Completed | Meeting ID, attendees, duration |
| Minutes Generated | Minutes ID, summary, action items |
| Minutes Approved | Minutes ID, approver, timestamp |
| Action Item Created | Item ID, assignee, due date |
| Action Item Overdue | Item ID, days overdue |

**Actions**:
| Action | Parameters |
|--------|------------|
| Get Meeting Details | Meeting ID |
| Get Minutes | Minutes ID |
| Update Action Item | Item ID, status, notes |
| Regenerate Minutes | Meeting ID, detail level |
| Send Custom Email | Recipients, subject, body |

**Acceptance Criteria**:
- [ ] Connector published to Power Platform
- [ ] All triggers fire correctly
- [ ] Actions execute without errors
- [ ] Documentation in Power Automate

---

## Phase 3: AI Enhancements

**Timeline**: Months 7-9 (Q3)  
**Theme**: Leverage AI for advanced intelligence beyond basic summarization

### 3.1 Knowledge Graph

**Priority**: HIGH  
**Effort**: 5-6 weeks

**Purpose**: Link decisions, action items, and topics across meetings

**Data Model**:
```typescript
interface KnowledgeNode {
  id: string;
  type: 'topic' | 'decision' | 'action_item' | 'person' | 'project';
  name: string;
  embedding: number[]; // Vector embedding for similarity
  metadata: Record<string, any>;
}

interface KnowledgeEdge {
  source: string; // Node ID
  target: string; // Node ID
  relationship: 'discussed_in' | 'decided_by' | 'assigned_to' | 'relates_to' | 'follows_up';
  weight: number; // Confidence/strength
  meetingId: string; // Source meeting
}
```

**Database Schema**:
```sql
-- Vector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_nodes (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  name TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimensions
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE knowledge_edges (
  id VARCHAR PRIMARY KEY,
  source_id VARCHAR REFERENCES knowledge_nodes(id),
  target_id VARCHAR REFERENCES knowledge_nodes(id),
  relationship TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  meeting_id VARCHAR REFERENCES meetings(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX ON knowledge_nodes USING ivfflat (embedding vector_cosine_ops);
```

**Use Cases**:
1. "Show me all discussions about Project X across meetings"
2. "What decisions were made about budget in Q4?"
3. "Who is responsible for AI initiatives?"
4. "What's the history of this action item?"

**UI Components**:
- Visual knowledge graph explorer
- Search with semantic understanding
- Timeline view of topic evolution
- "Related meetings" suggestions

**Acceptance Criteria**:
- [ ] Topics extracted and linked automatically
- [ ] Semantic search returns relevant results
- [ ] Graph visualization renders correctly
- [ ] Cross-meeting relationships visible

---

### 3.2 Automatic Redaction Pipeline

**Priority**: HIGH  
**Effort**: 4-5 weeks

**Purpose**: Automatically detect and redact sensitive information

**Redaction Categories**:
| Category | Examples | Action |
|----------|----------|--------|
| PII | SSN, phone numbers, addresses | Redact completely |
| Financial | Credit cards, bank accounts | Redact completely |
| Medical | Health conditions, medications | Redact if not medical meeting |
| Classified Terms | Code words, project names | Redact based on clearance |
| Custom | Organization-specific terms | Configurable per tenant |

**Implementation**:
```typescript
interface RedactionRule {
  id: string;
  category: string;
  pattern: RegExp | 'ai-detect';
  replacement: string; // e.g., "[REDACTED-PII]"
  appliesTo: 'transcript' | 'summary' | 'both';
  clearanceRequired?: string; // Minimum clearance to see unredacted
}

async function redactContent(
  content: string, 
  rules: RedactionRule[],
  viewerClearance: string
): Promise<{ redacted: string; redactions: Redaction[] }> {
  // Apply rules based on viewer clearance
}
```

**Database Schema**:
```sql
CREATE TABLE redaction_rules (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  pattern TEXT, -- Regex pattern or 'ai-detect'
  replacement TEXT NOT NULL,
  applies_to TEXT DEFAULT 'both',
  min_clearance TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE redaction_logs (
  id VARCHAR PRIMARY KEY,
  meeting_id VARCHAR REFERENCES meetings(id),
  original_hash TEXT, -- Hash of original content
  redacted_hash TEXT, -- Hash of redacted content
  redaction_count INTEGER,
  categories TEXT[],
  applied_at TIMESTAMP DEFAULT NOW()
);
```

**Acceptance Criteria**:
- [ ] PII detected with >95% accuracy
- [ ] Redaction audit log maintained
- [ ] Clearance-based viewing implemented
- [ ] Custom rules configurable per tenant

---

### 3.3 Sentiment & Risk Analysis

**Priority**: HIGH  
**Effort**: 3-4 weeks

**Purpose**: Identify contentious discussions and flag risks

**Analysis Dimensions**:
| Dimension | Indicators | Action |
|-----------|------------|--------|
| Sentiment | Positive/negative language | Color-code in UI |
| Conflict | Disagreement patterns | Alert organizer |
| Risk | Blockers, delays, budget concerns | Flag for review |
| Engagement | Participation levels | Report to manager |

**AI Prompt Enhancement**:
```typescript
const sentimentPrompt = `
Analyze this meeting transcript segment for:
1. Overall sentiment (positive/neutral/negative, 1-10 scale)
2. Any conflicts or disagreements (participants, topic, resolution status)
3. Risk indicators (blockers, delays, budget concerns, dependencies)
4. Engagement level (balanced discussion vs. dominated by few)

Return structured JSON with your analysis.
`;
```

**Database Schema**:
```sql
ALTER TABLE meeting_minutes ADD COLUMN sentiment_analysis JSONB;
-- Structure: {
--   "overall_sentiment": 7.5,
--   "conflicts": [{"topic": "budget", "participants": ["Alice", "Bob"], "resolved": false}],
--   "risks": [{"type": "blocker", "description": "Waiting on vendor", "severity": "high"}],
--   "engagement": {"balanced": true, "dominant_speakers": []}
-- }
```

**Acceptance Criteria**:
- [ ] Sentiment score displayed on minutes
- [ ] Conflicts highlighted with participants
- [ ] Risk items automatically flagged
- [ ] Engagement metrics in analytics

---

### 3.4 Customizable AI Prompts

**Priority**: MEDIUM  
**Effort**: 2-3 weeks

**Purpose**: Allow organizations to customize AI output format and tone

**Configurable Elements**:
| Element | Options |
|---------|---------|
| Tone | Formal, conversational, technical |
| Format | Narrative, bullet points, structured |
| Emphasis | Decisions, actions, discussions |
| Length | Concise, balanced, comprehensive |
| Language | Output language (multilingual) |

**Database Schema**:
```sql
CREATE TABLE ai_prompts (
  id VARCHAR PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  prompt_type TEXT NOT NULL, -- 'summary', 'action_items', 'decisions'
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  output_schema JSONB, -- Expected JSON structure
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI Components**:
- Prompt editor with preview
- Template library
- A/B testing for prompt effectiveness
- Feedback collection on output quality

**Acceptance Criteria**:
- [ ] Custom prompts configurable per tenant
- [ ] Preview mode shows sample output
- [ ] Template library with pre-built options
- [ ] Feedback mechanism to rate quality

---

## Phase 4: Differentiation

**Timeline**: Months 10-12 (Q4)  
**Theme**: Unique features that set us apart from competitors

### 4.1 Compliance Attestation Reports

**Priority**: HIGH  
**Effort**: 3-4 weeks

**Purpose**: One-click generation of audit-ready compliance reports

**Report Types**:
| Report | Content | Audience |
|--------|---------|----------|
| Meeting Audit Trail | Full history of a meeting lifecycle | Auditors |
| User Activity Report | Actions taken by specific user | Compliance |
| Classification Report | Documents by classification level | Security |
| Distribution Report | Who received what, when | Legal |
| Access Report | Who viewed what meetings | Privacy |

**Report Structure**:
```typescript
interface ComplianceReport {
  id: string;
  reportType: string;
  generatedAt: Date;
  generatedBy: string;
  parameters: Record<string, any>; // Date range, filters
  sections: ReportSection[];
  attestation: {
    statement: string;
    attestedBy: string;
    attestedAt: Date;
    digitalSignature?: string;
  };
}
```

**Features**:
- PDF export with digital signature
- Scheduled report generation
- Email delivery to stakeholders
- Tamper-evident report chain

**Acceptance Criteria**:
- [ ] All report types generate correctly
- [ ] Digital signature verification works
- [ ] Scheduled delivery functional
- [ ] Reports render in under 30 seconds

---

### 4.2 AI Meeting Effectiveness Coach

**Priority**: HIGH  
**Effort**: 4-5 weeks

**Purpose**: Provide insights to improve meeting quality

**Metrics Analyzed**:
| Metric | Description | Target |
|--------|-------------|--------|
| Decision Ratio | Decisions made per hour | >2 per hour |
| Action Completion | % of action items completed | >80% |
| Participation Balance | Standard deviation of speaking time | Low variance |
| Time Efficiency | Actual vs. scheduled duration | Within 10% |
| Follow-up Rate | % of action items with follow-ups | >90% |

**Coaching Insights**:
```typescript
interface CoachingInsight {
  category: 'efficiency' | 'engagement' | 'outcomes' | 'preparation';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  dataPoints: any[]; // Supporting evidence
}

// Example insights:
// "Your Tuesday standups run 40% longer than industry average. Consider a stricter agenda."
// "Action item completion rate dropped 15% this month. Consider assigning due dates."
// "3 attendees haven't spoken in the last 5 meetings. Consider rotating facilitators."
```

**UI Components**:
- Personal effectiveness dashboard
- Team benchmarking
- Trend analysis over time
- Recommendation cards with actions

**Acceptance Criteria**:
- [ ] Insights generated for each meeting
- [ ] Personal dashboard shows trends
- [ ] Recommendations are actionable
- [ ] Benchmarking against org average

---

### 4.3 Mobile Companion App

**Priority**: MEDIUM  
**Effort**: 6-8 weeks

**Purpose**: Review and approve minutes on mobile devices

**Features**:
| Feature | Description |
|---------|-------------|
| Push Notifications | Alert when approval needed |
| Quick Approve | Swipe to approve from notification |
| View Minutes | Read formatted minutes |
| Action Items | View and update assigned items |
| Offline Mode | Cache recent meetings |

**Technical Approach**:
- Progressive Web App (PWA) for cross-platform
- React Native for native features (notifications)
- Offline-first with sync when connected
- Biometric authentication (Face ID, fingerprint)

**Acceptance Criteria**:
- [ ] Push notifications work on iOS/Android
- [ ] Approve workflow functional on mobile
- [ ] Offline viewing of cached content
- [ ] Biometric auth supported

---

### 4.4 Clearance-Aware Content Display

**Priority**: HIGH (Government)  
**Effort**: 3-4 weeks

**Purpose**: Show/hide content based on viewer's clearance level

**Clearance Hierarchy**:
```
TOP_SECRET > SECRET > CONFIDENTIAL > UNCLASSIFIED
```

**Implementation**:
```typescript
interface UserClearance {
  userId: string;
  clearanceLevel: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  caveats: string[]; // e.g., 'SCI', 'SAP', 'NATO'
  validUntil: Date;
  verifiedBy: string;
}

function canViewContent(
  userClearance: UserClearance,
  contentClassification: string,
  contentCaveats: string[]
): boolean {
  // Check clearance level
  if (getClearanceRank(userClearance.clearanceLevel) < getClearanceRank(contentClassification)) {
    return false;
  }
  // Check caveats
  for (const caveat of contentCaveats) {
    if (!userClearance.caveats.includes(caveat)) {
      return false;
    }
  }
  return true;
}
```

**Database Schema**:
```sql
CREATE TABLE user_clearances (
  id VARCHAR PRIMARY KEY,
  user_id TEXT NOT NULL,
  clearance_level TEXT NOT NULL,
  caveats TEXT[],
  valid_until TIMESTAMP NOT NULL,
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  revoke_reason TEXT
);
```

**UI Behavior**:
- Content above clearance: "[CONTENT ABOVE YOUR CLEARANCE]"
- Missing caveat: "[REQUIRES {CAVEAT} ACCESS]"
- Audit log: Record every access attempt

**Acceptance Criteria**:
- [ ] Clearance checked on every content access
- [ ] Proper placeholder shown for restricted content
- [ ] Access attempts logged
- [ ] Clearance expiration enforced

---

## Implementation Guidelines

### Development Strategy

**V1/V2 Isolation**:
1. Create `v2-development` branch for all new features
2. Deploy V2 to separate Container App for testing
3. Use feature flags to enable V2 features per tenant
4. Migrate tenants gradually after validation

**Testing Requirements**:
| Phase | Unit Tests | Integration Tests | E2E Tests | Security Review |
|-------|------------|-------------------|-----------|-----------------|
| Phase 1 | Required | Required | Required | Required |
| Phase 2 | Required | Required | Required | Required |
| Phase 3 | Required | Required | Sample | Recommended |
| Phase 4 | Required | Required | Sample | Recommended |

**Documentation Requirements**:
- API documentation (OpenAPI/Swagger)
- Admin configuration guide
- User training materials
- Compliance documentation updates

### Success Metrics

| Phase | Key Metrics | Target |
|-------|-------------|--------|
| Phase 1 | FedRAMP control coverage | 100% High baseline |
| Phase 2 | Enterprise adoption | 5+ enterprise tenants |
| Phase 3 | AI accuracy ratings | >4.5/5 user satisfaction |
| Phase 4 | Feature differentiation | 3+ unique features vs. competitors |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| FedRAMP delays | Medium | High | Early engagement with 3PAO |
| AI accuracy issues | Medium | Medium | Extensive testing, user feedback loop |
| Performance degradation | Low | High | Load testing, auto-scaling |
| Integration failures | Medium | Medium | Vendor relationship, fallback modes |
| Scope creep | High | Medium | Strict phase boundaries, change control |

---

## Resource Requirements

### Team Structure
| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| Backend Developer | 2 | 2 | 2 | 1 |
| Frontend Developer | 1 | 2 | 1 | 2 |
| Security Engineer | 1 | 0.5 | 0.5 | 0.5 |
| DevOps Engineer | 1 | 0.5 | 0.5 | 0.5 |
| QA Engineer | 1 | 1 | 1 | 1 |
| Technical Writer | 0.5 | 0.5 | 0.5 | 0.5 |

### Infrastructure Costs (Estimated Monthly)
| Component | V1 Current | V2 Target |
|-----------|------------|-----------|
| Container Apps | $500 | $2,000 (multi-region) |
| PostgreSQL | $200 | $800 (Hyperscale) |
| Azure OpenAI | $300 | $1,500 (increased usage) |
| Key Vault | $50 | $200 (HSM-backed) |
| Networking | $100 | $500 (Private Endpoints) |
| Monitoring | $100 | $300 (Sentinel) |
| **Total** | **$1,250** | **$5,300** |

---

## Appendices

### Appendix A: Competitive Analysis

| Feature | Our V2 | Otter.ai | Fireflies.ai | MS Copilot |
|---------|--------|----------|--------------|------------|
| FedRAMP Ready | Yes | No | No | Partial |
| Multi-tenant | Yes | No | No | Yes |
| Clearance-aware | Yes | No | No | No |
| Custom workflows | Yes | Limited | Limited | Limited |
| On-premises option | Planned | No | No | No |
| Knowledge graph | Yes | No | Limited | Limited |
| Compliance reports | Yes | No | No | Limited |

### Appendix B: Glossary

| Term | Definition |
|------|------------|
| FedRAMP | Federal Risk and Authorization Management Program |
| IL4/IL5 | Impact Levels 4/5 (DoD security classification) |
| ATO | Authority to Operate (government approval) |
| SSP | System Security Plan |
| SBOM | Software Bill of Materials |
| POA&M | Plan of Action & Milestones |
| CMK | Customer-Managed Keys |
| HSM | Hardware Security Module |

### Appendix C: Reference Documents

- docs/ARCHITECTURE.md - Current system architecture
- docs/TEST_EXECUTION_RESULTS.md - V1 test results
- docs/END_TO_END_TEST_PLAN.md - Testing procedures
- docs/DEPLOYMENT_CHECKLIST.md - Deployment procedures
- docs/TEAMS_SSO_CHECKLIST.md - Teams authentication setup

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 3, 2026 | Development Team | Initial roadmap document |
