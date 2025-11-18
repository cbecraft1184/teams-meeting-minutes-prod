// ============================================================================
// Demo Environment Parameters
// ============================================================================

using '../main.bicep'

param environment = 'demo'
param location = 'eastus'
param namingPrefix = 'tmm'

param azureAdTenantId = '<YOUR_AZURE_AD_TENANT_ID>'
param adminEmail = '<YOUR_ADMIN_EMAIL>'
param enableZoneRedundancy = false

param tags = {
  Environment: 'Demo'
  Application: 'TeamsMinutesManagement'
  Criticality: 'High'
  Owner: 'MeetingsTeam'
  CostCenter: 'Demo'
}
