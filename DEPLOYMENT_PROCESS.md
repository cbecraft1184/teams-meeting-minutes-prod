# Azure Deployment Process

## Quick Deploy (5 minutes)

**Use this process for all future deployments.**

### Prerequisites
- Azure credentials configured as Replit secrets: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- GitHub repository: `https://github.com/cbecraft1184/teams-meeting-minutes-prod.git`

### Deployment Steps

```bash
# 1. Login to Azure
az login --service-principal \
  -u "$AZURE_CLIENT_ID" \
  -p "$AZURE_CLIENT_SECRET" \
  --tenant "$AZURE_TENANT_ID"

# 2. Build Docker image from GitHub (bypasses Replit git restrictions)
az acr build \
  --registry teamminutesacr \
  --image teams-minutes:$(date +%Y%m%d%H%M) \
  --image teams-minutes:latest \
  --file Dockerfile \
  https://github.com/cbecraft1184/teams-meeting-minutes-prod.git#main

# 3. Deploy to Container App
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --image teamminutesacr.azurecr.io/teams-minutes:latest

# 4. Verify deployment
curl https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/health
```

### Why This Works
- **No local Docker needed** - Azure ACR builds the image in the cloud
- **No git push needed** - Builds directly from GitHub repository
- **Fast** - Build + deploy in ~3-5 minutes
- **Automatic** - Creates new Container App revision with zero downtime

### Troubleshooting

**Build fails?**
- Push code to GitHub first
- Check Dockerfile syntax

**Deploy fails?**
- Verify resource names: `az containerapp list -g rg-teams-minutes-demo -o table`
- Check ACR access: `az acr repository list --name teamminutesacr`

**Health check fails?**
- Wait 30 seconds for container startup
- Check logs: `az containerapp logs show -n teams-minutes-app -g rg-teams-minutes-demo`

### Configuration

| Resource | Value |
|----------|-------|
| Subscription | `17f080ac-db85-4c7d-a12e-fc88bf22b2bc` |
| Resource Group | `rg-teams-minutes-demo` |
| Container Registry | `teamminutesacr` |
| Container App | `teams-minutes-app` |
| GitHub Repo | `cbecraft1184/teams-meeting-minutes-prod` |
| Health Endpoint | `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/health` |
