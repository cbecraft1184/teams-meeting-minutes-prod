// ============================================================================
// Teams Meeting Minutes Demo - Parameter File
// Environment: Commercial Azure Demo
// ============================================================================
// 
// INSTRUCTIONS FOR DEPLOYMENT:
// 1. Replace placeholder values marked with <YOUR_...> with actual values
// 2. Obtain Azure AD Tenant ID: Azure Portal → Azure Active Directory → Overview → Tenant ID
// 3. Provide your admin email for alerts and notifications
// 4. Validate before deploying:
//    az deployment sub validate --location eastus --template-file ../main.bicep --parameters ./demo.bicepparam
// 5. Deploy using deploy.sh script:
//    cd azure-infrastructure && ./deploy.sh demo
//
// ============================================================================

using '../main.bicep'

// ============================================================================
// REQUIRED PARAMETERS - Must be configured before deployment
// ============================================================================

// Azure AD Tenant ID for authentication and RBAC
// Find: Azure Portal → Azure Active Directory → Overview → Tenant ID
// Example: '72f988bf-86f1-41af-91ab-2d7cd011db47'
param azureAdTenantId = '<YOUR_AZURE_AD_TENANT_ID>'

// Administrator email for alerts and notifications
// Example: 'admin@contoso.com'
param adminEmail = '<YOUR_ADMIN_EMAIL>'

// ============================================================================
// OPTIONAL PARAMETERS - Customize as needed
// ============================================================================

// Environment name - keep as 'demo' for commercial demonstration
param environment = 'demo'

// Primary Azure region - East US recommended for demo
// Other options: 'westus2', 'centralus', 'westeurope'
param location = 'eastus'

// Resource naming prefix - short identifier (2-5 characters)
// This will be used to name all Azure resources (e.g., tmm-app-demo, tmm-kv-demo)
param namingPrefix = 'tmm'

// Enable zone redundancy for high availability
// Set to false for cost-effective demo, true for production
param enableZoneRedundancy = false

// Resource tags for organization and cost tracking
param tags = {
  Environment: 'Demo'
  Application: 'TeamsMinutesManagement'
  Criticality: 'High'
  Owner: 'MeetingsTeam'
  CostCenter: 'Demo'
  DeployedBy: 'ReplitAgent'
  DeploymentDate: '2025-11-18'
}

// ============================================================================
// WHAT GETS DEPLOYED
// ============================================================================
//
// NETWORKING:
// - Virtual Network (10.20.0.0/22)
// - App Service Integration Subnet (delegated to Microsoft.Web/serverFarms)
// - Private Endpoint Subnet
// - Management Subnet
// - Network Security Groups
//
// IDENTITY & SECURITY:
// - User-Assigned Managed Identity (for App Service)
// - Key Vault with RBAC (private endpoint enabled)
// - RBAC role assignments (Key Vault Secrets User, Storage Blob Data Contributor, Cognitive Services OpenAI User)
//
// DATA SERVICES:
// - PostgreSQL Flexible Server 14 (VNet-integrated, 256GB storage, auto-grow enabled)
// - Storage Account (GRS, blob containers for transcripts and exports)
// - Lifecycle policies (Cool tier after 30 days, Archive after 90 days)
//
// AI SERVICES:
// - Azure OpenAI Account with private endpoint
//   - GPT-4o deployment (40 TPM capacity)
//   - GPT-4o-mini deployment (80 TPM capacity)
//   - Whisper deployment (10 TPM capacity)
//
// COMPUTE:
// - App Service Plan (P1v3 - 2 vCPU, 8GB RAM, Linux)
// - App Service with staging slot (blue-green deployment)
// - VNet integration enabled
// - Auto-scaling rules (CPU and HTTP queue-based)
//
// MONITORING:
// - Log Analytics Workspace
// - Application Insights
// - Diagnostic settings for all resources
//
// INGRESS:
// - Azure Front Door (Standard tier)
// - Global CDN distribution
// - WAF policies
//
// ============================================================================
// ESTIMATED COSTS (Monthly)
// ============================================================================
//
// - App Service Plan (P1v3): ~$146/month
// - PostgreSQL Flexible Server (B2ms): ~$60/month
// - Storage Account (GRS): ~$20/month
// - Azure OpenAI (pay-per-use): Variable based on usage
// - Key Vault: ~$3/month
// - Front Door (Standard): ~$35/month + data transfer
// - Log Analytics: ~$10/month (first 5GB free)
// - Private Endpoints (4x): ~$32/month
//
// TOTAL ESTIMATED: ~$500-800/month with moderate usage
// (Auto-scaling and actual API usage will affect final cost)
//
// ============================================================================
// POST-DEPLOYMENT REQUIRED STEPS
// ============================================================================
//
// 1. POPULATE KEY VAULT SECRETS:
//    - database-url: PostgreSQL connection string
//    - session-secret: Random secret for session encryption
//    - openai-api-key: Azure OpenAI API key (managed identity preferred)
//    - azure-ad-client-id: Teams app client ID
//    - azure-ad-client-secret: Teams app client secret
//    - azure-ad-tenant-id: Your Azure AD tenant ID
//    - storage-account-key: Storage account key
//
// 2. REGISTER AZURE AD APPLICATION:
//    - Create app registration in Azure AD
//    - Configure Microsoft Graph API permissions:
//      - Calendars.Read, OnlineMeetings.Read, Files.ReadWrite.All
//    - Set up redirect URIs for authentication
//
// 3. DEPLOY APPLICATION CODE:
//    - Build Docker container or deploy Node.js app
//    - Configure GitHub Actions CI/CD pipeline
//    - Deploy to staging slot first, then swap to production
//
// 4. CONFIGURE MICROSOFT TEAMS:
//    - Set up webhook subscription for meeting events
//    - Test meeting capture workflow
//
// 5. CONFIGURE SHAREPOINT:
//    - Create document library for minutes archival
//    - Configure OAuth permissions (Sites.Selected)
//
// ============================================================================
