# DOD SharePoint Integration Plan
## Microsoft Teams Meeting Minutes - SharePoint Archival Integration

**Classification:** UNCLASSIFIED  
**Document Version:** 1.0  
**Date:** November 2025  
**Audience:** System Administrators, SharePoint Administrators, ISSO

---

## Overview

This document provides comprehensive guidance for integrating the Meeting Minutes Management System with Department of Defense SharePoint Online instances. The integration enables automatic archival of approved meeting minutes to designated SharePoint document libraries with proper classification handling, metadata tagging, and access controls aligned with DOD security requirements.

**SharePoint Environment:**
- **Platform:** SharePoint Online (Microsoft 365 GCC High)
- **Domain Structure:** .gov and .mil tenant domains
- **Authentication:** CAC/PIV certificate-based via Azure AD Government
- **Compliance:** FedRAMP High, DISA SRG IL5

---

## Prerequisites

### SharePoint Environment Requirements

**SharePoint Online Tenant:**
- Microsoft 365 GCC High subscription
- SharePoint Online enabled for organization
- Custom .gov or .mil domain configured
- Multi-level classification sites (UNCLASSIFIED, CONFIDENTIAL, SECRET)

**Site Collections:**
- Dedicated site collection for meeting minutes archival
- Separate document libraries by classification level
- Proper sensitivity labels configured
- Retention policies aligned with DOD records management

**SharePoint Administrator Access:**
- Site Collection Administrator role
- Ability to configure App Permissions (Sites.Selected)
- Access to Azure AD Application Registration
- Permissions to configure sensitivity labels and retention policies

### Microsoft Graph API Permissions

**Required API Permissions (Application-Level):**
```yaml
Sites.Selected:
  - Read and write to selected SharePoint sites only
  - Least privilege access (no tenant-wide permissions)
  - Requires explicit site permission grants

Sites.ReadWrite.All (Alternative - NOT RECOMMENDED):
  - Grants access to all SharePoint sites
  - Only use if Sites.Selected unavailable
  - Requires higher security authorization level
```

**Authentication Method:**
- Azure AD Application Registration (GCC High tenant)
- Certificate-based client credentials (preferred)
- Client secret (fallback, 90-day rotation required)

---

## SharePoint Site Structure

### Recommended Hierarchy

```
Site Collection: Meeting Minutes Archive
├── Classification: UNCLASSIFIED
│   ├── Document Library: Meeting Minutes (UNCLASS)
│   │   ├── Folders by Organization/Command
│   │   ├── Metadata: Date, Attendees, Classification, Retention
│   │   └── Permissions: All cleared personnel
│   └── Document Library: Action Items (UNCLASS)
│
├── Classification: CONFIDENTIAL
│   ├── Document Library: Meeting Minutes (CONF)
│   │   ├── Folders by Organization/Command
│   │   ├── Metadata: Date, Attendees, Classification, Retention
│   │   └── Permissions: CONFIDENTIAL clearance required
│   └── Document Library: Action Items (CONF)
│
└── Classification: SECRET
    ├── Document Library: Meeting Minutes (SECRET)
    │   ├── Folders by Organization/Command
    │   ├── Metadata: Date, Attendees, Classification, Retention
    │   └── Permissions: SECRET clearance required
    └── Document Library: Action Items (SECRET)
```

### Document Library Configuration

**Required Metadata Columns:**
```yaml
Columns:
  - Meeting Date (Date and Time)
  - Meeting Title (Single line of text)
  - Organizer (Person or Group)
  - Attendees (Person or Group, allow multiple)
  - Classification Level (Choice: UNCLASSIFIED, CONFIDENTIAL, SECRET)
  - Organization (Single line of text)
  - Command (Single line of text)
  - Retention Period (Choice: 3 years, 5 years, 7 years, Permanent)
  - Document ID (Single line of text, auto-generated)
  - Approval Status (Choice: Pending, Approved, Archived)
```

**Content Type:**
- Base: Document
- Name: "Meeting Minutes"
- Template: None (uploaded as DOCX/PDF)
- Workflow: Approval workflow (optional)

**Versioning:**
- Enable major versions
- Require checkout: No (documents uploaded as final)
- Approval: Required for major versions
- Retention: Based on classification and retention policy

---

## Azure AD Application Registration

### Step 1: Create App Registration (GCC High Tenant)

1. Navigate to Azure AD Government Portal: https://portal.azure.us
2. Go to Azure Active Directory → App Registrations → New Registration
3. Configure application:
   ```yaml
   Name: Meeting Minutes SharePoint Integration
   Supported Account Types: Single tenant (this organization only)
   Redirect URI: None (service-to-service)
   ```

### Step 2: Configure API Permissions

1. Go to App Registration → API Permissions
2. Add Microsoft Graph permissions:
   ```yaml
   Permission: Sites.Selected (Application)
   Type: Application (not Delegated)
   Admin Consent: Required
   ```
3. Grant admin consent (requires Global Administrator or SharePoint Administrator)
4. Verify permissions granted successfully

### Step 3: Create Certificate for Authentication

**Generate Certificate (Preferred Method):**

```bash
# Generate RSA 4096-bit key pair
openssl req -x509 -newkey rsa:4096 \
  -keyout sharepoint-integration-key.pem \
  -out sharepoint-integration-cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=Meeting Minutes SharePoint Integration/O=DOD/C=US"

# Extract public key for Azure AD
openssl x509 -in sharepoint-integration-cert.pem -out sharepoint-integration-cert.cer -outform DER
```

**Upload to Azure AD:**

1. Go to App Registration → Certificates & secrets
2. Upload certificate (.cer file)
3. Note certificate thumbprint for application configuration
4. Set certificate expiration reminder (30 days before expiry)

**Store Private Key Securely:**

```bash
# Upload to Azure Key Vault
az keyvault certificate import \
  --vault-name kv-meeting-minutes-virginia \
  --name sharepoint-integration-cert \
  --file sharepoint-integration-cert.pem
```

### Step 4: Grant Site-Specific Permissions

**Using PowerShell (SharePoint Online Management Shell):**

```powershell
# Connect to SharePoint Online (GCC High)
Connect-SPOService -Url https://<tenant>-admin.sharepoint.us

# Get application client ID from Azure AD App Registration
$appId = "<application-client-id>"

# Grant write permission to specific site
Grant-SPOSiteDesignRights `
  -Identity "Meeting Minutes Archive" `
  -Principals $appId `
  -Rights FullControl

# Verify permissions
Get-SPOSite -Identity https://<tenant>.sharepoint.us/sites/meeting-minutes-archive | `
  Select -ExpandProperty AppPermissions
```

**Alternative: Using Microsoft Graph API:**

```bash
# Get site ID
SITE_ID=$(curl -X GET \
  "https://graph.microsoft.us/v1.0/sites/<tenant>.sharepoint.us:/sites/meeting-minutes-archive" \
  -H "Authorization: Bearer <admin-token>" | jq -r '.id')

# Grant application permissions
curl -X POST \
  "https://graph.microsoft.us/v1.0/sites/$SITE_ID/permissions" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["write"],
    "grantedToIdentities": [{
      "application": {
        "id": "<application-client-id>",
        "displayName": "Meeting Minutes SharePoint Integration"
      }
    }]
  }'
```

---

## Integration Implementation

### Application Configuration

**Environment Variables:**

```bash
# SharePoint Site Configuration
SHAREPOINT_SITE_URL="https://<tenant>.sharepoint.us/sites/meeting-minutes-archive"
SHAREPOINT_TENANT_ID="<azure-ad-tenant-id>"
SHAREPOINT_CLIENT_ID="<application-client-id>"
SHAREPOINT_CERT_THUMBPRINT="<certificate-thumbprint>"

# Document Library Names (by classification)
SHAREPOINT_LIB_UNCLASS="Meeting Minutes (UNCLASS)"
SHAREPOINT_LIB_CONFIDENTIAL="Meeting Minutes (CONF)"
SHAREPOINT_LIB_SECRET="Meeting Minutes (SECRET)"

# Microsoft Graph Endpoint (GCC High)
GRAPH_API_ENDPOINT="https://graph.microsoft.us"
```

**Key Vault References (Recommended):**

```yaml
SHAREPOINT_CLIENT_ID: "@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-virginia.vault.usgovcloudapi.net/secrets/sharepoint-client-id)"
SHAREPOINT_CERT_THUMBPRINT: "@Microsoft.KeyVault(SecretUri=https://kv-meeting-minutes-virginia.vault.usgovcloudapi.net/secrets/sharepoint-cert-thumbprint)"
```

### Document Upload Logic

**Classification-Aware Upload:**

```typescript
// Pseudo-code for SharePoint upload
async function uploadToSharePoint(minute: MeetingMinute, document: Buffer) {
  // Determine target library based on classification
  const libraryName = getLibraryByClassification(minute.classificationLevel);
  
  // Construct folder path (optional: organize by organization/command)
  const folderPath = `${minute.organization}/${minute.command}`;
  
  // Upload document with metadata
  const uploadResult = await graphClient
    .api(`/sites/${siteId}/drives/${driveId}/root:/${folderPath}/${minute.id}.docx:/content`)
    .headers({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    .put(document);
  
  // Update metadata
  await graphClient
    .api(`/sites/${siteId}/drives/${driveId}/items/${uploadResult.id}/listItem/fields`)
    .patch({
      MeetingDate: minute.meetingDate,
      MeetingTitle: minute.title,
      Organizer: minute.organizer,
      Attendees: minute.attendees,
      ClassificationLevel: minute.classificationLevel,
      Organization: minute.organization,
      Command: minute.command,
      RetentionPeriod: determineRetentionPeriod(minute),
      DocumentID: minute.id,
      ApprovalStatus: 'Archived'
    });
  
  return uploadResult;
}

function getLibraryByClassification(level: string): string {
  switch(level) {
    case 'UNCLASSIFIED': return process.env.SHAREPOINT_LIB_UNCLASS;
    case 'CONFIDENTIAL': return process.env.SHAREPOINT_LIB_CONFIDENTIAL;
    case 'SECRET': return process.env.SHAREPOINT_LIB_SECRET;
    default: throw new Error(`Unknown classification level: ${level}`);
  }
}
```

### Error Handling and Retry Logic

**Retry Strategy:**

```typescript
async function uploadWithRetry(minute: MeetingMinute, document: Buffer, maxRetries = 3) {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadToSharePoint(minute, document);
    } catch (error) {
      lastError = error;
      
      // Log error
      logger.error(`SharePoint upload failed (attempt ${attempt}/${maxRetries})`, {
        minuteId: minute.id,
        error: error.message,
        classification: minute.classificationLevel
      });
      
      // Exponential backoff
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await sleep(delayMs);
      }
    }
  }
  
  // After all retries failed, log to dead-letter queue
  await addToDeadLetterQueue({
    type: 'sharepoint_upload_failed',
    minuteId: minute.id,
    error: lastError.message,
    timestamp: new Date()
  });
  
  throw lastError;
}
```

**Common Error Scenarios:**

```yaml
401 Unauthorized:
  Cause: Certificate expired or invalid
  Resolution: Rotate certificate, update Key Vault

403 Forbidden:
  Cause: Insufficient site permissions
  Resolution: Re-grant Sites.Selected permissions via PowerShell

404 Not Found:
  Cause: Site or library does not exist
  Resolution: Verify SHAREPOINT_SITE_URL and library names

503 Service Unavailable:
  Cause: SharePoint throttling or temporary outage
  Resolution: Retry with exponential backoff (already implemented)
```

---

## Security Considerations

### Classification Boundary Enforcement

**Prevent Information Spillage:**

```typescript
// Validate classification before upload
function validateClassificationBoundary(minute: MeetingMinute, targetLibrary: string) {
  const allowedLibraries = {
    'UNCLASSIFIED': ['Meeting Minutes (UNCLASS)'],
    'CONFIDENTIAL': ['Meeting Minutes (UNCLASS)', 'Meeting Minutes (CONF)'],
    'SECRET': ['Meeting Minutes (UNCLASS)', 'Meeting Minutes (CONF)', 'Meeting Minutes (SECRET)']
  };
  
  if (!allowedLibraries[minute.classificationLevel]?.includes(targetLibrary)) {
    throw new Error(`Classification boundary violation: Cannot upload ${minute.classificationLevel} to ${targetLibrary}`);
  }
}
```

**Audit All Uploads:**

```typescript
// Comprehensive audit logging
await logAuditEvent({
  eventType: 'SHAREPOINT_UPLOAD',
  userId: 'SYSTEM',
  minuteId: minute.id,
  classification: minute.classificationLevel,
  targetSite: process.env.SHAREPOINT_SITE_URL,
  targetLibrary: libraryName,
  documentSize: document.length,
  success: true,
  timestamp: new Date()
});
```

### Network Security

**Private Endpoint for SharePoint (Recommended):**
- Azure Private Link for SharePoint Online (if available in GCC High)
- Traffic never traverses public internet
- Integration with VNet and NSGs

**Egress Control:**
- Restrict outbound traffic to SharePoint endpoints only
- Use Azure Firewall with FQDN filtering
- Monitor and alert on unusual egress patterns

### Certificate Management

**Certificate Rotation Policy:**
- Certificates valid for 365 days maximum
- Rotation required 30 days before expiration
- Automated reminders via Azure Monitor
- Blue-green rotation (upload new cert before removing old)

**Rotation Procedure:**

```bash
# 1. Generate new certificate
openssl req -x509 -newkey rsa:4096 -keyout new-cert-key.pem -out new-cert.pem -days 365 -nodes

# 2. Upload to Azure AD (both old and new active)
az ad app credential reset --id <app-id> --cert @new-cert.cer --append

# 3. Update Key Vault
az keyvault certificate import --vault-name kv-meeting-minutes-virginia --name sharepoint-integration-cert --file new-cert.pem

# 4. Restart application (picks up new certificate)
az webapp restart --name app-meeting-minutes-virginia --resource-group rg-meeting-minutes-virginia

# 5. Verify new certificate works (monitor logs for 24 hours)

# 6. Remove old certificate from Azure AD
az ad app credential delete --id <app-id> --key-id <old-cert-key-id>
```

---

## Testing and Validation

### Integration Testing

**Test Upload to Each Classification Library:**

```bash
# UNCLASSIFIED test document
curl -X POST https://meeting-minutes.mil/api/test/sharepoint-upload \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"classification": "UNCLASSIFIED", "testMode": true}'

# CONFIDENTIAL test document
curl -X POST https://meeting-minutes.mil/api/test/sharepoint-upload \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"classification": "CONFIDENTIAL", "testMode": true}'

# SECRET test document (if authorized)
curl -X POST https://meeting-minutes.mil/api/test/sharepoint-upload \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"classification": "SECRET", "testMode": true}'
```

**Verify Metadata:**
1. Navigate to SharePoint document library
2. Check uploaded test documents
3. Verify metadata columns populated correctly
4. Confirm classification markings visible
5. Test search functionality

### Permission Validation

**Test Access Controls:**
- User with UNCLASSIFIED clearance: Can access UNCLASS library only
- User with CONFIDENTIAL clearance: Can access UNCLASS + CONF libraries
- User with SECRET clearance: Can access all three libraries
- User without clearance: Denied access to all libraries

---

## Monitoring and Maintenance

### Health Checks

**Periodic Connection Tests:**
```typescript
// Run every 15 minutes
async function testSharePointConnection() {
  try {
    // Attempt to read site metadata
    const site = await graphClient
      .api(`/sites/${siteId}`)
      .get();
    
    // Log success
    logger.info('SharePoint health check passed', { siteId: site.id });
    return { status: 'healthy', siteId: site.id };
  } catch (error) {
    // Log failure and alert
    logger.error('SharePoint health check failed', { error: error.message });
    await sendAlert('SharePoint integration unhealthy', error);
    return { status: 'unhealthy', error: error.message };
  }
}
```

**Key Metrics:**
- Upload success rate (target: >99.5%)
- Average upload time (target: <5 seconds)
- Error rate by type (401, 403, 404, 503)
- Certificate expiration countdown
- Site storage utilization

### Retention and Archival

**Automated Retention Policies:**
```yaml
Retention Rules (SharePoint):
  UNCLASSIFIED:
    - Standard meetings: 3 years
    - Strategic planning: 7 years
    - Policy decisions: Permanent
  
  CONFIDENTIAL:
    - Standard meetings: 5 years
    - Acquisition decisions: 10 years
    - Mission-critical: Permanent
  
  SECRET:
    - All SECRET documents: 10 years minimum
    - Review for permanent archival at 10 years
```

---

## Troubleshooting Guide

### Common Issues

**Issue: 401 Unauthorized Error**
```yaml
Symptoms: All SharePoint uploads failing with 401
Root Cause: Expired certificate or invalid client credentials
Resolution:
  1. Verify certificate in Azure AD (not expired)
  2. Check Key Vault certificate matches Azure AD
  3. Restart application to reload certificate
  4. If still failing, regenerate certificate
```

**Issue: 403 Forbidden Error**
```yaml
Symptoms: Uploads failing with 403, authentication succeeds
Root Cause: Insufficient site permissions or wrong library
Resolution:
  1. Verify Sites.Selected permission granted
  2. Re-run Grant-SPOSiteDesignRights PowerShell command
  3. Check library names match configuration
  4. Verify classification boundaries not violated
```

**Issue: Slow Upload Performance**
```yaml
Symptoms: Uploads taking >30 seconds
Root Cause: Network latency, large files, or throttling
Resolution:
  1. Check network connectivity to SharePoint endpoints
  2. Review file sizes (optimize DOCX generation)
  3. Implement chunked upload for files >10MB
  4. Check for SharePoint throttling errors (503)
```

---

**Document Control:**
- Version: 1.0
- Classification: UNCLASSIFIED
- Last Updated: November 2025
- Next Review: February 2026
