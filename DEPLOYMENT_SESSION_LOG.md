# Deployment Session Log - November 24, 2025

## Executive Summary

Successfully deployed Teams Meeting Minutes application to Azure Container Apps after resolving critical database and configuration issues. Application is now running in production at:
- **URL**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
- **Status**: OPERATIONAL (as of 2025-11-24 23:30 UTC)
- **Configuration**: Mock services enabled, PostgreSQL connected

---

## Critical Issues Resolved

### 1. 504 Gateway Timeout - ROOT CAUSE IDENTIFIED

**Problem**: Container App experiencing 504 Gateway Timeout errors on startup

**Root Cause**: Azure Container Apps `secretRef` environment variable bindings were resolving to **empty strings**, causing:
- `DATABASE_URL` = `undefined`
- Application crashed before health checks could succeed
- Container never became healthy, resulting in 504 errors

**Solution**: Use **inline environment variables** instead of Key Vault secretRef bindings

```bash
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars \
    "DATABASE_URL=postgresql://adminuser:PASSWORD@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require" \
    "SESSION_SECRET=<generated-secret>" \
    "USE_MOCK_SERVICES=true" \
    "PORT=8080" \
    "NODE_ENV=production" \
  --remove-env-vars KEY_VAULT_NAME
```

**Critical Lesson**: Azure Container Apps secretRef bindings are unreliable. Always use inline environment variables for critical configuration.

---

### 2. Database Schema Deployment

**Problem**: PostgreSQL database existed but had no tables

**Root Cause**: drizzle-kit version mismatch
- `drizzle-kit@1.0.0-beta.1` incompatible with `drizzle-orm@0.39.3`
- Beta version failing with "Please install latest version of drizzle-orm"

**Solution**:
```bash
# Downgrade to stable drizzle-kit
npm pkg set devDependencies.drizzle-kit="0.31.7"
npm install

# Upgrade drizzle-orm to compatible version
npm install drizzle-orm@0.44.7

# Push schema to Azure PostgreSQL
DATABASE_URL='postgresql://adminuser:PASSWORD@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require' npm run db:push
```

**Result**: All 12 tables successfully created in Azure PostgreSQL
- meetings
- meeting_minutes
- action_items
- users
- meeting_templates
- graph_webhook_subscriptions
- user_group_cache
- teams_conversation_references
- sent_messages
- message_outbox
- job_queue
- app_settings

---

### 3. Application Startup Success

**Verification** (from Azure Container App logs):
```
✅ Configuration valid for MOCK MODE
   Real Microsoft integrations will use mock services
   
10:44:20 PM [express] serving on port 8080
✅ [JobWorker] Worker lock acquired - this instance is the ACTIVE worker
[JobWorker] Starting job processing loop...
[Cleanup] Scheduler initialized
```

**Health Check**:
```bash
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
# Response: {"status":"healthy","timestamp":"2025-11-24T22:45:24.299Z","version":"1.0.0"}
```

---

## Favicon Replacement Attempt - FAILED DEPLOYMENT

### What Happened

**Objective**: Remove Replit branding from browser tab favicon

**Actions Taken**:
1. Generated custom Teams-themed favicon in Replit (`client/favicon.png`)
2. Attempted deployment via Azure Cloud Shell:
   ```bash
   cd ~/TeamsMeetingDemo
   curl -o client/favicon.png "https://img.icons8.com/fluency/48/microsoft-teams-2019.png"
   mkdir -p client/public
   cp client/favicon.png client/public/favicon.png
   git add client/favicon.png client/public/favicon.png
   git commit -m "Remove Replit branding"
   git push
   az acr build --registry teamminutesacr --image teams-minutes-app:latest --file Dockerfile .
   az containerapp update --name teams-minutes-app --resource-group rg-teams-minutes-demo --image teamminutesacr.azurecr.io/teams-minutes-app:latest
   ```

**Result**: **DEPLOYMENT FAILURE**
- New revision (0000010) created but marked **Unhealthy**
- 0 replicas running
- Application became unavailable

**Root Cause**: `az containerapp update --image` command **dropped all environment variables**
- No `DATABASE_URL` → database connection failed
- No `SESSION_SECRET` → application startup validation failed
- No `PORT=8080` → container listening on wrong port (5000)
- Health probes failed → revision never became healthy

---

## Recovery Procedure - SUCCESSFUL

**Emergency Rollback**:
```bash
# Enable multi-revision mode
az containerapp revision set-mode \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --mode multiple

# Route traffic back to healthy revision
az containerapp ingress traffic set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --revision-weight teams-minutes-app--0000009=100 teams-minutes-app--0000010=0
```

**Current Status**:
```
CreatedTime                Active    Replicas    TrafficWeight    HealthState    Name
-------------------------  --------  ----------  ---------------  -------------  --------------------------
2025-11-24T22:30:43+00:00  True      1           100              Healthy        teams-minutes-app--0000009
2025-11-24T23:20:28+00:00  True      0           0                Unhealthy      teams-minutes-app--0000010
```

**Verification**:
```bash
curl -I https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
# HTTP/2 200 - Application restored and functional
```

---

## CORRECT FIX for Replit Branding Removal

### Prerequisites

1. **Custom favicon ready** in GitHub repository at `client/favicon.png`
2. **Environment variables documented** (never lose these!)

### Step-by-Step Deployment

**1. Prepare favicon in GitHub** (via Cloud Shell):
```bash
cd ~/TeamsMeetingDemo
git pull

# Option A: Download custom icon
curl -o client/favicon.png "https://img.icons8.com/fluency/48/microsoft-teams-2019.png"

# Option B: Generate simple professional icon
cat > create-icon.py << 'EOF'
from PIL import Image, ImageDraw
img = Image.new('RGB', (32, 32), color='#5B5FC7')
draw = ImageDraw.Draw(img)
draw.rectangle([8, 8, 24, 24], fill='white', outline='#5B5FC7', width=2)
img.save('client/favicon.png')
EOF
python3 create-icon.py

# Ensure favicon exists in both locations
mkdir -p client/public
cp client/favicon.png client/public/favicon.png

# Commit and push
git add client/favicon.png client/public/favicon.png
git commit -m "Remove Replit branding, add custom favicon"
git push
```

**2. Build new container image**:
```bash
az acr build \
  --registry teamminutesacr \
  --image teams-minutes-app:latest \
  --file Dockerfile \
  .
```

**3. Deploy with ALL environment variables** (CRITICAL):
```bash
# Generate new session secret
NEW_SESSION_SECRET=$(openssl rand -base64 32)

# Deploy with complete configuration
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --image teamminutesacr.azurecr.io/teams-minutes-app:latest \
  --set-env-vars \
    "DATABASE_URL=postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require" \
    "SESSION_SECRET=${NEW_SESSION_SECRET}" \
    "USE_MOCK_SERVICES=true" \
    "PORT=8080" \
    "NODE_ENV=production"
```

**4. Verify deployment**:
```bash
# Watch logs for successful startup
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow

# Look for:
# ✅ Configuration valid for MOCK MODE
# [express] serving on port 8080

# Test health endpoint
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health

# Test in browser (hard refresh to clear cached favicon)
# Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

**5. Cleanup failed revision**:
```bash
# Once new revision is healthy, deactivate the failed one
az containerapp revision deactivate \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --revision teams-minutes-app--0000010
```

---

## Key Lessons Learned

### 1. Environment Variables Are Critical
- **NEVER** run `az containerapp update --image` without `--set-env-vars`
- The update command does NOT preserve existing environment variables
- Always include the complete set of required variables in every update

### 2. Azure Container Apps Quirks
- secretRef bindings are unreliable (resolve to empty strings)
- Use inline environment variables for all critical configuration
- Single-revision mode prevents traffic rollback - use multi-revision mode
- Health probes require correct PORT configuration (8080 for this app)

### 3. Deployment Safety
- Always enable multi-revision mode before deployments
- Keep previous healthy revision active during updates
- Test new revisions before routing production traffic
- Have rollback procedure ready before making changes

### 4. Database Schema Management
- Use stable drizzle-kit versions (avoid beta releases)
- Ensure drizzle-orm and drizzle-kit versions are compatible
- Always test `npm run db:push` in development before production

---

## Production Configuration Reference

### Required Environment Variables

```bash
DATABASE_URL=postgresql://adminuser:PASSWORD@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require
SESSION_SECRET=<random-base64-string-32-bytes>
USE_MOCK_SERVICES=true
PORT=8080
NODE_ENV=production
```

### Azure Resources

- **Resource Group**: rg-teams-minutes-demo
- **Container App**: teams-minutes-app
- **Container Registry**: teamminutesacr.azurecr.io
- **Container Environment**: teams-minutes-env
- **Database Server**: teams-minutes-db.postgres.database.azure.com
- **Database Name**: teams_minutes_db
- **Database User**: adminuser

### Application Endpoints

- **Main Application**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
- **Health Check**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
- **API Base**: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api

---

## Current Status

**Application**: ✅ OPERATIONAL
- Serving traffic on revision teams-minutes-app--0000009
- Health status: Healthy
- Replicas: 1 active
- Database: Connected to Azure PostgreSQL
- Configuration: Mock services enabled

**Known Issues**:
- Browser tab still shows Replit favicon (cosmetic only, does not affect functionality)
- Failed revision teams-minutes-app--0000010 still exists (can be deactivated)

**Next Steps** (Optional):
1. Follow "CORRECT FIX for Replit Branding Removal" procedure above
2. Configure GitHub Actions for automated deployments (see GITHUB_SETUP.md)
3. Add real Azure OpenAI credentials when ready
4. Configure SharePoint and email integration

---

## Quick Reference Commands

### Check Application Status
```bash
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table
```

### View Logs
```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50
```

### Test Health
```bash
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
```

### Rollback to Previous Revision
```bash
az containerapp ingress traffic set \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --revision-weight teams-minutes-app--0000009=100 teams-minutes-app--0000010=0
```

---

**Document Created**: 2025-11-24 23:35 UTC  
**Application Status**: OPERATIONAL  
**Deployment Mode**: Production (Mock Services)
