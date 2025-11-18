// ============================================================================
// Database Module - PostgreSQL Flexible Server
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object
param subnetId string
param vnetId string
param enableZoneRedundancy bool
param logAnalyticsWorkspaceId string

@secure()
@description('Administrator password for PostgreSQL')
param administratorPassword string = uniqueString(resourceGroup().id, deployment().name)

// ============================================================================
// Private DNS Zone
// ============================================================================

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource privateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${namingPrefix}-pg-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

// ============================================================================
// PostgreSQL Flexible Server
// ============================================================================

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: '${namingPrefix}-pg-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_B2ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'dbadmin'
    administratorLoginPassword: administratorPassword
    version: '14'
    storage: {
      storageSizeGB: 256
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 35
      geoRedundantBackup: 'Enabled'
    }
    highAvailability: {
      mode: enableZoneRedundancy ? 'ZoneRedundant' : 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
    createMode: 'Default'
  }
  dependsOn: [
    privateDnsZoneVnetLink
  ]
}

// ============================================================================
// Database
// ============================================================================

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: 'meeting_minutes'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ============================================================================
// PostgreSQL Configuration
// ============================================================================

resource pgBouncerConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'pgbouncer.enabled'
  properties: {
    value: 'true'
    source: 'user-override'
  }
}

resource sharedBuffers 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'shared_buffers'
  properties: {
    value: '512'
    source: 'user-override'
  }
}

resource workMem 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'work_mem'
  properties: {
    value: '16384'
    source: 'user-override'
  }
}

resource pgStatStatements 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'shared_preload_libraries'
  properties: {
    value: 'pg_stat_statements'
    source: 'user-override'
  }
}

// ============================================================================
// Diagnostic Settings
// ============================================================================

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagnostics'
  scope: postgresServer
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'PostgreSQLLogs'
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

output databaseId string = postgresServer.id
output databaseHost string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output administratorLogin string = 'dbadmin'
