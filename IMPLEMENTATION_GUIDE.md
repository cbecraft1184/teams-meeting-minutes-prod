# DOD Teams Meeting Minutes - Complete Commercial Testing Implementation Guide

## Overview

**Purpose**: Test the Teams meeting minutes app with Microsoft 365 commercial environment BEFORE deploying to DOD production with 300,000 users.

**Philosophy**: If it doesn't work commercially, it will definitely not work in DOD.

**Critical Distinction**: This app is INDEPENDENT of CapraGPT/DON-GPT. It provides automated meeting minutes workflow, not general AI assistance.

---

## Quick Start Summary

| Phase | Duration | What You'll Do |
|-------|----------|----------------|
| 1. Microsoft 365 Setup | 30 min | Create free trial tenant with 25 users |
| 2. Azure AD Configuration | 30 min | Register app, create access control groups |
| 3. Azure OpenAI Setup | 20 min | Deploy GPT-4 for AI processing |
| 4. Deploy Application | 20 min | Configure Replit with credentials |
| 5. Create Teams App | 15 min | Package manifest + icons |
| 6. Install in Teams | 10 min | Upload and pin app to sidebar |
| 7. Testing | 2-3 hours | Validate complete workflow |
| **Total** | **~5 hours** | **Fully functional test environment** |

**Cost**: $15-20/month (vs. $1,700/month production)

---

## Prerequisites

### Required
- [ ] Internet connection
- [ ] Web browser (Chrome, Edge, Firefox)
- [ ] Credit card for Azure OpenAI (or free Azure credits)
- [ ] Email address for Microsoft 365
- [ ] 5 hours of focused time

### Skills Needed
- Basic computer literacy
- Ability to follow instructions
- Copy/paste proficiency
- **NO coding required!**

---

## Phase 1: Microsoft 365 Test Tenant Setup (30 minutes)

### Step 1.1: Sign Up for Microsoft 365 E5 Trial

**What you get**: 30 days free, 25 user licenses, full Teams/Azure AD access

1. **Visit**: https://www.microsoft.com/en-us/microsoft-365/enterprise/e5
2. Click **"Free trial"**
3. Enter your email address
4. Fill in organization details:
   - Company: `"Meeting Minutes Testing"`
   - Organization size: `25 users`
   - Country: `United States`
5. Create subdomain: `meetingminutestest` 
   - Full domain: `meetingminutestest.onmicrosoft.com`
   - **Cannot be changed later!**
6. Create admin account:
   - Username: `admin`
   - Full email: `admin@meetingminutestest.onmicrosoft.com`
   - Password: **Create strong password and save it!**
7. Verify phone number (SMS or call)
8. Wait 2-5 minutes for provisioning

**✅ Success**: You see "You're all set!" message

### Step 1.2: Bookmark Admin Centers

Save these URLs:
- **Microsoft 365 Admin**: https://admin.microsoft.com
- **Teams Admin**: https://admin.teams.microsoft.com
- **Azure AD Portal**: https://portal.azure.com

Sign in with: `admin@meetingminutestest.onmicrosoft.com`

### Step 1.3: Create Test Users

You need 5-10 test users for access control testing.

**Quick method** (Manual):
1. Go to https://admin.microsoft.com
2. **Users** → **Active users** → **Add a user**
3. Create these users:

| Name | Email | Password | Role |
|------|-------|----------|------|
| John Doe | john.doe@ | TestPass123! | Test viewer |
| Jane Smith | jane.smith@ | TestPass123! | Test admin |
| Bob Johnson | bob.johnson@ | TestPass123! | Test approver |
| Alice Williams | alice.williams@ | TestPass123! | Test approver |
| Charlie Brown | charlie.brown@ | TestPass123! | Test viewer |

For each user:
- Assign **Microsoft 365 E5** license
- **UNCHECK** "Require password change on next login"

**✅ Success**: 5+ test users created and licensed

### Step 1.4: Enable Custom Apps in Teams

1. Go to **Teams Admin Center**: https://admin.teams.microsoft.com
2. **Teams apps** → **Setup policies** → **Global**
3. Under **Upload custom apps**: Toggle to **On**
4. Click **Save**
5. Wait up to 24 hours (usually instant)

**✅ Success**: Custom app upload enabled

---

## Phase 2: Azure AD Configuration (30 minutes)

### Step 2.1: Register Application

1. Go to https://portal.azure.com
2. Sign in as `admin@meetingminutestest.onmicrosoft.com`
3. **Azure Active Directory** → **App registrations** → **+ New registration**

4. Configure:
   - **Name**: `Meeting Minutes Test`
   - **Supported account types**: `Single tenant`
   - **Redirect URI**: Leave blank (update later)

5. Click **Register**

6. **SAVE THESE VALUES**:
   - **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 2.2: Create Client Secret

1. Click **Certificates & secrets** → **+ New client secret**
2. Description: `Test Environment Secret`
3. Expires: `6 months`
4. Click **Add**
5. **IMMEDIATELY COPY THE VALUE** (shows only once!)
   - Example: `abc123~DEF456.G7H8I9J0K1L2M3N4O5P6Q7R8S9T0`

**⚠️ WARNING**: Save this secret securely - you cannot retrieve it later!

### Step 2.3: Configure API Permissions

1. Click **API permissions** → **+ Add a permission**
2. **Microsoft Graph** → **Application permissions**
3. Add these permissions:
   - `User.Read.All`
   - `OnlineMeetings.Read.All`
   - `Calendars.Read`
   - `Files.Read.All`
   - `Mail.Send`
   - `Group.Read.All` ← **Critical for Azure AD groups**

4. Also add **Delegated permissions**:
   - `User.Read`
   - `OnlineMeetings.Read`

5. **Grant admin consent**:
   - Click **Grant admin consent for [organization]**
   - Click **Yes**
   - Wait for green checkmarks

**✅ Success**: All permissions show green checkmarks

### Step 2.4: Configure Authentication

1. Click **Authentication** → **+ Add a platform** → **Web**
2. Redirect URI: `https://placeholder.replit.app` (update later)
3. **Implicit grant**:
   - ✅ ID tokens
   - ✅ Access tokens
4. **Allow public client flows**: Yes
5. Click **Save**

### Step 2.5: Create Azure AD Security Groups

**Why groups?** Centralized access control, scalable to 300K users, no database updates needed.

1. **Azure Active Directory** → **Groups** → **+ New group**

Create 7 groups:

| Group Name | Type | Description |
|------------|------|-------------|
| `DOD-Clearance-UNCLASSIFIED` | Security | UNCLASSIFIED clearance |
| `DOD-Clearance-CONFIDENTIAL` | Security | CONFIDENTIAL clearance |
| `DOD-Clearance-SECRET` | Security | SECRET clearance |
| `DOD-Clearance-TOP_SECRET` | Security | TOP SECRET clearance |
| `DOD-Role-Admin` | Security | System administrators |
| `DOD-Role-Approver` | Security | Can approve minutes |
| `DOD-Role-Auditor` | Security | Can view all meetings |

For each:
- **Group type**: Security
- **Membership type**: Assigned

### Step 2.6: Assign Users to Groups

**Test scenario setup**:

1. **DOD-Clearance-UNCLASSIFIED**: Add ALL 5 users
2. **DOD-Clearance-SECRET**: Add Jane, Bob
3. **DOD-Role-Admin**: Add Jane
4. **DOD-Role-Approver**: Add Jane, Bob, Alice

**Result**:
- **John**: UNCLASSIFIED, Viewer → Sees only UNCLASSIFIED meetings he attended
- **Jane**: SECRET, Admin → Sees all meetings up to SECRET, can approve
- **Bob**: SECRET, Approver → Sees SECRET meetings, can approve
- **Alice**: UNCLASSIFIED, Approver → Can approve UNCLASSIFIED only
- **Charlie**: UNCLASSIFIED, Viewer → Basic access

**✅ Success**: Groups created and users assigned

---

## Phase 3: Azure OpenAI Setup (20 minutes)

### Step 3.1: Create Azure OpenAI Resource

1. **Azure Portal** → **+ Create a resource**
2. Search: `Azure OpenAI`
3. Click **Create**

4. Configure:
   - **Subscription**: Your subscription
   - **Resource group**: Create new → `meeting-minutes-test`
   - **Region**: `East US`
   - **Name**: `meeting-minutes-openai` (must be unique)
   - **Pricing tier**: `Standard S0`

5. Click **Review + create** → **Create**
6. Wait 2-5 minutes for deployment

### Step 3.2: Deploy GPT-4 Model

1. Go to your Azure OpenAI resource
2. Click **Model deployments** → **Manage Deployments**
3. Opens **Azure AI Studio**
4. Click **+ Create new deployment**

5. Configure:
   - **Model**: `gpt-4` (or `gpt-35-turbo` for cheaper testing)
   - **Deployment name**: `gpt-4` ← **Exactly this!**
   - **Tokens per minute**: `10K`

6. Click **Create**

### Step 3.3: Get Credentials

1. Back in Azure Portal, your Azure OpenAI resource
2. **Keys and Endpoint**
3. **SAVE THESE**:
   - **KEY 1**: Copy the key
   - **Endpoint**: `https://meeting-minutes-openai.openai.azure.com/`

**✅ Success**: Azure OpenAI ready with GPT-4 deployed

---

## Phase 4: Deploy Application (20 minutes)

### Option A: Replit (Recommended for Testing)

**Your app is already on Replit!** Just need to configure it.

#### Step 4A.1: Configure Secrets

1. Open your Replit project
2. Click **Secrets** (lock icon in sidebar)
3. Add these secrets:

```
MICROSOFT_TENANT_ID=<from Step 2.1>
MICROSOFT_CLIENT_ID=<from Step 2.1>
MICROSOFT_CLIENT_SECRET=<from Step 2.2>

AZURE_OPENAI_ENDPOINT=<from Step 3.3>
AZURE_OPENAI_API_KEY=<from Step 3.3>
AZURE_OPENAI_DEPLOYMENT=gpt-4

SESSION_SECRET=<any random 64-character string>
```

#### Step 4A.2: Get Your App URL

1. Run your Replit app
2. Copy URL from webview: `https://your-project-name.replit.app`

#### Step 4A.3: Update Azure AD Redirect URI

1. Go back to **Azure Portal** → **Azure AD** → **App registrations**
2. Click your app → **Authentication**
3. Update Redirect URI:
   - Replace placeholder with: `https://your-actual-replit-url.replit.app`
4. Click **Save**

**✅ Success**: App deployed and configured!

---

## Phase 5: Create Teams App Package (15 minutes)

### Step 5.1: Create manifest.json

Create a file with this content (update the placeholders):

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_CLIENT_ID_HERE",
  "packageName": "com.test.meetingminutes",
  "developer": {
    "name": "Test Organization",
    "websiteUrl": "https://your-replit-url.replit.app",
    "privacyUrl": "https://your-replit-url.replit.app/privacy",
    "termsOfUseUrl": "https://your-replit-url.replit.app/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "Meeting Minutes Management (Test)"
  },
  "description": {
    "short": "Automatic meeting minutes capture",
    "full": "Automatically captures and processes Teams meeting minutes with AI."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://your-replit-url.replit.app",
      "websiteUrl": "https://your-replit-url.replit.app",
      "scopes": ["personal"]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["your-replit-url.replit.app"],
  "webApplicationInfo": {
    "id": "YOUR_CLIENT_ID_HERE",
    "resource": "api://your-replit-url.replit.app/YOUR_CLIENT_ID_HERE"
  }
}
```

**Replace**:
- `YOUR_CLIENT_ID_HERE`: Your Azure AD client ID from Step 2.1
- `your-replit-url.replit.app`: Your actual Replit URL

### Step 5.2: Create Icons

**color.png** (192x192px): Colorful icon
**outline.png** (32x32px): White on transparent

Quick option: Download placeholders from https://icons8.com (search "document")

### Step 5.3: Package as ZIP

1. Create folder with these 3 files:
   - `manifest.json`
   - `color.png`
   - `outline.png`

2. Create ZIP (files at root, NOT in subfolder):
   - **Windows**: Select files → Right-click → Send to → Compressed folder
   - **Mac**: Select files → Right-click → Compress
   - **Linux**: `zip meeting-minutes.zip manifest.json *.png`

3. Name: `meeting-minutes-test.zip`

**✅ Success**: Teams app package ready!

---

## Phase 6: Install Teams App (10 minutes)

### Step 6.1: Upload to Teams

1. Open **Microsoft Teams** (web or desktop)
2. Sign in as `admin@meetingminutestest.onmicrosoft.com`
3. Click **Apps** (left sidebar)
4. Click **Manage your apps**
5. Click **Upload an app** → **Upload a custom app**
6. Select `meeting-minutes-test.zip`
7. Click **Add**

### Step 6.2: Open the App

1. Find app in your app list
2. Click to open
3. **Teams SSO logs you in automatically**
4. You should see the dashboard!

### Step 6.3: Pin to Sidebar

1. Right-click app icon
2. Select **Pin**
3. App now in left sidebar for easy access

**✅ Success**: App installed and accessible!

---

## Phase 7: Testing Workflow (2-3 hours)

### Test 1: End-to-End Meeting Capture

**Objective**: Verify complete workflow from meeting → AI → approval → distribution

#### 7.1: Schedule and Record Meeting

1. **Teams Calendar** → **+ New meeting**
2. Configure:
   - Title: `Test Meeting - Project Status`
   - Attendees: john.doe@, jane.smith@, bob.johnson@
   - Time: Now or soon
3. **Join meeting**
4. **⚠️ CRITICAL: Start recording!**
5. Talk for 3-5 minutes:
   - "We discussed Q4 timeline"
   - "Decision: Approve $50K budget increase"
   - "Action: John prepares report by Friday"
6. **Stop recording**
7. **End meeting**

#### 7.2: Wait for Processing

- Teams processes recording: 5-15 minutes
- Webhook triggers automatically
- Check Replit logs for: `Webhook received: meeting ended`

#### 7.3: Verify Meeting Appears

1. Open **Meeting Minutes** app in Teams
2. **Dashboard** should show:
   - Total Meetings: 1
   - Recent meeting listed
3. Click meeting card
4. Verify details correct

#### 7.4: Generate AI Minutes

1. Click **"Generate Minutes"**
2. Watch status: "Processing..." → "Completed"
3. Wait 30-60 seconds
4. **Verify output**:
   - Summary paragraph
   - Key discussions list
   - Decisions list
   - Action items with assignees

#### 7.5: Approve Minutes

1. Sign in as **jane.smith@** (approver)
2. Open meeting
3. Click **"Approve"**
4. Status changes to "Approved"

#### 7.6: Verify Email Distribution

1. Check email for john.doe@, jane.smith@, bob.johnson@
2. Should receive:
   - Subject: "Meeting Minutes: Test Meeting..."
   - DOCX attachment
   - PDF attachment
3. Download and open attachments
4. Verify: classification headers, content, formatting

**✅ Expected**: Complete automation from meeting → minutes → distribution!

---

### Test 2: Azure AD Group Access Control

**Objective**: Verify access based on Azure AD group membership

#### 7.7: Create Two Meetings

**Meeting 1** (UNCLASSIFIED):
- Title: `Budget Review`
- Classification: UNCLASSIFIED
- Attendees: john.doe@, jane.smith@

**Meeting 2** (SECRET):
- Title: `Security Review`
- Classification: SECRET
- Attendees: jane.smith@, bob.johnson@

Record both meetings (even 1 minute each is fine for testing).

#### 7.8: Test User Access

**As John** (UNCLASSIFIED clearance only):
1. Sign in as john.doe@
2. Open app
3. **Should see**: Budget Review ✅
4. **Should NOT see**: Security Review ❌
5. Dashboard shows: Total Meetings = 1

**As Jane** (SECRET clearance, Admin):
1. Sign in as jane.smith@
2. **Should see**: Both meetings ✅
3. Dashboard shows: Total Meetings = 2+

**As Bob** (SECRET clearance):
1. Sign in as bob.johnson@
2. **Should see**: Security Review ✅ (attended)
3. **Should NOT see**: Budget Review ❌ (didn't attend)
4. Dashboard shows: Total Meetings = 1

**✅ Expected**: Access control works! Users see only meetings they:
- Attended (or have auditor/admin role)
- Have Azure AD clearance group for

---

### Test 3: Role Permissions

#### 7.9: Test Viewer (Cannot Approve)

1. Sign in as **charlie.brown@** (viewer role)
2. Open any meeting
3. **Should NOT see** approve button
4. Read-only access

#### 7.10: Test Approver (Can Approve)

1. Sign in as **alice.williams@** (approver role)
2. Open pending meeting she attended
3. **Should see** "Approve" and "Reject" buttons
4. Click "Approve" → works!

**✅ Expected**: Only approvers can approve!

---

### Test 4: Auditor Role

#### 7.11: Assign Auditor

1. **Azure AD** → **Groups** → **DOD-Role-Auditor**
2. Add member: charlie.brown@
3. Wait 15 minutes (or sign out/in)

#### 7.12: Verify Auditor Access

1. Sign in as charlie.brown@
2. **Should now see**: ALL meetings (not just attended)
3. Limited by clearance (UNCLASSIFIED only)

**✅ Expected**: Auditors see full archive within clearance!

---

### Test 5: Dynamic Access

#### 7.13: Remove from Group

1. **Azure AD** → **DOD-Clearance-SECRET**
2. Remove bob.johnson@
3. Wait 15 minutes

#### 7.14: Verify Access Revoked

1. Sign in as bob.johnson@
2. **Can no longer see** SECRET meetings
3. Access updated in real-time!

**✅ Expected**: Group membership changes = immediate access changes!

---

### Complete Testing Checklist

- [ ] Meeting auto-captured via webhook
- [ ] Transcript downloaded
- [ ] AI generates summary, discussions, decisions, actions
- [ ] Approval workflow works
- [ ] DOCX has classification markings
- [ ] PDF formatted correctly
- [ ] Emails sent to attendees
- [ ] Azure AD groups control access
- [ ] UNCLASSIFIED users can't see SECRET
- [ ] Viewers can't approve
- [ ] Approvers can approve
- [ ] Auditors see all (within clearance)
- [ ] Group removal revokes access
- [ ] Teams SSO works
- [ ] No errors in logs

**✅ ALL CHECKED = Commercial testing SUCCESSFUL!**

---

## Phase 8: Transition to DOD (2-4 weeks)

### What Changes for DOD

| Component | Commercial | DOD |
|-----------|-----------|-----|
| Microsoft 365 | `xxx.onmicrosoft.com` | `dod.teams.mil` |
| Azure OpenAI | `xxx.openai.azure.com` | `xxx.openai.azure.us` |
| Deployment | Replit | AWS Gov Cloud |
| Users | 25 test | 300,000 real |

### What Stays the Same

✅ Application code (100%)
✅ Database schema
✅ UI/UX
✅ Workflows
✅ Access control logic

**Only credentials and endpoints change!**

### Next Steps

1. Document test results
2. Request DOD resources
3. Follow **AWS_DEPLOYMENT_GUIDE.md** for Gov Cloud
4. Test with 50-100 DOD users
5. Deploy to 300K users (**TEAMS_APP_DEPLOYMENT.md**)

---

## Troubleshooting

### Webhook Not Firing

**Symptoms**: Meeting ends but doesn't appear in app

**Solutions**:
- Verify recording was enabled
- Check webhook URL accessible (HTTPS)
- Review Microsoft Graph subscription active
- Check Replit logs for errors

### Azure AD Groups Not Working

**Symptoms**: Users see wrong meetings

**Solutions**:
- Verify user in correct Azure AD groups
- Wait 15 minutes for cache refresh
- Check `Group.Read.All` permission granted
- Sign out/in to force refresh

### Teams SSO Fails

**Symptoms**: Login loop or auth error

**Solutions**:
- Verify redirect URI matches exactly
- Check `webApplicationInfo` in manifest
- Ensure API permissions granted

### AI Processing Fails

**Symptoms**: Minutes generation stuck

**Solutions**:
- Verify Azure OpenAI deployment name = `gpt-4`
- Check API key valid
- Verify sufficient quota

---

## Cost Summary

**Commercial Testing**: ~$15-20/month
- Microsoft 365 E5: $0 (30-day trial)
- Replit: $10-20/month
- Azure OpenAI: ~$5-10/month (minimal usage)

**DOD Production**: ~$1,700/month
- AWS Gov Cloud infrastructure
- 300,000 users
- Full redundancy and compliance

---

## Success Criteria

**Ready for DOD when**:
✅ All test scenarios pass
✅ No errors in logs
✅ Performance acceptable
✅ Documentation complete
✅ Stakeholder approval received

---

## Support Resources

- **Microsoft Graph**: https://learn.microsoft.com/graph
- **Teams Apps**: https://learn.microsoft.com/microsoftteams/platform
- **Azure AD**: https://learn.microsoft.com/azure/active-directory
- **Azure OpenAI**: https://learn.microsoft.com/azure/ai-services/openai

---

## Key Takeaways

**✅ Independent of CapraGPT/DON-GPT**
- Your app: Automated meeting minutes workflow
- CapraGPT: General AI chatbot
- Both coexist, serve different purposes

**✅ Replit = AWS for Microsoft Integrations**
- Same webhooks
- Same Graph API calls
- Same Azure AD auth
- Only deployment platform differs

**✅ Commercial First = Smart Approach**
- Prove it works before DOD investment
- Debug easily in open environment
- Build confidence for production

**✅ Azure AD Groups = Scalable**
- IT manages centrally
- App reads membership
- No database updates needed
- Works for 300K users

---

**Total Time**: ~5 hours setup + 2-3 hours testing = **1-2 days to fully validated commercial test environment!**

🚀 **Then**: Deploy to DOD with confidence!
