// ============================================================================
// Azure OpenAI Module - AI Processing for Meeting Minutes
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object
param subnetId string
param vnetId string
param logAnalyticsWorkspaceId string

// ============================================================================
// Azure OpenAI Account
// ============================================================================

resource openaiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${namingPrefix}-openai-${environment}'
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${namingPrefix}-openai-${environment}-${uniqueString(resourceGroup().id)}'
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// ============================================================================
// Model Deployments
// ============================================================================

// GPT-4o for high-fidelity minute generation
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openaiAccount
  name: 'gpt-4o'
  sku: {
    name: 'Standard'
    capacity: 40
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-08-06'
    }
    versionUpgradeOption: 'OnceCurrentVersionExpired'
    raiPolicyName: 'Microsoft.Default'
  }
}

// GPT-4o-mini for cost-efficient processing
resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openaiAccount
  name: 'gpt-4o-mini'
  sku: {
    name: 'Standard'
    capacity: 80
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
    versionUpgradeOption: 'OnceCurrentVersionExpired'
    raiPolicyName: 'Microsoft.Default'
  }
  dependsOn: [
    gpt4oDeployment
  ]
}

// Whisper for transcription
resource whisperDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openaiAccount
  name: 'whisper'
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'whisper'
      version: 'turbo-2024-04-09'
    }
    versionUpgradeOption: 'OnceCurrentVersionExpired'
    raiPolicyName: 'Microsoft.Default'
  }
  dependsOn: [
    gpt4oMiniDeployment
  ]
}

// ============================================================================
// Private DNS Zone
// ============================================================================

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  tags: tags
}

resource privateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${namingPrefix}-openai-vnet-link'
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
  name: '${namingPrefix}-pe-openai-${environment}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'openai-connection'
        properties: {
          privateLinkServiceId: openaiAccount.id
          groupIds: [
            'account'
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
  scope: openaiAccount
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'Audit'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
      {
        category: 'RequestResponse'
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

output openaiId string = openaiAccount.id
output openaiName string = openaiAccount.name
output openaiEndpoint string = openaiAccount.properties.endpoint
output openaiPrincipalId string = openaiAccount.identity.principalId
