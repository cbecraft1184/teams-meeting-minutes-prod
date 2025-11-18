// ============================================================================
// Front Door Module - Global CDN, WAF, Load Balancing
// ============================================================================

param namingPrefix string
param environment string
param tags object
param appServiceHostname string
param logAnalyticsWorkspaceId string

// ============================================================================
// Front Door Profile
// ============================================================================

resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '${namingPrefix}-fd-${environment}'
  location: 'global'
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

// ============================================================================
// Front Door Endpoint
// ============================================================================

resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoorProfile
  name: '${namingPrefix}-${environment}'
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// ============================================================================
// Origin Group
// ============================================================================

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: 'app-origins'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// ============================================================================
// Origin (App Service)
// ============================================================================

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: originGroup
  name: 'app-service-origin'
  properties: {
    hostName: appServiceHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: appServiceHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ============================================================================
// Route
// ============================================================================

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: frontDoorEndpoint
  name: 'default-route'
  properties: {
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    origin
  ]
}

// ============================================================================
// WAF Policy
// ============================================================================

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: '${namingPrefix}waf${environment}'
  location: 'global'
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
        }
      ]
    }
  }
}

// ============================================================================
// Security Policy (Associate WAF with Endpoint)
// ============================================================================

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = {
  parent: frontDoorProfile
  name: 'waf-policy'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: frontDoorEndpoint.id
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
    }
  }
}

// ============================================================================
// Diagnostic Settings
// ============================================================================

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagnostics'
  scope: frontDoorProfile
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'FrontDoorAccessLog'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
      {
        category: 'FrontDoorHealthProbeLog'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
      {
        category: 'FrontDoorWebApplicationFirewallLog'
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

output frontDoorId string = frontDoorProfile.id
output frontDoorName string = frontDoorProfile.name
output frontDoorEndpoint string = frontDoorEndpoint.properties.hostName
output frontDoorEndpointUrl string = 'https://${frontDoorEndpoint.properties.hostName}'
