#!/bin/bash

# ============================================================================
# Teams Meeting Minutes - Azure Deployment Script
# Commercial Azure Demo Deployment
# ============================================================================
#
# Usage: ./deploy.sh <environment> [--validate-only]
#
# Examples:
#   ./deploy.sh demo                    # Deploy demo environment
#   ./deploy.sh demo --validate-only    # Validate without deploying
#   ./deploy.sh staging                 # Deploy staging environment
#
# Prerequisites:
#   - Azure CLI installed and authenticated (az login)
#   - Subscription selected (az account set --subscription <id>)
#   - Bicep CLI installed (az bicep install)
#   - Parameter file configured (parameters/<env>.bicepparam)
#
# ============================================================================

set -e  # Exit on any error
set -o pipefail  # Catch errors in pipes

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENVIRONMENT="${1:-demo}"
VALIDATE_ONLY=false
LOCATION="eastus"
TEMPLATE_FILE="$SCRIPT_DIR/main.bicep"
PARAM_FILE="$SCRIPT_DIR/parameters/${ENVIRONMENT}.bicepparam"

# Check for --validate-only flag
if [ "$2" == "--validate-only" ]; then
    VALIDATE_ONLY=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}Azure Teams Meeting Minutes Demo Deployment${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""

log "Environment: ${ENVIRONMENT}"
log "Location: ${LOCATION}"
log "Template: ${TEMPLATE_FILE}"
log "Parameters: ${PARAM_FILE}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    error "Azure CLI is not installed. Please install it first:"
    error "  https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if Bicep is installed
if ! az bicep version &> /dev/null; then
    warning "Bicep CLI not found. Installing..."
    az bicep install
fi

# Check if jq is installed (required for parsing deployment outputs)
if ! command -v jq &> /dev/null; then
    error "jq is not installed. Install it to parse deployment outputs:"
    error "  Ubuntu/Debian: sudo apt-get install jq"
    error "  macOS: brew install jq"
    error "  Or continue without output parsing (manual review of deployment required)"
    read -p "Continue without jq? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    JQ_AVAILABLE=false
else
    JQ_AVAILABLE=true
fi

# Check if perl is installed (required for safe parameter substitution)
if ! command -v perl &> /dev/null; then
    error "perl is not installed. Install it for safe parameter substitution:"
    error "  Ubuntu/Debian: sudo apt-get install perl"
    error "  macOS: perl is pre-installed"
    exit 1
fi

# Check if logged in
log "Checking Azure CLI authentication..."
if ! az account show &> /dev/null; then
    error "Not logged in to Azure CLI. Running: az login"
    az login
fi

# Display current subscription
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
log "Current subscription:"
echo -e "${GREEN}  Name:${NC}      ${SUBSCRIPTION_NAME}"
echo -e "${GREEN}  ID:${NC}        ${SUBSCRIPTION_ID}"
echo -e "${GREEN}  Tenant ID:${NC} ${TENANT_ID}"
echo ""

read -p "Is this the correct subscription? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warning "Please set the correct subscription:"
    warning "  az account set --subscription <subscription-id>"
    exit 1
fi

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    error "Template file not found: ${TEMPLATE_FILE}"
    exit 1
fi

# Check if parameter file exists
if [ ! -f "$PARAM_FILE" ]; then
    error "Parameter file not found: ${PARAM_FILE}"
    error "Please create: ${PARAM_FILE}"
    error "You can use parameters/demo.bicepparam as a template"
    exit 1
fi

# Check for placeholder values and auto-populate if possible
if grep -q '<YOUR_AZURE_AD_TENANT_ID>' "$PARAM_FILE"; then
    warning "Auto-populating Azure AD Tenant ID in parameter file..."
    # Use perl for safe replacement (handles special characters)
    perl -i.bak -pe "s/<YOUR_AZURE_AD_TENANT_ID>/${TENANT_ID}/g" "$PARAM_FILE"
fi

if grep -q '<YOUR_ADMIN_EMAIL>' "$PARAM_FILE"; then
    read -p "Enter admin email for alerts: " ADMIN_EMAIL
    # For Bicep: double apostrophes for single-quote escaping (o'connor → o''connor)
    BICEP_EMAIL=$(printf '%s\n' "$ADMIN_EMAIL" | sed "s/'/''/g")
    # Replace the entire parameter line to avoid quoting context issues
    # This targets: param adminEmail = '<YOUR_ADMIN_EMAIL>'
    # And replaces with: param adminEmail = 'escaped@example.com'
    perl -i.bak -pe "s/param adminEmail = '<YOUR_ADMIN_EMAIL>'/param adminEmail = '${BICEP_EMAIL}'/" "$PARAM_FILE"
fi

# Final check for any remaining placeholders
if grep -q '<YOUR_' "$PARAM_FILE"; then
    error "Parameter file still contains placeholder values: ${PARAM_FILE}"
    error "Please replace all <YOUR_*> placeholders with actual values"
    exit 1
fi

success "Pre-flight checks passed"

# ============================================================================
# Validate Deployment
# ============================================================================

log "Validating Bicep template..."

if ! az deployment sub validate \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAM_FILE" \
    --output none 2>&1; then
    error "Template validation failed. Check errors above."
    exit 1
fi

success "Template validation passed"

# If validate-only mode, exit here
if [ "$VALIDATE_ONLY" = true ]; then
    success "Validation complete (--validate-only mode)"
    exit 0
fi

# ============================================================================
# Confirm Deployment
# ============================================================================

echo ""
warning "═══════════════════════════════════════════════════════════════"
warning "  You are about to deploy infrastructure to Azure Commercial"
warning "  This will create resources that incur costs (~\$500-800/month)"
warning "═══════════════════════════════════════════════════════════════"
echo ""
echo "Environment:    ${ENVIRONMENT}"
echo "Subscription:   ${SUBSCRIPTION_NAME}"
echo "Location:       ${LOCATION}"
echo ""

read -p "Do you want to proceed with deployment? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    warning "Deployment cancelled by user"
    exit 0
fi

# ============================================================================
# Deploy Infrastructure
# ============================================================================

DEPLOYMENT_NAME="tmm-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

log "Starting deployment: ${DEPLOYMENT_NAME}"
log "This may take 15-30 minutes. Please be patient..."
echo ""

# Start deployment with progress output
if ! az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAM_FILE" \
    --output table; then
    error "Deployment failed. Check errors above."
    exit 1
fi

success "Deployment completed successfully"

# ============================================================================
# Display Deployment Outputs
# ============================================================================

echo ""
log "Retrieving deployment outputs..."

# Get outputs from latest deployment
if [ "$JQ_AVAILABLE" = true ]; then
    # Parse outputs with jq
    OUTPUTS=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs -o json)
    
    RESOURCE_GROUP=$(echo "$OUTPUTS" | jq -r '.resourceGroupName.value')
    APP_SERVICE_NAME=$(echo "$OUTPUTS" | jq -r '.appServiceName.value')
    APP_SERVICE_URL=$(echo "$OUTPUTS" | jq -r '.appServiceUrl.value')
    FRONT_DOOR_ENDPOINT=$(echo "$OUTPUTS" | jq -r '.frontDoorEndpoint.value')
    KEY_VAULT_NAME=$(echo "$OUTPUTS" | jq -r '.keyVaultName.value')
    DATABASE_HOST=$(echo "$OUTPUTS" | jq -r '.databaseHost.value')
    OPENAI_ENDPOINT=$(echo "$OUTPUTS" | jq -r '.openaiEndpoint.value')
    APP_INSIGHTS_NAME=$(echo "$OUTPUTS" | jq -r '.applicationInsightsName.value')
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Deployment Outputs${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Resource Group:${NC}       ${RESOURCE_GROUP}"
    echo -e "${GREEN}App Service:${NC}          ${APP_SERVICE_NAME}"
    echo -e "${GREEN}App Service URL:${NC}      ${APP_SERVICE_URL}"
    echo -e "${GREEN}Front Door Endpoint:${NC}  ${FRONT_DOOR_ENDPOINT}"
    echo -e "${GREEN}Key Vault:${NC}            ${KEY_VAULT_NAME}"
    echo -e "${GREEN}Database Host:${NC}        ${DATABASE_HOST}"
    echo -e "${GREEN}OpenAI Endpoint:${NC}      ${OPENAI_ENDPOINT}"
    echo -e "${GREEN}App Insights:${NC}         ${APP_INSIGHTS_NAME}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
else
    # jq not available - show manual instructions
    warning "jq not installed - cannot parse deployment outputs automatically"
    echo ""
    echo "To view deployment outputs manually, run:"
    echo "  az deployment sub show --name ${DEPLOYMENT_NAME} --query properties.outputs --output table"
    echo ""
    echo "Or install jq for automated output parsing:"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  macOS: brew install jq"
    echo ""
    
    # Set defaults for error handling below
    RESOURCE_GROUP="${ENVIRONMENT}-rg"
    KEY_VAULT_NAME="<check-deployment-outputs>"
    APP_SERVICE_NAME="<check-deployment-outputs>"
fi

# ============================================================================
# Post-Deployment Instructions
# ============================================================================

warning "═══════════════════════════════════════════════════════════════"
warning "  IMPORTANT: Post-Deployment Steps Required"
warning "═══════════════════════════════════════════════════════════════"
echo ""
echo "1. Populate Key Vault Secrets:"
echo "   az keyvault secret set --vault-name ${KEY_VAULT_NAME} --name database-url --value 'postgresql://...'"
echo "   az keyvault secret set --vault-name ${KEY_VAULT_NAME} --name session-secret --value '\$(openssl rand -base64 32)'"
echo "   az keyvault secret set --vault-name ${KEY_VAULT_NAME} --name azure-ad-client-id --value '<CLIENT_ID>'"
echo "   az keyvault secret set --vault-name ${KEY_VAULT_NAME} --name azure-ad-client-secret --value '<CLIENT_SECRET>'"
echo "   az keyvault secret set --vault-name ${KEY_VAULT_NAME} --name azure-ad-tenant-id --value '${TENANT_ID}'"
echo ""
echo "2. Deploy Application Code:"
echo "   cd .. && npm run build"
echo "   az webapp deployment source config-zip --resource-group ${RESOURCE_GROUP} --name ${APP_SERVICE_NAME} --src deploy.zip"
echo ""
echo "3. Configure Microsoft Teams Integration:"
echo "   - Register Azure AD application"
echo "   - Configure Graph API permissions (Calendars.Read, OnlineMeetings.Read)"
echo "   - Set up webhook subscription"
echo ""
echo "4. Configure SharePoint Integration:"
echo "   - Create document library"
echo "   - Configure OAuth permissions (Sites.Selected)"
echo ""
echo "5. Initialize Database Schema:"
echo "   - Run: npm run db:push"
echo ""
echo "6. Verify Deployment:"
echo "   - App Service: ${APP_SERVICE_URL}"
echo "   - Application Insights: https://portal.azure.com/#resource${APP_INSIGHTS_NAME}"
echo ""

success "Deployment script completed"
success "Infrastructure is ready for application deployment"

# Save deployment info
if [ "$JQ_AVAILABLE" = true ]; then
    cat > deployment-info.txt <<EOF
Teams Meeting Minutes - Deployment Information
================================================
Deployment Name:   ${DEPLOYMENT_NAME}
Environment:       ${ENVIRONMENT}
Deployment Date:   $(date)

Azure Resources:
- Resource Group:       ${RESOURCE_GROUP}
- App Service:          ${APP_SERVICE_NAME}
- App Service URL:      ${APP_SERVICE_URL}
- Front Door:           ${FRONT_DOOR_ENDPOINT}
- Key Vault:            ${KEY_VAULT_NAME}
- Database Host:        ${DATABASE_HOST}
- OpenAI Endpoint:      ${OPENAI_ENDPOINT}
- Application Insights: ${APP_INSIGHTS_NAME}

Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})
Location:     ${LOCATION}
Tenant ID:    ${TENANT_ID}
================================================
EOF
    log "Deployment information saved to: deployment-info.txt"
else
    cat > deployment-info.txt <<EOF
Teams Meeting Minutes - Deployment Information
================================================
Deployment Name:   ${DEPLOYMENT_NAME}
Environment:       ${ENVIRONMENT}
Deployment Date:   $(date)

Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})
Location:     ${LOCATION}
Tenant ID:    ${TENANT_ID}

NOTE: jq was not installed - outputs not parsed.
Run this to view deployment outputs:
  az deployment sub show --name ${DEPLOYMENT_NAME} --query properties.outputs --output table
================================================
EOF
    log "Deployment information saved to: deployment-info.txt (without parsed outputs)"
fi

exit 0
