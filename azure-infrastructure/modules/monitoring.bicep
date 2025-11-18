// ============================================================================
// Monitoring Module - Log Analytics + Application Insights
// ============================================================================

param location string
param namingPrefix string
param environment string
param tags object
param adminEmail string

// ============================================================================
// Log Analytics Workspace
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namingPrefix}-logs-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 10
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// Application Insights
// ============================================================================

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namingPrefix}-ai-${environment}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// Action Group for Alerts
// ============================================================================

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${namingPrefix}-alerts-${environment}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'TmmAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'Admin'
        emailAddress: adminEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output applicationInsightsId string = applicationInsights.id
output applicationInsightsName string = applicationInsights.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output applicationInsightsInstrumentationKey string = applicationInsights.properties.InstrumentationKey
output actionGroupId string = actionGroup.id
