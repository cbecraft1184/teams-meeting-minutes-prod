#!/bin/bash
###############################################################################
# Azure Deployment Script v2 - Redesigned for Replit Environment
# 
# This script deploys Teams Meeting Minutes to Microsoft Azure
# Designed to work in containerized environments (Replit, Cloud Shell, etc.)
###############################################################################

set -e
set -o pipefail

###############################################################################
# ENVIRONMENT SETUP
###############################################################################

# Use fresh temporary Azure config directory to avoid stale credentials
# This prevents hangs from az logout and ensures clean state
export AZURE_CONFIG_DIR="$(mktemp -d -t azure-cli-XXXXXX)"
export AZURE_CORE_ONLY_SHOW_ERRORS=1
export AZURE_HTTP_USER_AGENT="TeamsMeetingMinutes-Deployment/1.0"

# Cleanup function
cleanup() {
    if [ -n "$AZURE_CONFIG_DIR" ] && [ -d "$AZURE_CONFIG_DIR" ]; then
        rm -rf "$AZURE_CONFIG_DIR"
    fi
}
trap cleanup EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# HELPER FUNCTIONS
###############################################################################

# Print status messages
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Parse JSON using Python (reliable, no jq dependency)
parse_json() {
    local json="$1"
    local field="$2"
    python3 -c "import json, sys; data=json.loads(sys.argv[1]); print(data.get(sys.argv[2], ''))" "$json" "$field" 2>/dev/null || echo ""
}

parse_json_nested() {
    local json="$1"
    local path="$2"  # e.g., "user.name"
    python3 -c "
import json, sys
data = json.loads(sys.argv[1])
path = sys.argv[2].split('.')
for key in path:
    data = data.get(key, {})
print(data if isinstance(data, str) else '')
" "$json" "$path" 2>/dev/null || echo ""
}

# Run Azure CLI command with timeout and error handling
run_az() {
    local timeout_seconds=30
    local output
    local exit_code
    
    output=$(timeout "$timeout_seconds" "$@" 2>&1) || exit_code=$?
    
    if [ "${exit_code:-0}" -eq 124 ]; then
        log_error "Command timed out after ${timeout_seconds}s: $*"
        return 1
    elif [ "${exit_code:-0}" -ne 0 ]; then
        log_error "Command failed: $*"
        echo "$output" | head -20
        return 1
    fi
    
    echo "$output"
    return 0
}

###############################################################################
# HEADER
###############################################################################

clear
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║       Teams Meeting Minutes - Azure Deployment v2               ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}This will deploy your application to Microsoft Azure${NC}"
echo -e "${YELLOW}Your application will run on Azure, NOT on Replit${NC}"
echo ""

###############################################################################
# PHASE 1: PREREQUISITES
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 1: Prerequisites Check"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# Check Azure CLI
echo -n "Checking Azure CLI... "
if ! command -v az &> /dev/null; then
    # Try to find in /nix/store (Replit)
    if [ -d /nix/store ]; then
        AZ_PATH=$(find /nix/store -maxdepth 3 -path "*/azure-cli*/bin/az" -type f 2>/dev/null | head -1)
        if [ -n "$AZ_PATH" ]; then
            export PATH="$(dirname "$AZ_PATH"):$PATH"
        fi
    fi
    
    # Check again
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI not found"
        echo "Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
fi
AZ_VERSION=$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "unknown")
log_success "Found ($AZ_VERSION)"

# Check Python 3
echo -n "Checking Python 3... "
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 not found (required for JSON parsing)"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
log_success "Found ($PYTHON_VERSION)"

# Check/Install Bicep
echo -n "Checking Bicep... "
if ! az bicep version &> /dev/null; then
    log_warning "Not found, installing..."
    az bicep install 2>&1 | grep -v "WARNING" || true
fi
BICEP_VERSION=$(az bicep version 2>&1 | grep -o 'version [0-9.]*' | cut -d' ' -f2 || echo "unknown")
log_success "Ready ($BICEP_VERSION)"

echo ""

###############################################################################
# PHASE 2: TENANT INPUT
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 2: Azure Tenant"
echo "══════════════════════════════════════════════════════════════════"
echo ""

read -p "Enter your Azure AD tenant domain: " AZURE_TENANT
if [ -z "$AZURE_TENANT" ]; then
    log_error "Tenant is required"
    exit 1
fi

# Validate tenant format
if ! [[ "$AZURE_TENANT" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
    log_error "Invalid tenant format"
    echo "Expected: yourtenant.onmicrosoft.com"
    exit 1
fi

log_success "Tenant validated: $AZURE_TENANT"
echo ""

###############################################################################
# PHASE 3: AUTHENTICATION
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 3: Azure Login (Device Code)"
echo "══════════════════════════════════════════════════════════════════"
echo ""

echo "You will receive a device code for authentication."
echo ""
echo "Steps:"
echo "  1. A code will appear below (e.g., ABC123XYZ)"
echo "  2. Open: https://microsoft.com/devicelogin"
echo "  3. Enter the code"
echo "  4. Sign in with your Azure credentials"
echo "  5. Return here after authentication completes"
echo ""

read -p "Press Enter to begin login... "
echo ""

# Login with optimal flags for containerized environments
# --allow-no-subscriptions: works even if user has no subscriptions yet
# --only-show-errors: reduces noise
# --use-device-code: non-interactive flow
if ! az login \
    --tenant "$AZURE_TENANT" \
    --use-device-code \
    --allow-no-subscriptions \
    --only-show-errors; then
    log_error "Login failed"
    exit 1
fi

echo ""
log_success "Authentication successful!"
echo ""

###############################################################################
# PHASE 4: SUBSCRIPTION & PERMISSIONS
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 4: Subscription & Permissions"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# Retrieve account info ONCE and cache
log_info "Retrieving account information..."
ACCOUNT_JSON=$(az account show --output json 2>/dev/null) || {
    log_error "Failed to retrieve account information"
    echo "Try running: az account list"
    exit 1
}

# Parse using Python helper
SUB_NAME=$(parse_json "$ACCOUNT_JSON" "name")
SUB_ID=$(parse_json "$ACCOUNT_JSON" "id")
SUB_STATE=$(parse_json "$ACCOUNT_JSON" "state")
SUB_TENANT=$(parse_json "$ACCOUNT_JSON" "tenantId")
USER_NAME=$(parse_json_nested "$ACCOUNT_JSON" "user.name")

if [ -z "$SUB_ID" ]; then
    log_error "Could not parse subscription information"
    exit 1
fi

log_success "Account information retrieved"
echo ""
echo "  Subscription:  $SUB_NAME"
echo "  ID:            $SUB_ID"
echo "  State:         $SUB_STATE"
echo "  Tenant:        $SUB_TENANT"
echo "  User:          $USER_NAME"
echo ""

# Confirm subscription
read -p "Use this subscription? (y/n): " CONFIRM_SUB
if [[ ! "$CONFIRM_SUB" =~ ^[Yy]$ ]]; then
    echo ""
    log_info "Available subscriptions:"
    az account list --output table
    echo ""
    read -p "Enter subscription ID to use: " NEW_SUB_ID
    
    if ! az account set --subscription "$NEW_SUB_ID"; then
        log_error "Failed to set subscription"
        exit 1
    fi
    
    # Re-fetch account info
    ACCOUNT_JSON=$(az account show --output json)
    SUB_ID=$(parse_json "$ACCOUNT_JSON" "id")
    SUB_NAME=$(parse_json "$ACCOUNT_JSON" "name")
    log_success "Switched to: $SUB_NAME"
    echo ""
fi

# Check permissions (Owner or Contributor required)
log_info "Verifying permissions..."

ROLE_ASSIGNMENTS=$(az role assignment list \
    --assignee "$USER_NAME" \
    --scope "/subscriptions/$SUB_ID" \
    --include-inherited \
    --output json 2>/dev/null || echo "[]")

HAS_PERMISSION=false
if echo "$ROLE_ASSIGNMENTS" | python3 -c "
import json, sys
roles = json.load(sys.stdin)
required = ['Owner', 'Contributor']
for assignment in roles:
    role_name = assignment.get('roleDefinitionName', '')
    if role_name in required:
        print('true')
        sys.exit(0)
print('false')
" | grep -q "true"; then
    HAS_PERMISSION=true
fi

if [ "$HAS_PERMISSION" = true ]; then
    log_success "Permissions verified (Owner or Contributor)"
else
    log_warning "Could not verify Owner/Contributor role"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE_ANYWAY
    if [[ ! "$CONTINUE_ANYWAY" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

echo ""

###############################################################################
# PHASE 5: DEPLOYMENT CONFIGURATION
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 5: Deployment Configuration"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# Get deployment parameters
read -p "Enter deployment region (default: eastus): " LOCATION
LOCATION=${LOCATION:-eastus}

read -p "Enter environment (demo/staging/production, default: demo): " ENVIRONMENT
ENVIRONMENT=${ENVIRONMENT:-demo}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(demo|staging|production)$ ]]; then
    log_error "Invalid environment. Use: demo, staging, or production"
    exit 1
fi

read -p "Enter naming prefix (3-8 chars, default: tmm): " NAMING_PREFIX
NAMING_PREFIX=${NAMING_PREFIX:-tmm}

# Validate prefix
if ! [[ "$NAMING_PREFIX" =~ ^[a-z0-9]{3,8}$ ]]; then
    log_error "Invalid prefix. Use 3-8 lowercase alphanumeric characters."
    exit 1
fi

read -p "Enter administrator email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    log_error "Administrator email is required"
    exit 1
fi

# Validate email format
if ! [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    log_error "Invalid email format"
    exit 1
fi

DEPLOYMENT_NAME="teams-minutes-$(date +%Y%m%d-%H%M%S)"

echo ""
log_info "Deployment Configuration:"
echo "  Name:         $DEPLOYMENT_NAME"
echo "  Environment:  $ENVIRONMENT"
echo "  Region:       $LOCATION"
echo "  Prefix:       $NAMING_PREFIX"
echo "  Tenant ID:    $SUB_TENANT"
echo "  Admin Email:  $ADMIN_EMAIL"
echo ""

###############################################################################
# PHASE 6: DEPLOYMENT EXECUTION
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "PHASE 6: Azure Deployment"
echo "══════════════════════════════════════════════════════════════════"
echo ""

log_info "Resources to be created:"
echo "  • App Service (hosting)"
echo "  • PostgreSQL Database"
echo "  • Azure OpenAI (GPT-4o + Whisper)"
echo "  • Front Door + CDN"
echo "  • Key Vault"
echo "  • Application Insights"
echo "  • Virtual Network"
echo ""
echo -e "${YELLOW}Estimated time: 20-30 minutes${NC}"
echo -e "${YELLOW}Estimated cost: ~\$750-850/month${NC}"
echo ""

read -p "Proceed with deployment? (y/n): " FINAL_CONFIRM
if [[ ! "$FINAL_CONFIRM" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
log_info "Starting deployment..."
echo ""

# Navigate to infrastructure directory
if [ ! -d "azure-infrastructure" ]; then
    log_error "azure-infrastructure directory not found"
    exit 1
fi

cd azure-infrastructure

# Validate Bicep template first
log_info "Validating Bicep template..."
if ! az deployment sub validate \
    --location "$LOCATION" \
    --template-file main.bicep \
    --parameters \
        environment="$ENVIRONMENT" \
        location="$LOCATION" \
        namingPrefix="$NAMING_PREFIX" \
        azureAdTenantId="$SUB_TENANT" \
        adminEmail="$ADMIN_EMAIL" \
    --output none; then
    log_error "Template validation failed"
    echo "Check that main.bicep exists and all parameters are correct"
    exit 1
fi
log_success "Template validated"
echo ""

# Execute deployment
log_info "Deploying infrastructure (this will take 20-30 minutes)..."
echo ""

DEPLOYMENT_OUTPUT=$(az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file main.bicep \
    --parameters \
        environment="$ENVIRONMENT" \
        location="$LOCATION" \
        namingPrefix="$NAMING_PREFIX" \
        azureAdTenantId="$SUB_TENANT" \
        adminEmail="$ADMIN_EMAIL" \
    --output json 2>&1)

DEPLOYMENT_STATUS=$?

if [ $DEPLOYMENT_STATUS -ne 0 ]; then
    log_error "Deployment failed"
    echo ""
    echo "$DEPLOYMENT_OUTPUT" | head -50
    exit 1
fi

log_success "Infrastructure deployed successfully!"
echo ""

# Parse outputs
log_info "Deployment Outputs:"
echo "$DEPLOYMENT_OUTPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    outputs = data.get('properties', {}).get('outputs', {})
    for key, value in outputs.items():
        print(f'  {key}: {value.get(\"value\", \"N/A\")}')
except:
    print('  (Could not parse outputs)')
" || echo "  (Could not parse outputs)"

echo ""

###############################################################################
# COMPLETION
###############################################################################

echo "══════════════════════════════════════════════════════════════════"
echo "✓ Deployment Complete!"
echo "══════════════════════════════════════════════════════════════════"
echo ""
log_success "Teams Meeting Minutes infrastructure is deployed to Azure"
echo ""
echo "Next Steps:"
echo "  1. Review deployment outputs above"
echo "  2. Configure application secrets in Azure Key Vault"
echo "  3. Deploy application code (Phase 4)"
echo "  4. Run integration tests"
echo ""
echo "Documentation: See DEPLOYMENT_RUNBOOK.md"
echo ""

exit 0
