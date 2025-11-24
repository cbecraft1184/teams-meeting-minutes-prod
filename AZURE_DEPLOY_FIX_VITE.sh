#!/bin/bash
set -e

echo "================================"
echo "Azure Container Apps Deployment"
echo "Fix: Vite excluded from production bundle"
echo "================================"
echo ""

cd ~/TeamsMeetingDemo

echo "Step 1: Pull latest code changes..."
# In Cloud Shell, you would copy the updated files here
echo "Make sure you have the latest server/index.ts, server/static.ts, scripts/build-server.mjs, and Dockerfile"
echo ""

echo "Step 2: Rebuild Docker image with Vite fix..."
az acr build \
  --registry teamminutesacr \
  --resource-group rg-teams-minutes-demo \
  --image teams-minutes:latest \
  --file Dockerfile \
  .

echo ""
echo "Step 3: Update Container App with new image..."
az containerapp update \
  --name teams-minutes-app \
  --resource-group rg-teams-minutes-demo \
  --image teamminutesacr.azurecr.io/teams-minutes:latest

echo ""
echo "Step 4: Wait for deployment..."
sleep 60

echo ""
echo "Step 5: Test health endpoint..."
curl -v https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/health

echo ""
echo "================================"
echo "Deployment complete!"
echo "================================"
