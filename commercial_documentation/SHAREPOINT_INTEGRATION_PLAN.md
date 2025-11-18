# SharePoint Integration Plan
## Enterprise Meeting Minutes Management System - SharePoint Online Integration

**Classification:** Confidential - Integration Documentation  
**Document Version:** 1.0  
**Date:** November 2025  
**Audience:** System Administrators, SharePoint Administrators, Integration Engineers

---

## Overview

This document provides comprehensive guidance for integrating the Enterprise Meeting Minutes Management System with customer SharePoint Online tenants. The integration enables automatic archival of approved meeting minutes to customer-designated SharePoint document libraries with metadata tagging, full-text search indexing, and enterprise-grade access controls.

**SharePoint Environment:**
- **Platform:** SharePoint Online (Microsoft 365 Business/Enterprise)
- **Domain Structure:** .com tenant domains (customer-specific)
- **Authentication:** Azure AD OAuth 2.0 / OpenID Connect
- **Compliance:** SOC 2 Type II, ISO 27001, GDPR

---

## Integration Architecture

### Multi-Tenant Design

**Per-Customer SharePoint Configuration:**
- Each organization configures their own SharePoint tenant connection
- Isolated credentials and permissions per customer
- No cross-customer data access
- Customer admin controls which sites/libraries are accessible

**Security Model:**
- Customer grants application limited permissions (Sites.Selected preferred)
- Application uses customer-specific credentials for each upload
- All operations logged with customer organization ID
- Revocable permissions via Azure AD admin consent

---

## Prerequisites

### Customer SharePoint Requirements

**SharePoint Online Subscription:**
- Microsoft 365 Business Basic/Standard/Premium or Enterprise E3/E5
- SharePoint Online enabled for organization
- Custom domain configured (.com or verified domain)
- Sufficient storage quota for meeting documents

**Site Collections and Libraries:**
- Dedicated site for meeting minutes (recommended)
- Document library configured for meeting storage
- Optional: Folder structure by department/team
- Retention policies configured per compliance requirements

**SharePoint Administrator Access (Customer):**
- Ability to grant application permissions
- Site Collection Administrator role
- Access to Azure AD admin consent workflow

### Application Requirements (SaaS Platform)

**Microsoft Graph API Permissions:**

```yaml
Sites.Selected (Recommended):
  - Read and write to specific SharePoint sites only
  - Customer grants permission to designated sites
  - Least privilege security model

Sites.ReadWrite.All (Alternative):
  - Read and write to all SharePoint sites
  - Higher security risk
  - Only use if customer specifically requests
```

**Multi-Tenant App Registration:**
- Azure AD multi-tenant application
- Support for external customer tenants
- Admin consent workflow for permissions
- Certificate or secret rotation every 90 days

---

## Customer Onboarding Flow

### Step 1: Customer Initiates SharePoint Connection

**Admin Portal Workflow:**

1. Customer admin logs into platform admin portal
2. Navigates to Integrations → SharePoint Online
3. Clicks "Connect SharePoint" button
4. Redirected to Microsoft admin consent flow

**Admin Consent URL:**

```
https://login.microsoftonline.com/common/adminconsent?
  client_id=<application-client-id>
  &redirect_uri=https://app.yourcompany.com/integrations/sharepoint/callback
  &state=<customer-org-id-encrypted>
  &scope=https://graph.microsoft.com/.default
```

### Step 2: Microsoft Admin Consent

**Customer Admin Experience:**
1. Authenticates with Microsoft 365 admin credentials
2. Reviews requested permissions (Sites.Selected or Sites.ReadWrite.All)
3. Grants consent for organization
4. Redirected back to platform with authorization code

**Platform Receives:**
- Tenant ID (customer's Azure AD tenant)
- Authorization code (exchanged for tokens)
- Admin email (for audit trail)

### Step 3: Site Selection

**Platform UX:**

1. Exchange authorization code for access token
2. Retrieve customer's SharePoint sites via Graph API:
   ```
   GET https://graph.microsoft.com/v1.0/sites?search=*
   ```
3. Display list of sites to customer admin
4. Customer selects target site and document library
5. Platform requests specific site permissions (Sites.Selected model)

**Grant Site-Specific Permissions (Sites.Selected):**

```http
POST /v1.0/sites/{siteId}/permissions
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [{
    "application": {
      "id": "<application-client-id>",
      "displayName": "Meeting Minutes Management"
    }
  }]
}
```

### Step 4: Configuration Storage

**Stored Per Customer:**

```typescript
interface SharePointConfig {
  organizationId: string;
  tenantId: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  libraryId: string;
  libraryName: string;
  folderPath: string | null; // Optional subfolder structure
  enabled: boolean;
  createdAt: Date;
  lastSyncAt: Date | null;
  errorCount: number; // Track failures for health monitoring
}
```

**Secure Credential Storage:**
- Access tokens: Short-lived (1 hour), refreshed automatically
- Refresh tokens: Encrypted in database, rotated per Microsoft policy
- Tenant ID: Plain text (not sensitive)
- Site/Library IDs: Plain text (not sensitive)

---

## Integration Implementation

### Authentication and Token Management

**Token Acquisition (Per Customer):**

```typescript
async function getSharePointAccessToken(organizationId: string): Promise<string> {
  // Retrieve customer's SharePoint config
  const config = await db.query.sharepointConfigs.findFirst({
    where: eq(sharepointConfigs.organizationId, organizationId)
  });
  
  if (!config) {
    throw new Error('SharePoint not configured for organization');
  }
  
  // Check token cache (Redis)
  const cachedToken = await redis.get(`sharepoint:token:${organizationId}`);
  if (cachedToken) {
    return cachedToken;
  }
  
  // Acquire new token using refresh token
  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      scope: 'https://graph.microsoft.com/.default offline_access',
      refresh_token: decrypt(config.refreshToken), // Decrypt from database
      grant_type: 'refresh_token'
    })
  });
  
  const tokens = await tokenResponse.json();
  
  // Cache access token (55 minutes, expires in 60)
  await redis.setex(`sharepoint:token:${organizationId}`, 3300, tokens.access_token);
  
  // Update refresh token if rotated
  if (tokens.refresh_token && tokens.refresh_token !== decrypt(config.refreshToken)) {
    await db.update(sharepointConfigs)
      .set({ refreshToken: encrypt(tokens.refresh_token) })
      .where(eq(sharepointConfigs.organizationId, organizationId));
  }
  
  return tokens.access_token;
}
```

### Document Upload Logic

**Upload to Customer SharePoint:**

```typescript
async function uploadToSharePoint(minute: MeetingMinute, document: Buffer) {
  // Get customer SharePoint configuration
  const config = await getSharePointConfig(minute.organizationId);
  
  if (!config || !config.enabled) {
    logger.info('SharePoint not configured, skipping upload', {
      organizationId: minute.organizationId,
      minuteId: minute.id
    });
    return null;
  }
  
  // Get access token for customer tenant
  const accessToken = await getSharePointAccessToken(minute.organizationId);
  
  // Construct file path (optional folder structure)
  const folderPath = config.folderPath || '';
  const fileName = `${minute.id}_${sanitizeFileName(minute.title)}.docx`;
  const uploadPath = folderPath ? `${folderPath}/${fileName}` : fileName;
  
  // Upload document
  try {
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drives/${config.libraryId}/root:/${uploadPath}:/content`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      body: document
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`SharePoint upload failed: ${uploadResponse.statusText}`);
    }
    
    const uploadedFile = await uploadResponse.json();
    
    // Update metadata on uploaded document
    await updateSharePointMetadata(config, uploadedFile.id, minute, accessToken);
    
    // Log successful upload
    await logAuditEvent({
      eventType: 'SHAREPOINT_UPLOAD',
      organizationId: minute.organizationId,
      minuteId: minute.id,
      targetSite: config.siteUrl,
      targetLibrary: config.libraryName,
      fileId: uploadedFile.id,
      success: true
    });
    
    // Update last sync timestamp
    await db.update(sharepointConfigs)
      .set({ 
        lastSyncAt: new Date(),
        errorCount: 0 // Reset error counter on success
      })
      .where(eq(sharepointConfigs.organizationId, minute.organizationId));
    
    return uploadedFile;
    
  } catch (error) {
    // Increment error counter
    await db.update(sharepointConfigs)
      .set({ 
        errorCount: sql`${sharepointConfigs.errorCount} + 1`
      })
      .where(eq(sharepointConfigs.organizationId, minute.organizationId));
    
    // Log failure
    await logAuditEvent({
      eventType: 'SHAREPOINT_UPLOAD_FAILED',
      organizationId: minute.organizationId,
      minuteId: minute.id,
      error: error.message,
      success: false
    });
    
    throw error;
  }
}

async function updateSharePointMetadata(
  config: SharePointConfig,
  fileId: string,
  minute: MeetingMinute,
  accessToken: string
) {
  const metadataUrl = `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drives/${config.libraryId}/items/${fileId}/listItem/fields`;
  
  await fetch(metadataUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Title: minute.title,
      MeetingDate: minute.meetingDate.toISOString(),
      Organizer: minute.organizerEmail,
      Department: minute.department,
      DocumentStatus: 'Archived'
      // Additional custom fields as configured by customer
    })
  });
}
```

### Error Handling and Resilience

**Retry Logic with Exponential Backoff:**

```typescript
async function uploadWithRetry(minute: MeetingMinute, document: Buffer, maxRetries = 3) {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadToSharePoint(minute, document);
    } catch (error) {
      lastError = error;
      
      // Don't retry on auth errors (likely needs re-consent)
      if (error.message.includes('401') || error.message.includes('403')) {
        logger.error('SharePoint authentication failed, requires admin re-consent', {
          organizationId: minute.organizationId,
          error: error.message
        });
        
        // Notify customer admin via email
        await sendAdminNotification(minute.organizationId, {
          subject: 'SharePoint Integration Requires Attention',
          body: 'Your SharePoint connection has expired. Please reconnect via Admin Portal.'
        });
        
        // Disable integration to prevent further failures
        await db.update(sharepointConfigs)
          .set({ enabled: false })
          .where(eq(sharepointConfigs.organizationId, minute.organizationId));
        
        break; // Don't retry auth errors
      }
      
      // Retry on transient errors (429, 503, network issues)
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.warn(`SharePoint upload retry ${attempt}/${maxRetries}`, {
          minuteId: minute.id,
          delayMs
        });
        await sleep(delayMs);
      }
    }
  }
  
  // All retries exhausted
  throw lastError;
}
```

**Graceful Degradation:**

```typescript
// If SharePoint upload fails, don't block meeting approval/distribution
async function archiveMeetingMinute(minute: MeetingMinute) {
  try {
    // Primary: Upload to SharePoint
    await uploadWithRetry(minute, document);
    logger.info('Meeting minute archived to SharePoint', { minuteId: minute.id });
  } catch (error) {
    // Fallback: Store in platform blob storage
    logger.error('SharePoint upload failed, using fallback storage', {
      minuteId: minute.id,
      error: error.message
    });
    
    await uploadToBlobStorage(minute, document);
    
    // Queue for retry later (background job)
    await addToRetryQueue({
      type: 'sharepoint_upload',
      minuteId: minute.id,
      organizationId: minute.organizationId,
      retryAfter: Date.now() + 3600000 // 1 hour
    });
  }
}
```

---

## Security and Compliance

### Data Isolation

**Multi-Tenant Isolation:**
- Organization ID validated on every SharePoint operation
- Impossible to upload document to wrong customer's SharePoint
- Database row-level security enforces tenant boundaries
- Application-level validation as defense-in-depth

**Example Safeguard:**

```typescript
// Always validate organization ownership before SharePoint operations
async function validateOrganizationOwnership(minuteId: number, organizationId: string) {
  const minute = await db.query.meetingMinutes.findFirst({
    where: and(
      eq(meetingMinutes.id, minuteId),
      eq(meetingMinutes.organizationId, organizationId)
    )
  });
  
  if (!minute) {
    throw new Error('Meeting minute not found or access denied');
  }
  
  return minute;
}
```

### Credential Management

**Encryption at Rest:**
- Refresh tokens encrypted with AES-256-GCM
- Encryption keys stored in Azure Key Vault
- Unique encryption key per customer (optional Premium tier)
- Key rotation every 90 days

**Token Lifecycle:**
- Access tokens: Cached in Redis (55-minute TTL)
- Refresh tokens: Encrypted in PostgreSQL
- Automatic refresh before expiration
- Revocation via Azure AD if integration disabled

### Audit Logging

**Comprehensive Audit Trail:**

```typescript
interface SharePointAuditLog {
  id: string;
  organizationId: string;
  eventType: 'UPLOAD' | 'METADATA_UPDATE' | 'AUTH_FAILURE' | 'CONFIG_CHANGE';
  userId: string | null; // null for system operations
  minuteId: number | null;
  siteUrl: string;
  libraryName: string;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

**Retention:**
- 7 years for SOC 2 compliance
- Exportable for customer audit requests
- Indexed for fast searching

---

## Customer Admin Experience

### Admin Portal Features

**SharePoint Configuration Dashboard:**
- Connection status (Connected / Disconnected / Error)
- Last successful sync timestamp
- Error count and recent error messages
- Reconnect button (triggers admin consent flow)
- Test connection button (uploads test document)
- Disable/enable integration toggle

**Example UI:**

```
┌─────────────────────────────────────────────────────┐
│ SharePoint Online Integration                      │
├─────────────────────────────────────────────────────┤
│ Status: ● Connected                                 │
│ Site: https://contoso.sharepoint.com/sites/minutes │
│ Library: Meeting Minutes Archive                   │
│ Last Sync: 2 minutes ago                           │
│ Documents Archived: 1,247                          │
│                                                     │
│ [Test Connection]  [Reconnect]  [Disable]          │
└─────────────────────────────────────────────────────┘
```

**Configuration Options:**
- Select site and library
- Configure folder structure (flat vs. hierarchical)
- Enable/disable automatic upload
- Set metadata mapping (custom fields)
- Configure error notifications

### Troubleshooting Tools

**Connection Health Check:**

```typescript
async function testSharePointConnection(organizationId: string): Promise<ConnectionStatus> {
  try {
    const config = await getSharePointConfig(organizationId);
    const accessToken = await getSharePointAccessToken(organizationId);
    
    // Test site access
    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${config.siteId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!siteResponse.ok) {
      return { status: 'error', message: 'Cannot access SharePoint site' };
    }
    
    // Test library access
    const libraryResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drives/${config.libraryId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!libraryResponse.ok) {
      return { status: 'error', message: 'Cannot access document library' };
    }
    
    return { status: 'healthy', message: 'SharePoint connection verified' };
    
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
```

---

## Monitoring and Maintenance

### Platform-Level Monitoring

**Key Metrics (Per Customer):**
- Upload success rate (target: >99%)
- Average upload time (target: <5 seconds)
- Error rate and types (401, 403, 429, 503)
- Token refresh success rate
- Integration health status

**Alerting Thresholds:**
```yaml
Critical:
  - Upload success rate < 95% for any customer
  - 5+ consecutive failures for same customer
  - Token refresh failure (requires admin action)

Warning:
  - Upload success rate < 98%
  - Average upload time > 10 seconds
  - Error count > 10 in 1 hour
```

### Customer Notifications

**Proactive Alerts to Customer Admins:**
- SharePoint connection expired (auth failure)
- Integration disabled due to errors
- Storage quota approaching limit
- Permissions revoked or changed

**Email Template Example:**

```
Subject: SharePoint Integration Requires Attention

Hello [Admin Name],

Your SharePoint Online integration for [Organization Name] requires attention.

Issue: Authentication has expired
Impact: Meeting minutes are not being archived to SharePoint
Action Required: Reconnect SharePoint via Admin Portal

[Reconnect SharePoint Button]

If you have questions, contact support at support@yourcompany.com.

Best regards,
Meeting Minutes Management Team
```

---

## Migration and Offboarding

### Customer Data Export

**Bulk Export Feature:**
- Customer admin can export all archived documents
- ZIP download with folder structure preserved
- Includes metadata as CSV file
- Available even after subscription cancellation

**Export Process:**

```typescript
async function exportSharePointDocuments(organizationId: string): Promise<string> {
  const config = await getSharePointConfig(organizationId);
  const accessToken = await getSharePointAccessToken(organizationId);
  
  // Get all documents from SharePoint library
  const documentsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drives/${config.libraryId}/root/children`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  const documents = await documentsResponse.json();
  
  // Download each document and package into ZIP
  const zipPath = await createExportZip(documents, accessToken);
  
  return zipPath; // Return download URL
}
```

### Integration Disconnection

**Clean Removal:**
1. Customer admin clicks "Disconnect SharePoint"
2. Platform revokes permissions via Azure AD
3. Refresh tokens deleted from database
4. Configuration marked as disabled
5. Archived documents remain in customer SharePoint (not deleted)
6. Audit logs retained for compliance

---

## Troubleshooting Guide

### Common Issues

**Issue: "Authentication failed (401)"**
```yaml
Cause: Access token expired, refresh token invalid, or admin consent revoked
Resolution:
  1. Customer admin clicks "Reconnect SharePoint" in admin portal
  2. Complete admin consent flow again
  3. Platform acquires new refresh token
  4. Integration automatically resumes
```

**Issue: "Permission denied (403)"**
```yaml
Cause: Application permissions changed, site deleted, or library access revoked
Resolution:
  1. Verify SharePoint site and library still exist
  2. Re-grant application permissions via PowerShell:
     Grant-SPOSiteDesignRights -Identity <site> -Principals <app-id> -Rights Write
  3. If issue persists, reconnect integration
```

**Issue: "Too many requests (429)"**
```yaml
Cause: SharePoint throttling due to high request volume
Resolution:
  - Platform automatically retries with exponential backoff
  - Throttling typically resolves within minutes
  - If persistent, contact Microsoft 365 support
```

---

**Document Control:**
- Version: 1.0
- Classification: Confidential - Integration Documentation
- Last Updated: November 2025
- Next Review: February 2026
