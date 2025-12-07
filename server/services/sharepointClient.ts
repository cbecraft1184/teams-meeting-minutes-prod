/**
 * SharePoint Client Service
 * 
 * Uploads meeting minutes documents to SharePoint using Microsoft Graph API.
 * 
 * AUTHENTICATION:
 * - Azure Production: Uses MSAL client credentials flow via acquireTokenByClientCredentials
 * - Replit Development: Uses Replit SharePoint connector (fallback)
 * - Mock Mode: Returns mock URL without calling SharePoint
 * 
 * REQUIRED PERMISSIONS:
 * - Sites.ReadWrite.All or Sites.Selected (application permission)
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - SHAREPOINT_SITE_URL: Full SharePoint site URL (e.g., https://contoso.sharepoint.com/sites/meetings)
 * - SHAREPOINT_LIBRARY: Document library name (default: "Documents")
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { getConfig } from './configValidator';
import { acquireTokenByClientCredentials } from './microsoftIdentity';

/**
 * Get access token for SharePoint Graph API access
 * 
 * Uses Azure MSAL client credentials flow for production (same as email service).
 * Falls back to Replit connector in development if MSAL is not configured.
 */
async function getAccessToken(): Promise<string> {
  const config = getConfig();
  
  // Mock mode: throw early
  if (config.useMockServices) {
    throw new Error('SharePoint not available in mock mode (set USE_MOCK_SERVICES=false)');
  }

  // PRIMARY: Use Azure MSAL client credentials flow (works in Azure production)
  // This uses the same authentication method as email distribution
  if (config.graph.clientId && config.graph.clientSecret && config.graph.tenantId) {
    console.log('[SharePoint] Using Azure MSAL client credentials flow');
    
    const accessToken = await acquireTokenByClientCredentials([
      'https://graph.microsoft.com/.default'
    ]);
    
    if (!accessToken) {
      throw new Error('Failed to acquire access token for SharePoint via MSAL');
    }
    
    return accessToken;
  }

  // FALLBACK: Use Replit SharePoint connector (works in Replit development)
  console.log('[SharePoint] Attempting Replit connector fallback...');
  return await getReplitConnectorToken();
}

/**
 * Replit connector token acquisition (fallback for Replit development environment)
 */
async function getReplitConnectorToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      'SharePoint authentication failed: ' +
      'Azure credentials not configured (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID) ' +
      'and Replit connector not available. ' +
      'Configure Azure credentials for production or enable Replit SharePoint connector for development.'
    );
  }

  const connectionSettings = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=sharepoint`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('SharePoint not connected via Replit connector');
  }
  
  return accessToken;
}

/**
 * Get Graph API client for SharePoint operations
 * 
 * WARNING: Never cache this client.
 * Access tokens expire, so a new client must be created each time.
 * Always call this function again to get a fresh client.
 */
export async function getUncachableSharePointClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

/**
 * Upload document to SharePoint
 * 
 * Creates folder structure: YYYY/MM-Month/Classification/
 * Sets metadata columns on uploaded document.
 * 
 * @param fileName - Name of the file to upload
 * @param fileContent - File content as Buffer
 * @param metadata - Document metadata (classification, meeting date, etc.)
 * @returns SharePoint web URL of the uploaded document
 */
export async function uploadToSharePoint(
  fileName: string,
  fileContent: Buffer,
  metadata: {
    classificationLevel: string;
    meetingDate: Date;
    attendeeCount: number;
    meetingId: string;
  }
): Promise<string> {
  // Mock mode: Return mock URL without calling SharePoint
  const config = getConfig();
  if (config.useMockServices) {
    console.log(`🔧 [SharePoint] Mock mode - simulating upload: ${fileName}`);
    return `https://mock-sharepoint.example.com/sites/meetings/Documents/${fileName}`;
  }

  const client = await getUncachableSharePointClient();
  
  // Extract site and library from environment
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  const libraryName = process.env.SHAREPOINT_LIBRARY || 'Documents';
  
  if (!siteUrl) {
    throw new Error('SHAREPOINT_SITE_URL environment variable not configured');
  }
  
  // Create folder structure: YYYY/MM-Month/Classification
  const year = metadata.meetingDate.getFullYear();
  const month = String(metadata.meetingDate.getMonth() + 1).padStart(2, '0');
  const monthName = metadata.meetingDate.toLocaleString('default', { month: 'long' });
  const folderPath = `${year}/${month}-${monthName}/${metadata.classificationLevel}`;
  
  console.log(`📁 [SharePoint] Uploading to: ${siteUrl}/${libraryName}/${folderPath}/${fileName}`);
  
  try {
    // Parse site URL to get host and path
    // Example: https://contoso.sharepoint.com/sites/meetings
    const siteUrlObj = new URL(siteUrl);
    const hostName = siteUrlObj.hostname; // contoso.sharepoint.com
    const sitePath = siteUrlObj.pathname.replace(/^\//, ''); // sites/meetings
    
    // Step 1: Get site ID
    // GET /sites/{hostname}:/{server-relative-path}
    console.log(`[SharePoint] Getting site ID for: ${hostName}/${sitePath}`);
    const siteResponse = await client.api(`/sites/${hostName}:/${sitePath}`).get();
    const siteId = siteResponse.id;
    
    // Step 2: Get drive ID for the document library
    // GET /sites/{site-id}/drives
    console.log(`[SharePoint] Getting drive ID for library: ${libraryName}`);
    const drivesResponse = await client.api(`/sites/${siteId}/drives`).get();
    const drive = drivesResponse.value.find((d: any) => d.name === libraryName);
    
    if (!drive) {
      const availableLibraries = drivesResponse.value.map((d: any) => d.name).join(', ');
      throw new Error(`Document library "${libraryName}" not found. Available libraries: ${availableLibraries}`);
    }
    
    const driveId = drive.id;
    
    // Step 3: Upload file using correct Graph API format
    // PUT /drives/{drive-id}/root:/{folder-path}/{filename}:/content
    const uploadPath = `/drives/${driveId}/root:/${folderPath}/${fileName}:/content`;
    console.log(`[SharePoint] Uploading file to path: ${uploadPath}`);
    
    const uploadResponse = await client.api(uploadPath)
      .put(fileContent);
    
    // Step 4: Set metadata on the uploaded item (optional - may fail if columns don't exist)
    const itemId = uploadResponse.id;
    try {
      await client.api(`/drives/${driveId}/items/${itemId}/listItem`)
        .patch({
          fields: {
            Classification: metadata.classificationLevel,
            MeetingDate: metadata.meetingDate.toISOString(),
            AttendeeCount: metadata.attendeeCount,
            MeetingID: metadata.meetingId
          }
        });
      console.log(`[SharePoint] Metadata set successfully`);
    } catch (metadataError: any) {
      // Log but don't fail - metadata columns may not exist in the library
      console.warn(`[SharePoint] Could not set metadata (columns may not exist): ${metadataError.message}`);
    }
    
    console.log(`✅ [SharePoint] Upload successful: ${uploadResponse.webUrl}`);
    return uploadResponse.webUrl;
  } catch (error: any) {
    console.error('❌ [SharePoint] Upload error:', error.message);
    
    // Provide more specific error messages
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw new Error(`SharePoint permission denied. Ensure the Azure AD app has Sites.ReadWrite.All or Sites.Selected permission.`);
    }
    if (error.statusCode === 404) {
      throw new Error(`SharePoint site or library not found. Verify SHAREPOINT_SITE_URL and SHAREPOINT_LIBRARY are correct.`);
    }
    if (error.statusCode === 429) {
      throw new Error(`SharePoint rate limited. Retry after ${error.headers?.['Retry-After'] || '60'} seconds.`);
    }
    
    throw new Error(`Failed to upload to SharePoint: ${error.message}`);
  }
}
