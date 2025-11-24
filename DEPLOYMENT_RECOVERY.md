# Azure Deployment Recovery - Emergency Guide

**Target**: Get Teams Meeting Minutes app running on Azure Container Apps in shortest time possible

**Root Cause**: Azure Container Apps secretRef environment variable bindings resolve to empty strings, causing DATABASE_URL to be undefined → app crashes before health checks → 504 Gateway Timeout

**Solution**: CLI-first deployment with inline environment variables and explicit health probes

---

## Prerequisites

1. Azure CLI installed and logged in: `az login`
2. Docker installed locally
3. Access to Azure subscription with existing resources:
   - Resource Group: `rg-teams-minutes-demo`
   - Container Registry: `teamminutesacr.azurecr.io`
   - Container App: `teams-minutes-app`
   - PostgreSQL Server: `teams-minutes-db-dev.postgres.database.azure.com`

---

## Step 1: Rebuild and Push Docker Image

```bash
# Navigate to project root
cd /path/to/teams-minutes-app

# Build Docker image with latest fixes (Node 22, pg driver fix)
docker build -t teamminutesacr.azurecr.io/teams-minutes:v1.0.1 .

# Login to Azure Container Registry
az acr login --name teamminutesacr

# Push image to ACR
docker push teamminutesacr.azurecr.io/teams-minutes:v1.0.1
```

**Alternative** (build directly in Azure if local Docker unavailable):
```bash
az acr build --registry teamminutesacr \
  --image teams-minutes:v1.0.1 \
  --file Dockerfile .
```

---

## Step 2: Gather Required Environment Variables

Create a file `.env.deploy` with the following values (replace placeholders):

```bash
# Database connection (REQUIRED)
DATABASE_URL="postgresql://adminuser:YOUR_PASSWORD@teams-minutes-db-dev.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require"

# Session security (REQUIRED - generate random 32+ char string)
SESSION_SECRET="your-random-session-secret-min-32-chars"

# Mock services mode (REQUIRED for fast demo)
USE_MOCK_SERVICES="true"

# Server configuration (REQUIRED)
PORT="8080"
NODE_ENV="production"

# Key Vault (REQUIRED - must be unset for inline env vars)
# Do NOT set KEY_VAULT_NAME when using inline environment variables
# If set, app will try to use Azure Key Vault instead of env vars

# Azure AD configuration (OPTIONAL - only if USE_MOCK_SERVICES=false)
GRAPH_TENANT_ID_PROD=""
GRAPH_CLIENT_ID_PROD=""
GRAPH_CLIENT_SECRET_PROD=""

# Azure OpenAI configuration (OPTIONAL - only if USE_MOCK_SERVICES=false)
AZURE_OPENAI_ENDPOINT_PROD=""
AZURE_OPENAI_API_KEY_PROD=""
AZURE_OPENAI_DEPLOYMENT_PROD=""

# SharePoint configuration (OPTIONAL - only if USE_MOCK_SERVICES=false)
SHAREPOINT_SITE_URL=""
SHAREPOINT_LIBRARY=""
GRAPH_SENDER_EMAIL=""

# Teams Bot configuration (OPTIONAL)
MICROSOFT_APP_ID=""
MICROSOFT_APP_PASSWORD=""
```

**CRITICAL**: 
- Get PostgreSQL password from Azure Portal → PostgreSQL Server → Connection strings
- Generate SESSION_SECRET: `openssl rand -base64 32`
- Set `USE_MOCK_SERVICES=true` for fastest demo (no Azure AD/OpenAI/SharePoint setup needed)
- **DO NOT set KEY_VAULT_NAME** - this will cause app to ignore inline env vars and try to use Azure Key Vault instead

---

## Step 3: Redeploy Container App with Inline Environment Variables

```bash
# Update container app with new image and inline environment variables
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --image teamminutesacr.azurecr.io/teams-minutes:v1.0.1 \
  --set-env-vars \
    "DATABASE_URL=postgresql://adminuser:YOUR_PASSWORD@teams-minutes-db-dev.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require" \
    "SESSION_SECRET=your-random-session-secret-min-32-chars" \
    "USE_MOCK_SERVICES=true" \
    "PORT=8080" \
    "NODE_ENV=production"
```

**Verify deployment started**:
```bash
# Check revision status
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --output table

# Stream logs to see startup
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --follow
```

**Expected logs**:
```
[Teams Bot] MICROSOFT_APP_ID or MICROSOFT_APP_PASSWORD not set - Teams bot features disabled
[KeyVault] KEY_VAULT_NAME not set - using environment variables only
=================================================
📋 Configuration Validation
=================================================
Environment: PRODUCTION
Mock Services: ENABLED
✅ Configured Secrets:
   ✓ SESSION_SECRET
   ✓ DATABASE_URL
✅ Configuration valid for MOCK MODE
=================================================
9:48:20 PM [express] serving on port 8080
[JobWorker] Attempting to acquire worker lock...
✅ [JobWorker] Worker lock acquired
```

---

## Step 4: Configure HTTP Health Probes

Once the app starts successfully (logs show "serving on port 8080"):

```bash
# Configure both readiness and liveness probes (single command)
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set properties.template.containers[0].probes='[
    {
      "type": "Readiness",
      "httpGet": {
        "path": "/health",
        "port": 8080
      },
      "initialDelaySeconds": 20,
      "periodSeconds": 30,
      "timeoutSeconds": 5,
      "failureThreshold": 3
    },
    {
      "type": "Liveness",
      "httpGet": {
        "path": "/health",
        "port": 8080
      },
      "initialDelaySeconds": 30,
      "periodSeconds": 60,
      "timeoutSeconds": 5,
      "failureThreshold": 3
    }
  ]'
```

**Explanation**:
- **Readiness probe**: Checks if app is ready to receive traffic (every 30s, starting 20s after container starts)
- **Liveness probe**: Checks if app needs restart (every 60s, starting 30s after container starts)
- Both probes call `GET /health` on port 8080
- After 3 consecutive failures, readiness removes container from load balancer; liveness restarts container

---

## Step 5: Verify Deployment

```bash
# Get app URL
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv
```

**Test endpoints**:
1. Health check: `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health`
   - Expected: `{"status":"healthy","timestamp":"..."}`

2. App homepage: `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/`
   - Expected: Teams Meeting Minutes dashboard UI

3. API test: `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/meetings`
   - Expected: `[]` (empty array if no meetings yet)

---

## Troubleshooting

### Container still failing to start

**Check logs**:
```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 100
```

**Common issues**:
1. **DATABASE_URL empty**: Environment variable not set correctly
   - Verify: `az containerapp show --name teams-minutes-app --resource-group rg-teams-minutes-demo --query "properties.template.containers[0].env"`
   - Fix: Re-run Step 3 with correct DATABASE_URL

2. **KEY_VAULT_NAME set but Key Vault not accessible**: App tries to use Key Vault instead of env vars
   - Symptom: Logs show "[KeyVault] Initializing..." but environment variables are empty
   - Fix: Unset KEY_VAULT_NAME:
     ```bash
     az containerapp update \
       --name teams-minutes-app \
       --resource-group rg-teams-minutes-demo \
       --remove-env-vars "KEY_VAULT_NAME"
     ```

3. **PostgreSQL connection refused**: Firewall rules blocking Container Apps
   - Fix: Azure Portal → PostgreSQL Server → Networking → Add "Allow Azure Services" rule

4. **Port mismatch**: App listening on wrong port
   - Verify: Logs should show "serving on port 8080"
   - Fix: Ensure PORT=8080 in environment variables

5. **Ingress target port mismatch**: Container Apps ingress configured for wrong port
   - Verify: `az containerapp show --name teams-minutes-app --resource-group rg-teams-minutes-demo --query "properties.configuration.ingress.targetPort"`
   - Expected: 8080
   - Fix: Update ingress target port:
     ```bash
     az containerapp ingress update \
       --name teams-minutes-app \
       --resource-group rg-teams-minutes-demo \
       --target-port 8080
     ```

### 504 Gateway Timeout

This means the container is not responding to health checks:
- Check logs for startup errors
- Verify DATABASE_URL is valid (test connection from local psql)
- Ensure SESSION_SECRET is set
- Confirm PORT=8080 matches ingress configuration

### Health endpoint returns 404

App is running but health probe misconfigured:
- Verify path is `/health` (not `/api/health`)
- Confirm port is 8080 (matches app PORT)
- Check ingress settings allow health probe traffic

---

## Quick Recovery Commands

**Restart container** (if app hung):
```bash
az containerapp revision restart \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo
```

**View current environment variables**:
```bash
az containerapp show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env" \
  --output table
```

**Update single environment variable**:
```bash
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --set-env-vars "USE_MOCK_SERVICES=true"
```

---

## Post-Deployment: Enable Real Services

Once demo is successful and you want to enable real Microsoft integrations:

1. Configure Azure AD app registration (see COMMERCIAL_DEMO_DEPLOYMENT.md Phase 2)
2. Configure Azure OpenAI service (see COMMERCIAL_DEMO_DEPLOYMENT.md Phase 1)
3. Update environment variables:
   ```bash
   az containerapp update \
     --name teams-minutes-app \
     --resource-group rg-teams-minutes-demo \
     --set-env-vars \
       "USE_MOCK_SERVICES=false" \
       "GRAPH_TENANT_ID_PROD=your-tenant-id" \
       "GRAPH_CLIENT_ID_PROD=your-client-id" \
       "GRAPH_CLIENT_SECRET_PROD=your-client-secret" \
       "AZURE_OPENAI_ENDPOINT_PROD=https://your-openai.openai.azure.com/" \
       "AZURE_OPENAI_API_KEY_PROD=your-api-key" \
       "AZURE_OPENAI_DEPLOYMENT_PROD=gpt-4o"
   ```

---

## Success Criteria

✅ **Revision is Active and Healthy**:
```bash
az containerapp revision list \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --query "[?properties.active].{Name:name, Status:properties.healthState, Traffic:properties.trafficWeight}" \
  --output table
```
Expected: Status = "Healthy", Traffic = 100

✅ **Container starts without errors** (logs show "serving on port 8080"):
```bash
az containerapp logs show \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --tail 50 | grep "serving on port"
```

✅ **Health endpoint returns 200 OK**:
```bash
curl -I https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health
```
Expected: `HTTP/1.1 200 OK` with `{"status":"healthy"}`

✅ **Dashboard UI loads at app URL**:
Open browser to: `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/`

✅ **No 504 Gateway Timeout errors**

✅ **Logs show "Mock Services: ENABLED"** for demo mode

**Estimated time to working deployment**: 15-30 minutes
