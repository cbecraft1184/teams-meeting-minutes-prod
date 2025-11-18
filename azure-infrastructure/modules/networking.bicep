// ============================================================================
// Networking Module - VNet, Subnets, NSGs
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object

// ============================================================================
// Virtual Network
// ============================================================================

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: '${namingPrefix}-vnet-${environment}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/22'
      ]
    }
    subnets: [
      {
        name: 'snet-appservice-integration'
        properties: {
          addressPrefix: '10.20.0.0/26'
          delegations: [
            {
              name: 'delegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
          networkSecurityGroup: {
            id: nsgAppService.id
          }
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: '10.20.0.64/27'
          privateEndpointNetworkPolicies: 'Disabled'
          networkSecurityGroup: {
            id: nsgPrivateEndpoints.id
          }
        }
      }
      {
        name: 'snet-management'
        properties: {
          addressPrefix: '10.20.0.96/27'
          networkSecurityGroup: {
            id: nsgManagement.id
          }
        }
      }
    ]
  }
}

// ============================================================================
// Network Security Groups
// ============================================================================

resource nsgAppService 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: '${namingPrefix}-nsg-appservice-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
    ]
  }
}

resource nsgPrivateEndpoints 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: '${namingPrefix}-nsg-pe-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

resource nsgManagement 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: '${namingPrefix}-nsg-mgmt-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowSSH'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output vnetId string = vnet.id
output vnetName string = vnet.name
output appServiceSubnetId string = '${vnet.id}/subnets/snet-appservice-integration'
output privateEndpointSubnetId string = '${vnet.id}/subnets/snet-private-endpoints'
output managementSubnetId string = '${vnet.id}/subnets/snet-management'
