#!/bin/bash

# ==============================================================================
# Deploy Production Configuration to Azure Container Apps
# ==============================================================================
# This script updates the Teams Minutes Container App with full Microsoft 365
# integration credentials, transitioning from mock services to production.
# ==============================================================================

set -e  # Exit on error

echo "======================================================================"
echo "Teams Meeting Minutes - Production Deployment"
echo "======================================================================"
echo ""
echo "This script will update your Container App with production credentials."
echo "You will need to provide the secret values you saved earlier."
echo ""

# Azure Resource Configuration
RESOURCE_GROUP="rg-teams-minutes-demo"
CONTAINER_APP="teams-minutes-app"
REGION="eastus2"

echo "Target Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Container App:  $CONTAINER_APP"
echo "  Region:         $REGION"
echo ""

# ==============================================================================
# Collect Secret Values (not stored in code)
# ==============================================================================

echo "======================================================================"
echo "Step 1: Provide Secret Values"
echo "======================================================================"
echo ""

# Database credentials (from existing deployment)
read -sp "Enter PostgreSQL admin password: " DB_PASSWORD
echo ""

read -sp "Enter SESSION_SECRET (from existing deployment): " SESSION_SECRET
echo ""

# Azure AD Graph App credentials
read -sp "Enter GRAPH_CLIENT_SECRET (from Graph app registration): " GRAPH_CLIENT_SECRET
echo ""

# Teams Bot credentials
read -sp "Enter BOT_APP_PASSWORD (from Teams Bot registration): " BOT_APP_PASSWORD
echo ""

# Azure OpenAI credentials
read -sp "Enter AZURE_OPENAI_API_KEY (from Azure OpenAI): " AZURE_OPENAI_API_KEY
echo ""

echo ""
echo "✅ All secrets collected"
echo ""

# ==============================================================================
# Build Complete Environment Variable List
# ==============================================================================

echo "======================================================================"
echo "Step 2: Building Production Configuration"
echo "======================================================================"
echo ""

# Fixed Azure AD Configuration
AZURE_TENANT_ID="e6ba87bd-8d65-4db7-bdb8-708b31b9d985"
GRAPH_CLIENT_ID="71383692-c5b6-40cc-94cf-96c970e414dc"
BOT_APP_ID="5ea1c494-6869-4879-8dc2-16c7b57da3e3"

# Fixed Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT="https://eastus.api.cognitive.microsoft.com/"
AZURE_OPENAI_DEPLOYMENT_NAME="teams-minutes-demo"

# Fixed SharePoint & Email Configuration
SHAREPOINT_SITE_URL="https://chrisbecraft.sharepoint.com"
SHAREPOINT_LIBRARY_NAME="Documents"
GRAPH_SENDER_EMAIL="ChristopherBecraft@ChrisBecraft.onmicrosoft.com"

# Database Configuration
DATABASE_URL="postgresql://adminuser:${DB_PASSWORD}@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require"

# Application Configuration
NODE_ENV="production"
PORT="8080"

# Build environment variable arguments for az containerapp update
ENV_VARS=(
    "DATABASE_URL=${DATABASE_URL}"
    "SESSION_SECRET=${SESSION_SECRET}"
    "NODE_ENV=${NODE_ENV}"
    "PORT=${PORT}"
    
    # Azure AD Configuration
    "AZURE_TENANT_ID=${AZURE_TENANT_ID}"
    "GRAPH_CLIENT_ID=${GRAPH_CLIENT_ID}"
    "GRAPH_CLIENT_SECRET=${GRAPH_CLIENT_SECRET}"
    "BOT_APP_ID=${BOT_APP_ID}"
    "BOT_APP_PASSWORD=${BOT_APP_PASSWORD}"
    
    # Azure OpenAI Configuration
    "AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}"
    "AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}"
    "AZURE_OPENAI_DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT_NAME}"
    
    # Enable background job processing (required for AI minutes generation)
    "ENABLE_JOB_WORKER=true"
    
    # SharePoint & Email Configuration
    "SHAREPOINT_SITE_URL=${SHAREPOINT_SITE_URL}"
    "SHAREPOINT_LIBRARY_NAME=${SHAREPOINT_LIBRARY_NAME}"
    "GRAPH_SENDER_EMAIL=${GRAPH_SENDER_EMAIL}"
)

echo "Production environment variables configured:"
echo "  ✅ Database connection"
echo "  ✅ Azure AD (Graph + Bot) - 5 credentials"
echo "  ✅ Azure OpenAI - 3 credentials"
echo "  ✅ SharePoint & Email - 3 credentials"
echo "  ✅ Application settings"
echo ""
echo "Total: 15 environment variables"
echo ""
echo "🚫 USE_MOCK_SERVICES has been REMOVED - full production mode enabled"
echo ""

# ==============================================================================
# Deploy to Azure Container Apps
# ==============================================================================

echo "======================================================================"
echo "Step 3: Deploying to Azure Container Apps"
echo "======================================================================"
echo ""

read -p "Ready to deploy? This will create a new revision with production config. (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🚀 Deploying production configuration..."
echo ""

# Execute deployment
az containerapp update \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars "${ENV_VARS[@]}"

DEPLOYMENT_STATUS=$?

if [ $DEPLOYMENT_STATUS -eq 0 ]; then
    echo ""
    echo "======================================================================"
    echo "✅ Deployment Successful!"
    echo "======================================================================"
    echo ""
    echo "Next steps:"
    echo "  1. Wait 60-90 seconds for new revision to become healthy"
    echo "  2. Check status: az containerapp revision list --name $CONTAINER_APP --resource-group $RESOURCE_GROUP -o table"
    echo "  3. Test application: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health"
    echo ""
    echo "Production integrations now active:"
    echo "  ✅ Microsoft Graph API (meeting capture)"
    echo "  ✅ Azure OpenAI (AI-powered minutes generation)"
    echo "  ✅ SharePoint (document archival)"
    echo "  ✅ Email (distribution via Graph API)"
    echo ""
else
    echo ""
    echo "======================================================================"
    echo "❌ Deployment Failed"
    echo "======================================================================"
    echo ""
    echo "Check logs: az containerapp logs tail --name $CONTAINER_APP --resource-group $RESOURCE_GROUP"
    echo ""
    exit 1
fi
