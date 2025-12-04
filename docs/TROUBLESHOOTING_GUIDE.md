# Troubleshooting Guide

## Teams Meeting Minutes Application

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Audience:** IT Support, Administrators, Help Desk  
**Platform:** Azure Commercial Cloud (Not applicable to Azure Government or other sovereign clouds)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Diagnostic Tools](#diagnostic-tools)
3. [Common Issues by Category](#common-issues-by-category)
   - [Authentication Issues](#authentication-issues)
   - [Meeting Sync Issues](#meeting-sync-issues)
   - [Minutes Generation Issues](#minutes-generation-issues)
   - [UI and Display Issues](#ui-and-display-issues)
   - [Performance Issues](#performance-issues)
   - [Integration Issues](#integration-issues)
4. [Error Code Reference](#error-code-reference)
5. [Log Analysis](#log-analysis)
6. [Escalation Procedures](#escalation-procedures)

---

## 1. Introduction

### Purpose

This Troubleshooting Guide provides systematic approaches to diagnose and resolve issues with the Teams Meeting Minutes application. Use this guide when users report problems or when monitoring detects anomalies.

### How to Use This Guide

1. Identify the symptom or error message
2. Find the matching issue category
3. Follow the diagnostic steps
4. Apply the recommended resolution
5. Escalate if unresolved

### Support Tiers

| Tier | Handles | Escalates To |
|------|---------|--------------|
| L1 - Help Desk | User questions, basic issues | L2 |
| L2 - IT Admin | Configuration, access issues | L3 |
| L3 - Development | Code bugs, complex issues | Vendor |

---

## 2. Diagnostic Tools

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Basic health | `200 OK` |
| `GET /api/health` | Detailed status | JSON with component status |

### Azure Portal Resources

| Resource | Where to Find | What to Check |
|----------|---------------|---------------|
| Container App | Resource Group > Container App | Logs, Metrics, Revisions |
| PostgreSQL | Resource Group > PostgreSQL | Connection health, Metrics |
| Application Insights | Resource Group > App Insights | Failures, Performance |
| Azure AD | Azure AD > Sign-in logs | Authentication failures |

### Useful Commands

```bash
# Check application logs
az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes --follow

# Check database connectivity
psql "$DATABASE_URL" -c "SELECT 1"

# List recent deployments
az containerapp revision list --name teams-minutes-app --resource-group rg-teams-minutes

# Check Azure OpenAI status
az cognitiveservices account show --name teams-minutes-openai --resource-group rg-teams-minutes
```

---

## 3. Common Issues by Category

### Authentication Issues

#### Issue: "Authentication Error" displayed on app load

**Symptoms:**
- Red error page showing "Authentication Error"
- SSO timeout errors
- Login loops

**Diagnostic Steps:**

1. Check if running inside Teams or standalone browser
2. Review browser console for specific error
3. Check Azure AD sign-in logs

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| App running outside Teams | Expected behavior - Teams SSO only works in Teams client |
| Azure AD consent not granted | Grant admin consent in Azure Portal > App registrations |
| Invalid Application ID URI | Verify URI matches `api://{app-url}/{client-id}` |
| Teams client not authorized | Add client IDs in Expose an API > Authorized client applications |
| Token expired | Refresh the page or restart Teams |

**Resolution Steps:**

1. If outside Teams: Open app within Teams client
2. If in Teams:
   - Close Teams completely
   - Clear Teams cache:
     - Windows: `%appdata%\Microsoft\Teams\Cache`
     - Mac: `~/Library/Application Support/Microsoft/Teams/Cache`
   - Restart Teams
3. If still failing:
   - Verify app registration settings
   - Check `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` environment variables
   - Review SSO checklist in `docs/TEAMS_SSO_CHECKLIST.md`

---

#### Issue: "Access Denied" or 403 Forbidden

**Symptoms:**
- User sees "Access Denied" message
- API returns 403 status
- Certain features unavailable

**Diagnostic Steps:**

1. Identify user's role in the system
2. Check classification level of the meeting
3. Verify Azure AD group membership

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Insufficient role | Assign appropriate role (viewer/approver/admin) |
| Classification mismatch | User clearance doesn't match meeting classification |
| Not a meeting attendee | User must be attendee or organizer |
| Tenant isolation | User from different tenant cannot access |

**Resolution Steps:**

1. Check user's role:
   ```sql
   SELECT email, role, clearance_level FROM users WHERE email = 'user@company.com';
   ```
2. Update role if needed:
   ```sql
   UPDATE users SET role = 'approver' WHERE email = 'user@company.com';
   ```
3. Verify meeting access by checking attendees

---

### Meeting Sync Issues

#### Issue: Meetings not appearing in dashboard

**Symptoms:**
- Dashboard shows no meetings
- New meetings don't sync
- Missing meetings after calls

**Diagnostic Steps:**

1. Check when meeting ended (wait 5-10 minutes)
2. Verify webhook subscription is active
3. Check for polling errors in logs

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Meeting still processing | Wait 5-10 minutes after meeting ends |
| Webhook not registered | Restart app to re-register webhook |
| CallRecords.Read.All not consented | Grant admin consent for application permission |
| Graph API throttled | Wait and retry, check rate limits |

**Resolution Steps:**

1. Check webhook status in logs:
   ```
   [Webhook Routes] Registered: GET/POST /webhooks/graph/callRecords
   ```

2. If webhook missing, verify environment:
   ```bash
   # Check ENABLE_GRAPH_WEBHOOKS is true
   az containerapp show --name teams-minutes-app --resource-group rg-teams-minutes --query properties.template.containers[0].env
   ```

3. Check Graph API permissions:
   - Azure Portal > App registrations > API permissions
   - Verify `CallRecords.Read.All` has admin consent

4. Manually trigger sync (if available):
   ```bash
   curl -X POST https://{app-url}/api/admin/sync-meetings
   ```

---

#### Issue: Meeting shows but no transcript available

**Symptoms:**
- Meeting visible in dashboard
- Status shows "No Transcript"
- Minutes not generated

**Diagnostic Steps:**

1. Check if transcription was enabled during meeting
2. Verify transcript permissions in Graph API
3. Check transcript fetch job status

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Transcription not enabled | User must enable transcription during meeting |
| Meeting too short | Meetings under 5 minutes may not have transcripts |
| Transcript still processing | Microsoft may take 10-30 minutes to process |
| Permission denied | Verify OnlineMeetings.Read permission |

**Resolution Steps:**

1. Inform user to enable transcription:
   - During meeting, click "..." menu
   - Select "Start transcription"

2. Check job queue for transcript fetch:
   ```sql
   SELECT * FROM job_queue 
   WHERE type = 'fetch_transcript' 
   AND payload->>'meetingId' = 'xxx'
   ORDER BY created_at DESC;
   ```

3. If job failed, check last_error field for details

---

### Minutes Generation Issues

#### Issue: Minutes not generated after meeting

**Symptoms:**
- Meeting has transcript but no minutes
- Status stuck on "Processing"
- AI generation failed

**Diagnostic Steps:**

1. Check Azure OpenAI connectivity
2. Review AI generation job status
3. Check processing validation rules

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Azure OpenAI quota exceeded | Wait or increase quota |
| OpenAI credentials invalid | Verify API key and endpoint |
| Transcript too short | Meeting didn't meet minimum thresholds |
| Job worker not running | Enable `ENABLE_JOB_WORKER=true` |

**Resolution Steps:**

1. Check Azure OpenAI status:
   ```bash
   az cognitiveservices account show --name teams-minutes-openai --resource-group rg-teams-minutes --query properties.provisioningState
   ```

2. Check job queue:
   ```sql
   SELECT * FROM job_queue 
   WHERE type = 'generate_minutes' 
   AND status IN ('pending', 'failed')
   ORDER BY created_at DESC;
   ```

3. If job failed, retry:
   ```sql
   UPDATE job_queue SET status = 'pending', attempts = 0 WHERE id = {job_id};
   ```

4. Check processing validation:
   - See `docs/PROCESSING_VALIDATION.md` for thresholds

---

#### Issue: Generated minutes are low quality

**Symptoms:**
- Summary is too brief
- Action items missing
- Incorrect information

**Diagnostic Steps:**

1. Review original transcript quality
2. Check AI model configuration
3. Verify prompt template

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Poor audio quality | Inform users to use quality microphones |
| Multiple speakers unclear | Encourage speakers to identify themselves |
| Technical jargon | AI may struggle with specialized terms |
| Transcript errors | Original transcription had errors |

**Resolution Steps:**

1. Review the transcript for quality issues
2. Report patterns to development team for prompt improvement
3. Users can reject and request regeneration

---

### UI and Display Issues

#### Issue: Modal appears blank or collapsed

**Symptoms:**
- Meeting details modal is empty
- White box displays instead of content
- Tabs not visible

**Diagnostic Steps:**

1. Check browser console for errors
2. Verify CSS is loading correctly
3. Test in different browser

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| CSS not loaded | Clear browser cache, reload |
| JavaScript error | Check console, report to L3 |
| Browser compatibility | Try Chrome, Edge, or Firefox |
| Teams client issue | Restart Teams |

**Resolution Steps:**

1. User should:
   - Clear browser cache
   - Reload the app
   - Try in different browser/Teams client

2. If persists:
   - Collect browser console logs
   - Note Teams client version
   - Escalate to L3 with details

---

#### Issue: Page not loading or showing spinner indefinitely

**Symptoms:**
- Infinite loading spinner
- Page never renders
- Timeout errors

**Diagnostic Steps:**

1. Check network connectivity
2. Verify API endpoints responding
3. Check for JavaScript errors

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| API timeout | Check backend health |
| Database slow | Check database performance |
| Network issue | Verify connectivity to Azure |
| Large data set | May need pagination |

**Resolution Steps:**

1. Check health endpoint:
   ```bash
   curl https://{app-url}/health
   ```

2. Check database connectivity:
   ```bash
   az postgres flexible-server show --name teams-minutes-db --resource-group rg-teams-minutes
   ```

3. Review application logs for timeout errors

---

### Performance Issues

#### Issue: Application responding slowly

**Symptoms:**
- Pages take >5 seconds to load
- API calls timing out
- Users reporting lag

**Diagnostic Steps:**

1. Check Application Insights for latency
2. Monitor database query times
3. Check container resource usage

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Database slow queries | Add indexes, optimize queries |
| Container under-resourced | Scale up CPU/memory |
| High concurrent load | Scale out replicas |
| External API slow | Check Graph/OpenAI response times |

**Resolution Steps:**

1. Check container metrics:
   ```bash
   az monitor metrics list --resource {container-app-id} --metric CpuUsage,MemoryUsage
   ```

2. Scale if needed:
   ```bash
   az containerapp update --name teams-minutes-app --resource-group rg-teams-minutes --min-replicas 2 --max-replicas 5
   ```

3. Check slow queries in database:
   - Enable query performance insights
   - Review and optimize slow queries

---

### Integration Issues

#### Issue: SharePoint archival failing

**Symptoms:**
- Minutes approved but not archived
- "Archive failed" in history
- SharePoint documents missing

**Diagnostic Steps:**

1. Verify SharePoint configuration
2. Check Graph API permissions for SharePoint
3. Review archival job status

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| SharePoint URL incorrect | Verify SHAREPOINT_SITE_URL |
| Library doesn't exist | Create the document library |
| Permission denied | Grant Sites.ReadWrite.All |
| Quota exceeded | Free up SharePoint space |

**Resolution Steps:**

1. Verify configuration:
   ```bash
   az containerapp show --name teams-minutes-app --resource-group rg-teams-minutes --query properties.template.containers[0].env | grep SHAREPOINT
   ```

2. Check job status:
   ```sql
   SELECT * FROM job_queue WHERE type = 'archive_sharepoint' ORDER BY created_at DESC LIMIT 10;
   ```

3. Test SharePoint access manually via Graph Explorer

---

#### Issue: Email distribution not working

**Symptoms:**
- No emails sent after approval
- Recipients not receiving minutes
- "Email failed" in history

**Diagnostic Steps:**

1. Check email configuration
2. Verify sender email permissions
3. Review email job status

**Common Causes and Resolutions:**

| Cause | Resolution |
|-------|------------|
| Sender not configured | Set GRAPH_SENDER_EMAIL |
| Mail.Send permission missing | Grant Mail.Send in app permissions |
| Recipients blocked | Check spam filters |
| Mailbox full | Verify sender mailbox |

**Resolution Steps:**

1. Verify email configuration:
   - Check GRAPH_SENDER_EMAIL is set
   - Verify Mail.Send permission has admin consent

2. Check job queue:
   ```sql
   SELECT * FROM job_queue WHERE type = 'send_email' ORDER BY created_at DESC LIMIT 10;
   ```

3. Review failed job's last_error for details

---

## 4. Error Code Reference

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Service down or overloaded |

### Application Error Codes

| Code | Message | Resolution |
|------|---------|------------|
| AUTH_001 | Token validation failed | Re-authenticate, check Azure AD config |
| AUTH_002 | Insufficient permissions | Check user role and clearance |
| MEET_001 | Meeting not found | Verify meeting ID exists |
| MEET_002 | Transcript unavailable | Wait for processing or check transcription |
| AI_001 | Generation failed | Check Azure OpenAI status |
| AI_002 | Quota exceeded | Wait or increase quota |
| JOB_001 | Job processing failed | Check job queue for errors |
| GRAPH_001 | Graph API error | Check permissions and connectivity |

---

## 5. Log Analysis

### Key Log Patterns

**Successful Operations:**
```
[express] GET /api/meetings 200 in 150ms
[Webhook Routes] Registered: GET/POST /webhooks/graph/callRecords
[GraphGroupSync] Cached VALID Azure AD groups
```

**Authentication Errors:**
```
[AUTH] TEAMS_SDK_ERROR: SDK initialization timed out
[Auth] Token validation failed: jwt expired
```

**Processing Errors:**
```
[AI] Azure OpenAI request failed: 429 Too Many Requests
[Job] Job failed after 3 attempts: Error fetching transcript
```

### Log Locations

| Log Type | Location |
|----------|----------|
| Application logs | Azure Container Apps logs |
| Database logs | Azure PostgreSQL logs |
| Authentication | Azure AD Sign-in logs |
| Performance | Application Insights |

### Searching Logs

```bash
# Search for errors in last hour
az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes --tail 500 | grep -i error

# Search for specific meeting
az containerapp logs show --name teams-minutes-app --resource-group rg-teams-minutes --tail 1000 | grep "meeting-id-here"
```

---

## 6. Escalation Procedures

### When to Escalate

**Escalate to L2 (IT Admin):**
- Issue affects multiple users
- Requires configuration changes
- Authentication/permission issues
- Performance degradation

**Escalate to L3 (Development):**
- Application bugs
- Data corruption
- Integration failures
- Security issues

### Escalation Information

When escalating, provide:

1. **Issue Summary:** One-line description
2. **Impact:** Number of users affected, severity
3. **Timeline:** When issue started, any recent changes
4. **Reproduction Steps:** How to recreate
5. **Evidence:** Logs, screenshots, error messages
6. **Attempted Resolutions:** What was already tried

### Escalation Template

```
ISSUE: [Brief description]
SEVERITY: [Critical/High/Medium/Low]
AFFECTED USERS: [Number and scope]

DESCRIPTION:
[Detailed description of the issue]

STEPS TO REPRODUCE:
1. [Step 1]
2. [Step 2]
3. [Step 3]

ERROR MESSAGES:
[Paste any error messages]

LOGS:
[Relevant log excerpts]

ATTEMPTED RESOLUTIONS:
- [What was tried]
- [Result]

ADDITIONAL CONTEXT:
[Any other relevant information]
```

---

## Appendix: Quick Reference Card

### Health Checks
```bash
curl https://{app-url}/health
curl https://{app-url}/api/health
```

### Common Fixes

| Issue | Quick Fix |
|-------|-----------|
| Auth errors | Restart Teams, clear cache |
| No meetings | Wait 10 min, check webhook |
| No minutes | Verify transcription enabled |
| Slow performance | Check Application Insights |
| Modal blank | Clear cache, try different browser |

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ENABLE_JOB_WORKER` | Background processing |
| `ENABLE_GRAPH_WEBHOOKS` | Real-time meeting sync |
| `USE_MOCK_SERVICES` | Development mode |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 4, 2025 | System | Initial release |

---

*This document is for internal support use only.*
