# Deploy Teams Meeting Minutes to Azure

## ⚡ Quick Start - Run ONE Command

Open the Shell tab in this Replit and run:

```bash
./deploy-azure.sh
```

**That's it.** This single script will:

1. ✅ Check Azure CLI is installed
2. ✅ Login to Azure with your credentials  
3. ✅ Verify your subscription
4. ✅ Deploy all infrastructure to Azure (20-30 min)
5. ✅ Give you next steps

---

## What Will Be Deployed to Azure

Your application will run entirely on Microsoft Azure (NOT on Replit):

- **App Service** - Hosts your Node.js application
- **PostgreSQL Database** - Azure managed database
- **Azure OpenAI** - GPT-4o and Whisper AI models
- **Front Door + CDN** - Global content delivery
- **Key Vault** - Secure secrets storage
- **Application Insights** - Monitoring and logging
- **Virtual Network** - Private secure networking

---

## Your Azure Account

You'll need:
- Your Azure AD tenant name (e.g., `yourcompany.onmicrosoft.com`)
- Your Azure credentials (you'll be prompted to login via browser)

---

## What Happens When You Run `./deploy-azure.sh`

### Step 1: Azure Login
You'll be asked for your Azure tenant name, then see a device code like: `ABC123XYZ`

1. Enter your Azure tenant when prompted (e.g., `yourcompany.onmicrosoft.com`)
2. Open https://microsoft.com/devicelogin in your browser
3. Enter the device code shown
4. Sign in with your Azure credentials
5. Return to this Replit Shell

### Step 2: Subscription Verification
The script shows your Azure subscription and asks for confirmation.
- Type `yes` and press Enter

### Step 3: Infrastructure Deployment
The script deploys all Azure resources (20-30 minutes).

You'll see progress messages:
```
Creating resource group...
Deploying managed identity...
Deploying virtual network...
Deploying PostgreSQL database... (longest step)
Deploying Azure OpenAI...
Deploying App Service...
Deploying Front Door...
Deploying Key Vault...
```

### Step 4: Save Outputs
When complete, you'll see deployment outputs like:
```
Resource Group:       tmm-demo-eastus
App Service:          tmm-app-demo
Front Door Endpoint:  https://tmm-demo-xyz.azurefd.net
Key Vault:            tmm-kv-demo-xyz
Database Host:        tmm-pg-demo.postgres.database.azure.com
OpenAI Endpoint:      https://tmm-openai-demo.openai.azure.com
```

**COPY THESE VALUES** - You need them for the next phases.

---

## After Infrastructure Deployment

Once `./deploy-azure.sh` completes, you still need to:

**Phase 2:** Create Azure AD app registrations (15 min)
**Phase 3:** Run secrets setup:
```bash
cd azure-infrastructure/scripts
./setup-secrets.sh
```

**Phase 4:** Deploy application code (10 min)
**Phase 5:** Initialize database:
```bash
./init-database.sh
```

**Phase 6-10:** Complete remaining integration steps

👉 **See `DEPLOYMENT_RUNBOOK.md` for detailed instructions for all phases**

---

## Timeline

- **Now:** Run `./deploy-azure.sh` (30 min)
- **After:** Complete Phases 2-10 (3-5 hours total)
- **Result:** Fully operational Teams Meeting Minutes system on Azure

---

## Cost

Estimated: **~$750-850/month** for all Azure resources

---

## Need Help?

- **Quick reference:** This file (START_HERE.md)
- **Detailed guide:** DEPLOYMENT_RUNBOOK.md
- **Quick start:** DEPLOY_TO_AZURE_NOW.md

---

# Ready? Run This:

```bash
./deploy-azure.sh
```

The script will guide you through everything step by step.
