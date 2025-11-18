# Quick Start: Deploy to Azure

## Your Credentials
- **Email:** ChrisBECRAFT@ABC123987.onmicrosoft.com
- **Tenant:** ABC123987.onmicrosoft.com

---

## **Recommended: Deploy via Azure Cloud Shell** ⚡

**Why?** Azure Cloud Shell has all tools pre-installed, you're auto-authenticated, and it's the fastest way to deploy.

### Steps:

1. **Open Azure Cloud Shell**
   - Navigate to: https://shell.azure.com
   - Sign in with: ChrisBECRAFT@ABC123987.onmicrosoft.com
   - Choose **Bash** environment

2. **Upload Deployment Package**
   ```bash
   # In Cloud Shell, click the "Upload/Download files" button
   # Upload: azure-deployment.tar.gz (from this Replit)
   ```

3. **Extract and Deploy**
   ```bash
   # Extract files
   tar -xzf azure-deployment.tar.gz
   cd azure-infrastructure
   
   # Make script executable
   chmod +x deploy.sh
   
   # Run deployment
   ./deploy.sh
   ```

4. **Follow the Prompts**
   - Confirm subscription
   - Enter admin email for alerts
   - Wait 20-30 minutes for deployment

---

## **Alternative: Deploy from Local Machine**

If you prefer to run from your local computer:

### Prerequisites:
- Install Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli
- Install Node.js 18+
- Install Git

### Steps:

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. **Login to Azure**
   ```bash
   az login --tenant ABC123987.onmicrosoft.com
   ```

3. **Navigate to infrastructure folder**
   ```bash
   cd azure-infrastructure
   ```

4. **Run deployment**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

---

## What Happens During Deployment?

The `deploy.sh` script will:

✅ Validate Azure CLI and tools  
✅ Prompt for subscription confirmation  
✅ Ask for admin email  
✅ Deploy infrastructure (20-30 min):
   - App Service
   - PostgreSQL Database
   - Azure OpenAI
   - Front Door + CDN
   - Key Vault
   - Application Insights

✅ Output deployment details

---

## After Infrastructure Deployment

Once Phase 1 completes, follow the **DEPLOYMENT_RUNBOOK.md** for:

- **Phase 2:** Azure AD App Registrations
- **Phase 3:** Configure Secrets
- **Phase 4:** Deploy Application Code
- **Phase 5:** Initialize Database
- **Phase 6:** Microsoft Teams Integration
- **Phase 7:** Azure OpenAI Setup
- **Phase 8:** SharePoint Integration
- **Phase 9:** Validation & Testing
- **Phase 10:** Monitoring & Operations

---

## Need Help?

Refer to **DEPLOYMENT_RUNBOOK.md** for detailed step-by-step instructions for all 10 phases.

---

## Deployment Files Included

```
azure-infrastructure/
├── deploy.sh              # Main deployment script
├── main.bicep             # Infrastructure template
├── modules/               # Bicep modules
├── parameters/            # Environment configs
└── scripts/               # Post-deployment scripts
```

**Ready to deploy? Start with Azure Cloud Shell! 🚀**
