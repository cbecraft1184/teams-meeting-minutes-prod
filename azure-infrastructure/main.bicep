// ============================================================================
// Teams Meeting Minutes Demo - Main Bicep Template
// Commercial Azure Deployment (East US)
// ============================================================================

targetScope = 'subscription'

@description('Environment name (demo, staging, production)')
@allowed(['demo', 'staging', 'production'])
param environment string = 'demo'

@description('Primary Azure region for deployment')
param location string = 'eastus'

@description('Resource naming prefix')
param namingPrefix string = 'tmm'

@description('Tags to apply to all resources')
param tags object = {
  Environment: environment
  Application: 'TeamsMinutesManagement'
  Criticality: 'High'
  Owner: 'MeetingsTeam'
  CostCenter: 'Demo'
}

@description('Azure AD tenant ID for authentication')
param azureAdTenantId string

@description('Administrator email for notifications')
param adminEmail string

@description('Enable zone redundancy for production workloads')
param enableZoneRedundancy bool = false

// ============================================================================
// Resource Group
// ============================================================================

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${namingPrefix}-${environment}-${location}'
  location: location
  tags: tags
}

// ============================================================================
// Shared Services (Networking, Monitoring, Security)
// ============================================================================

module monitoring './modules/monitoring.bicep' = {
  scope: rg
  name: 'monitoring-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    adminEmail: adminEmail
  }
}

module networking './modules/networking.bicep' = {
  scope: rg
  name: 'networking-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

module keyVault './modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    azureAdTenantId: azureAdTenantId
    subnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================================================
// Data Services (PostgreSQL, Storage)
// ============================================================================

module storage './modules/storage.bicep' = {
  scope: rg
  name: 'storage-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    subnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

module database './modules/database.bicep' = {
  scope: rg
  name: 'database-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    subnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    enableZoneRedundancy: enableZoneRedundancy
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================================================
// AI Services (Azure OpenAI)
// ============================================================================

module openai './modules/openai.bicep' = {
  scope: rg
  name: 'openai-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    subnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================================================
// Managed Identity (User-Assigned)
// ============================================================================

module managedIdentity './modules/managed-identity.bicep' = {
  scope: rg
  name: 'identity-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// ============================================================================
// Compute Services (App Service)
// ============================================================================

module appService './modules/appservice.bicep' = {
  scope: rg
  name: 'appservice-${environment}'
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    vnetIntegrationSubnetId: networking.outputs.appServiceSubnetId
    userAssignedIdentityId: managedIdentity.outputs.identityId
    keyVaultName: keyVault.outputs.keyVaultName
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    databaseHost: database.outputs.databaseHost
    databaseName: database.outputs.databaseName
    storageAccountName: storage.outputs.storageAccountName
    openaiEndpoint: openai.outputs.openaiEndpoint
  }
}

// ============================================================================
// Ingress (Azure Front Door)
// ============================================================================

module frontDoor './modules/frontdoor.bicep' = {
  scope: rg
  name: 'frontdoor-${environment}'
  params: {
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServiceHostname: appService.outputs.appServiceHostname
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================================================
// RBAC Role Assignments - Grant Managed Identity Access
// ============================================================================

module rbacAssignments './modules/rbac-assignments.bicep' = {
  scope: rg
  name: 'rbac-assignments-${environment}'
  params: {
    appServicePrincipalId: managedIdentity.outputs.principalId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    openaiAccountName: openai.outputs.openaiName
  }
  dependsOn: [
    managedIdentity
    keyVault
    storage
    openai
  ]
}

// ============================================================================
// Outputs
// ============================================================================

output resourceGroupName string = rg.name
output appServiceName string = appService.outputs.appServiceName
output appServiceUrl string = 'https://${appService.outputs.appServiceHostname}'
output frontDoorEndpoint string = frontDoor.outputs.frontDoorEndpoint
output keyVaultName string = keyVault.outputs.keyVaultName
output databaseHost string = database.outputs.databaseHost
output openaiEndpoint string = openai.outputs.openaiEndpoint
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
