#!/bin/bash

# ============================================================================
# Post-Deployment: Database Initialization
# Teams Meeting Minutes Demo
# ============================================================================
#
# Usage: ./init-database.sh <database-host> <database-name>
#
# Prerequisites:
#   - PostgreSQL client (psql) installed
#   - Database credentials from deployment
#   - Drizzle schema defined in shared/schema.ts
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

DATABASE_HOST="${1}"
DATABASE_NAME="${2:-meeting_minutes}"

if [ -z "$DATABASE_HOST" ]; then
    echo -e "${RED}ERROR: Database host is required${NC}"
    echo "Usage: ./init-database.sh <database-host> [database-name]"
    echo ""
    echo "Example:"
    echo "  ./init-database.sh tmm-pg-demo.postgres.database.azure.com meeting_minutes"
    exit 1
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Database Initialization${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Database Host:${NC} $DATABASE_HOST"
echo -e "${BLUE}Database Name:${NC} $DATABASE_NAME"
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================

echo -e "${BLUE}[1/4] Checking prerequisites...${NC}"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}ERROR: psql (PostgreSQL client) is not installed${NC}"
    echo "Install with: sudo apt-get install postgresql-client"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}ERROR: npm is not installed${NC}"
    echo "Please install Node.js and npm first"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"

# ============================================================================
# Test Database Connection
# ============================================================================

echo -e "${BLUE}[2/4] Testing database connection...${NC}"
read -p "Enter database admin username (default: dbadmin): " DB_USER
DB_USER="${DB_USER:-dbadmin}"

echo "Enter database password (input will be hidden):"
read -s DB_PASSWORD
echo ""

# Test connection
export PGPASSWORD="$DB_PASSWORD"
if ! psql -h "$DATABASE_HOST" -U "$DB_USER" -d "$DATABASE_NAME" -c "SELECT version();" &> /dev/null; then
    echo -e "${RED}ERROR: Cannot connect to database${NC}"
    echo "Please verify:"
    echo "  - Database host: $DATABASE_HOST"
    echo "  - Database name: $DATABASE_NAME"
    echo "  - Username: $DB_USER"
    echo "  - Password is correct"
    echo "  - Your IP is allowed in PostgreSQL firewall rules"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"

# ============================================================================
# Run Database Migrations (Drizzle)
# ============================================================================

echo -e "${BLUE}[3/4] Running database migrations...${NC}"
echo ""

# Navigate to project root (assuming we're in azure-infrastructure/post-deploy)
cd ../..

# Check if drizzle is configured
if [ ! -f "drizzle.config.ts" ]; then
    echo -e "${YELLOW}WARNING: drizzle.config.ts not found${NC}"
    echo "Skipping automated migrations. Run 'npm run db:push' manually after deployment."
else
    # Build DATABASE_URL
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require"
    export DATABASE_URL
    
    echo "Running: npm run db:push"
    
    if npm run db:push; then
        echo -e "${GREEN}✓ Database schema pushed successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Migration had issues. You may need to run manually${NC}"
    fi
fi

# ============================================================================
# Verify Schema
# ============================================================================

echo -e "${BLUE}[4/4] Verifying database schema...${NC}"

# List all tables
TABLES=$(psql -h "$DATABASE_HOST" -U "$DB_USER" -d "$DATABASE_NAME" -t -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
" | grep -v '^$')

if [ -z "$TABLES" ]; then
    echo -e "${YELLOW}⚠ No tables found in database${NC}"
    echo "Schema may not have been initialized properly"
else
    echo -e "${GREEN}✓ Tables found:${NC}"
    echo "$TABLES" | while read -r table; do
        echo "  - $table"
    done
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Database Initialization Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Database Connection Details:"
echo "  Host: $DATABASE_HOST"
echo "  Database: $DATABASE_NAME"
echo "  Username: $DB_USER"
echo ""
echo "Connection String (for App Service):"
echo "  postgresql://${DB_USER}:<password>@${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Store DATABASE_URL in Key Vault:"
echo "     az keyvault secret set --vault-name <kv-name> --name database-url --value '<connection-string>'"
echo "  2. Verify App Service can connect"
echo "  3. Test application endpoints"
echo ""
echo -e "${GREEN}✓ Database ready for application deployment${NC}"
echo ""

# Clean up
unset PGPASSWORD
unset DATABASE_URL

exit 0
