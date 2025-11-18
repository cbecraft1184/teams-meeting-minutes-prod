// ============================================================================
// RBAC Role Assignments Module
// Grants App Service Managed Identity access to Azure resources
// ============================================================================

param appServicePrincipalId string
param keyVaultName string
param storageAccountName string
param openaiAccountName string

// ============================================================================
// Reference Existing Resources
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource openaiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: openaiAccountName
}

// ============================================================================
// Role Assignments
// ============================================================================

// Grant Key Vault Secrets User role
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appServicePrincipalId, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Storage Blob Data Contributor role
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, appServicePrincipalId, 'StorageBlobDataContributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Cognitive Services OpenAI User role
resource openaiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openaiAccount.id, appServicePrincipalId, 'CognitiveServicesOpenAIUser')
  scope: openaiAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Outputs
// ============================================================================

output keyVaultRoleAssignmentId string = keyVaultRoleAssignment.id
output storageRoleAssignmentId string = storageRoleAssignment.id
output openaiRoleAssignmentId string = openaiRoleAssignment.id
