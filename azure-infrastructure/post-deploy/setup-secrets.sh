#!/bin/bash

# ============================================================================
# Post-Deployment: Key Vault Secrets Setup
# Teams Meeting Minutes Demo
# ============================================================================
#
# Usage: ./setup-secrets.sh <key-vault-name>
#
# Prerequisites:
#   - Azure CLI authenticated
#   - Sufficient permissions to set Key Vault secrets
#   - Azure AD app registration completed (for Teams/Graph API)
#
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Configuration
# ============================================================================

KEY_VAULT_NAME="${1}"

if [ -z "$KEY_VAULT_NAME" ]; then
    echo -e "${RED}ERROR: Key Vault name is required${NC}"
    echo "Usage: ./setup-secrets.sh <key-vault-name>"
    exit 1
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Key Vault Secrets Setup${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Key Vault:${NC} $KEY_VAULT_NAME"
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================

echo -e "${BLUE}[1/6] Checking Azure CLI authentication...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${RED}ERROR: Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"

echo -e "${BLUE}[2/6] Verifying Key Vault exists...${NC}"
if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
    echo -e "${RED}ERROR: Key Vault '$KEY_VAULT_NAME' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Key Vault found${NC}"

# ============================================================================
# Generate Session Secret
# ============================================================================

echo -e "${BLUE}[3/6] Generating session secret...${NC}"
SESSION_SECRET=$(openssl rand -base64 32)
az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "session-secret" \
    --value "$SESSION_SECRET" \
    --output none
echo -e "${GREEN}✓ Session secret generated and stored${NC}"

# ============================================================================
# Azure AD Application Credentials
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Azure AD Application Setup${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "You need to provide Azure AD application credentials for Microsoft Teams/Graph API integration."
echo "If you haven't created an Azure AD app registration yet, do so now:"
echo ""
echo "1. Go to: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
echo "2. Click 'New registration'"
echo "3. Name: 'Teams Meeting Minutes Demo'"
echo "4. Supported account types: 'Single tenant'"
echo "5. Click 'Register'"
echo "6. Note the 'Application (client) ID'"
echo "7. Go to 'Certificates & secrets' → 'New client secret'"
echo "8. Note the secret value (copy immediately, it won't be shown again)"
echo "9. Go to 'API permissions' → 'Add a permission' → 'Microsoft Graph'"
echo "10. Add Application permissions:"
echo "    - Calendars.Read"
echo "    - OnlineMeetings.Read"
echo "    - Files.ReadWrite.All"
echo "    - Sites.Selected (for SharePoint)"
echo "11. Click 'Grant admin consent'"
echo ""

read -p "Press Enter when you have the Azure AD credentials ready..."

echo ""
echo -e "${BLUE}[4/6] Collecting Azure AD credentials...${NC}"

# Get Azure AD Tenant ID (auto-detect)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo -e "${GREEN}✓ Tenant ID detected:${NC} $TENANT_ID"

# Get Client ID
read -p "Enter Azure AD Application (client) ID: " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}ERROR: Client ID cannot be empty${NC}"
    exit 1
fi

# Get Client Secret
echo ""
echo "Enter Azure AD Client Secret (input will be hidden):"
read -s CLIENT_SECRET
echo ""
if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${RED}ERROR: Client Secret cannot be empty${NC}"
    exit 1
fi

# Store Azure AD credentials
echo -e "${BLUE}[5/6] Storing Azure AD credentials in Key Vault...${NC}"

az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "azure-ad-tenant-id" \
    --value "$TENANT_ID" \
    --output none

az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "azure-ad-client-id" \
    --value "$CLIENT_ID" \
    --output none

az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "azure-ad-client-secret" \
    --value "$CLIENT_SECRET" \
    --output none

echo -e "${GREEN}✓ Azure AD credentials stored${NC}"

# ============================================================================
# Optional: Storage Account Key
# ============================================================================

echo ""
echo -e "${BLUE}[6/6] Storage Account configuration...${NC}"
echo ""
echo "The App Service can access Storage using:"
echo "  A) Managed Identity (recommended, more secure)"
echo "  B) Storage Account Key"
echo ""
read -p "Do you want to store the Storage Account Key? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter Storage Account name: " STORAGE_ACCOUNT_NAME
    read -p "Enter Resource Group name: " RESOURCE_GROUP
    
    echo "Retrieving storage account key..."
    STORAGE_KEY=$(az storage account keys list \
        --resource-group "$RESOURCE_GROUP" \
        --account-name "$STORAGE_ACCOUNT_NAME" \
        --query '[0].value' -o tsv)
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "storage-account-key" \
        --value "$STORAGE_KEY" \
        --output none
    
    echo -e "${GREEN}✓ Storage account key stored${NC}"
else
    echo -e "${YELLOW}⚠ Skipping storage key (using managed identity)${NC}"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "The following secrets have been stored in Key Vault:"
echo ""
echo "  ✓ session-secret              (auto-generated)"
echo "  ✓ azure-ad-tenant-id          ($TENANT_ID)"
echo "  ✓ azure-ad-client-id          ($CLIENT_ID)"
echo "  ✓ azure-ad-client-secret      (hidden)"
if [[ $REPLY =~ ^[Yy]$ ]]; then
echo "  ✓ storage-account-key         (hidden)"
fi
echo ""
echo "App Service will automatically retrieve these secrets via:"
echo "  @Microsoft.KeyVault(SecretUri=https://$KEY_VAULT_NAME.vault.azure.net/secrets/<secret-name>)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Configure SharePoint integration (if needed)"
echo "  2. Deploy application code to App Service"
echo "  3. Run database migrations: npm run db:push"
echo "  4. Test the application"
echo ""
echo -e "${GREEN}✓ All secrets configured successfully${NC}"
echo ""

exit 0
