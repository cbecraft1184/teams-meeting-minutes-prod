#!/bin/bash
###############################################################################
# Setup Secrets Script
# Populates Azure Key Vault with all required application secrets
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Azure Key Vault Secrets Setup"
echo "=================================================="
echo ""

# Check if required tools are installed
command -v az >/dev/null 2>&1 || { echo -e "${RED}Error: Azure CLI is required but not installed.${NC}" >&2; exit 1; }

# Prompt for Key Vault name
read -p "Enter Key Vault name (from deployment outputs): " KEY_VAULT_NAME
read -p "Enter Resource Group name [tmm-demo-eastus]: " RESOURCE_GROUP
RESOURCE_GROUP=${RESOURCE_GROUP:-tmm-demo-eastus}

echo ""
echo -e "${YELLOW}Gathering information...${NC}"

# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "✓ Tenant ID: $TENANT_ID"

# Prompt for application IDs
echo ""
echo "Enter Azure AD Application IDs (from Phase 2):"
read -p "Frontend App (Client) ID: " FRONTEND_APP_ID
read -p "Backend App (Client) ID: " BACKEND_APP_ID
read -sp "Backend Client Secret: " BACKEND_CLIENT_SECRET
echo ""

# Prompt for database info
echo ""
read -p "Database Host (e.g., tmm-pg-demo.postgres.database.azure.com): " DATABASE_HOST
read -p "Database Name [meetings_db]: " DB_NAME
DB_NAME=${DB_NAME:-meetings_db}
read -p "Database User [tmm_admin]: " DB_USER
DB_USER=${DB_USER:-tmm_admin}
read -sp "Database Password: " DB_PASSWORD
echo ""

# Construct database URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DATABASE_HOST}/${DB_NAME}?sslmode=require"

# Prompt for Azure OpenAI info
echo ""
read -p "Azure OpenAI Endpoint (e.g., https://tmm-openai-demo.openai.azure.com): " OPENAI_ENDPOINT

# Get OpenAI API key
echo -e "${YELLOW}Fetching Azure OpenAI API key...${NC}"
OPENAI_NAME=$(echo $OPENAI_ENDPOINT | sed 's|https://||' | sed 's|\.openai\.azure\.com||')
OPENAI_API_KEY=$(az cognitiveservices account keys list \
  --name $OPENAI_NAME \
  --resource-group $RESOURCE_GROUP \
  --query key1 -o tsv)
echo "✓ OpenAI API key retrieved"

# Generate session secret
SESSION_SECRET=$(openssl rand -base64 32)
echo "✓ Generated session secret"

# Prompt for SharePoint info
echo ""
read -p "SharePoint Site URL: " SHAREPOINT_SITE_URL
read -p "SharePoint Library Name [Meeting Minutes]: " SHAREPOINT_LIBRARY
SHAREPOINT_LIBRARY=${SHAREPOINT_LIBRARY:-Meeting Minutes}

echo ""
echo "=================================================="
echo "Storing secrets in Key Vault: $KEY_VAULT_NAME"
echo "=================================================="
echo ""

# Store secrets
echo "Storing database-url..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name database-url --value "$DATABASE_URL" > /dev/null
echo -e "${GREEN}✓${NC} database-url"

echo "Storing session-secret..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name session-secret --value "$SESSION_SECRET" > /dev/null
echo -e "${GREEN}✓${NC} session-secret"

echo "Storing azure-ad-client-id..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-ad-client-id --value "$FRONTEND_APP_ID" > /dev/null
echo -e "${GREEN}✓${NC} azure-ad-client-id"

echo "Storing azure-ad-tenant-id..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-ad-tenant-id --value "$TENANT_ID" > /dev/null
echo -e "${GREEN}✓${NC} azure-ad-tenant-id"

echo "Storing graph-client-id..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name graph-client-id --value "$BACKEND_APP_ID" > /dev/null
echo -e "${GREEN}✓${NC} graph-client-id"

echo "Storing graph-client-secret..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name graph-client-secret --value "$BACKEND_CLIENT_SECRET" > /dev/null
echo -e "${GREEN}✓${NC} graph-client-secret"

echo "Storing azure-openai-endpoint..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-openai-endpoint --value "$OPENAI_ENDPOINT" > /dev/null
echo -e "${GREEN}✓${NC} azure-openai-endpoint"

echo "Storing azure-openai-api-key..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-openai-api-key --value "$OPENAI_API_KEY" > /dev/null
echo -e "${GREEN}✓${NC} azure-openai-api-key"

echo "Storing azure-openai-deployment..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-openai-deployment --value "gpt-4o" > /dev/null
echo -e "${GREEN}✓${NC} azure-openai-deployment"

echo "Storing azure-openai-whisper-deployment..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-openai-whisper-deployment --value "whisper" > /dev/null
echo -e "${GREEN}✓${NC} azure-openai-whisper-deployment"

echo "Storing sharepoint-site-url..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name sharepoint-site-url --value "$SHAREPOINT_SITE_URL" > /dev/null
echo -e "${GREEN}✓${NC} sharepoint-site-url"

echo "Storing sharepoint-library..."
az keyvault secret set --vault-name $KEY_VAULT_NAME --name sharepoint-library --value "$SHAREPOINT_LIBRARY" > /dev/null
echo -e "${GREEN}✓${NC} sharepoint-library"

echo ""
echo "=================================================="
echo -e "${GREEN}All secrets stored successfully!${NC}"
echo "=================================================="
echo ""

# List all secrets
echo "Verifying secrets in Key Vault:"
az keyvault secret list --vault-name $KEY_VAULT_NAME --query "[].name" -o table

echo ""
echo -e "${GREEN}✓ Phase 3 Complete!${NC}"
echo "Next: Proceed to Phase 4 - Deploy Application Code"
