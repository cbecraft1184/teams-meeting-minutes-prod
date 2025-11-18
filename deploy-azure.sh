#!/bin/bash
###############################################################################
# Azure Deployment Launcher
# Run this script to deploy Teams Meeting Minutes to Microsoft Azure
###############################################################################

set -e

# Find and add Azure CLI to PATH dynamically (Replit-specific)
if [ -d /nix/store ]; then
    # Use a faster, more targeted search with maxdepth and timeout
    AZ_PATH=$(timeout 10 find /nix/store -maxdepth 3 -path "*/azure-cli*/bin/az" -type f 2>/dev/null | head -1)
    if [ -n "$AZ_PATH" ]; then
        export PATH="$(dirname "$AZ_PATH"):$PATH"
    fi
fi

# Fallback: check if az is already in PATH (non-Replit environments)
# If not found anywhere, the prerequisite check below will catch it

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║       Teams Meeting Minutes - Azure Deployment                  ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}This will deploy your application to Microsoft Azure${NC}"
echo -e "${YELLOW}Your application will run on Azure, NOT on Replit${NC}"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo ""

# Prompt for Azure tenant
read -p "Enter your Azure AD tenant (e.g., yourtenant.onmicrosoft.com): " AZURE_TENANT
if [ -z "$AZURE_TENANT" ]; then
    echo -e "${RED}Tenant is required${NC}"
    exit 1
fi

echo ""

# Check required tools
echo "Checking prerequisites..."
echo ""

# Check Azure CLI
echo -n "  Azure CLI... "
if ! command -v az &> /dev/null; then
    echo -e "${RED}NOT FOUND${NC}"
    echo ""
    echo "Azure CLI is not available."
    echo "The packager may still be installing it. Please wait 1-2 minutes and try again."
    echo ""
    echo "If the problem persists, check the Dependencies pane in Replit."
    exit 1
fi
AZ_VERSION=$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "unknown")
echo -e "${GREEN}✓${NC} (version $AZ_VERSION)"

# Check perl
echo -n "  perl... "
if ! command -v perl &> /dev/null; then
    echo -e "${RED}NOT FOUND${NC}"
    echo ""
    echo "perl is required but not found. This is unusual for Replit."
    exit 1
fi
echo -e "${GREEN}✓${NC}"

# Check Node.js and npm
echo -n "  Node.js... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}NOT FOUND${NC}"
    echo ""
    echo "Node.js is required. Check Replit configuration."
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} ($NODE_VERSION)"

echo -n "  npm... "
if ! command -v npm &> /dev/null; then
    echo -e "${RED}NOT FOUND${NC}"
    echo ""
    echo "npm is required. Check Replit configuration."
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓${NC} (v$NPM_VERSION)"

# Check jq (optional but helpful)
echo -n "  jq (optional)... "
if command -v jq &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}NOT FOUND${NC} (deployment will work but output formatting will be plain)"
fi

echo ""

# Check if logged in
echo -n "Checking Azure login status... "
if az account show &> /dev/null; then
    CURRENT_USER=$(az account show --query user.name -o tsv)
    echo -e "${GREEN}✓${NC} Logged in as: $CURRENT_USER"
    echo ""
    read -p "Continue with this account? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        echo "Run 'az logout' then run this script again"
        exit 0
    fi
else
    echo -e "${YELLOW}NOT LOGGED IN${NC}"
    echo ""
    echo "══════════════════════════════════════════════════════════════════"
    echo "STEP 1: Login to Azure"
    echo "══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Running: az login --tenant $AZURE_TENANT"
    echo ""
    echo "A message will appear with a device code."
    echo "1. Open https://microsoft.com/devicelogin in your browser"
    echo "2. Enter the code shown below"
    echo "3. Sign in with your Azure credentials"
    echo "4. Return here after you see 'You have signed in'"
    echo ""
    read -p "Press Enter to continue..."
    echo ""
    
    az login --tenant "$AZURE_TENANT"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Login failed. Please try again.${NC}"
        exit 1
    fi
fi

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "STEP 2: Verify Subscription"
echo "══════════════════════════════════════════════════════════════════"
echo ""

az account show --output table

echo ""
read -p "Is this the correct subscription? (yes/no): " CORRECT_SUB

if [ "$CORRECT_SUB" != "yes" ]; then
    echo ""
    echo "Available subscriptions:"
    az account list --output table
    echo ""
    read -p "Enter subscription ID to use: " SUB_ID
    az account set --subscription "$SUB_ID"
fi

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "STEP 3: Run Infrastructure Deployment"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "This will deploy to Azure:"
echo "  • App Service (for hosting your application)"
echo "  • PostgreSQL Database"
echo "  • Azure OpenAI (GPT-4o + Whisper)"
echo "  • Front Door + CDN"
echo "  • Key Vault"
echo "  • Application Insights"
echo "  • Virtual Network"
echo ""
echo -e "${YELLOW}Estimated time: 20-30 minutes${NC}"
echo -e "${YELLOW}Estimated cost: ~$750-850/month${NC}"
echo ""
read -p "Continue with deployment? (yes/no): " DEPLOY

if [ "$DEPLOY" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Navigating to deployment directory..."
cd azure-infrastructure

echo "Making deployment script executable..."
chmod +x deploy.sh

echo ""
echo -e "${GREEN}Starting deployment...${NC}"
echo ""

./deploy.sh

DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════════"
    echo -e "${GREEN}✓ Infrastructure Deployment Complete!${NC}"
    echo "══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Your Azure resources are now deployed!"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Copy the deployment outputs shown above${NC}"
    echo "You'll need them for the next phases."
    echo ""
    echo "══════════════════════════════════════════════════════════════════"
    echo "NEXT STEPS:"
    echo "══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Phase 2: Create Azure AD app registrations (15 min)"
    echo "Phase 3: Configure secrets (run: cd scripts && ./setup-secrets.sh)"
    echo "Phase 4: Deploy application code (10 min)"
    echo "Phase 5: Initialize database (run: ./init-database.sh)"
    echo "Phase 6: Microsoft Teams integration (20 min)"
    echo "Phase 7: Azure OpenAI setup (10 min)"
    echo "Phase 8: SharePoint integration (15 min)"
    echo "Phase 9: Validation & testing (30 min)"
    echo "Phase 10: Monitoring setup (20 min)"
    echo ""
    echo "See DEPLOYMENT_RUNBOOK.md for detailed instructions"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Deployment failed${NC}"
    echo ""
    echo "Check the error messages above and try again"
    echo "Or see DEPLOYMENT_RUNBOOK.md for troubleshooting"
    exit 1
fi
