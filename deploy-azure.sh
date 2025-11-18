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

# Validate tenant format (basic check for domain pattern)
if ! [[ "$AZURE_TENANT" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
    echo -e "${RED}Invalid tenant format. Expected format: yourtenant.onmicrosoft.com${NC}"
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

# Check optional tools (only needed for later phases, not infrastructure deployment)
echo -n "  perl (for later phases)... "
if command -v perl &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}NOT FOUND${NC} (needed for Phase 4 code deployment)"
fi

echo -n "  Node.js (for later phases)... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} ($NODE_VERSION)"
else
    echo -e "${YELLOW}NOT FOUND${NC} (needed for Phase 4 code deployment)"
fi

echo -n "  npm (for later phases)... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} (v$NPM_VERSION)"
else
    echo -e "${YELLOW}NOT FOUND${NC} (needed for Phase 4 code deployment)"
fi

# Check jq (optional but helpful)
echo -n "  jq (optional)... "
if command -v jq &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}NOT FOUND${NC} (deployment will work but output formatting will be plain)"
fi

echo ""

# Always force fresh login to ensure valid credentials
# NOTE: We do NOT use 'az account show' to check login status because it hangs in
# Replit's container environment. Instead, we simply logout and re-login fresh.
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "STEP 1: Login to Azure"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "Clearing any cached credentials..."
az logout 2>/dev/null
echo ""
echo "A device code will appear below."
echo "1. Open https://microsoft.com/devicelogin in your browser"
echo "2. Enter the code shown"
echo "3. Sign in with: ChrisBECRAFT@ABC123987.onmicrosoft.com"
echo "4. Return here after you see 'You have signed in'"
echo ""
read -p "Press Enter to start login..."
echo ""

az login --tenant "$AZURE_TENANT" --use-device-code

if [ $? -ne 0 ]; then
    echo -e "${RED}Login failed. Please try again.${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✓${NC} Login successful!"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "STEP 2: Verify Subscription"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# Display subscription info using Azure CLI query
echo "Name:   $(az account show --query name -o tsv)"
echo "ID:     $(az account show --query id -o tsv)"
echo "State:  $(az account show --query state -o tsv)"
echo "Tenant: $(az account show --query tenantId -o tsv)"

echo ""
read -p "Is this the correct subscription? (y/yes): " CORRECT_SUB
CORRECT_SUB=$(echo "$CORRECT_SUB" | tr '[:upper:]' '[:lower:]')

if [[ "$CORRECT_SUB" != "yes" && "$CORRECT_SUB" != "y" ]]; then
    echo ""
    echo "Available subscriptions:"
    az account list --output table
    echo ""
    read -p "Enter subscription ID to use: " SUB_ID
    az account set --subscription "$SUB_ID"
fi

# Verify user has appropriate role (Contributor or Owner)
echo ""
echo -n "Checking subscription permissions... "

# Use Azure CLI's built-in query - no external tools needed
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
USER_ID=$(az account show --query user.name -o tsv)

# Check for Owner or Contributor role
ROLE_CHECK=$(az role assignment list --assignee "$USER_ID" --scope "/subscriptions/$SUBSCRIPTION_ID" --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='Contributor']" -o tsv 2>/dev/null)

if [ -n "$ROLE_CHECK" ]; then
    echo -e "${GREEN}✓${NC} (Contributor or Owner access confirmed)"
else
    echo -e "${YELLOW}WARNING${NC}"
    echo ""
    echo "Could not verify Contributor/Owner role on this subscription."
    echo "Deployment may fail if you lack sufficient permissions."
    echo ""
    read -p "Continue anyway? (y/yes): " CONTINUE_ANYWAY
    CONTINUE_ANYWAY=$(echo "$CONTINUE_ANYWAY" | tr '[:upper:]' '[:lower:]')
    if [[ "$CONTINUE_ANYWAY" != "yes" && "$CONTINUE_ANYWAY" != "y" ]]; then
        echo "Deployment cancelled. Please contact your Azure administrator for access."
        exit 0
    fi
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
read -p "Continue with deployment? (y/yes): " DEPLOY
DEPLOY=$(echo "$DEPLOY" | tr '[:upper:]' '[:lower:]')

if [[ "$DEPLOY" != "yes" && "$DEPLOY" != "y" ]]; then
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
