# Deploy Teams Meeting Minutes to Azure - STEP BY STEP

**GOAL:** Get this application OFF Replit and running on Microsoft Azure infrastructure.

**WHAT YOU'LL NEED:**
- Your Azure AD tenant name (e.g., `yourcompany.onmicrosoft.com`)
- Your Azure account credentials (for browser login)

---

## ⚡ FASTEST PATH: Copy-Paste Commands in This Replit

**Time:** 30 minutes for infrastructure deployment

### STEP 1: Login to Azure

Copy and paste this command (replace YOUR-TENANT with your actual tenant):

```bash
az login --tenant YOUR-TENANT.onmicrosoft.com
```

**What will happen:**
1. A message will appear: "To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code XXXXXXXXX"
2. Open that URL in your browser
3. Enter the code shown
4. Sign in with your Azure credentials
5. You'll see "You have signed in to Azure CLI on your device"
6. Return to this Replit terminal

**Expected output in terminal:**
```json
[
  {
    "cloudName": "AzureCloud",
    "id": "12345678-...",
    "isDefault": true,
    "name": "Your Subscription Name",
    "state": "Enabled",
    "tenantId": "..."
  }
]
```

---

### STEP 2: Verify Your Subscription

Copy and paste this command:

```bash
az account show
```

**Expected output:**
You should see your subscription details with `"state": "Enabled"`

**If you have multiple subscriptions and need to select one:**

```bash
az account list --output table
```

Find your subscription ID, then:

```bash
az account set --subscription "YOUR-SUBSCRIPTION-ID"
```

---

### STEP 3: Navigate to Deployment Directory

Copy and paste this command:

```bash
cd azure-infrastructure
```

**Expected output:**
Your terminal prompt will change to show you're in the `azure-infrastructure` directory.

---

### STEP 4: Make Deployment Script Executable

Copy and paste this command:

```bash
chmod +x deploy.sh
```

**Expected output:**
No output means success.

---

### STEP 5: Run the Deployment

Copy and paste this command:

```bash
./deploy.sh
```

**What will happen:**

1. **Prompt 1:** "Confirm deployment to subscription..."
   - Type: `yes`
   - Press Enter

2. **Prompt 2:** "Enter admin email for alerts:"
   - Type: your email address for receiving alerts
   - Press Enter

3. **Deployment starts:** You'll see:
   ```
   [INFO] Starting deployment: tmm-demo-20231118-143022
   [INFO] This may take 15-30 minutes. Please be patient...
   ```

4. **Progress messages:** You'll see messages like:
   ```
   Creating resource group...
   Deploying managed identity...
   Deploying virtual network...
   Deploying PostgreSQL database... (this takes the longest)
   Deploying Azure OpenAI...
   Deploying App Service...
   Deploying Front Door...
   Deploying Key Vault...
   ```

5. **Completion:** After 20-30 minutes, you'll see:
   ```
   ✓ Deployment completed successfully
   ```

---

### STEP 6: Save the Deployment Outputs

When deployment finishes, you'll see output like this:

```
═══════════════════════════════════════════════════════════════
  Deployment Outputs
═══════════════════════════════════════════════════════════════
Resource Group:       tmm-demo-eastus
App Service:          tmm-app-demo
App Service URL:      https://tmm-app-demo.azurewebsites.net
Front Door Endpoint:  https://tmm-demo-xyz.azurefd.net
Key Vault:            tmm-kv-demo-xyz
Database Host:        tmm-pg-demo.postgres.database.azure.com
OpenAI Endpoint:      https://tmm-openai-demo.openai.azure.com
App Insights:         tmm-ai-demo
═══════════════════════════════════════════════════════════════
```

**COPY THESE VALUES** - You'll need them for the next phases.

Write them down here:

- Resource Group: `_______________________`
- App Service Name: `_______________________`
- Front Door Endpoint: `_______________________`
- Key Vault Name: `_______________________`
- Database Host: `_______________________`
- OpenAI Endpoint: `_______________________`

---

## ✅ WHAT YOU JUST DEPLOYED TO AZURE

Your application infrastructure is now live on Microsoft Azure:

- ✅ **Azure App Service** - Will host your Node.js application (currently empty, we'll deploy code next)
- ✅ **PostgreSQL Database** - Azure managed database (currently empty, we'll initialize next)
- ✅ **Azure OpenAI** - GPT-4o and Whisper models deployed
- ✅ **Front Door** - Global CDN for fast access
- ✅ **Key Vault** - For storing secrets securely
- ✅ **Application Insights** - Monitoring and logging
- ✅ **Virtual Network** - Secure private networking

**IMPORTANT:** The infrastructure is deployed, but the application code is not deployed yet. That's Phase 4.

---

## 📋 WHAT'S NEXT: Complete Phases 2-10

Now that infrastructure is deployed, you need to:

**Phase 2:** Create Azure AD app registrations (15 min)
- Creates authentication apps for Microsoft Teams access

**Phase 3:** Configure secrets in Key Vault (10 min)
- Run: `cd scripts && ./setup-secrets.sh`
- Enter the values from Step 6 when prompted

**Phase 4:** Deploy application code (10 min)
- Build and upload the Node.js app to Azure App Service

**Phase 5:** Initialize database (5 min)
- Run: `./init-database.sh`
- Creates database tables

**Phase 6:** Microsoft Teams integration (20 min)
- Configure webhooks to capture meeting events

**Phase 7:** Azure OpenAI setup (10 min)  
- Verify AI models are deployed

**Phase 8:** SharePoint integration (15 min)
- Configure document archival

**Phase 9:** Validation & testing (30 min)
- End-to-end testing

**Phase 10:** Monitoring (20 min)
- Configure alerts and dashboards

---

## 🆘 TROUBLESHOOTING

### Problem: "az: command not found"

**Solution 1 - If on Replit:**
Wait 1-2 minutes for dependencies to finish installing, then try again.

**Solution 2 - If on your own machine:**
Install Azure CLI:
- Windows: Download from https://aka.ms/installazurecliwindows
- macOS: `brew install azure-cli`
- Linux: Follow https://learn.microsoft.com/cli/azure/install-azure-cli-linux

Then verify:
```bash
az version
```

### Problem: Deployment fails with "Subscription not found"

**Solution:**
1. Run: `az account list --output table`
2. Find your subscription ID
3. Run: `az account set --subscription "YOUR-SUBSCRIPTION-ID"`
4. Re-run: `./deploy.sh`

### Problem: "Location 'eastus' is not available"

**Solution:**
Open `parameters/demo.bicepparam` and change:
```
location: 'eastus'
```
to:
```
location: 'centralus'
```
Then re-run `./deploy.sh`

---

## 📞 NEED HELP?

Open the detailed runbook: `DEPLOYMENT_RUNBOOK.md`

It has step-by-step instructions for ALL 10 phases with:
- Exact commands
- Expected outputs
- Troubleshooting for every step

---

**Ready?** Start with Step 1 above and work your way down. After Step 6, proceed to Phase 2 in the DEPLOYMENT_RUNBOOK.md.
