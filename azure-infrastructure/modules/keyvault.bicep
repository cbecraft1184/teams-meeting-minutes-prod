// ============================================================================
// Key Vault Module - Secrets Management
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object
param azureAdTenantId string
param subnetId string
param vnetId string
param logAnalyticsWorkspaceId string

// ============================================================================
// Key Vault
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${namingPrefix}-kv-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    tenantId: azureAdTenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true  // Required for managed identity RBAC assignments
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// ============================================================================
// Private DNS Zone
// ============================================================================

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

resource privateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${namingPrefix}-kv-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

// ============================================================================
// Private Endpoint
// ============================================================================

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: '${namingPrefix}-pe-kv-${environment}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'kv-connection'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config1'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

// ============================================================================
// Diagnostic Settings
// ============================================================================

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagnostics'
  scope: keyVault
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AuditEvent'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
