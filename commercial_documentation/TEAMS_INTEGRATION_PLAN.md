# Microsoft Teams Integration Plan

## Overview
Integrate the Enterprise Meeting Minutes Platform as a **multi-surface Teams application** with:
- **Personal Tab** (sidebar) - Primary interface for post-meeting workflows
- **Meeting Extension** (stage/side panel) - In-meeting approval interface
- **Notification Bot** (optional) - Proactive alerts for pending approvals
- **Message Extension** (optional) - Quick sharing of minutes in chats

This plan addresses Enterprise security requirements including SSO/MFA MFA, conditional access, SOC 2 Type II logging, and on-behalf-of (OBO) token flow for backend authentication.

## Architecture Design

### 1. Teams App Type: Personal Tab (Static Tab)
- **Placement**: Pinned in left sidebar (similar to OneDrive, Planner)
- **Scope**: Personal (individual user), not channel-specific
- **Technology**: Web app embedded in iframe via Teams SDK
- **Access**: Available to all 300,000 Enterprise users via org-wide deployment

### 2. Integration Components

```
┌─────────────────────────────────────────┐
│   Microsoft Teams Client                │
│  ┌───────────────────────────────────┐  │
│  │   Sidebar Icon/Badge              │  │
│  │   "Enterprise Meeting Minutes"           │  │
│  └─────────────┬─────────────────────┘  │
│                │                         │
│                ↓                         │
│  ┌───────────────────────────────────┐  │
│  │   Personal Tab (iframe)           │  │
│  │   https://app.company.com             │  │
│  │   ┌─────────────────────────────┐ │  │
│  │   │  Our React App with         │ │  │
│  │   │  Teams JS SDK Integration   │ │  │
│  │   │                             │ │  │
│  │   │  - Dashboard                │ │  │
│  │   │  - Meeting List             │ │  │
│  │   │  - Minutes Viewer           │ │  │
│  │   │  - Approval Controls        │ │  │
│  │   └─────────────────────────────┘ │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ↓
   Azure AD SSO Auth
         │
         ↓
   Backend API (Express)
         │
         ↓
   PostgreSQL + Microsoft Graph
```

## Implementation Steps

### Step 1: Install Microsoft Teams SDK

```bash
npm install @microsoft/teams-js
```

**Package**: `@microsoft/teams-js` v2.x (latest)
**Purpose**: Detect Teams context, handle authentication, theme changes, navigation

### Step 2: Add Teams Initialization to Frontend

**File**: `client/src/lib/teams-context.ts` (new file)
```typescript
import { app, authentication } from '@microsoft/teams-js';

export async function initializeTeamsApp() {
  try {
    await app.initialize();
    const context = await app.getContext();
    
    // Notify Teams that app loaded successfully
    app.notifySuccess();
    
    return {
      isTeamsContext: true,
      userPrincipalName: context.user?.userPrincipalName,
      theme: context.app?.theme || 'default',
      tenantId: context.user?.tenant?.id
    };
  } catch (error) {
    // Not running in Teams - browser mode
    return {
      isTeamsContext: false,
      userPrincipalName: null,
      theme: 'default',
      tenantId: null
    };
  }
}

export async function getTeamsAuthToken(): Promise<string | null> {
  try {
    const token = await authentication.getAuthToken({
      resources: ['https://graph.microsoft.us'], // Commercial Cloud endpoint
      silent: false
    });
    return token;
  } catch (error) {
    console.error('Teams SSO failed:', error);
    return null;
  }
}
```

**File**: `client/src/App.tsx` (modify)
```typescript
// Add Teams initialization on app mount
useEffect(() => {
  initializeTeamsApp().then(context => {
    console.log('Teams context:', context);
    // Store context for authentication
    if (context.isTeamsContext) {
      // Use Teams SSO instead of standard auth
      // Set theme based on Teams theme
      setTheme(context.theme === 'dark' ? 'dark' : 'light');
    }
  });
}, []);
```

### Step 3: Create Teams App Manifest

**File**: `teams-app/manifest.json` (new file)
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<GUID-GENERATED-BY-TEAMS-ADMIN>",
  "packageName": "com.company.teams.meetingminutes",
  "developer": {
    "name": "Enterprise",
    "websiteUrl": "https://defense.gov",
    "privacyUrl": "https://defense.gov/privacy",
    "termsOfUseUrl": "https://defense.gov/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "Enterprise Teams Meeting Minutes Management"
  },
  "description": {
    "short": "AI-powered meeting minutes capture and distribution",
    "full": "Automatically capture, process, and distribute Microsoft Teams meeting minutes with AI-generated summaries, action items, and classification markings for Enterprise compliance."
  },
  "icons": {
    "color": "icon-color-192x192.png",
    "outline": "icon-outline-32x32.png"
  },
  "accentColor": "#0078D4",
  "staticTabs": [
    {
      "entityId": "meeting-minutes-dashboard",
      "name": "Minutes",
      "contentUrl": "https://teams-minutes.company.com/",
      "websiteUrl": "https://teams-minutes.company.com/",
      "scopes": ["personal"]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "teams-minutes.company.com",
    "*.company.com"
  ],
  "webApplicationInfo": {
    "id": "<AZURE-AD-APP-CLIENT-ID>",
    "resource": "api://teams-minutes.company.com/<AZURE-AD-APP-CLIENT-ID>"
  }
}
```

**Required Icons:**
- `icon-color-192x192.png` - Color icon (192x192 px, <25KB)
- `icon-outline-32x32.png` - Outline icon (32x32 px, white/transparent, <25KB)

### Step 4: Configure Azure AD for Teams SSO

**Azure AD App Registration:**
1. Navigate to: https://portal.azure.com → Azure Active Directory → App registrations
2. Create new registration: "Enterprise Teams Meeting Minutes"
3. **Redirect URIs**: 
   - Web: `https://teams-minutes.company.com/auth-end`
   - SPA: `https://teams-minutes.company.com`
4. **API Permissions (Microsoft Graph - Delegated)**:
   - `User.Read` - Read user profile
   - `Calendars.Read` - Read user's calendar (for meeting context)
   - `OnlineMeetings.Read` - Read Teams meetings
   - `Mail.Send` - Send emails (for distribution)
   - `Sites.ReadWrite.All` - SharePoint archival
5. **Expose an API**:
   - Application ID URI: `api://teams-minutes.company.com/<client-id>`
   - Add scope: `access_as_user` (Who can consent: Admins and users)
6. **Admin Consent**: Grant admin consent for the tenant

### Step 5: Responsive UI for Teams Iframe

**Considerations:**
- Teams sidebar is narrower than browser (~320-400px on desktop)
- Must support collapse/expand states
- Should adapt to Teams themes (default, dark, high-contrast)

**CSS Adjustments** (`client/src/index.css`):
```css
/* Teams iframe detection */
.teams-app {
  /* Optimize for narrow sidebar */
  --sidebar-width: 0px; /* Collapse our sidebar in Teams */
}

/* Teams theme variables */
[data-teams-theme="default"] {
  /* Already handled by light mode */
}

[data-teams-theme="dark"] {
  /* Already handled by dark mode */
}

[data-teams-theme="contrast"] {
  /* High contrast mode for accessibility */
  --background: 0 0% 0%;
  --foreground: 0 0% 100%;
  --border: 0 0% 100%;
}
```

### Step 6: Deployment Process

#### Development/Testing (Commercial Azure)
1. **Host on Replit** or **Azure App Service** (commercial)
2. Use **ngrok** or **Azure dev tunnels** for local testing:
   ```bash
   ngrok http 5000 --host-header="localhost:5000"
   ```
3. Update manifest with ngrok URL
4. Package manifest + icons as `.zip`
5. Upload to Teams:
   - Teams → Apps → Manage your apps → Upload an app
   - Select `.zip` file

#### Production (Azure Commercial + Enterprise Teams)
1. **Host application**: Azure Commercial (Azure App Service)
2. **Domain**: `teams-minutes.company.com` (Enterprise-approved domain)
3. **SSL Certificate**: Enterprise-issued TLS certificate
4. **Manifest deployment** via **Teams Admin Center**:
   - https://admin.teams.microsoft.com
   - Teams apps → Manage apps → Upload
   - Review and approve app
5. **Org-wide deployment** via **Setup Policy**:
   - Teams apps → Setup policies
   - Create policy: "Enterprise Meeting Minutes Auto-Install"
   - Add app to "Installed apps"
   - Pin app to sidebar
   - Assign policy to all users or security groups
   - **Propagation time**: Up to 24 hours

### Step 7: Meeting Context Detection

When user opens app from Teams after a meeting:
```typescript
// Detect if opened from meeting context
const context = await app.getContext();

if (context.page?.subPageId) {
  // User opened from specific context (e.g., meeting)
  const meetingId = context.meeting?.id;
  
  // Auto-navigate to that meeting's minutes
  navigate(`/meetings/${meetingId}`);
}
```

## User Experience Flow

### Scenario: User Completes a Meeting in Teams

1. **Meeting ends in Teams**
2. User clicks "Meeting Minutes" icon in left sidebar
3. App opens in sidebar panel showing:
   - Dashboard with recent meetings
   - Just-completed meeting at top (if processed)
   - Badge notification if minutes pending approval
4. User clicks on completed meeting
5. Meeting details modal opens showing:
   - AI-generated summary
   - Key discussions
   - Decisions made
   - Action items
6. If user is approver, they see "Approve & Distribute" button
7. User approves → Minutes emailed to all attendees with DOCX/PDF attachments
8. SharePoint archival happens automatically

### Scenario: User Wants to Download Minutes

1. User opens Teams app
2. Navigates to meeting from list
3. Clicks Minutes tab
4. Clicks "Download DOCX" or "Download PDF"
5. File downloads directly via Teams download handler

## Security & Compliance

### Authentication Flow
1. **Teams SSO (Preferred)**:
   - User already authenticated in Teams
   - App requests token via Teams SDK
   - Token validated against Azure AD
   - No separate login required

2. **Fallback (Browser)**:
   - Standard Azure AD OAuth flow
   - Redirect to Azure AD login
   - Return with auth token

### Classification Markings in Teams
- Classification badges visible in Teams UI
- Access control enforced via Azure AD groups
- Audit trail logged for all access
- Cannot screenshot/copy classified content (Teams DLP policies)

### Data Residency
- All data stored in Azure Commercial (CONUS)
- Microsoft Graph API calls to Gov Cloud endpoints
- No data leaves Enterprise boundary

## Limitations & Considerations

### Teams App Constraints
1. **Iframe sandboxing**: Some browser features restricted
2. **Storage**: Limited localStorage (use backend sessions)
3. **Network**: Must use HTTPS, valid SSL certificate
4. **Permissions**: Users must grant consent for Graph API access
5. **Installation**: Requires Teams admin approval for org-wide deployment

### Enterprise-Specific Requirements
1. **SSO/MFA Authentication**: May need additional middleware for CAC cards
2. **NIPR/SIPR Networks**: Separate deployments for classified networks
3. **Offline Access**: Not available (Teams requires internet)
4. **Mobile Support**: Teams mobile app supported but limited screen size
5. **Compliance**: STIG hardening, certification certification required for production

## Testing Checklist

- [ ] App loads in Teams desktop client
- [ ] App loads in Teams web client
- [ ] App loads in Teams mobile app
- [ ] SSO authentication works
- [ ] Theme switching (light/dark/high-contrast) works
- [ ] Responsive layout in narrow sidebar
- [ ] Meeting context detection works
- [ ] File downloads work via Teams
- [ ] Notifications/badges display correctly
- [ ] App works on NIPR network
- [ ] CAC authentication integration (if required)

## Rollout Strategy

### Phase 1: Pilot (Week 1-4)
- Deploy to 50 pilot users
- Gather feedback on UX in Teams context
- Fix bugs and usability issues

### Phase 2: Limited Release (Week 5-8)
- Deploy to 5,000 users across multiple commands
- Monitor performance and Graph API usage
- Optimize for scale

### Phase 3: Full Deployment (Week 9-12)
- Org-wide deployment to all 300,000 users
- Setup policies auto-install and pin app
- User training and documentation

### Phase 4: Post-Launch (Ongoing)
- Monitor usage analytics
- Add meeting-specific features (in-meeting panel)
- Integrate with Teams workflows (bots, notifications)

## Cost Implications

### Microsoft Licensing
- **Requires**: Microsoft 365 E3 or E5 (already provided to Enterprise)
- **Graph API**: Included in license (throttling limits apply)
- **Teams Apps**: Free to deploy internally

### Infrastructure (Azure Commercial)
- **Application Hosting**: ~$500-2000/month (Azure App Service)
- **Database**: ~$300-1000/month (Azure Database for PostgreSQL)
- **Storage**: Minimal (< $50/month)
- **Azure OpenAI**: ~$5000-15000/month (based on usage)

**Total Monthly Operating Cost**: $6,000 - $18,000

## Next Steps

1. **Install Teams SDK** in current application
2. **Create Teams manifest** with proper configuration
3. **Test in commercial Teams** environment (development)
4. **Request Azure AD app registration** from Enterprise IT
5. **Deploy to Azure Commercial** test environment
6. **Submit for certification certification** (6-12 month process)
7. **Pilot with select users** on NIPR
8. **Full rollout** after validation

## Documentation References

- **Teams Tab Documentation**: https://learn.microsoft.com/microsoftteams/platform/tabs/what-are-tabs
- **Teams JS SDK v2**: https://learn.microsoft.com/javascript/api/@microsoft/teams-js/
- **Azure AD Integration**: https://learn.microsoft.com/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview
- **App Manifest Schema**: https://learn.microsoft.com/microsoftteams/platform/resources/schema/manifest-schema
- **Teams Admin Center**: https://admin.teams.microsoft.com

## Enterprise Security & Compliance Architecture

### Enhanced Authentication Flow (On-Behalf-Of)

**Problem**: Teams SDK provides user token, but backend needs to call Microsoft Graph on behalf of user
**Solution**: Implement OAuth 2.0 On-Behalf-Of (OBO) flow

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1: Teams Client Authenticates User                     │
│  ┌─────────────────┐                                         │
│  │  Teams Client   │ ──SSO──> Azure AD (SSO/MFA MFA)        │
│  └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
                      │
                      ↓ (ID Token)
┌──────────────────────────────────────────────────────────────┐
│  Step 2: Frontend Gets Teams Token                           │
│  ┌──────────────────┐                                        │
│  │  React App       │ ← getAuthToken() ← Teams JS SDK        │
│  │  (iframe)        │                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
                      │
                      ↓ (Send token to backend)
┌──────────────────────────────────────────────────────────────┐
│  Step 3: Backend Validates Token & Exchanges (OBO)           │
│  ┌──────────────────┐                                        │
│  │  Express API     │ ──validate──> Azure AD                 │
│  │                  │ ──OBO exchange──> Get new token        │
│  │                  │     with Graph API permissions         │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
                      │
                      ↓ (Backend Graph API token)
┌──────────────────────────────────────────────────────────────┐
│  Step 4: Backend Calls Microsoft Graph                       │
│  ┌──────────────────┐                                        │
│  │  Express API     │ ──Graph API calls──> Microsoft Graph   │
│  │                  │     (meetings, emails, SharePoint)     │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

### Backend OBO Implementation

**File**: `server/middleware/teamsAuth.ts` (new file)
```typescript
import { Request, Response, NextFunction } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_Standard!,
    authority: `https://login.microsoftonline.us/${process.env.AZURE_AD_TENANT_ID}` // Gov Cloud
  }
});

export async function validateTeamsToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const userToken = authHeader.substring(7);

    // Step 1: Validate the token from Teams
    // (Use jsonwebtoken or @azure/msal-node to validate signature)

    // Step 2: Exchange token via OBO flow
    const oboRequest = {
      oboAssertion: userToken,
      scopes: [
        'https://graph.microsoft.us/Calendars.Read',
        'https://graph.microsoft.us/OnlineMeetings.Read',
        'https://graph.microsoft.us/Mail.Send',
        'https://graph.microsoft.us/Sites.ReadWrite.All'
      ]
    };

    const response = await msalClient.acquireTokenOnBehalfOf(oboRequest);
    
    if (!response || !response.accessToken) {
      return res.status(401).json({ error: 'OBO token exchange failed' });
    }

    // Attach token to request for downstream use
    req.user = {
      accessToken: response.accessToken,
      upn: response.account?.username,
      tenantId: response.tenantId
    };

    // Audit log for SOC 2 Type II compliance
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'teams_auth_success',
      user: req.user.upn,
      tenant: req.user.tenantId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }));

    next();
  } catch (error) {
    console.error('Teams auth error:', error);
    
    // Audit log for failures
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'teams_auth_failure',
      error: error.message,
      ip: req.ip
    }));

    res.status(401).json({ error: 'Authentication failed' });
  }
}
```

### SSO/MFA Multi-Factor Authentication

**Azure AD Conditional Access Policy:**
```json
{
  "displayName": "Require SSO/MFA for Enterprise Meeting Minutes App",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["<APP-CLIENT-ID>"]
    },
    "clientAppTypes": ["all"]
  },
  "grantControls": {
    "opercertificationr": "AND",
    "builtInControls": [
      "mfa",
      "compliantDevice"
    ],
    "authenticationStrength": {
      "requirementsSatisfied": "phishingResistant"
    }
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 8,
      "type": "hours"
    },
    "persistentBrowser": {
      "mode": "never"
    }
  }
}
```

**Requirements:**
- **Phishing-resistant MFA**: SSO/MFA certificate authentication
- **Compliant device**: Intune-managed, encrypted Enterprise devices
- **Session timeout**: Re-authenticate every 8 hours
- **No persistent sessions**: Users must re-auth after browser close

### Token Lifetime Management

**Configuration:**
```typescript
// Token refresh strategy
const TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hour
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh when < 5 min remaining

// Store token expiry in session
req.session.tokenExpiry = Date.now() + TOKEN_LIFETIME;

// Middleware to check token freshness
export function ensureFreshToken(req: Request, res: Response, next: NextFunction) {
  const timeUntilExpiry = req.session.tokenExpiry - Date.now();
  
  if (timeUntilExpiry < REFRESH_THRESHOLD) {
    // Trigger token refresh via OBO
    // (Implementation similar to initial auth)
  }
  
  next();
}
```

### SOC 2 Type II Audit Logging

**Requirements:**
- Log all access attempts (success + failure)
- Log all API calls to Microsoft Graph
- Log all data modifications (CRUD operations)
- Log all approval/rejection actions
- Retain logs for 1 year minimum

**Implementation:**
```typescript
// Structured audit log format
interface AuditLog {
  timestamp: string;
  eventType: 'auth' | 'api' | 'data' | 'approval';
  action: string;
  user: {
    upn: string;
    tenantId: string;
    clearanceLevel: string;
  };
  resource: {
    type: 'meeting' | 'minutes' | 'action_item';
    id: string;
    classification: string;
  };
  result: 'success' | 'failure' | 'denied';
  ip: string;
  userAgent: string;
  requestId: string;
}

// Send to centralized logging (Splunk, Azure Monitor, etc.)
function auditLog(log: AuditLog) {
  console.log(JSON.stringify(log)); // Azure Monitor Logs
  // Also send to Enterprise SIEM if required
}
```

### Backend Token Validation

**Never trust client-side tokens without server validation:**

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const jwksClientInstance = jwksClient({
  jwksUri: `https://login.microsoftonline.us/${process.env.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`
});

function getKey(header: any, callback: any) {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function validateJWT(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: process.env.AZURE_AD_CLIENT_ID,
      issuer: `https://login.microsoftonline.us/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}
```

### Conditional Access Enforcement

**Network Location Restrictions:**
- Allow only from Enterprise network IP ranges (NIPR)
- Block all public internet access
- Require VPN if remote access needed

**Device Compliance:**
- Must be Intune-enrolled
- Must have disk encryption enabled
- Must meet minimum OS patch level
- Must have antivirus running

**User Risk Detection:**
- Block sign-ins from risky locations
- Block sign-ins after multiple failed attempts
- Require step-up auth for high-risk actions (e.g., Standard classification access)

## Meeting Extension (In-Meeting Panel)

### Purpose
Allow approvers to review and approve minutes **during the meeting** or immediately after, without leaving Teams.

### Configuration

**Add to manifest.json:**
```json
{
  "configurableTabs": [
    {
      "configurationUrl": "https://teams-minutes.company.com/meeting-config",
      "canUpdateConfiguration": true,
      "scopes": ["groupchat"],
      "context": [
        "meetingChatTab",
        "meetingSidePanel",
        "meetingStage"
      ]
    }
  ]
}
```

### Meeting Side Panel UI

**Purpose**: Show meeting minutes in right panel during/after meeting
**Size**: 320px wide, full height
**Features**:
- Real-time minutes generation status
- Preview of generated minutes
- Quick approve/reject buttons
- Action items list

### Meeting Stage View

**Purpose**: Full-screen minutes display for detailed review
**Trigger**: Click "Open in stage" button from side panel
**Size**: Full Teams window
**Features**:
- Full minutes content
- Compare multiple meeting versions
- Collaborative review annotations

## Notification Bot (Proactive Alerts)

### Purpose
Send proactive notifications to approvers when minutes are ready for review.

### Architecture

**Bot Registration:**
- Register bot in Azure Portal
- Add bot ID to Teams manifest
- Configure message endpoint: `https://teams-minutes.company.com/api/bot`

**Notification Types:**
1. **Minutes Ready**: "Meeting minutes for 'Q4 Planning' are ready for your review"
2. **Approval Reminder**: "3 meeting minutes awaiting your approval"
3. **Action Item Due**: "Action item 'Deploy staging environment' due tomorrow"
4. **Minutes Distributed**: "Approved minutes for 'Security Review' sent to all attendees"

**Manifest Addition:**
```json
{
  "bots": [
    {
      "botId": "<BOT-APP-ID>",
      "scopes": ["personal"],
      "supportsFiles": false,
      "isNotificationOnly": true
    }
  ]
}
```

### Bot Implementation (Proactive Messaging)

```typescript
import { TeamsBot } from '@microsoft/bot-framework';

// Send proactive notification
async function notifyApprover(userId: string, minutesId: string, meetingTitle: string) {
  const conversationReference = await getConversationReference(userId);
  
  await bot.continueConversation(conversationReference, async (context) => {
    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: 'Minutes Ready for Review',
          weight: 'Bolder',
          size: 'Medium'
        },
        {
          type: 'TextBlock',
          text: `Meeting: ${meetingTitle}`,
          wrap: true
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Review Minutes',
          url: `https://teams.microsoft.com/l/entity/<APP-ID>/<ENTITY-ID>?meetingId=${minutesId}`
        }
      ]
    };
    
    await context.sendActivity({ attachments: [card] });
  });
}
```

## Message Extension (Quick Sharing)

### Purpose
Allow users to quickly share minutes in Teams chats/channels without opening full app.

### Configuration

**Add to manifest.json:**
```json
{
  "composeExtensions": [
    {
      "botId": "<BOT-APP-ID>",
      "commands": [
        {
          "id": "searchMinutes",
          "type": "query",
          "title": "Share Meeting Minutes",
          "description": "Search and share meeting minutes",
          "parameters": [
            {
              "name": "search",
              "title": "Search",
              "description": "Search for meetings",
              "inputType": "text"
            }
          ]
        }
      ]
    }
  ]
}
```

### Usage Flow

1. User clicks "..." in Teams compose box
2. Selects "Meeting Minutes" extension
3. Searches for meeting (e.g., "Q4 planning")
4. Selects result
5. Minutes card inserted into message
6. Recipients can click card to view full minutes

## Enhanced Rollout Strategy

### Phase 0: Infrastructure Preparation (Week 1-2)

**Objectives:**
- Provision Azure Commercial resources
- Configure auto-scaling groups
- Set up Azure Monitor monitoring
- Establish baseline metrics

**Capacity Planning:**
- **Expected load**: 300,000 users, 10% DAU (30,000)
- **Peak load**: 5,000 concurrent users
- **API rate limits**: Microsoft Graph throttling (2,000 req/min per app)
- **Database sizing**: Azure Database for PostgreSQL (db.r6g.2xlarge, 8 vCPU, 64GB RAM)
- **App servers**: Azure App Service (10 tasks, each 2 vCPU, 4GB RAM)

**Auto-Scaling Configuration:**
```yaml
AutoScaling:
  MinTasks: 10
  MaxTasks: 50
  TargetCPU: 70%
  TargetMemory: 75%
  ScaleOutCooldown: 60s
  ScaleInCooldown: 300s
```

### Phase 1: Limited Pilot (Week 3-4)

**Cohort 1: 50 users** (IT staff + select approvers)
- Deploy to test tenant
- Manual installation via App Store upload
- Daily feedback sessions
- Bug triage and fixes

**Success Metrics:**
- Zero authentication failures
- < 2s page load time
- 100% approval workflow success rate
- Zero data loss incidents

### Phase 2: Expanded Pilot (Week 5-8)

**Cohort 2: 5,000 users** (across 5 Enterprise commands)
- Deploy to production tenant (limited distribution)
- Setup policy for specific Azure AD groups
- Monitor Graph API throttling
- Stress test with synthetic load

**Monitoring:**
- Azure Monitor dashboards
- Application Insights telemetry
- Custom metrics:
  - Authentication success rate
  - API response times (p50, p95, p99)
  - Error rates by endpoint
  - Teams SDK initialization failures

**Synthetic Load Testing:**
```bash
# Simulate 5,000 concurrent users
artillery run --target https://teams-minutes.company.com \
  --count 5000 \
  --ramp 60 \
  load-test-scenario.yml
```

### Phase 3: Staged Rollout (Week 9-12)

**Cohort 3: 50,000 users** (Week 9-10)
- Deploy via org-wide setup policy (limited groups)
- Enable auto-pin to sidebar for targeted users
- 24/7 monitoring

**Cohort 4: 150,000 users** (Week 11)
- Expand setup policy
- Monitor database connection pool saturation
- Adjust auto-scaling thresholds

**Cohort 5: All 300,000 users** (Week 12)
- Full org-wide deployment
- Auto-pin for all users
- Backup plan: Disable auto-pin if issues arise

### Rollback Plan

**Trigger Conditions:**
- Authentication failure rate > 5%
- API error rate > 10%
- Database unavailable > 30 seconds
- Graph API throttling blocking users

**Rollback Actions:**
1. Disable app via Teams Admin Center (immediate)
2. Remove from setup policies
3. Notify users via Teams announcement
4. Roll back to previous working version
5. Post-mortem within 24 hours

## Telemetry & Monitoring

### Application Insights Integration

```typescript
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true
  }
});

appInsights.loadAppInsights();

// Track custom events
appInsights.trackEvent({
  name: 'MinutesApproved',
  properties: {
    meetingId: minutesId,
    approver: user.upn,
    classificationLevel: meeting.classificationLevel
  }
});
```

### Key Metrics to Track

1. **User Engagement:**
   - Daily/Monthly Active Users
   - Session duration
   - Feature usage (approve, download, search)

2. **Performance:**
   - Page load times
   - API response times
   - Teams SDK initialization time
   - Graph API call latency

3. **Reliability:**
   - Error rates by type
   - Authentication failures
   - Graph API throttling events
   - Database connection errors

4. **Business Metrics:**
   - Meetings processed per day
   - Minutes approved/rejected ratio
   - Average time to approval
   - Email distribution success rate

### Alerting Rules

**Critical Alerts (PagerDuty):**
- Authentication failure rate > 5%
- API error rate > 10%
- Database connection pool exhausted
- Graph API throttling active

**Warning Alerts (Email):**
- Response time p95 > 3s
- Error rate > 2%
- Disk usage > 80%
- Memory usage > 85%

## Theme Support (Including High-Contrast)

### Teams Theme Detection

```typescript
import { app } from '@microsoft/teams-js';

app.getContext().then((context) => {
  const theme = context.app.theme; // 'default', 'dark', 'contrast'
  
  // Apply theme to document
  document.body.setAttribute('data-teams-theme', theme);
  
  // Sync with our theme system
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

// Listen for theme changes
app.registerOnThemeChangeHandler((theme) => {
  document.body.setAttribute('data-teams-theme', theme);
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});
```

### High-Contrast Mode CSS

**File**: `client/src/index.css`
```css
/* High-contrast theme for accessibility */
[data-teams-theme="contrast"] {
  --background: 0 0% 0%;
  --foreground: 0 0% 100%;
  --primary: 0 0% 100%;
  --primary-foreground: 0 0% 0%;
  --secondary: 0 0% 20%;
  --secondary-foreground: 0 0% 100%;
  --muted: 0 0% 15%;
  --muted-foreground: 0 0% 100%;
  --accent: 0 0% 100%;
  --accent-foreground: 0 0% 0%;
  --destructive: 0 100% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 100%;
  --input: 0 0% 100%;
  --ring: 0 0% 100%;
  --card: 0 0% 5%;
  --card-foreground: 0 0% 100%;
  --popover: 0 0% 5%;
  --popover-foreground: 0 0% 100%;
}

/* Increase contrast for interactive elements */
[data-teams-theme="contrast"] button {
  border: 2px solid var(--foreground) !important;
}

[data-teams-theme="contrast"] input,
[data-teams-theme="contrast"] textarea,
[data-teams-theme="contrast"] select {
  border: 2px solid var(--foreground) !important;
  background: var(--background) !important;
  color: var(--foreground) !important;
}
```

## Offline & Error Handling

### Offline Detection

```typescript
// Detect offline state
window.addEventListener('offline', () => {
  // Show offline banner
  showBanner({
    message: 'You are currently offline. Some features may be unavailable.',
    type: 'warning'
  });
  
  // Disable API calls
  setOfflineMode(true);
});

window.addEventListener('online', () => {
  // Hide offline banner
  hideBanner();
  
  // Re-enable API calls
  setOfflineMode(false);
  
  // Sync any pending changes
  syncPendingChanges();
});
```

### Graceful Degradation

**When Teams SDK fails to initialize:**
- Fall back to standard web app mode
- Show warning: "For best experience, use this app within Microsoft Teams"
- Provide deep link to open in Teams

**When Microsoft Graph API is unavailable:**
- Show cached data (if available)
- Display warning: "Unable to fetch latest data"
- Retry with exponential backoff

**When database is unavailable:**
- Show error page with retry button
- Log incident for operations team
- Trigger failover to read-replica (if configured)

## Disaster Recovery & Business Continuity

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 15 minutes

### Database Backup Strategy

**Azure Database for PostgreSQL Automated Backups:**
- Daily snapshots retained for 35 days
- Transaction logs backed up every 5 minutes
- Point-in-time recovery enabled

**Disaster Recovery Region:**
- Primary: `us-gov-west-1`
- DR: `us-gov-east-1`
- Cross-region replication for critical data

### Application Failover

**Active-Passive Setup:**
- Primary deployment in `us-gov-west-1`
- Standby deployment in `us-gov-east-1` (warm standby)
- DNS failover via Route 53 health checks
- Automatic failover if primary unhealthy > 3 minutes

### Disaster Scenarios

**Scenario 1: Regional Outage (Azure Commercial USGov West)**
1. Route 53 detects unhealthy endpoints (1-2 min)
2. DNS routes traffic to `us-gov-east-1` (2-3 min)
3. Standby RDS promoted to primary (10-15 min)
4. Users experience brief interruption (Total: 15-20 min)

**Scenario 2: Database Corruption**
1. Detect corruption via monitoring (< 5 min)
2. Restore from latest snapshot (30-60 min)
3. Replay transaction logs (10-30 min)
4. Total recovery time: 40-90 min

**Scenario 3: Microsoft Graph API Outage**
1. Detect via health checks (< 1 min)
2. Display cached data to users
3. Queue pending writes for retry
4. Resume normal operation when Graph API recovers

## Updated Cost Estimate

### Infrastructure (Monthly)

**Azure Commercial:**
- Azure App Service (10-50 tasks): $500-2,500
- Azure Database for PostgreSQL (production + DR): $600-1,200
- Application Load Balancer: $50
- Azure Monitor + Application Insights: $200
- S3 Storage (backups): $50
- Route 53 DNS: $25
- **Total Azure Commercial**: $1,425-4,025/month

**Azure Services:**
- Azure AD P2 licenses (included in M365 E5)
- Azure OpenAI Gov Cloud: $5,000-15,000/month
- Azure Bot Service: $0 (included in M365)
- **Total Azure**: $5,000-15,000/month

**Total Monthly Operating Cost**: **$6,425-19,025**

### One-Time Costs

- Teams app development: $50,000-100,000 (if outsourced)
- certification certification: $100,000-300,000
- Security audit: $50,000-100,000
- Training materials: $20,000
- **Total One-Time**: $220,000-520,000

## Implementation Timeline (Revised)

### Month 1-2: Development
- Teams SDK integration
- OBO authentication flow
- Meeting extension UI
- Notification bot

### Month 3-4: Security Hardening
- SSO/MFA integration
- Conditional access policies
- SOC 2 Type II audit logging
- Penetration testing

### Month 5-6: Testing & Validation
- Load testing
- Security scanning
- Accessibility compliance (Section 508)
- User acceptance testing

### Month 7-12: certification Certification
- Security documentation
- Risk assessment
- Authority review
- Authorization granted

### Month 13-16: Phased Rollout
- Pilot (50 users)
- Expanded pilot (5,000 users)
- Staged rollout (50k → 150k → 300k)
- Post-launch optimization

**Total Timeline**: 16 months from kickoff to full deployment

## Success Criteria

1. **Adoption**: 80% of users with pending approvals use Teams app within 2 months
2. **Performance**: 95% of page loads < 2 seconds
3. **Reliability**: 99.9% uptime (excluding planned maintenance)
4. **Security**: Zero unauthorized access incidents
5. **User Satisfaction**: Net Promoter Score (NPS) > 50

## Appendix: Required Environment Variables

```bash
# Azure AD (Government Cloud)
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_CLIENT_Standard=<client-secret>
AZURE_AD_AUTHORITY=https://login.microsoftonline.us

# Microsoft Graph (Government Cloud)
GRAPH_API_ENDPOINT=https://graph.microsoft.us

# Azure OpenAI (Government Cloud)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.us
AZURE_OPENAI_API_KEY=<api-key>
AZURE_OPENAI_DEPLOYMENT=<deployment-name>

# Teams App
TEAMS_APP_ID=<app-id>
TEAMS_BOT_ID=<bot-id>
TEAMS_BOT_PASSWORD=<bot-password>

# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=<connection-string>

# Feature Flags
ENABLE_TEAMS_MODE=true
ENABLE_BROWSER_MODE=true
ENABLE_NOTIFICATION_BOT=false
ENABLE_MESSAGE_EXTENSION=false
```

---

## enterprise data isolation Validation

### Purpose

This section provides mandcertificationry testing procedures to validate that Teams integration maintains Enterprise-compliant data segregation when processing meeting webhooks, transcripts, and recordings across Standard, Standard, and Standard classification levels.

### Enterprise Requirements for Teams Integration

**Classification-Based Meeting Processing:**
- Webhook subscriptions MUST route classified meetings to appropriate isolated environments
- Transcripts and recordings for Standard meetings MUST be processed in air-gapped Standard environment
- Meeting metadata from one classification MUST NOT leak into another classification's processing pipeline

**Access Control:**
- Teams app MUST enforce clearance-based access: Standard meetings only accessible to Standard-cleared users
- Meeting extensions MUST hide classification options above user's clearance level
- Bot notifications MUST NOT reveal existence of higher-classified meetings to lower-cleared users

### Test Case 1: Webhook Classification Routing

**Objective:** Verify Teams webhooks route meetings to correct classification-specific processing environment

**Test Steps:**
1. Create three test Teams meetings with classifications:
   - Meeting A: Standard (organizer: testuser_standard@company.com)
   - Meeting B: Standard (organizer: testuser_enhanced@company.com)
   - Meeting C: Standard (organizer: testuser_premium@company.com)
2. Complete each meeting (trigger "callEnded" webhook)
3. Verify webhook routing:
   - Standard webhook → UNCLASS ASE cluster (VNet 10.0.0.0/16)
   - Standard webhook → CONF ASE cluster (VNet 10.10.0.0/16)
   - Standard webhook → Standard ASE cluster (VNet 10.20.0.0/16)
4. Verify each environment queries only its respective database shard

**Expected Routing Table:**
| Meeting Classification | Webhook Destination | Database Shard | Network Isolation |
|------------------------|---------------------|----------------|-------------------|
| Standard | UNCLASS ASE | UNCLASS shards 1-6 | Public/Private VNet |
| Standard | CONF ASE | CONF shards 1-4 | Private VNet only |
| Standard | Standard ASE | Standard shards 1-2 | Air-gapped VNet (no egress) |

**Failure Criteria:**
- Webhook routed to wrong ASE cluster
- Cross-classification database query detected
- Standard webhook processed in non-air-gapped environment

### Test Case 2: Graph API Endpoint Validation

**Objective:** Verify all Graph API calls use Commercial Cloud endpoints (.us domain)

**Test Steps:**
1. Monitor network traffic from all ASE environments
2. Verify ALL Graph API requests use https://graph.microsoft.us (NOT .com)
3. Verify OAuth tokens acquired from https://login.microsoftonline.us
4. Confirm no requests to commercial Azure endpoints

**Network Validation:**
```bash
# Monitor outbound HTTPS requests
tcpdump -i any 'port 443 and host graph.microsoft.us'  # Should see traffic

# Verify NO traffic to commercial endpoints:
tcpdump -i any 'port 443 and host graph.microsoft.com'  # Should be EMPTY
```

**Expected OAuth Token:**
```json
{
  "aud": "https://graph.microsoft.us",  // CORRECT (Commercial Cloud)
  "iss": "https://sts.windows.net/{tenant-id}/",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Failure Criteria:**
- Any request to graph.microsoft.com (commercial)
- OAuth tokens with wrong audience claim
- Login attempts to login.microsoftonline.com instead of .us

### Test Case 3: Transcript/Recording Isolation

**Objective:** Verify Teams transcripts and recordings are downloaded only in classification-appropriate environment

**Test Steps:**
1. Create Standard meeting with recording enabled
2. Complete meeting, wait for recording availability
3. Verify Graph API call to download recording originates from Standard ASE instance only
4. Verify recording NEVER downloaded or cached in UNCLASS/CONF environments
5. Check Standard database for recording metadata, confirm NOT present in other shards

**Expected Result:**
```
Standard meeting recording download:
- Source: Standard ASE instance (10.20.x.x)
- Storage: Standard database shard 1 or 2
- Network: No internet egress (air-gapped)

UNCLASS/CONF environments:
- No knowledge of Standard meeting existence
- Recording download never attempted
```

**Failure Criteria:**
- Recording downloaded from non-Standard environment
- Recording cached in lower classification environment
- Standard meeting metadata visible in UNCLASS/CONF database

### Production Validation Checklist

**Before deploying Teams integration to Azure Commercial production:**

- [ ] **Test Case 1:** PASSED - Webhook routing to classification-specific ASE verified
- [ ] **Test Case 2:** PASSED - All Graph API calls use .us endpoints
- [ ] **Test Case 3:** PASSED - Transcript/recording isolation confirmed
- [ ] **Network Scan:** No commercial Azure endpoint traffic detected
- [ ] **ISSO Review:** Information System Security Officer approval obtained
- [ ] **certification Package:** Teams integration controls documented

**Sign-Off Required:**
- [ ] System Owner
- [ ] Information System Security Officer (ISSO)
- [ ] Teams Administrcertificationr (Commercial Cloud)
- [ ] Compliance Lead

**Acceptance Criteria:**
All 3 test cases must achieve 100% pass rate. Any failure in classification isolation requires immediate remediation and complete re-testing.

---

**This updated plan addresses all critical gaps identified in the architectural review and provides a comprehensive roadmap for production-grade Microsoft Teams integration with Enterprise security requirements.**
