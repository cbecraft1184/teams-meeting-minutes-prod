# GitHub Actions Deployment Setup

## Quick Setup Instructions

You need to create ONE Azure service principal and add it as a GitHub secret. This will allow GitHub Actions to automatically build and deploy your app whenever you push code.

### Step 1: Create Azure Service Principal

Run this command in Azure Cloud Shell:

```bash
az ad sp create-for-rbac \
  --name "github-actions-teams-minutes" \
  --role contributor \
  --scopes /subscriptions/17f080ac-db85-4c7d-a12e-fc88bf22b2bc/resourceGroups/rg-teams-minutes-demo \
  --sdk-auth
```

This will output JSON like this:
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "17f080ac-db85-4c7d-a12e-fc88bf22b2bc",
  "tenantId": "e4bd87fd-5d62-4e07-bdb8-70bb31b96985",
  ...
}
```

**COPY THE ENTIRE JSON OUTPUT** - you'll need it in the next step.

### Step 2: Add Secret to GitHub

1. Go to your GitHub repository: https://github.com/cbecraft1184/TeamsMeetingDemo
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**
5. Name: `AZURE_CREDENTIALS`
6. Value: **PASTE THE ENTIRE JSON** from Step 1
7. Click **Add secret**

### Step 3: Push the Workflow File

The workflow file is already created at `.github/workflows/azure-deploy.yml`. You need to push it to GitHub:

```bash
# In your local git repository or Replit
git add .github/workflows/azure-deploy.yml
git add Dockerfile
git commit -m "Add GitHub Actions deployment workflow with fixed Dockerfile"
git push origin main
```

### Step 4: Verify Deployment

After you push:

1. Go to your GitHub repository
2. Click **Actions** tab
3. You should see the "Deploy to Azure Container Apps" workflow running
4. Wait for it to complete (usually 3-5 minutes)
5. Check your app: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health

---

## What This Does

- **Every time you push to `main` branch**, GitHub Actions will:
  1. Build your Docker image using Azure Container Registry (bypasses all authentication issues)
  2. Push the image with both `latest` tag and a unique tag based on the git commit
  3. Update your Container App to use the new image
  4. Automatically restart the container

- **No more Cloud Shell commands needed** - just push code and it deploys automatically

---

## Manual Trigger

You can also trigger deployments manually without pushing code:

1. Go to **Actions** tab in GitHub
2. Click **Deploy to Azure Container Apps** workflow
3. Click **Run workflow** button
4. Select `main` branch
5. Click **Run workflow**

---

## Troubleshooting

**If the workflow fails:**

1. Check the **Actions** tab for error details
2. Verify the `AZURE_CREDENTIALS` secret was added correctly
3. Ensure the service principal was created successfully

**If you need to recreate the service principal:**

```bash
# Delete old one
az ad sp delete --id $(az ad sp list --display-name "github-actions-teams-minutes" --query "[0].id" -o tsv)

# Create new one (run Step 1 again)
```

---

## Next Steps After Setup

Once the workflow runs successfully:

1. Your container will be deployed with the **FIXED** Dockerfile (CMD points to `dist/index.js`)
2. The app should start successfully
3. Check the health endpoint to verify
4. If needed, seed demo data using the existing script

---

## Security Note

The `AZURE_CREDENTIALS` secret gives GitHub Actions permission to:
- Build images in your Azure Container Registry
- Update your Container App

It does NOT have permission to:
- Delete resources
- Access other resource groups
- Modify database or other services

The service principal is scoped only to the `rg-teams-minutes-demo` resource group with `contributor` role.
