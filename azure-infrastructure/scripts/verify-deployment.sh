#!/bin/bash
###############################################################################
# Verify Deployment Script
# Runs health checks on all deployed services
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Deployment Verification"
echo "=================================================="
echo ""

# Prompt for Front Door endpoint
read -p "Enter Front Door Endpoint URL: " FRONT_DOOR_ENDPOINT

# Remove trailing slash if present
FRONT_DOOR_ENDPOINT=${FRONT_DOOR_ENDPOINT%/}

echo ""
echo "Running health checks..."
echo ""

# Function to check endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Checking $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)
    
    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $response, expected $expected)"
        return 1
    fi
}

# Health checks
CHECKS_PASSED=0
CHECKS_TOTAL=5

echo "─────────────────────────────────────────────────"
echo "Application Health Checks"
echo "─────────────────────────────────────────────────"

check_endpoint "Application Health" "$FRONT_DOOR_ENDPOINT/health" "200" && ((CHECKS_PASSED++))
check_endpoint "API Health" "$FRONT_DOOR_ENDPOINT/api/health" "200" && ((CHECKS_PASSED++))
check_endpoint "Database Health" "$FRONT_DOOR_ENDPOINT/api/health/database" "200" && ((CHECKS_PASSED++))
check_endpoint "Azure OpenAI Health" "$FRONT_DOOR_ENDPOINT/api/health/openai" "200" && ((CHECKS_PASSED++))
check_endpoint "SharePoint Health" "$FRONT_DOOR_ENDPOINT/api/health/sharepoint" "200" && ((CHECKS_PASSED++))

echo ""
echo "─────────────────────────────────────────────────"
echo "Summary"
echo "─────────────────────────────────────────────────"
echo "Checks passed: $CHECKS_PASSED/$CHECKS_TOTAL"

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
    echo -e "${GREEN}✓ All health checks passed!${NC}"
    echo ""
    echo "Your deployment is healthy and ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Test user login at: $FRONT_DOOR_ENDPOINT"
    echo "  2. Create a test meeting in Microsoft Teams"
    echo "  3. Verify webhook captures the meeting"
    echo "  4. Test AI minute generation"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some health checks failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Application Insights for errors"
    echo "  2. Verify Key Vault secrets are configured"
    echo "  3. Ensure App Service has Key Vault access"
    echo "  4. Review application logs"
    echo ""
    exit 1
fi
