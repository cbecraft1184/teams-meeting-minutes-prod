# Operations Runbook - NAVY ERP Meeting Minutes System

**Environment:** Azure Government (GCC High)  
**Classification:** CUI (Controlled Unclassified Information)  
**Last Updated:** November 21, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Monitoring Runbook](#monitoring-runbook)
3. [Backup and Recovery Runbook](#backup-and-recovery-runbook)
4. [Incident Response Playbook](#incident-response-playbook)
5. [Routine Maintenance](#routine-maintenance)
6. [Escalation Procedures](#escalation-procedures)

---

## Overview

This runbook provides standard operating procedures for day-to-day operations, monitoring, backup, recovery, and incident response for the Teams Meeting Minutes application deployed in Azure Government (GCC High).

### Target Audience

- **System Administrators**: Infrastructure management and configuration
- **Operations Engineers**: Daily monitoring and maintenance
- **DevOps Team**: Deployment and release management
- **On-Call Personnel**: After-hours incident response

### Resource Quick Reference

| Resource | Name | Type |
|----------|------|------|
| **Resource Group** | tmm-navy-demo-eastus | Container for all resources |
| **App Service** | tmm-app-navy-demo | Application hosting |
| **PostgreSQL** | tmm-pg-navy-demo | Database (35-day backup retention) |
| **Key Vault** | tmm-kv-navy-XXXXX | Secrets and configuration |
| **Application Insights** | tmm-appinsights-navy-demo | Telemetry and monitoring |
| **Azure OpenAI** | tmm-openai-navy-demo | AI minutes generation |

---

## Monitoring Runbook

### 1.1: Daily Health Checks

**Frequency:** Every business day (0800 local time)  
**Time Required:** 5-10 minutes

#### Procedure

**Step 1: Application Health**
```bash
# Check App Service status
az webapp show \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{Name:name,State:state,OutboundIPs:possibleOutboundIpAddresses}" -o table

# Expected: State = "Running"

# Test health endpoint
curl https://tmm-app-navy-demo.azurewebsites.us/api/health

# Expected response:
# {"status":"healthy","database":"connected","openai":"available","timestamp":"..."}
```

**Step 2: Database Health**
```bash
# Check PostgreSQL status
az postgres flexible-server show \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{Name:name,State:state,Version:version,Storage:storageProfile.storageMb}" -o table

# Expected: State = "Ready"

# Check connection count
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT count(*) as active_connections FROM pg_stat_activity WHERE datname='meeting_minutes';" \
  -o table

# Normal range: 5-20 connections
```

**Step 3: Webhook Subscription Status**
```bash
# Check webhook expiration
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "
    SELECT 
      subscription_id,
      resource,
      expiration_datetime,
      CASE 
        WHEN expiration_datetime < NOW() THEN 'EXPIRED'
        WHEN expiration_datetime < NOW() + INTERVAL '6 hours' THEN 'EXPIRING SOON'
        ELSE 'ACTIVE'
      END as status
    FROM graph_webhook_subscriptions
    ORDER BY expiration_datetime DESC
    LIMIT 5;
  " -o table

# Expected: status = "ACTIVE"
# If "EXPIRING SOON" or "EXPIRED", restart app service to renew
```

**Step 4: Application Insights Metrics**
```bash
# Check last 24 hours error rate
az monitor app-insights metrics show \
  --app tmm-appinsights-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --metric exceptions/count \
  --aggregation count \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  -o table

# Normal: <10 exceptions per 24 hours
# Alert threshold: >50 exceptions per 24 hours
```

**Step 5: Job Queue Health**
```bash
# Check failed jobs in last 24 hours
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "
    SELECT 
      job_type,
      COUNT(*) as failed_count
    FROM job_queue
    WHERE status = 'failed'
      AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY job_type
    ORDER BY failed_count DESC;
  " -o table

# Normal: 0-2 failed jobs
# Investigate if >5 failed jobs of same type
```

**Daily Health Check Checklist:**
- [ ] App Service state = "Running"
- [ ] Health endpoint returns 200 OK
- [ ] PostgreSQL state = "Ready"
- [ ] Database connections < 50
- [ ] Webhooks status = "ACTIVE"
- [ ] Exception count < 10/day
- [ ] Failed job count < 5/day

---

### 1.2: Application Insights Monitoring

#### Key Metrics to Monitor

**Performance Metrics:**
- **Response Time:** Average < 500ms (Alert if >2000ms sustained)
- **Request Rate:** 10-100 requests/minute (varies by usage)
- **Failed Request Rate:** <1% (Alert if >5%)

**Dependency Metrics:**
- **Azure OpenAI Latency:** Average < 3000ms (GPT-4o processing)
- **Database Query Duration:** Average < 100ms (Alert if >500ms)
- **Microsoft Graph API:** Success rate >99%

**Custom Metrics:**
- **Meeting Processing Duration:** 2-5 minutes end-to-end
- **Webhook Delivery Latency:** <30 seconds from meeting end
- **Job Queue Processing Rate:** 1-3 jobs/minute

#### Accessing Application Insights

**Azure Portal:**
1. Navigate to **tmm-appinsights-navy-demo**
2. Go to **Monitoring** → **Logs**
3. Use pre-saved queries (see below)

**Kusto Query Examples:**

**Failed Requests (Last Hour):**
```kusto
requests
| where timestamp > ago(1h)
| where success == false
| summarize count() by resultCode, operation_Name
| order by count_ desc
```

**Slow Database Queries:**
```kusto
dependencies
| where timestamp > ago(1h)
| where type == "SQL"
| where duration > 500
| project timestamp, name, duration, resultCode
| order by duration desc
| take 20
```

**Azure OpenAI API Failures:**
```kusto
dependencies
| where timestamp > ago(24h)
| where target contains "openai.usgovcloudapi.net"
| where success == false
| summarize count() by resultCode, name
| order by count_ desc
```

**Meeting Processing Pipeline:**
```kusto
customEvents
| where timestamp > ago(24h)
| where name in ("MeetingCaptured", "MinutesGenerated", "MinutesApproved", "MinutesDistributed")
| summarize count() by name, bin(timestamp, 1h)
| render timechart
```

---

### 1.3: Alert Rules Management

#### Critical Alerts

**Alert 1: High Error Rate**
- **Condition:** >10 exceptions in 5 minutes
- **Severity:** 2 (High)
- **Action:** Email to on-call engineer
- **Investigation:** Check Application Insights for stack traces

**Alert 2: Database Connection Failures**
- **Condition:** >3 database connection failures in 5 minutes
- **Severity:** 1 (Critical)
- **Action:** Page on-call engineer immediately
- **Investigation:** Check PostgreSQL firewall, network connectivity

**Alert 3: Webhook Subscription Expiring**
- **Condition:** Webhook expires in <6 hours
- **Severity:** 3 (Warning)
- **Action:** Email to operations team
- **Remediation:** Restart App Service to renew subscription

#### Alert Investigation Procedure

**When alert fires:**

1. **Acknowledge Alert**
   - Log into Azure Portal
   - Navigate to **Monitor** → **Alerts**
   - Click alert to see details

2. **Check Application Logs**
   ```bash
   az webapp log tail \
     --name tmm-app-navy-demo \
     --resource-group tmm-navy-demo-eastus
   ```

3. **Review Application Insights**
   - Go to **Application Insights** → **Failures**
   - Check failure timeline and affected operations
   - Review exception details and stack traces

4. **Assess Impact**
   - How many users affected?
   - Is system still operational?
   - Are meetings being captured and processed?

5. **Take Action**
   - Minor issue: Create incident ticket, monitor
   - Major issue: Follow incident response playbook (Section 4)

6. **Document Resolution**
   - Update incident ticket with root cause
   - Document remediation steps taken
   - Update runbook if new procedure discovered

---

### 1.4: Dashboard Monitoring

#### Azure Portal Custom Dashboard

**Recommended Tiles:**

**App Service Metrics:**
- CPU Percentage (Alert if >80% sustained)
- Memory Percentage (Alert if >85% sustained)
- Response Time (Average, P95, P99)
- HTTP Server Errors (5xx)

**Application Insights:**
- Request Rate (requests/minute)
- Failed Request Rate (%)
- Exception Count (last hour)
- Availability (uptime percentage)

**PostgreSQL Metrics:**
- Active Connections (current)
- CPU Percent (Alert if >75% sustained)
- Storage Used (% of 128 GB)
- IOPS (current vs. max)

**Azure OpenAI:**
- API Call Count (last hour)
- Token Usage (total tokens consumed)
- Average Latency (milliseconds)
- Error Rate (% of failed calls)

#### Creating Dashboard

```bash
# Export dashboard configuration to JSON
az portal dashboard show \
  --resource-group tmm-navy-demo-eastus \
  --name "NAVY-Meeting-Minutes-Dashboard" \
  -o json > dashboard-config.json

# Import dashboard configuration
az portal dashboard create \
  --resource-group tmm-navy-demo-eastus \
  --name "NAVY-Meeting-Minutes-Dashboard" \
  --input-path dashboard-config.json
```

**Dashboard Access:**
- URL: `https://portal.azure.us/#@ABC123987.onmicrosoft.com/dashboard`
- Pin to favorites for quick access
- Share with operations team members

---

### 1.5: Performance Baseline

Understanding normal system behavior helps detect anomalies.

**Typical Metrics (20-user pilot):**

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| **Request Rate** | 10-100 req/min | >500 req/min |
| **Response Time (P95)** | 200-800ms | >2000ms |
| **Database Connections** | 5-20 | >50 |
| **CPU Usage** | 10-40% | >80% sustained |
| **Memory Usage** | 30-60% | >85% sustained |
| **Exception Rate** | 0-10/day | >50/day |
| **Failed Jobs** | 0-2/day | >10/day |
| **Webhook Latency** | 10-30 seconds | >5 minutes |
| **AI Processing Time** | 2-5 minutes | >10 minutes |

**Seasonal Patterns:**
- **Business Hours (0800-1700):** Higher meeting capture rate
- **Lunch Time (1200-1300):** Lower activity
- **After Hours:** Minimal activity (batch processing only)
- **Weekends:** Near-zero activity

---

### 1.6: Log Retention and Archival

**Log Types and Retention:**

| Log Source | Retention (Azure) | Archival Location | Purpose |
|-----------|-------------------|-------------------|---------|
| **Application Insights** | 90 days | Export to Blob Storage | Performance analysis, debugging |
| **App Service Logs** | 7 days | Not archived | Real-time troubleshooting |
| **PostgreSQL Logs** | 7 days | Database backups | Audit trail |
| **Audit Logs (Azure AD)** | 30 days | Compliance archive | Security investigations |

**Log Export Procedure (Monthly):**

```bash
# Export Application Insights data to storage account
az monitor app-insights component export create \
  --app tmm-appinsights-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --export-name "MonthlyExport-$(date +%Y-%m)" \
  --storage-account tmmlogarchive \
  --container-name "appinsights-archive"
```

---

## Backup and Recovery Runbook

### 2.1: Automated Backup Verification

**Frequency:** Weekly (every Monday 0900)  
**Time Required:** 5 minutes

#### Procedure

**Step 1: Verify PostgreSQL Backups**

```bash
# List recent backups
az postgres flexible-server backup list \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "[].{Name:name,Status:completedTime,EarliestRestore:earliestRestoreDate}" -o table

# Expected: At least 7 backups (1 per day minimum)
# Retention: 35 days

# Check backup configuration
az postgres flexible-server show \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{BackupRetention:backup.backupRetentionDays,GeoRedundant:backup.geoRedundantBackup}" -o table

# Expected: BackupRetention = 35, GeoRedundant = Enabled
```

**Step 2: Verify Key Vault Backup**

```bash
# List secrets in Key Vault
az keyvault secret list \
  --vault-name $KEYVAULT_NAME \
  --query "[].{Name:name,Enabled:attributes.enabled,Updated:attributes.updated}" -o table

# Expected: 13 secrets, all enabled

# Export secret names (not values) for DR documentation
az keyvault secret list \
  --vault-name $KEYVAULT_NAME \
  --query "[].name" -o tsv > keyvault-secrets-inventory-$(date +%Y%m%d).txt
```

**Step 3: Document Configuration State**

```bash
# Export App Service configuration
az webapp config appsettings list \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  -o json > app-config-backup-$(date +%Y%m%d).json

# Store in secure location (NOT in Git repository)
```

**Weekly Backup Verification Checklist:**
- [ ] PostgreSQL backups running daily
- [ ] 35-day retention verified
- [ ] Geo-redundant backup enabled
- [ ] Key Vault secrets inventory updated
- [ ] App Service configuration exported

---

### 2.2: Manual Backup Procedures

**When to Create Manual Backup:**
- Before major deployment or migration
- Before schema changes
- Before bulk data operations
- Before testing new features in production

#### Pre-Deployment Backup

```bash
# Create timestamped backup
BACKUP_NAME="pre-deployment-$(date +%Y%m%d-%H%M%S)"

az postgres flexible-server backup create \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --backup-name "$BACKUP_NAME"

# Verify backup created
az postgres flexible-server backup show \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --backup-name "$BACKUP_NAME"

# Document backup details
echo "Backup created: $BACKUP_NAME at $(date)" >> deployment-log.txt
```

---

### 2.3: Database Restore Procedures

#### 2.3.1: Point-in-Time Restore

**Scenario:** Recover from data corruption or accidental deletion

**Recovery Time:** 15-30 minutes  
**Data Loss (RPO):** 5 minutes (continuous backup)

```bash
# Determine restore point
TARGET_TIME="2025-11-21T14:30:00Z"  # UTC timestamp

# Option A: Restore to new server (recommended for testing)
az postgres flexible-server restore \
  --name tmm-pg-navy-demo-restore-$(date +%Y%m%d) \
  --resource-group tmm-navy-demo-eastus \
  --source-server tmm-pg-navy-demo \
  --restore-time "$TARGET_TIME"

# Option B: Restore to original server (DESTRUCTIVE - use with caution)
# This REPLACES the production database
az postgres flexible-server restore \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --restore-time "$TARGET_TIME"
```

**Post-Restore Verification:**

```bash
# Connect to restored server
az postgres flexible-server execute \
  --name tmm-pg-navy-demo-restore-$(date +%Y%m%d) \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT COUNT(*) as total_meetings FROM meetings;"

# Compare with expected count
# Verify critical data integrity
```

#### 2.3.2: Restore from Named Backup

**Scenario:** Restore from specific pre-deployment backup

```bash
# List available backups
az postgres flexible-server backup list \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  -o table

# Restore from specific backup
BACKUP_NAME="pre-deployment-20251121-083000"

az postgres flexible-server geo-restore \
  --name tmm-pg-navy-demo-restored \
  --resource-group tmm-navy-demo-eastus \
  --source-server tmm-pg-navy-demo \
  --backup-name "$BACKUP_NAME"
```

---

### 2.4: Geo-Redundant Restore (Disaster Recovery)

**Scenario:** Primary region (US Gov Virginia) is unavailable

**Recovery Time Objective (RTO):** 1-2 hours  
**Recovery Point Objective (RPO):** 5 minutes

#### Procedure

**Step 1: Assess Region Outage**

```bash
# Check Azure Service Health
az resource-health availability-status list \
  --resource-group tmm-navy-demo-eastus \
  --query "[].{Name:name,Status:properties.availabilityState}" -o table

# If primary region down, proceed with geo-restore
```

**Step 2: Restore Database to Secondary Region**

```bash
# Restore to US Gov Texas (secondary region)
az postgres flexible-server geo-restore \
  --name tmm-pg-navy-demo-dr \
  --resource-group tmm-navy-demo-westus \
  --location usgovtexas \
  --source-server tmm-pg-navy-demo

# This takes 30-60 minutes for full restore
```

**Step 3: Deploy App Service to Secondary Region**

```bash
# Create App Service in secondary region
az webapp create \
  --name tmm-app-navy-demo-dr \
  --resource-group tmm-navy-demo-westus \
  --plan tmm-appservice-plan-westus \
  --runtime "NODE:18-lts"

# Deploy application code (from ZIP package)
az webapp deployment source config-zip \
  --name tmm-app-navy-demo-dr \
  --resource-group tmm-navy-demo-westus \
  --src tmm-navy-demo-deploy.zip

# Update DATABASE_URL to point to restored database
az webapp config appsettings set \
  --name tmm-app-navy-demo-dr \
  --resource-group tmm-navy-demo-westus \
  --settings DATABASE_URL="<restored-db-connection-string>"
```

**Step 4: Update DNS/Traffic Manager**

```bash
# Add secondary endpoint to Traffic Manager
az network traffic-manager endpoint create \
  --name tmm-navy-demo-dr \
  --resource-group tmm-navy-demo \
  --profile-name tmm-traffic-manager \
  --type azureEndpoints \
  --target-resource-id /subscriptions/.../tmm-app-navy-demo-dr
```

---

### 2.5: Configuration Backup and Restore

#### Backup Key Vault Secrets

**⚠️ CRITICAL:** Never export secret values to files. Only backup secret **names** and **metadata**.

```bash
# Backup secret inventory (names only)
az keyvault secret list \
  --vault-name $KEYVAULT_NAME \
  --query "[].{Name:name,ContentType:contentType,Enabled:attributes.enabled}" -o json \
  > keyvault-inventory-backup.json

# Store in secure offline location
```

#### Restore Secrets to New Key Vault

**Scenario:** Re-creating environment after catastrophic failure

```bash
# Read inventory file
cat keyvault-inventory-backup.json

# Manually re-create each secret (values must be obtained from secure storage)
az keyvault secret set \
  --vault-name $NEW_KEYVAULT_NAME \
  --name "database-url" \
  --value "<value-from-secure-storage>"

# Repeat for all 13 secrets
```

---

### 2.6: Backup Testing Schedule

**Quarterly Restore Test (Every 3 months)**

Verify backup integrity by performing complete restore to test environment.

**Test Procedure:**

1. Create test resource group
2. Restore latest database backup to test server
3. Deploy application to test App Service
4. Verify end-to-end functionality:
   - Can log in
   - Can view existing meetings
   - Database queries succeed
5. Document test results
6. Delete test resources

**Test Checklist:**
- [ ] Database restore successful (no errors)
- [ ] All tables present and queryable
- [ ] Meeting data integrity verified
- [ ] Application connects to restored database
- [ ] End-to-end workflow functional
- [ ] Test documented in incident log

---

## Incident Response Playbook

### 3.1: Incident Classification

**Severity Levels:**

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P1 - Critical** | System down, no workaround | 15 minutes | Database offline, app crashed |
| **P2 - High** | Major feature broken, limited workaround | 1 hour | AI generation failing, webhook broken |
| **P3 - Medium** | Minor feature broken, workaround exists | 4 hours | Email delivery failed, slow queries |
| **P4 - Low** | Cosmetic issue, no user impact | 1 business day | UI glitch, logging error |

---

### 3.2: Incident Response Workflow

**Step 1: Detection**
- Alert triggered in Application Insights
- User reports issue via help desk
- Abnormal metrics detected in monitoring dashboard

**Step 2: Triage** (Within response time)
- Acknowledge alert
- Assess severity (P1-P4)
- Identify affected systems
- Estimate user impact

**Step 3: Investigation**
- Check Application Insights logs
- Review database query performance
- Examine webhook subscription status
- Test health endpoints

**Step 4: Mitigation**
- Apply immediate fix (restart, rollback, etc.)
- Implement workaround if fix unavailable
- Monitor for resolution

**Step 5: Resolution**
- Verify system restored to normal
- Confirm no ongoing errors
- Update status page

**Step 6: Post-Incident Review**
- Document root cause
- Identify preventive measures
- Update runbook if needed

---

### 3.3: Common Failure Scenarios

#### Scenario 1: Application Won't Start

**Symptoms:**
- Health endpoint returns 503 Service Unavailable
- App Service logs show crash on startup
- Users cannot access application

**Investigation:**

```bash
# Check app status
az webapp show \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{Name:name,State:state,HealthCheckStatus:siteConfig.healthCheckPath}" -o table

# View startup logs
az webapp log tail \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  | head -100

# Common errors:
# - "Cannot connect to database" → Check DATABASE_URL secret
# - "Module not found" → npm install failed during deployment
# - "Port already in use" → Restart app service
```

**Remediation:**

**Option 1: Key Vault Access Issue**
```bash
# Verify managed identity has Key Vault access
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $(az webapp identity show --name tmm-app-navy-demo --resource-group tmm-navy-demo-eastus --query principalId -o tsv) \
  --secret-permissions get list

# Restart app
az webapp restart --name tmm-app-navy-demo --resource-group tmm-navy-demo-eastus
```

**Option 2: Database Connection Failed**
```bash
# Check database firewall
az postgres flexible-server firewall-rule list \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus -o table

# Add App Service IP if missing
az postgres flexible-server firewall-rule create \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --rule-name AllowAppService \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0  # Allows all Azure services
```

**Option 3: Code Deployment Issue**
```bash
# Rollback to previous deployment
az webapp deployment list \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus

# Redeploy last known good version
az webapp deployment source config-zip \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --src tmm-navy-demo-deploy-v1.0.zip
```

---

#### Scenario 2: Meetings Not Being Captured

**Symptoms:**
- No new meetings appear in dashboard after meetings end
- Webhook subscription showing as expired
- Job queue empty

**Investigation:**

```bash
# Check webhook subscription status
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT subscription_id, resource, expiration_datetime, CASE WHEN expiration_datetime < NOW() THEN 'EXPIRED' ELSE 'ACTIVE' END as status FROM graph_webhook_subscriptions;" -o table

# Check Application Insights for webhook errors
az monitor app-insights query \
  --app tmm-appinsights-navy-demo \
  --analytics-query "traces | where timestamp > ago(1h) | where message contains 'webhook' | order by timestamp desc | take 20"
```

**Remediation:**

**Option 1: Webhook Expired (App Down >48 Hours)**
```bash
# Restart app to trigger webhook re-creation
az webapp restart \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus

# Monitor logs for webhook creation
az webapp log tail \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  | grep "webhook"

# Expected: "Webhook subscription created: <subscription-id>"
```

**Option 2: Microsoft Graph API Permissions**
```bash
# Verify app registration has required permissions
az ad app permission list --id $APP_ID

# Should include:
# - OnlineMeetings.Read.All
# - Calendars.Read

# If missing, re-run permission grant
az ad app permission admin-consent --id $APP_ID
```

**Option 3: Recording Not Enabled**
- Verify Teams meetings have recording enabled
- Check if recording policy is set for tenant
- Confirm meeting organizer has recording permissions

---

#### Scenario 3: AI Minutes Generation Failing

**Symptoms:**
- Meetings captured but stuck in "Processing" status
- No AI-generated minutes appearing
- Job queue shows "generate_minutes" jobs failing

**Investigation:**

```bash
# Check failed jobs
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT id, job_type, status, error_message, created_at FROM job_queue WHERE job_type='generate_minutes' AND status='failed' ORDER BY created_at DESC LIMIT 10;" -o table

# Check Azure OpenAI status
az cognitiveservices account show \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{Name:name,ProvisioningState:properties.provisioningState,Endpoint:properties.endpoint}" -o table

# Check deployment status
az cognitiveservices account deployment list \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus -o table
```

**Remediation:**

**Option 1: Azure OpenAI API Key Invalid**
```bash
# Rotate API key
az cognitiveservices account keys regenerate \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --key-name key1

# Update Key Vault secret
NEW_KEY=$(az cognitiveservices account keys list --name tmm-openai-navy-demo --resource-group tmm-navy-demo-eastus --query key1 -o tsv)

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name azure-openai-api-key \
  --value "$NEW_KEY"

# Restart app to pick up new key
az webapp restart --name tmm-app-navy-demo --resource-group tmm-navy-demo-eastus
```

**Option 2: Rate Limit Exceeded**
```bash
# Check Azure OpenAI quota
az cognitiveservices account deployment show \
  --name tmm-openai-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --deployment-name gpt-4o

# If rate limited:
# - Reduce concurrent job processing
# - Implement exponential backoff in application code
# - Request quota increase from Azure support
```

**Option 3: Transcript Not Available**
```bash
# Check if meeting has transcript
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT id, title, status, transcript_available FROM meetings WHERE status='processing' ORDER BY created_at DESC LIMIT 10;" -o table

# If transcript_available = false:
# - Recording may still be processing in Teams
# - Wait 5-10 minutes and check again
# - Verify recording was enabled during meeting
```

---

#### Scenario 4: Email Delivery Failures

**Symptoms:**
- Approved minutes not received by attendees
- Adaptive Card outbox showing permanent failures
- Email distribution job fails

**Investigation:**

```bash
# Check adaptive card outbox for failures
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT recipient_id, status, error_type, error_code, retry_count FROM adaptive_card_outbox WHERE status='failed' ORDER BY created_at DESC LIMIT 20;" -o table

# Check email distribution toggle
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT enable_email_distribution, enable_teams_card_notifications FROM app_settings;" -o table
```

**Remediation:**

**Option 1: Distribution Channel Disabled**
```bash
# If enable_email_distribution = false, enable it
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "UPDATE app_settings SET enable_email_distribution=true WHERE id=1;"

# Note: This only affects NEW approvals (not retroactive)
```

**Option 2: Teams Bot Permissions**
- Verify Teams app registration has correct permissions
- Check if bot is installed for all users
- Confirm tenant admin consented to bot permissions

**Option 3: Recipient Not Found (404 errors)**
```bash
# Check for invalid recipient IDs
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT recipient_id, error_type, error_code FROM adaptive_card_outbox WHERE error_code='404' GROUP BY recipient_id, error_type, error_code;" -o table

# Remove invalid conversation references
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "DELETE FROM teams_conversation_references WHERE user_id IN (SELECT DISTINCT recipient_id FROM adaptive_card_outbox WHERE error_code='404');"
```

---

#### Scenario 5: Database Performance Degradation

**Symptoms:**
- Slow query response times
- High CPU usage on PostgreSQL server
- Timeout errors in application logs

**Investigation:**

```bash
# Check database metrics
az postgres flexible-server show \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "{Name:name,Tier:sku.tier,CPU:sku.capacity,Storage:storageProfile.storageMb}" -o table

# Check current resource usage
az monitor metrics list \
  --resource /subscriptions/.../tmm-pg-navy-demo \
  --metric cpu_percent,memory_percent,storage_percent \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  -o table

# Identify slow queries
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state='active' AND query_start < NOW() - INTERVAL '30 seconds';" -o table
```

**Remediation:**

**Option 1: Scale Up Database Tier**
```bash
# Upgrade to higher tier for more CPU/memory
az postgres flexible-server update \
  --name tmm-pg-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --tier GeneralPurpose \
  --sku-name Standard_D4s_v3  # 4 vCPUs, 16 GB RAM

# Note: This causes brief downtime (1-2 minutes)
```

**Option 2: Optimize Queries**
```bash
# Identify missing indexes
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename::regclass)) as size,
      idx_scan as index_scans
    FROM pg_stat_user_tables
    ORDER BY idx_scan ASC
    LIMIT 10;
  " -o table

# Add indexes for frequently queried columns (requires schema update)
```

**Option 3: Vacuum and Analyze**
```bash
# Run maintenance to reclaim space and update statistics
az postgres flexible-server execute \
  --name tmm-pg-navy-demo \
  --admin-user dbadmin \
  --admin-password "<password>" \
  --database-name meeting_minutes \
  --querytext "VACUUM ANALYZE;"

# Schedule regular vacuuming during off-hours
```

---

### 3.4: Rollback Procedures

#### Rollback Application Deployment

**Scenario:** New deployment introduces critical bug

```bash
# List recent deployments
az webapp deployment list \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --query "[].{Id:id,Time:startTime,Status:status,Author:author}" -o table

# Rollback to previous deployment
PREVIOUS_DEPLOYMENT_ID="<deployment-id-from-list>"

az webapp deployment source config-zip \
  --name tmm-app-navy-demo \
  --resource-group tmm-navy-demo-eastus \
  --src tmm-navy-demo-deploy-previous.zip

# Verify rollback
curl https://tmm-app-navy-demo.azurewebsites.us/api/health
```

#### Rollback Database Migration

**Scenario:** Schema change causes errors

```bash
# Restore database to point-in-time before migration
RESTORE_TIME="2025-11-21T09:00:00Z"  # Time before migration

az postgres flexible-server restore \
  --name tmm-pg-navy-demo-restored \
  --resource-group tmm-navy-demo-eastus \
  --source-server tmm-pg-navy-demo \
  --restore-time "$RESTORE_TIME"

# After verification, swap connection strings to use restored database
```

---

### 3.5: Escalation Contacts

**Level 1: On-Call Engineer**
- Initial response to P1/P2 incidents
- Basic troubleshooting and mitigation
- Escalate to Level 2 if unable to resolve in 1 hour

**Level 2: Senior Operations Engineer**
- Complex incidents requiring deep system knowledge
- Database performance issues
- Infrastructure changes

**Level 3: Development Team**
- Application code bugs
- Architecture changes
- Custom feature requests

**Level 4: Microsoft Azure Support**
- Azure platform issues
- Service outages
- Quota increase requests

**Escalation Thresholds:**
- **P1 Incident:** Escalate to Level 2 after 30 minutes if unresolved
- **P2 Incident:** Escalate to Level 2 after 1 hour if unresolved
- **Regional Outage:** Escalate to Level 4 (Azure Support) immediately

---

## Routine Maintenance

### 4.1: Weekly Tasks

**Every Monday, 0900 local time**

- [ ] Verify automated backups running (Section 2.1)
- [ ] Check webhook subscription status
- [ ] Review Application Insights for anomalies
- [ ] Verify job queue processing normally
- [ ] Check disk space usage on PostgreSQL

### 4.2: Monthly Tasks

**First Tuesday of month, 1000 local time**

- [ ] Export Application Insights logs to archive
- [ ] Review and update alert thresholds
- [ ] Check Azure service health advisories
- [ ] Review failed job patterns
- [ ] Update runbook with new procedures

### 4.3: Quarterly Tasks

**January, April, July, October - Second week**

- [ ] Perform backup restore test (Section 2.6)
- [ ] Review and rotate API keys
- [ ] Audit Azure AD group memberships
- [ ] Test disaster recovery procedures
- [ ] Conduct security vulnerability scan

---

## Escalation Procedures

### Primary Contacts

**Operations Team:**
- On-Call Engineer: +1-xxx-xxx-xxxx (24/7 pager)
- Operations Manager: operations-manager@navy.mil
- Incident Response: incident-response@navy.mil

**Development Team:**
- Lead Developer: dev-lead@contractor.com
- DevOps Engineer: devops@contractor.com

**Microsoft Azure Support:**
- Support Portal: https://portal.azure.us/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- Phone: 1-800-xxx-xxxx (Azure Government support line)
- Severity 1 (Critical): Immediate callback within 1 hour

### Escalation Decision Tree

```
Incident Detected
     |
     ├─ Can resolve in <15 min? → No → Escalate to L2
     ├─ Database down? → Yes → Escalate to L2 + Azure Support
     ├─ Regional outage? → Yes → Escalate to Azure Support (Severity 1)
     ├─ Security incident? → Yes → Escalate to ISSO immediately
     └─ Code bug? → Yes → Escalate to Development Team
```

---

**End of Operations Runbook**

For technical architecture details, see:
- AZURE_DEPLOYMENT_GUIDE.md
- AZURE_GOVERNMENT_ARCHITECTURE.md
- USER_GUIDE.md
