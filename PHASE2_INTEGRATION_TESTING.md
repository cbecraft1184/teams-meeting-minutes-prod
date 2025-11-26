# Phase 2 Integration & Testing - Complete Workflow

**Deployment Status:** Phase 2 Active (Production Microsoft 365 Integration Enabled)  
**Container App:** https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io  
**Revision:** teams-minutes-app--0000015 (Healthy)

---

## Prerequisites Verification Checklist

### Step 1: Verify Azure AD App Registrations

Run these commands to verify all app registrations are properly configured:

```bash
# 1. Verify Graph API App Registration
az ad app show --id 71383692-c5b6-40cc-94cf-96c970e414dc --query "{name:displayName, id:appId, signInAudience:signInAudience}" --output table

# 2. Verify Bot App Registration  
az ad app show --id 5ea1c494-6869-4879-8dc2-16c7b57da3e3 --query "{name:displayName, id:appId, signInAudience:signInAudience}" --output table

# 3. Check Graph API permissions
az ad app permission list --id 71383692-c5b6-40cc-94cf-96c970e414dc --output table

# 4. Verify admin consent was granted
az ad app permission admin-consent --id 71383692-c5b6-40cc-94cf-96c970e414dc
```

**Expected Results:**
- ✅ Graph API app exists with application permissions (not delegated)
- ✅ Bot app exists with Teams bot configuration
- ✅ Admin consent granted for all Graph permissions
- ✅ Redirect URIs configured:
  - `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/auth/callback`
  - `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/silent-auth`

### Step 2: Verify Container App Environment Variables

```bash
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env[?name=='USE_MOCK_SERVICES' || name=='ENABLE_JOB_WORKER' || name=='GRAPH_CLIENT_ID' || name=='MICROSOFT_APP_ID'].{Name:name, Value:value}" \
  --output table
```

**Expected Configuration:**
- ✅ USE_MOCK_SERVICES=false
- ✅ ENABLE_JOB_WORKER=true
- ✅ ENABLE_CLEANUP_SCHEDULER=true
- ✅ GRAPH_CLIENT_ID=71383692-c5b6-40cc-94cf-96c970e414dc
- ✅ MICROSOFT_APP_ID=5ea1c494-6869-4879-8dc2-16c7b57da3e3
- ✅ DATABASE_URL configured with URL-encoded password

### Step 3: Verify Webhook Endpoints Accessibility

```bash
# Test Graph webhook endpoint
curl -X POST https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/webhooks/msgraph?validationToken=test

# Test Bot messaging endpoint  
curl -X POST https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/webhooks/bot/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message"}'
```

**Expected Results:**
- ✅ Graph webhook returns validation token (or 400 if no token)
- ✅ Bot endpoint returns 200 or 401 (not 404)

---

## Teams App Integration (Browser-Based Testing First)

**IMPORTANT:** You can test the application via browser BEFORE creating Teams app package.

### Option A: Browser-Based Testing (Recommended First)

1. **Navigate to Application URL:**
   ```
   https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
   ```

2. **Sign in with Azure AD:**
   - Use an account from your tenant: `ChrisBecraft.onmicrosoft.com`
   - Grant consent if prompted
   - You should see the Dashboard

3. **Verify Authentication:**
   - Dashboard loads successfully
   - User profile displays in top-right
   - No "Authentication required" errors

4. **Check Initial State:**
   - Total Meetings: 0
   - Pending Minutes: 0
   - Recent Meetings: "No recent meetings to display"

**If browser access works, proceed to Teams App Integration below.**  
**If browser access fails, STOP and troubleshoot Azure AD configuration first.**

---

### Option B: Teams App Integration (After Browser Testing)

#### Step 1: Prepare Teams App Manifest

The manifest needs these values (already configured):

| Placeholder | Value |
|-------------|-------|
| TEAMS_APP_ID | `6d94baf3-1ed6-4d34-8401-71c724305571` |
| AZURE_AD_APP_ID | `71383692-c5b6-40cc-94cf-96c970e414dc` |
| MICROSOFT_APP_ID | `5ea1c494-6869-4879-8dc2-16c7b57da3e3` |
| TAB_ENDPOINT | `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io` |
| TAB_DOMAIN | `teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io` |

#### Step 2: Create App Icons (Required)

**Color Icon (192x192px):**
- Create a 192x192px PNG with your company branding
- Save as `color.png`

**Outline Icon (32x32px):**
- Create a 32x32px PNG with transparent background
- Simple white outline/logo
- Save as `outline.png`

**Quick Icon Creation (if needed):**
- Use https://www.canva.com or similar
- Or use placeholder solid color squares for testing

#### Step 3: Create Teams App Package

**On Windows (PowerShell):**
```powershell
# Navigate to project directory
cd path\to\teams-app

# Create ZIP with configured manifest and icons
Compress-Archive -Path manifest.json,color.png,outline.png -DestinationPath ..\teams-minutes-app.zip -Force
```

**On macOS/Linux:**
```bash
cd teams-app
zip -r ../teams-minutes-app.zip manifest.json color.png outline.png
```

**CRITICAL:** Icons must be in ZIP root, not in a subfolder.

#### Step 4: Sideload Teams App (For Testing)

**Enable Developer Mode:**
1. Open Microsoft Teams desktop/web app
2. Go to Settings → About
3. Click version number 5 times (enables Developer mode)

**Upload Custom App:**
1. Teams → Apps (left sidebar)
2. Click "Manage your apps" (bottom left)
3. Click "Upload a custom app" → "Upload for me or my teams"
4. Select `teams-minutes-app.zip`
5. Click "Add" when prompted

**Verify Installation:**
- ✅ "Meeting Minutes" app appears in left sidebar
- ✅ Clicking it opens the dashboard
- ✅ Three tabs visible: Dashboard, Meetings, Archive

#### Step 5: Admin Deployment (Production - Optional)

**For organization-wide deployment:**

1. **Upload to Teams Admin Center:**
   - Go to https://admin.teams.microsoft.com
   - Teams apps → Manage apps → Upload new app
   - Upload `teams-minutes-app.zip`
   - Click "Publish"

2. **Deploy via Setup Policy:**
   - Teams Admin Center → Setup policies
   - Select "Global (Org-wide default)"
   - Installed apps → Add "Meeting Minutes"
   - Pinned apps → Add "Meeting Minutes" (optional auto-pin)
   - Save

3. **Wait for Propagation:**
   - Changes take up to 24 hours
   - Users may need to restart Teams

---

## Complete End-to-End Testing Workflow

### Test Scenario: Schedule → Record → Generate → Approve → Distribute

#### Phase 1: Pre-Test Validation (5 minutes)

1. **Verify Application Access:**
   ```bash
   curl -s https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/health
   ```
   Expected: `{"status":"ok"}`

2. **Check Database Connectivity:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 20 | grep -i "database\|error"
   ```
   Expected: No "connection refused" or "authentication failed" errors

3. **Verify Job Worker is Running:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 50 | grep -i "job worker"
   ```
   Expected: "Job worker ENABLED" (not disabled)

#### Phase 2: Schedule Teams Meeting (10 minutes)

1. **Create Teams Meeting:**
   - Open Outlook or Teams Calendar
   - Schedule new meeting
   - **CRITICAL Settings:**
     - Add at least 2 attendees from your tenant
     - Enable "Teams meeting"
     - Schedule for 15-20 minutes from now
     - **Meeting options:**
       - Allow recording: ON
       - Who can record: Organizer and presenters
       - Transcription: ON (REQUIRED for AI minutes)

2. **Join and Record Meeting:**
   - Join meeting when scheduled
   - Click "Record" button in meeting controls
   - **IMPORTANT:** Recording must be to "Cloud" (not local)
   - Have brief discussion (2-3 minutes minimum)
   - Mention specific action items clearly: "John will send report by Friday"
   - End recording
   - End meeting

3. **Wait for Processing:**
   - Microsoft processes recording: 5-30 minutes
   - Transcript generation: 10-45 minutes
   - **Do NOT proceed until transcript is available in Teams chat**

#### Phase 3: Verify Meeting Capture (15 minutes after meeting ends)

1. **Check Application Dashboard:**
   - Open Meeting Minutes app (browser or Teams tab)
   - Refresh dashboard
   - **Expected:** New meeting appears in "Recent Meetings"
   - Status should show "Scheduled" → "Completed" → "Enriched"

2. **Check Azure Logs for Webhook:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 100 | grep -i "webhook\|meeting\|graph"
   ```
   **Expected log entries:**
   - "Graph webhook notification received"
   - "Meeting enriched successfully"
   - "Transcript downloaded"

3. **Verify Database Record:**
   ```bash
   # Check if meeting was captured
   curl -s https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/meetings \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   Expected: JSON array with meeting object

#### Phase 4: Verify AI Minutes Generation (20-40 minutes after meeting)

1. **Monitor Job Queue:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 100 | grep -i "generate_minutes\|azure openai\|job"
   ```
   **Expected log entries:**
   - "Job: generate_minutes processing"
   - "Azure OpenAI request sent"
   - "Minutes generated successfully"

2. **Check Dashboard:**
   - Pending Minutes count should increase from 0 to 1
   - Click meeting in "Recent Meetings"
   - **Expected:** Draft minutes visible with:
     - Summary
     - Key discussions
     - Decisions
     - Action items
     - Approval status: "Pending Review"

3. **Verify Minutes Quality:**
   - Summary accurately reflects meeting content
   - Action items extracted correctly
   - Attendees list matches participants

#### Phase 5: Approve Minutes (5 minutes)

1. **Access Approval Interface:**
   - Click on meeting with pending minutes
   - Review generated content
   - Click "Approve" button

2. **Verify Approval Processing:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 50 | grep -i "approval\|approved\|distribution"
   ```
   **Expected:**
   - "Minutes approved by [user]"
   - "Triggering distribution jobs"

3. **Check Status Change:**
   - Approval status: "Pending Review" → "Approved"
   - Approved timestamp displayed
   - Approver name shown

#### Phase 6: Verify Distribution (10-20 minutes)

**Email Distribution:**

1. **Check Job Logs:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 100 | grep -i "send_email\|graph.*sendmail"
   ```
   **Expected:**
   - "Job: send_email processing"
   - "Email sent via Microsoft Graph"
   - "Recipients: [attendee list]"

2. **Verify Email Received:**
   - Check inbox of meeting attendees
   - From: `ChristopherBecraft@ChrisBecraft.onmicrosoft.com` (GRAPH_SENDER_EMAIL)
   - Subject: "Meeting Minutes: [Meeting Title]"
   - Attachments: DOCX and/or PDF

**SharePoint Archival:**

1. **Check SharePoint Upload Logs:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 100 | grep -i "sharepoint\|upload"
   ```
   **Expected:**
   - "Job: upload_sharepoint processing"
   - "Document uploaded to SharePoint"
   - "URL: https://chrisbecraft.sharepoint.com/..."

2. **Verify SharePoint Document:**
   - Navigate to: https://chrisbecraft.sharepoint.com
   - Go to Documents library (or configured library)
   - **Expected:** New document with meeting title
   - File includes timestamp and meeting metadata

**Teams Notification (if configured):**

1. **Check Bot Logs:**
   ```bash
   az containerapp logs show \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --tail 100 | grep -i "bot\|adaptive card\|teams notification"
   ```

2. **Verify Teams Message:**
   - Check Teams chat/channel where meeting was held
   - **Expected:** Adaptive card notification with minutes summary

#### Phase 7: Archive Verification

1. **Check Dashboard:**
   - Total Meetings: 1
   - Completed Meetings: 1
   - Archived: 1
   - Pending Minutes: 0

2. **Search Archive:**
   - Go to "Archive" tab
   - Search for meeting title
   - **Expected:** Document appears in search results
   - Click document → Download DOCX or PDF

---

## Success Criteria

**Complete workflow succeeds when ALL of these are true:**

- ✅ Browser access works with Azure AD authentication
- ✅ Teams tab loads with SSO (if Teams app deployed)
- ✅ Meeting auto-appears in dashboard within 15 minutes after recording ends
- ✅ AI generates draft minutes within 40 minutes
- ✅ Generated minutes are accurate and complete
- ✅ Approval workflow functions correctly
- ✅ Email distribution sends to all attendees
- ✅ SharePoint document uploaded successfully
- ✅ Archive search returns approved minutes
- ✅ No errors in Azure Container App logs

---

## Troubleshooting Guide

### Issue: Meeting Not Captured

**Check:**
1. Graph webhook subscription active:
   ```bash
   az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes-demo --tail 100 | grep "webhook subscription"
   ```
2. Meeting had cloud recording enabled
3. Transcript generation completed in Teams

**Fix:**
- Verify `GRAPH_CLIENT_ID` and `GRAPH_CLIENT_SECRET` are correct
- Check admin consent was granted for Graph permissions
- Ensure webhook endpoint is publicly accessible

### Issue: AI Minutes Not Generated

**Check:**
1. Azure OpenAI credentials:
   ```bash
   az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes-demo --tail 100 | grep "Azure OpenAI"
   ```
2. Job worker enabled: `ENABLE_JOB_WORKER=true`
3. Transcript actually exists and was downloaded

**Fix:**
- Verify `AZURE_OPENAI_API_KEY` is valid
- Check `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT_NAME`
- Review job queue error logs

### Issue: Email Not Sent

**Check:**
1. Graph sender email configured: `GRAPH_SENDER_EMAIL`
2. Mail.Send permission granted with admin consent
3. Sender has valid mailbox in tenant

**Fix:**
```bash
# Verify Graph permissions
az ad app permission list --id 71383692-c5b6-40cc-94cf-96c970e414dc | grep "Mail.Send"

# Re-grant admin consent if needed
az ad app permission admin-consent --id 71383692-c5b6-40cc-94cf-96c970e414dc
```

### Issue: SharePoint Upload Failed

**Check:**
1. SharePoint site URL is correct: `SHAREPOINT_SITE_URL`
2. Library exists: `SHAREPOINT_LIBRARY_NAME`
3. Graph app has Sites.ReadWrite.All permission

**Fix:**
- Navigate to SharePoint site in browser to verify access
- Check library name matches exactly (case-sensitive)
- Verify Graph app has SharePoint permissions granted

---

## Next Steps After Successful Test

1. **Document Results:**
   - Screenshot each phase completion
   - Save generated minutes sample
   - Note any performance metrics (processing times)

2. **Deploy to More Users:**
   - Teams Admin Center → Setup policies
   - Assign to pilot group
   - Monitor for 1-2 weeks

3. **Optimize Configuration:**
   - Adjust cleanup schedules if needed
   - Fine-tune AI prompts for better minutes quality
   - Configure additional notification channels

4. **Production Readiness:**
   - Scale Container App resources if needed
   - Set up Application Insights alerts
   - Configure backup/disaster recovery procedures

---

## Support Contacts

- **Azure Support:** Azure Portal → Help + Support
- **Teams Admin:** https://admin.teams.microsoft.com
- **Application Logs:** Container App → Log stream
- **Database Access:** Azure Portal → PostgreSQL Flexible Server
