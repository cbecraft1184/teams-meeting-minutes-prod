// ============================================================================
// User-Assigned Managed Identity Module
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object

// ============================================================================
// User-Assigned Managed Identity
// ============================================================================

resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namingPrefix}-identity-${environment}'
  location: location
  tags: tags
}

// ============================================================================
// Outputs
// ============================================================================

output identityId string = userAssignedIdentity.id
output identityName string = userAssignedIdentity.name
output principalId string = userAssignedIdentity.properties.principalId
output clientId string = userAssignedIdentity.properties.clientId
