# GitHub Repository Setup Guide

This guide explains how to set up a GitHub repository for the Teams Meeting Minutes application and configure automated deployments to Azure Container Apps.

---

## Part 1: Create GitHub Repository

### Option A: Create via GitHub Web Interface

1. **Go to GitHub:**
   - Navigate to https://github.com/new

2. **Repository Settings:**
   - **Repository name:** `teams-meeting-minutes`
   - **Description:** AI-powered Microsoft Teams meeting minutes management system
   - **Visibility:** Private (recommended for corporate use)
   - **Initialize:** Do NOT initialize with README, .gitignore, or license (already exist)

3. **Create Repository:**
   - Click "Create repository"
   - Note the repository URL (e.g., `https://github.com/yourusername/teams-meeting-minutes.git`)

### Option B: Create via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Create repository
gh repo create teams-meeting-minutes --private --description "AI-powered Microsoft Teams meeting minutes"

# Get the repository URL
gh repo view --json url -q .url
```

---

## Part 2: Push Code to GitHub

**From your Replit workspace:**

```bash
# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/yourusername/teams-meeting-minutes.git

# Verify current branch
git branch

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Teams Meeting Minutes application"

# Push to GitHub
git push -u origin main
```

**If you encounter authentication issues:**

1. **Create Personal Access Token:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` scope
   - Copy the token

2. **Use token as password:**
   ```bash
   git push -u origin main
   # Username: your-github-username
   # Password: <paste-your-token>
   ```

---

## Part 3: Configure GitHub Actions for Azure Deployment

### Step 3.1: Create GitHub Secrets

**Navigate to:**
- GitHub Repository → Settings → Secrets and variables → Actions → New repository secret

**Add these secrets:**

| Secret Name | Value | Source |
|------------|-------|--------|
| `AZURE_CREDENTIALS` | JSON service principal | See below |
| `ACR_NAME` | `acrteamsminutes<unique>` | From deployment |
| `CONTAINER_APP` | `app-teams-minutes-demo` | From deployment |
| `CONTAINER_ENV` | `env-teams-minutes-demo` | From deployment |
| `RESOURCE_GROUP` | `rg-teams-minutes-demo` | From deployment |

### Step 3.2: Create Azure Service Principal

**In Azure Cloud Shell:**

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "github-teams-minutes-deploy" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-teams-minutes-demo \
  --sdk-auth

# Copy the entire JSON output and save as AZURE_CREDENTIALS secret
```

**Expected output (save this as `AZURE_CREDENTIALS`):**
```json
{
  "clientId": "00000000-0000-0000-0000-000000000000",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### Step 3.3: Create GitHub Actions Workflow

**Create file:** `.github/workflows/azure-deploy.yml`

```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build

    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Build and push container image
      run: |
        az acr build \
          --registry ${{ secrets.ACR_NAME }} \
          --image teams-minutes:${{ github.sha }} \
          --image teams-minutes:latest \
          --file Dockerfile .

    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name ${{ secrets.CONTAINER_APP }} \
          --resource-group ${{ secrets.RESOURCE_GROUP }} \
          --image ${{ secrets.ACR_NAME }}.azurecr.io/teams-minutes:${{ github.sha }}

    - name: Logout from Azure
      run: az logout
```

**Commit and push workflow:**

```bash
# Create workflow directory
mkdir -p .github/workflows

# Create the workflow file (paste content above)
nano .github/workflows/azure-deploy.yml

# Commit and push
git add .github/workflows/azure-deploy.yml
git commit -m "Add GitHub Actions deployment workflow"
git push
```

---

## Part 4: Verify Deployment

### Step 4.1: Monitor GitHub Actions

1. **Navigate to:**
   - GitHub Repository → Actions tab

2. **Verify workflow run:**
   - Latest commit should trigger workflow
   - Monitor build and deployment progress
   - Check for any errors

### Step 4.2: Verify Azure Deployment

```bash
# Check Container App revision
az containerapp revision list \
  --name app-teams-minutes-demo \
  --resource-group rg-teams-minutes-demo \
  -o table

# View latest logs
az containerapp logs show \
  --name app-teams-minutes-demo \
  --resource-group rg-teams-minutes-demo \
  --follow
```

### Step 4.3: Test Application

```bash
# Get Container App URL
CONTAINER_APP_URL=$(az containerapp show \
  --name app-teams-minutes-demo \
  --resource-group rg-teams-minutes-demo \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Application URL: https://$CONTAINER_APP_URL"

# Test health endpoint
curl https://$CONTAINER_APP_URL/health
```

---

## Part 5: Branch Protection (Optional but Recommended)

### Enable Branch Protection

1. **Navigate to:**
   - GitHub Repository → Settings → Branches → Add rule

2. **Configure protection for `main`:**
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
     - Select: `build-and-deploy`
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

3. **Save changes**

**Workflow after protection:**
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push to GitHub
git push -u origin feature/my-feature

# Create Pull Request via GitHub web interface
# Merge after approval and CI passes
```

---

## Part 6: Repository Maintenance

### Regular Updates

```bash
# Pull latest changes
git pull origin main

# Create feature branch
git checkout -b feature/update

# Make changes, commit, and push
git add .
git commit -m "Update feature"
git push -u origin feature/update

# Create PR and merge
```

### Manual Deployment

**To deploy a specific commit:**

```bash
# Via GitHub Actions UI
# Repository → Actions → Deploy to Azure Container Apps → Run workflow → Select branch

# Or via Azure CLI directly
git checkout <commit-hash>
npm run build
az acr build --registry $ACR_NAME --image teams-minutes:<tag> --file Dockerfile .
az containerapp update --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --image $ACR_NAME.azurecr.io/teams-minutes:<tag>
```

---

## Troubleshooting

### Issue: GitHub Actions fails with authentication error

**Solution:**
```bash
# Recreate service principal
az ad sp create-for-rbac \
  --name "github-teams-minutes-deploy" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-teams-minutes-demo \
  --sdk-auth

# Update AZURE_CREDENTIALS secret in GitHub
```

### Issue: Container image build fails

**Solution:**
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check GitHub Actions logs for specific error

### Issue: Deployment succeeds but app doesn't work

**Solution:**
```bash
# Check Container App logs
az containerapp logs show \
  --name app-teams-minutes-demo \
  --resource-group rg-teams-minutes-demo \
  --follow

# Verify environment variables
az containerapp show \
  --name app-teams-minutes-demo \
  --resource-group rg-teams-minutes-demo \
  --query "properties.template.containers[0].env" -o table
```

---

## Security Best Practices

1. **Never commit secrets:**
   - Use GitHub Secrets for sensitive data
   - Verify .gitignore excludes .env files

2. **Use least-privilege service principal:**
   - Scope to specific resource group
   - Rotate credentials regularly

3. **Enable branch protection:**
   - Require code review
   - Require CI to pass

4. **Audit access:**
   - Review repository collaborators regularly
   - Monitor Actions usage

---

## Next Steps

✅ GitHub repository created  
✅ Code pushed to GitHub  
✅ GitHub Actions configured  
✅ Automated deployment working  

**Production Checklist:**
- [ ] Configure production environment variables
- [ ] Set up staging environment
- [ ] Enable monitoring and alerts
- [ ] Document deployment procedures
- [ ] Train team on Git workflow
