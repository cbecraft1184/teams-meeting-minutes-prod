#!/bin/bash
# ============================================================================
# Azure Infrastructure Deployment Script
# Teams Meeting Minutes Demo
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}Azure Teams Meeting Minutes Demo Deployment${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please log in:${NC}"
    az login
fi

# Select subscription
echo -e "${YELLOW}Current subscription:${NC}"
az account show --query "{Name:name, ID:id, TenantId:tenantId}" -o table
echo
read -p "Is this the correct subscription? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set the correct subscription:"
    echo "  az account set --subscription <subscription-id>"
    exit 1
fi

# Get parameters
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
read -p "Enter admin email for alerts: " ADMIN_EMAIL

# Update parameters file
echo -e "${YELLOW}Updating parameters file...${NC}"
sed -i "s/<YOUR_AZURE_AD_TENANT_ID>/$TENANT_ID/g" parameters/demo.bicepparam
sed -i "s/<YOUR_ADMIN_EMAIL>/$ADMIN_EMAIL/g" parameters/demo.bicepparam

# Validate template
echo -e "${YELLOW}Validating Bicep template...${NC}"
az deployment sub validate \
  --location eastus \
  --template-file main.bicep \
  --parameters parameters/demo.bicepparam

# Deploy infrastructure
echo -e "${YELLOW}Deploying infrastructure to Azure...${NC}"
echo "This will take approximately 15-20 minutes."
echo

az deployment sub create \
  --location eastus \
  --name "tmm-demo-$(date +%Y%m%d-%H%M%S)" \
  --template-file main.bicep \
  --parameters parameters/demo.bicepparam \
  --output table

# Get outputs
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo
echo -e "${YELLOW}Deployment Outputs:${NC}"
az deployment sub show \
  --name "tmm-demo-$(date +%Y%m%d-%H%M%S)" \
  --query properties.outputs -o table

echo
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}Next Steps:${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo "1. Configure Azure AD app registrations for Microsoft 365 integration"
echo "2. Store secrets in Azure Key Vault"
echo "3. Run database migrations"
echo "4. Deploy application code"
echo "5. Configure Front Door custom domain (optional)"
echo
echo "See README.md for detailed instructions."
