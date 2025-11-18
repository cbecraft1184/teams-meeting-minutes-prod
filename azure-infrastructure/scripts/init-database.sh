#!/bin/bash
###############################################################################
# Initialize Database Script
# Runs Drizzle migrations to create database schema
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Database Initialization"
echo "=================================================="
echo ""

# Check if required tools are installed
command -v az >/dev/null 2>&1 || { echo -e "${RED}Error: Azure CLI is required but not installed.${NC}" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: Node.js is required but not installed.${NC}" >&2; exit 1; }

# Prompt for Key Vault name
read -p "Enter Key Vault name: " KEY_VAULT_NAME

echo -e "${YELLOW}Retrieving database connection string from Key Vault...${NC}"

# Get database URL from Key Vault
DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name database-url \
  --query value -o tsv)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: Could not retrieve database-url from Key Vault${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database URL retrieved"

# Export for Drizzle
export DATABASE_URL

echo ""
echo -e "${YELLOW}Running database migrations...${NC}"
echo ""

# Navigate to project root (assumes script is in azure-infrastructure/scripts/)
cd "$(dirname "$0")/../.."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run Drizzle push
npm run db:push

echo ""
echo "=================================================="
echo -e "${GREEN}Database initialized successfully!${NC}"
echo "=================================================="
echo ""
echo "Tables created:"
echo "  ✓ meetings"
echo "  ✓ meeting_minutes"
echo "  ✓ action_items"
echo "  ✓ meeting_templates"
echo "  ✓ users"
echo "  ✓ graph_webhook_subscriptions"
echo "  ✓ user_group_cache"
echo "  ✓ job_queue"
echo ""
echo -e "${GREEN}✓ Phase 5 Complete!${NC}"
echo "Next: Proceed to Phase 6 - Microsoft Teams Integration"
