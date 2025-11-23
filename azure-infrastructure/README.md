# Azure Infrastructure Deployment Guide
## Teams Meeting Minutes Demo - Commercial Azure

This infrastructure-as-code deployment creates a production-ready Azure environment for the Teams Meeting Minutes demo application.

## 📋 Prerequisites

### Required Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (v2.50+)
- [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) (included with Azure CLI)
- **perl** (required for safe parameter substitution)
  - Pre-installed on macOS
  - Ubuntu/Debian: `sudo apt-get install perl`
- **jq** (optional, recommended for output parsing)
  - macOS: `brew install jq`
  - Ubuntu/Debian: `sudo apt-get install jq`
  - *Can proceed without jq, but output parsing will require manual Azure CLI commands*
- Azure subscription with Owner or Contributor access
- Microsoft 365 tenant for Teams integration

### Required Permissions
- **Azure:** Contributor + User Access Administrator on subscription
- **Microsoft 365:** Global Administrator or Application Administrator

### Special Character Handling
The deployment script (`deploy.sh`) supports all RFC 5322 compliant email addresses for admin notifications, including:
- Standard addresses: `admin@example.com`
- Plus-addressing: `admin+alerts@example.com`
- Apostrophes: `o'connor@example.mil`
- Special characters: `user$123@example.com`, `admin&ops@example.com`

The script automatically:
- Doubles apostrophes for Bicep syntax compliance (`o'connor` → `o''connor`)
- Prevents Perl interpolation of special characters using `\Q...\E`
- Creates `.bak` backup files for idempotent re-execution

## 🏗️ Architecture Overview

This deployment creates:

### Infrastructure Components
- **Resource Group:** `tmm-demo-eastus`
- **Virtual Network:** Hub-spoke topology with 3 subnets
- **Container Apps:** Dedicated plan with auto-scaling (1-3 instances)
- **Container Registry:** For application images
- **PostgreSQL:** Flexible Server B2ms with PgBouncer, 256GB storage
- **Storage Account:** Standard GRS with blob containers
- **Azure OpenAI:** GPT-4o, GPT-4o-mini, Whisper models
- **Azure Front Door:** Standard tier with WAF
- **Key Vault:** Secret management with private endpoint
- **Monitoring:** Application Insights + Log Analytics

### Estimated Monthly Cost
- **Demo (20 users):** ~$85/month
- **Production (100 users):** ~$463/month
- **Variable costs:** Based on AI usage, storage, bandwidth
- **Optimization:** Dedicated Container Apps plan for production workloads

## 🚀 Quick Start Deployment

### Step 1: Login to Azure

```bash
az login
az account set --subscription "<your-subscription-id>"
```

### Step 2: Deploy Infrastructure

```bash
cd azure-infrastructure
./deploy.sh
```

The script will:
1. Validate your Azure login and subscription
2. Update parameters with your tenant ID and email
3. Validate the Bicep template
4. Deploy all infrastructure (15-20 minutes)
5. Display deployment outputs

### Step 3: Verify Deployment

```bash
# List all resources
az resource list --resource-group tmm-demo-eastus --output table

# Check Container App
az containerapp show --name tmm-app-demo --resource-group tmm-demo-eastus

# Check PostgreSQL
az postgres flexible-server show --name tmm-pg-demo --resource-group tmm-demo-eastus
```

## 🔐 Post-Deployment Configuration

### 1. Configure Azure AD App Registrations

**Create Frontend SPA Registration:**

```bash
az ad app create \
  --display-name "Teams Minutes - Frontend" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://<your-frontdoor-endpoint>/auth/callback" \
  --enable-id-token-issuance true
```

**Create Backend API Registration:**

```bash
az ad app create \
  --display-name "Teams Minutes - Backend" \
  --sign-in-audience "AzureADMyOrg"

# Add Microsoft Graph API permissions
az ad app permission add \
  --id <backend-app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    b0afded3-3588-46d8-8b3d-9842eff778da=Scope \  # OnlineMeetings.ReadWrite
    43431867-d0fb-4f55-aebb-5c2e3ae67fbc=Scope \  # Calendars.Read
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope    # User.Read

# Grant admin consent
az ad app permission admin-consent --id <backend-app-id>
```

### 2. Store Secrets in Key Vault

```bash
# Get Key Vault name
KEYVAULT_NAME=$(az keyvault list --resource-group tmm-demo-eastus --query "[0].name" -o tsv)

# Store database password
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name database-url \
  --value "postgresql://dbadmin:<password>@tmm-pg-demo.postgres.database.azure.com:5432/meeting_minutes?sslmode=require"

# Store session secret
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name session-secret \
  --value "$(openssl rand -base64 32)"

# Store Azure AD credentials
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-ad-client-id --value "<frontend-app-id>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-ad-client-secret --value "<backend-app-secret>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-ad-tenant-id --value "<tenant-id>"

# Store Azure OpenAI key
OPENAI_KEY=$(az cognitiveservices account keys list \
  --name tmm-openai-demo \
  --resource-group tmm-demo-eastus \
  --query "key1" -o tsv)

az keyvault secret set --vault-name $KEYVAULT_NAME --name openai-api-key --value "$OPENAI_KEY"

# Store Storage Account key
STORAGE_KEY=$(az storage account keys list \
  --account-name <storage-account-name> \
  --resource-group tmm-demo-eastus \
  --query "[0].value" -o tsv)

az keyvault secret set --vault-name $KEYVAULT_NAME --name storage-account-key --value "$STORAGE_KEY"
```

### 3. Grant Key Vault Access to Container App

```bash
# Get Container App managed identity
APP_PRINCIPAL_ID=$(az containerapp identity show \
  --name tmm-app-demo \
  --resource-group tmm-demo-eastus \
  --query principalId -o tsv)

# Grant Key Vault Secrets User role
az role assignment create \
  --assignee $APP_PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/tmm-demo-eastus/providers/Microsoft.KeyVault/vaults/$KEYVAULT_NAME"
```

### 4. Run Database Migrations

```bash
# Get database connection string from Key Vault
DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEYVAULT_NAME \
  --name database-url \
  --query value -o tsv)

# Run Drizzle migrations
export DATABASE_URL="$DATABASE_URL"
npm run db:push

# Seed demo data
npm run db:seed
```

## 📊 Monitoring and Observability

### Application Insights Dashboard

Access Application Insights in the Azure Portal:
```
https://portal.azure.com/#@<tenant-id>/resource/subscriptions/<subscription-id>/resourceGroups/tmm-demo-eastus/providers/Microsoft.Insights/components/tmm-ai-demo
```

### Key Metrics to Monitor
- **Response Time:** P95 should be < 2 seconds
- **Error Rate:** Should be < 1%
- **CPU Usage:** Triggers auto-scale at 60%
- **Database Connections:** Monitor PgBouncer pool utilization
- **AI Token Usage:** Track costs via Azure OpenAI metrics

### Alerts Configured
- HTTP 5xx errors > 5/minute → Email alert
- CPU > 75% for 10 minutes → Email alert
- Database storage > 80% → Email alert
- Front Door unhealthy origin → Email alert

## 🔄 CI/CD Integration

### GitHub Actions Setup

1. Create Azure Service Principal:
```bash
az ad sp create-for-rbac \
  --name "tmm-github-actions" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/tmm-demo-eastus \
  --sdk-auth
```

2. Add secrets to GitHub repository:
   - `AZURE_CREDENTIALS`: Service principal JSON output
   - `ACR_NAME`: `tmmacrdemo`
   - `CONTAINER_APP`: `tmm-app-demo`
   - `RESOURCE_GROUP`: `tmm-demo-eastus`

3. Deploy on push to main branch (see `.github/workflows/azure-deploy.yml`)

## 🧪 Testing the Deployment

### Health Check
```bash
curl https://<frontdoor-endpoint>/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "storage": "accessible",
  "openai": "available"
}
```

### Integration Tests
```bash
# Run Playwright tests against deployed environment
VITE_API_URL=https://<frontdoor-endpoint> npm run test:e2e
```

## 🛠️ Troubleshooting

### Common Issues

**Container App won't start:**
- Check Application Insights logs for startup errors
- Verify Key Vault secrets are accessible
- Ensure managed identity has Key Vault permissions
- Check container image is in Container Registry

**Database connection failures:**
- Verify VNet integration is configured
- Check PostgreSQL firewall rules (should allow Azure services)
- Validate connection string in Key Vault

**Azure OpenAI 429 errors:**
- Check deployment quotas (TPM/RPM limits)
- Implement exponential backoff in code
- Consider increasing model capacity

## 💰 Cost Optimization

### Recommendations
- **Container Apps:** Use Dedicated plan for production workloads
- **PostgreSQL:** Right-size after monitoring actual usage
- **Storage:** Enable lifecycle policies to move to Cool/Archive tiers
- **Azure OpenAI:** Use GPT-4o-mini for non-critical processing
- **Front Door:** Evaluate if CDN caching can reduce origin requests

### Cost Monitoring
```bash
# View current month costs
az consumption usage list \
  --start-date $(date -d "first day of this month" +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'tmm-demo')].{Resource:instanceName, Cost:pretaxCost}" \
  --output table
```

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
- [Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/)

## 🆘 Support

For issues or questions:
1. Check Application Insights logs
2. Review Azure Portal diagnostics
3. Consult deployment outputs
4. Escalate to Azure Support if infrastructure issue

---

**Last Updated:** November 2025  
**Version:** 1.0  
**Maintained By:** Meetings Team
