#!/bin/bash
set -e

echo "=========================================="
echo "Azure Container Apps Deployment Script"
echo "=========================================="
echo ""

# Configuration
AZURE_SUBSCRIPTION_ID="17f080ac-db85-4c7d-a12e-fc88bf22b2bc"
AZURE_RESOURCE_GROUP="rg-teams-minutes-demo"
ACR_NAME="teamminutesacr"
CONTAINER_APP_NAME="teams-minutes-app"
IMAGE_NAME="teams-minutes"
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")

echo "Configuration:"
echo "  Resource Group: $AZURE_RESOURCE_GROUP"
echo "  ACR Name: $ACR_NAME"
echo "  Container App: $CONTAINER_APP_NAME"
echo "  Image Tag: $COMMIT_SHA"
echo ""

# Step 1: Build and push Docker image to ACR
echo "Step 1: Building Docker image in Azure Container Registry..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$COMMIT_SHA \
  --image $IMAGE_NAME:latest \
  --file Dockerfile \
  .

echo ""
echo "✅ Docker image built and pushed to ACR"
echo ""

# Step 2: Deploy to Container Apps
echo "Step 2: Deploying to Azure Container Apps..."
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$COMMIT_SHA

echo ""
echo "✅ Deployment complete!"
echo ""

# Step 3: Verify health endpoint
echo "Step 3: Verifying health endpoint..."
sleep 10  # Wait for deployment to stabilize
HEALTH_URL="https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/api/health"

echo "Testing: $HEALTH_URL"
HEALTH_STATUS=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" | tail -1)

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✅ Health check passed!"
  curl -s "$HEALTH_URL" | jq .
else
  echo "❌ Health check failed (HTTP $HEALTH_STATUS)"
  echo "Full response:"
  curl -s "$HEALTH_URL"
  exit 1
fi

echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo "Container App URL: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io"
echo "Health Endpoint: $HEALTH_URL"
echo "Teams App: https://teams.microsoft.com (check Meeting Minutes app)"
echo ""
