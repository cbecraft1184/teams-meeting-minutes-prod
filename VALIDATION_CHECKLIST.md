# Azure Test Deployment - Quick Validation Checklist

Use this checklist to systematically validate all critical scenarios after test deployment.

---

## ✅ Phase 1: Infrastructure (15-20 min)

**Bicep Deployment**
- [ ] Resource group created successfully
- [ ] App Service provisioned (Basic tier)
- [ ] PostgreSQL database provisioned (Basic tier)
- [ ] Azure OpenAI account created
- [ ] Key Vault created
- [ ] Storage Account created
- [ ] Application Insights enabled
- [ ] Managed Identity assigned to App Service

**RBAC Assignments**
- [ ] Key Vault Secrets User role assigned
- [ ] Storage Blob Data Contributor role assigned
- [ ] Cognitive Services OpenAI User role assigned

**Capture Outputs**
- [ ] App Service URL: `____________________`
- [ ] Key Vault name: `____________________`
- [ ] Managed Identity Client ID: `____________________`

---

## ✅ Phase 2: Application Configuration (20-30 min)

**Azure AD App Registration**
- [ ] App registration created
- [ ] Client ID captured: `____________________`
- [ ] Tenant ID captured: `____________________`
- [ ] Client secret created and captured
- [ ] Redirect URI configured
- [ ] API permissions granted:
  - [ ] OnlineMeetings.Read.All
  - [ ] CallRecords.Read.All
  - [ ] User.Read.All
  - [ ] Group.Read.All
  - [ ] Sites.ReadWrite.All
- [ ] Admin consent granted

**Key Vault Secrets**
- [ ] GRAPH-TENANT-ID stored
- [ ] GRAPH-CLIENT-ID stored
- [ ] GRAPH-CLIENT-SECRET stored
- [ ] AZURE-OPENAI-ENDPOINT stored
- [ ] AZURE-OPENAI-API-KEY stored
- [ ] AZURE-OPENAI-DEPLOYMENT stored
- [ ] SHAREPOINT-SITE-URL stored
- [ ] SHAREPOINT-LIBRARY stored
- [ ] SESSION-SECRET generated and stored

**App Service Configuration**
- [ ] KEY_VAULT_NAME environment variable set
- [ ] NODE_ENV=production set
- [ ] USE_MOCK_SERVICES=false set
- [ ] Application code deployed

---

## ✅ Phase 3: Critical Scenario Validation

### Test 1: Application Health (5 min)
- [ ] App starts without errors
- [ ] Health endpoint responds: `curl https://<url>/api/health`
- [ ] Logs show "Configuration valid for PRODUCTION MODE"
- [ ] No Key Vault access errors

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 2: Key Vault Integration (10 min)
- [ ] Managed Identity authenticates successfully
- [ ] Logs show: "Successfully retrieved secret: GRAPH-TENANT-ID"
- [ ] Logs show: "Cache populated with X secrets"
- [ ] No "DefaultAzureCredential authentication failed" errors
- [ ] No fallback to environment variables
- [ ] Secrets cached for 15 minutes (verify no repeated fetches)

**Test Command:**
```bash
az webapp log tail --name <app-name> \
  --resource-group rg-teams-minutes-test | grep "KeyVault"
```

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 3A: Job Worker Lock (Single Instance) (5 min)
- [ ] Logs show: "Worker lock acquired - this instance is the ACTIVE worker"
- [ ] Logs show: "Starting job processing loop..."
- [ ] Job stats appearing every ~10-30 seconds
- [ ] No lock acquisition errors

**Test Command:**
```bash
az webapp log tail --name <app-name> \
  --resource-group rg-teams-minutes-test | grep "JobWorker"
```

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 3B: Job Worker Standby (Multi-Instance) (10 min)
- [ ] Scaled to 2 instances
- [ ] Instance 1 shows "ACTIVE worker"
- [ ] Instance 2 shows "entering STANDBY mode"
- [ ] Instance 2 logs "retry every 30 seconds"
- [ ] Only ONE instance shows job stats
- [ ] No duplicate job processing

**Scale Command:**
```bash
az appservice plan update --name <plan-name> \
  --resource-group rg-teams-minutes-test \
  --number-of-workers 2
```

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 3C: Job Worker Failover (15 min)
- [ ] Active instance restarted
- [ ] Logs show: "Stopped and lock released"
- [ ] Standby acquires lock within 60 seconds
- [ ] New logs show: "this instance is the ACTIVE worker"
- [ ] New active instance processes jobs
- [ ] No job processing gap

**Restart Command:**
```bash
az webapp restart --name <app-name> \
  --resource-group rg-teams-minutes-test
```

**Failover Time:** `____` seconds (should be < 60s)

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 4A: Webhook Validation Callback (5 min)
- [ ] Webhook subscription created via admin endpoint
- [ ] Logs show: "POST /webhooks/graph/notifications?validationToken=..."
- [ ] Logs show: "Webhook validation successful"
- [ ] NO 401 Unauthorized errors
- [ ] Subscription confirmed active in Microsoft Graph

**Test:** Create webhook subscription via UI or API

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 4B: Webhook Live Notifications (10 min)
- [ ] Teams meeting created with recording
- [ ] Logs show: "POST /webhooks/graph/notifications" (meeting created)
- [ ] Logs show: "POST /webhooks/graph/notifications" (recording available)
- [ ] Logs show: "Job enqueued: enrich_meeting"
- [ ] NO authentication errors on webhook endpoint
- [ ] clientState validation passes

**Test:** Schedule and record a 2-minute Teams meeting

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 5: End-to-End Meeting Minutes (20-30 min)
- [ ] Teams meeting created with recording (5+ min)
- [ ] Meeting conducted with clear speech
- [ ] Recording available
- [ ] Webhook triggered within 10 minutes
- [ ] Job: "enrich_meeting" completed
- [ ] Transcript fetched from Microsoft Graph
- [ ] Job: "generate_minutes" started
- [ ] Azure OpenAI called successfully
- [ ] Job: "generate_minutes" completed
- [ ] Minutes appear in UI with correct content
- [ ] Meeting details accurate (title, date, attendees)
- [ ] Summary content reasonable
- [ ] Action items extracted (if any)
- [ ] Approval workflow functional
- [ ] DOCX export works
- [ ] PDF export works
- [ ] SharePoint archival succeeds (if configured)

**Meeting Details:**
- Title: `____________________`
- Date/Time: `____________________`
- Duration: `____` minutes
- Attendees: `____________________`

**Processing Times:**
- Webhook → Job Enqueue: `____` minutes
- Enrich Job: `____` seconds
- Generate Minutes Job: `____` seconds
- Total Time: `____` minutes

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

### Test 6: Monitoring & Performance (10 min)
- [ ] Application Insights receiving telemetry
- [ ] Request count > 0 in metrics
- [ ] No critical errors in traces
- [ ] Success rate > 95%
- [ ] Database queries < 500ms average
- [ ] OpenAI API calls < 30s average

**Metrics Command:**
```bash
az monitor app-insights metrics show \
  --app <app-insights-name> \
  --resource-group rg-teams-minutes-test \
  --metrics "requests/count"
```

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:** `____________________`

---

## 🎯 Overall Validation Results

### Critical Scenarios
- Infrastructure Deployment: ⬜ PASS / ⬜ FAIL
- Key Vault Integration: ⬜ PASS / ⬜ FAIL
- Job Worker Lock (Single): ⬜ PASS / ⬜ FAIL
- Job Worker Standby (Multi): ⬜ PASS / ⬜ FAIL
- Job Worker Failover: ⬜ PASS / ⬜ FAIL
- Webhook Validation: ⬜ PASS / ⬜ FAIL
- Webhook Live Notifications: ⬜ PASS / ⬜ FAIL
- End-to-End Flow: ⬜ PASS / ⬜ FAIL
- Monitoring: ⬜ PASS / ⬜ FAIL

### Decision
- [ ] **GO** - All tests passed, ready for production
- [ ] **NO-GO** - Critical issues found, need fixes

### Issues Found
```
1. ____________________
2. ____________________
3. ____________________
```

### Recommendations
```
1. ____________________
2. ____________________
3. ____________________
```

---

## 📊 Test Results Summary

**Test Date:** `____________________`  
**Tester:** `____________________`  
**Environment:** Azure Commercial (East US)  
**Test Duration:** `____` hours  

**Total Tests:** 9  
**Passed:** `____`  
**Failed:** `____`  
**Blocked:** `____`  

**Overall Status:** ⬜ READY FOR PRODUCTION / ⬜ NEEDS FIXES

---

## 🔄 Next Steps

**If All Tests Pass:**
1. Document successful test results
2. Schedule production deployment
3. Prepare production deployment parameters
4. Brief stakeholders on go-live plan

**If Tests Fail:**
1. Document specific failures with logs
2. Analyze root causes
3. Implement fixes in codebase
4. Redeploy to test environment
5. Re-run failed tests

**Production Deployment:**
- Use same Bicep template
- Change parameters for production
- Follow same configuration steps
- Apply learnings from test validation

---

**Last Updated:** November 20, 2025  
**Version:** 1.0
