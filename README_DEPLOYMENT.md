# Deploy to Azure - Clear Instructions

## Goal
Deploy the Teams Meeting Minutes application to Microsoft Azure (NOT host on Replit).

---

## ONE Command to Start

Open the Shell tab below and run:

```bash
./deploy-azure.sh
```

---

## What You'll Be Asked

### 1. Your Azure Tenant
```
Enter your Azure AD tenant (e.g., yourtenant.onmicrosoft.com): 
```
**Type:** Your Azure tenant name (the one ending in `.onmicrosoft.com`)

### 2. Azure Login
A device code will appear. You'll need to:
1. Open https://microsoft.com/devicelogin in a browser
2. Enter the code shown
3. Sign in with your Azure credentials
4. Come back to this Shell

### 3. Subscription Confirmation
The script will show your Azure subscription and ask:
```
Is this the correct subscription? (yes/no):
```
**Type:** `yes` (or `no` if you need to select a different subscription)

### 4. Deployment Confirmation
The script shows what will be deployed and asks:
```
Continue with deployment? (yes/no):
```
**Type:** `yes` to deploy to Azure

### 5. Admin Email (prompted during deployment)
```
Enter admin email for alerts:
```
**Type:** Your email address for receiving Azure Monitor alerts

---

## What Happens Next

The script will deploy to Azure for 20-30 minutes. You'll see:

```
Creating resource group...
Deploying managed identity...
Deploying virtual network...
Deploying PostgreSQL database...
Deploying Azure OpenAI...
Deploying App Service...
Deploying Front Door...
Deploying Key Vault...
```

When complete, you'll see:
```
✓ Infrastructure Deployment Complete!
```

---

## After Infrastructure Deploys

**SAVE THE OUTPUTS!** You'll see something like:

```
Resource Group:       tmm-demo-eastus
App Service:          tmm-app-demo
Front Door Endpoint:  https://tmm-demo-xyz.azurefd.net
Key Vault:            tmm-kv-demo-xyz
Database Host:        tmm-pg-demo.postgres.database.azure.com
OpenAI Endpoint:      https://tmm-openai-demo.openai.azure.com
```

**Copy these values** - you need them for the next phases.

---

## What's Deployed to Azure

- ✅ App Service (hosts the application)
- ✅ PostgreSQL Database
- ✅ Azure OpenAI (GPT-4o + Whisper)
- ✅ Front Door (CDN)
- ✅ Key Vault (secrets storage)
- ✅ Application Insights (monitoring)
- ✅ Virtual Network

**The infrastructure is ready, but the application code is not deployed yet.**

---

## Next Steps After Infrastructure

You still need to complete 9 more phases:

**Phase 2:** Create Azure AD apps (15 min)  
**Phase 3:** Configure secrets:
```bash
cd azure-infrastructure/scripts
./setup-secrets.sh
```

**Phase 4:** Deploy application code (10 min)  
**Phase 5:** Initialize database:
```bash
./init-database.sh
```

**Phases 6-10:** See `DEPLOYMENT_RUNBOOK.md` for detailed steps

---

## If Something Goes Wrong

### "Azure CLI not found"
Wait 1-2 minutes - Replit may still be installing it. Then try again.

### "Login failed"
Make sure you're using the correct Azure tenant name and credentials.

### "Deployment failed"
Check the error message. The script is idempotent - you can re-run `./deploy-azure.sh` safely.

### Need detailed help?
See `DEPLOYMENT_RUNBOOK.md` for comprehensive troubleshooting.

---

## Ready?

Run this in the Shell below:

```bash
./deploy-azure.sh
```

Then follow the prompts. The script will guide you through each step.
