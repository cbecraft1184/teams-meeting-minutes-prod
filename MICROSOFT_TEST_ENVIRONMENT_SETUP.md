# Microsoft Test Environment Setup for Teams App

## Creating a Test Platform for DOD Teams Meeting Minutes Plugin

This guide shows you how to set up a complete Microsoft test environment for testing your Teams app before deploying to 300,000 production users.

---

## Overview

**What You Need to Test:**
- ✅ Teams app installation and sidebar appearance
- ✅ Teams SSO (Single Sign-On) authentication
- ✅ Microsoft Graph API webhooks for meeting capture
- ✅ Azure AD group-based access control
- ✅ Meeting minutes generation workflow
- ✅ Document export and SharePoint integration
- ✅ Email distribution

**Test Environment Components:**
1. Microsoft 365 test tenant (with Teams)
2. Azure AD test environment
3. Test deployment of your app (AWS or Replit)
4. Test Azure OpenAI instance
5. Test SharePoint site

---

## Option 1: Microsoft 365 Developer Program (Free - If Eligible)

### ⚠️ Important Update (2024)
As of January 2024, **free Microsoft 365 Developer tenants are only available to**:
- Visual Studio Professional or Enterprise subscribers
- Members of qualifying Microsoft programs

**If you don't qualify**, skip to Option 2 (Trial Tenant) or Option 3 (Internal Test Tenant).

### Eligibility Check

**Do you have:**
- [ ] Active Visual Studio Professional subscription ($45/month)?
- [ ] Active Visual Studio Enterprise subscription ($250/month)?
- [ ] Existing Microsoft partnership program membership?

**If YES**, proceed with this option.
**If NO**, skip to Option 2.

---

### Step 1: Join Microsoft 365 Developer Program

1. **Visit**: https://developer.microsoft.com/en-us/microsoft-365/dev-program
2. Click **"Join Now"**
3. Sign in with your Microsoft account
   - If you have Visual Studio subscription, use that account
4. Complete your profile:
   - Country: United States
   - Company: DOD IT Department
   - Development interests: Select "Microsoft Teams"
5. Accept terms and conditions

### Step 2: Create Instant Sandbox Tenant

**Why Instant Sandbox?**
- ✅ Provisioned in seconds (vs. 2 days for configurable)
- ✅ Pre-loaded with 25 test users
- ✅ Sample Teams data already configured
- ✅ Teams app sideloading pre-enabled
- ✅ Perfect for Teams app testing

**Steps:**
1. In Developer Program dashboard, click **"Set up E5 subscription"**
2. Choose **"Instant sandbox"** (recommended)
3. Select region: **United States** (or US Government for Gov Cloud)
4. Create admin credentials:
   - Username: `admin` (becomes admin@yourdevtenant.onmicrosoft.com)
   - Password: Strong password (save it!)
5. Verify phone number
6. Wait 1-2 minutes for provisioning

**What You Get:**
- **25 user licenses** (24 test users + 1 admin)
- **Microsoft Teams** with sample data
- **Azure AD** with test users
- **SharePoint Online** for testing
- **Exchange Online** for email testing
- **Duration**: 90 days, auto-renews if actively used
- **Visual Studio subscribers**: Never expires (tied to VS subscription)

### Step 3: Access Your Test Tenant

1. **Admin Portal**: https://admin.microsoft.com
   - Sign in with: `admin@yourdevtenant.onmicrosoft.com`
2. **Teams Admin Center**: https://admin.teams.microsoft.com
3. **Azure AD Portal**: https://portal.azure.com
4. **Teams Client**: https://teams.microsoft.com

### Step 4: Verify Sample Data

**Pre-configured test users (examples):**
- Adele Vance (AdeleV@yourdevtenant.onmicrosoft.com)
- Alex Wilber (AlexW@yourdevtenant.onmicrosoft.com)
- Isaiah Langer (IsaiahL@yourdevtenant.onmicrosoft.com)
- Megan Bowen (MeganB@yourdevtenant.onmicrosoft.com)
- ...and 20 more test users

**Pre-configured Teams:**
- "Mark 8 Project Team" with channels and chat history
- Sample files and documents
- Existing meeting history

---

## Option 2: Microsoft 365 Trial Tenant (Free - No Restrictions)

**Best if you don't have Visual Studio subscription.**

### Step 1: Sign Up for Microsoft 365 E5 Trial

1. **Visit**: https://www.microsoft.com/en-us/microsoft-365/enterprise/e5
2. Click **"Free trial"**
3. Enter business email or create new Microsoft account
4. Fill in organization details:
   - Organization name: "DOD Teams Testing"
   - Organization size: 25 users
   - Country: United States
5. Create your subdomain: `dodteamtest.onmicrosoft.com`
6. Set up admin account and password
7. Verify phone number

**What You Get:**
- **25 user licenses**
- **Microsoft Teams**
- **Azure AD**
- **SharePoint Online**
- **Duration**: 30 days free trial (can extend or upgrade)

### Step 2: Enable Teams App Upload

1. Go to **Teams Admin Center**: https://admin.teams.microsoft.com
2. Navigate to **Teams apps** → **Setup policies** → **Global**
3. Under **Custom apps**:
   - Toggle **"Upload custom apps"** to **On**
4. Click **Save**
5. Wait up to 24 hours for changes to propagate

### Step 3: Create Test Users

**PowerShell Method (Bulk Create):**

```powershell
# Install Microsoft Graph PowerShell
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect to Microsoft Graph
Connect-MgGraph -Scopes "User.ReadWrite.All"

# Create test users
$users = @(
    @{Name="John Doe"; Email="john.doe"},
    @{Name="Jane Smith"; Email="jane.smith"},
    @{Name="Bob Johnson"; Email="bob.johnson"},
    @{Name="Alice Williams"; Email="alice.williams"},
    @{Name="Charlie Brown"; Email="charlie.brown"}
)

foreach ($user in $users) {
    New-MgUser -DisplayName $user.Name `
        -MailNickname $user.Email `
        -UserPrincipalName "$($user.Email)@dodteamtest.onmicrosoft.com" `
        -PasswordProfile @{Password="TestPass123!"; ForceChangePasswordNextSignIn=$false} `
        -AccountEnabled $true `
        -UsageLocation "US"
}
```

**Manual Method (Admin Portal):**

1. Go to https://admin.microsoft.com
2. **Users** → **Active users** → **Add a user**
3. Fill in details for each test user
4. Assign Teams license
5. Repeat for 5-10 test users

---

## Option 3: Use Your Organization's Internal Test Tenant

**Best for DOD deployment** - Your organization likely has a dedicated test/dev tenant.

### Step 1: Request Access from IT

Contact your IT department and request:
- [ ] Access to test Microsoft 365 tenant
- [ ] Admin rights for Teams app management
- [ ] Azure AD app registration permissions
- [ ] 10-15 test user accounts
- [ ] Test SharePoint site

### Step 2: Verify Tenant Capabilities

Ensure the test tenant has:
- [ ] Microsoft Teams enabled
- [ ] Azure AD Premium (for group-based access)
- [ ] SharePoint Online
- [ ] Custom app upload enabled
- [ ] External API access (for Graph API webhooks)

---

## Phase 2: Configure Azure AD for Testing

### Step 1: Register Azure AD App (Test Environment)

1. Go to **Azure Portal**: https://portal.azure.com
2. **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - Name: `DOD Meeting Minutes Test`
   - Supported account types: `Single tenant`
   - Redirect URI: Your test app URL
4. Save **Application (client) ID** and **Directory (tenant) ID**

### Step 2: Create Client Secret

1. In your app, go to **Certificates & secrets**
2. **New client secret**
3. Description: `Test Environment Secret`
4. Expiration: 6 months
5. **Copy the secret value immediately**

### Step 3: Configure API Permissions

Add these permissions:
- ✅ `User.Read`
- ✅ `User.ReadBasic.All`
- ✅ `OnlineMeetings.Read`
- ✅ `OnlineMeetingRecording.Read.All`
- ✅ `Mail.Send`
- ✅ `Files.ReadWrite.All`
- ✅ `Group.Read.All` (for Azure AD group access control)

Click **Grant admin consent** (requires admin role)

### Step 4: Create Test Azure AD Groups

Create groups for clearance testing:

```powershell
# Connect to Azure AD
Connect-AzureAD

# Create clearance groups
$groups = @(
    "DOD-Clearance-UNCLASSIFIED",
    "DOD-Clearance-CONFIDENTIAL",
    "DOD-Clearance-SECRET",
    "DOD-Clearance-TOP_SECRET",
    "DOD-Role-Admin",
    "DOD-Role-Approver",
    "DOD-Role-Auditor"
)

foreach ($groupName in $groups) {
    New-AzureADGroup -DisplayName $groupName `
        -MailEnabled $false `
        -SecurityEnabled $true `
        -MailNickname $groupName
}
```

### Step 5: Assign Test Users to Groups

```powershell
# Get groups
$unclassifiedGroup = Get-AzureADGroup -Filter "DisplayName eq 'DOD-Clearance-UNCLASSIFIED'"
$secretGroup = Get-AzureADGroup -Filter "DisplayName eq 'DOD-Clearance-SECRET'"
$adminGroup = Get-AzureADGroup -Filter "DisplayName eq 'DOD-Role-Admin'"

# Get test users
$john = Get-AzureADUser -Filter "UserPrincipalName eq 'john.doe@dodteamtest.onmicrosoft.com'"
$jane = Get-AzureADUser -Filter "UserPrincipalName eq 'jane.smith@dodteamtest.onmicrosoft.com'"

# Assign John to UNCLASSIFIED (viewer)
Add-AzureADGroupMember -ObjectId $unclassifiedGroup.ObjectId -RefObjectId $john.ObjectId

# Assign Jane to SECRET (admin)
Add-AzureADGroupMember -ObjectId $secretGroup.ObjectId -RefObjectId $jane.ObjectId
Add-AzureADGroupMember -ObjectId $adminGroup.ObjectId -RefObjectId $jane.ObjectId
```

---

## Phase 3: Deploy Test App Instance

### Option A: Deploy to Replit (Easiest for Testing)

1. **Keep existing Replit deployment**
2. Add test environment secrets:
   ```
   MICROSOFT_TENANT_ID=<test-tenant-id>
   MICROSOFT_CLIENT_ID=<test-client-id>
   MICROSOFT_CLIENT_SECRET=<test-client-secret>
   AZURE_OPENAI_ENDPOINT=<test-openai-endpoint>
   AZURE_OPENAI_API_KEY=<test-openai-key>
   ```
3. Use existing Replit PostgreSQL database
4. Deploy and get URL: `https://your-test-app.replit.app`

### Option B: Deploy Test Instance to AWS

1. Create separate AWS environment for testing
2. Use smaller instance sizes (save costs)
3. Deploy using same process as production
4. Test URL: `https://test-meeting-minutes.your-domain.com`

---

## Phase 4: Configure Test Azure OpenAI

### Option 1: Use Test Azure OpenAI Resource

1. Create new Azure OpenAI resource for testing
2. Region: East US (for testing, not Gov Cloud)
3. Deploy GPT-4 model
4. Use separate API keys from production

### Option 2: Use Lower-Cost Model for Testing

For testing, you can use:
- **GPT-3.5-turbo** instead of GPT-4 (much cheaper)
- **Lower token limits** for cost savings
- Same API, just different deployment name

---

## Phase 5: Create Test SharePoint Site

1. Go to SharePoint Admin Center
2. Create test site: `Meeting Minutes Test`
3. Create document library: `Test Meeting Minutes`
4. Set up same folder structure as production
5. Grant app permissions

---

## Phase 6: Create and Install Teams App Package

### Step 1: Create Test Manifest

Update `manifest.json` with test URLs:

```json
{
  "id": "<YOUR_TEST_AZURE_AD_CLIENT_ID>",
  "version": "1.0.0",
  "name": {
    "short": "Meeting Minutes (Test)",
    "full": "DOD Teams Meeting Minutes - Test Environment"
  },
  "developer": {
    "websiteUrl": "https://your-test-app.replit.app",
    "privacyUrl": "https://your-test-app.replit.app/privacy",
    "termsOfUseUrl": "https://your-test-app.replit.app/terms"
  },
  "staticTabs": [
    {
      "entityId": "dashboard",
      "name": "Dashboard",
      "contentUrl": "https://your-test-app.replit.app",
      "websiteUrl": "https://your-test-app.replit.app",
      "scopes": ["personal"]
    }
  ],
  "validDomains": [
    "your-test-app.replit.app"
  ],
  "webApplicationInfo": {
    "id": "<YOUR_TEST_AZURE_AD_CLIENT_ID>",
    "resource": "api://your-test-app.replit.app/<YOUR_TEST_AZURE_AD_CLIENT_ID>"
  }
}
```

### Step 2: Package and Upload

1. Create ZIP with manifest.json + icons
2. Name it: `dod-meeting-minutes-TEST.zip`
3. In Teams, go to **Apps** → **Manage your apps** → **Upload a custom app**
4. Upload the ZIP file
5. Click **Add** to install

---

## Phase 7: Testing Workflow

### Test Scenario 1: End-to-End Meeting Capture

**Steps:**
1. As test admin, schedule a Teams meeting
2. Add 2-3 test users as attendees
3. Start the meeting and **enable recording**
4. Have a 5-minute conversation about a test topic
5. End the meeting
6. Wait for webhook to trigger (check app logs)
7. Verify meeting appears in dashboard
8. Click "Generate Minutes"
9. Verify AI processing completes
10. Approve minutes
11. Check email was sent to attendees
12. Verify document uploaded to SharePoint

**Expected Results:**
- ✅ Meeting captured automatically via webhook
- ✅ Transcript downloaded from Teams
- ✅ AI generates summary, discussions, decisions, actions
- ✅ Minutes show "Pending Review" status
- ✅ Admin can approve
- ✅ DOCX/PDF generated correctly
- ✅ Emails sent to all attendees
- ✅ Documents archived to SharePoint

### Test Scenario 2: Azure AD Group Access Control

**Setup:**
- User A: Member of "DOD-Clearance-UNCLASSIFIED" group
- User B: Member of "DOD-Clearance-SECRET" group
- Meeting 1: Classification = UNCLASSIFIED
- Meeting 2: Classification = SECRET

**Steps:**
1. Create Meeting 1 (UNCLASSIFIED) with User A and B as attendees
2. Create Meeting 2 (SECRET) with User A and B as attendees
3. Sign in as User A
4. Verify User A sees only Meeting 1 (no access to SECRET)
5. Sign in as User B
6. Verify User B sees both meetings (has SECRET clearance)

**Expected Results:**
- ✅ User A (UNCLASSIFIED) sees 1 meeting
- ✅ User B (SECRET) sees 2 meetings
- ✅ Access control enforced via Azure AD groups
- ✅ No database changes needed when groups updated

### Test Scenario 3: Role-Based Access

**Setup:**
- User C: Role = Viewer
- User D: Role = Approver
- Meeting with pending minutes

**Steps:**
1. Sign in as User C (Viewer)
2. Try to approve minutes → Should fail (403 Forbidden)
3. Sign in as User D (Approver)
4. Approve minutes → Should succeed

**Expected Results:**
- ✅ Viewers cannot approve
- ✅ Approvers can approve
- ✅ Proper error messages shown

### Test Scenario 4: Auditor Role

**Setup:**
- User E: Role = Auditor, Clearance = SECRET
- 10 meetings across organization (mix of classifications)
- User E attended only 2 meetings personally

**Steps:**
1. Sign in as User E
2. Check dashboard

**Expected Results:**
- ✅ User E sees ALL meetings up to SECRET classification
- ✅ Not just the 2 they attended (auditor privilege)
- ✅ Still cannot see TOP_SECRET meetings (clearance limit)

### Test Scenario 5: Document Export

**Steps:**
1. Open approved meeting
2. Click "Download DOCX"
3. Open document, verify:
   - Classification markings in header/footer
   - Meeting details
   - Summary and decisions
   - Action items table
4. Click "Download PDF"
5. Verify PDF has same content + proper formatting

**Expected Results:**
- ✅ DOCX downloads successfully
- ✅ PDF downloads successfully
- ✅ Classification markings present
- ✅ All content formatted correctly

---

## Phase 8: Monitor Test Environment

### Check Application Logs

**Replit:**
- View logs in Replit console
- Check for errors during webhook processing

**AWS:**
- CloudWatch Logs: `/ecs/dod-meeting-minutes-test`
- Filter for ERROR level logs

### Check Graph API Webhooks

1. Go to Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
2. Sign in with test admin account
3. Run query: `GET https://graph.microsoft.com/v1.0/subscriptions`
4. Verify webhook subscription is active
5. Check expiration date (renew if needed)

### Monitor Database

1. Check PostgreSQL database for:
   - New meetings after Teams recording ends
   - Minutes records with AI-generated content
   - User records with Azure AD IDs
   - Access log entries

---

## Common Test Issues & Solutions

### Issue: Webhook not firing

**Solution:**
1. Verify webhook subscription is active
2. Check webhook URL is publicly accessible (HTTPS required)
3. Test webhook endpoint: `curl -X POST https://your-test-app.replit.app/api/webhooks/teams`
4. Review Azure AD app permissions
5. Check webhook logs for validation errors

### Issue: Teams SSO fails

**Solution:**
1. Verify Azure AD app redirect URI matches app URL
2. Check `webApplicationInfo` in manifest.json
3. Ensure API permissions granted and consented
4. Test token validation endpoint

### Issue: Azure AD groups not loading

**Solution:**
1. Verify `Group.Read.All` permission granted
2. Check user is actually in the groups (Azure AD portal)
3. Test Graph API call manually:
   ```
   GET https://graph.microsoft.com/v1.0/users/{userId}/memberOf
   ```
4. Clear app cache/session

### Issue: Meeting not appearing in app

**Solution:**
1. Check if recording was enabled (required for capture)
2. Verify webhook fired (check logs)
3. Check user attended the meeting
4. Verify user's clearance level includes meeting classification

---

## Test Checklist

Before deploying to production, verify:

**Infrastructure:**
- [ ] Test tenant created and accessible
- [ ] Azure AD app registered
- [ ] Test users created (5-10 minimum)
- [ ] Azure AD groups configured
- [ ] Test app deployed (Replit or AWS)
- [ ] Azure OpenAI configured
- [ ] Test SharePoint site created

**Teams App:**
- [ ] App package created with test URLs
- [ ] App uploaded to Teams
- [ ] App appears in Teams sidebar
- [ ] SSO authentication works

**Functionality:**
- [ ] Can create test meeting in Teams
- [ ] Recording captures successfully
- [ ] Webhook triggers on meeting end
- [ ] Meeting appears in dashboard
- [ ] AI minutes generation works
- [ ] Approval workflow functions
- [ ] Documents export (DOCX/PDF)
- [ ] Email distribution works
- [ ] SharePoint upload successful

**Access Control:**
- [ ] Azure AD group filtering works
- [ ] Role-based access enforced
- [ ] Clearance levels respected
- [ ] Auditor role works correctly
- [ ] Attendee filtering works

**Performance:**
- [ ] Dashboard loads quickly
- [ ] Search works efficiently
- [ ] No errors in logs
- [ ] Database queries performant

---

## Cost Estimate for Test Environment

**Free Options:**
- Microsoft 365 Developer Program: **$0** (if eligible)
- Microsoft 365 E5 Trial: **$0** for 30 days
- Replit deployment: **~$10/month** (basic tier)
- Azure OpenAI (minimal testing): **~$5-10/month**

**Total: $15-20/month for complete test environment**

---

## Next Steps After Testing

1. ✅ Complete all test scenarios
2. ✅ Fix any bugs discovered
3. ✅ Document test results
4. ✅ Get approval for production deployment
5. ✅ Create production Azure AD app (separate from test)
6. ✅ Deploy to AWS Gov Cloud
7. ✅ Install in production Teams tenant
8. 🚀 Go live with 300,000 users!

---

## Resources

- Microsoft 365 Developer Program: https://developer.microsoft.com/en-us/microsoft-365/dev-program
- Teams Admin Center: https://admin.teams.microsoft.com
- Azure AD Portal: https://portal.azure.com
- Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
- Teams Developer Portal: https://dev.teams.microsoft.com

---

**Remember**: Testing in a safe environment is critical before deploying to 300,000 production users. Take your time with these test scenarios!
