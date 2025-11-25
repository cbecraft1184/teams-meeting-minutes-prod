// Reference: blueprint:sharepoint
import { Client } from '@microsoft/microsoft-graph-client';
import { getConfig } from './configValidator';

let connectionSettings: any;

async function getAccessToken() {
  // Check if mock services are enabled (Azure production will have this set to false)
  const config = getConfig();
  if (config.useMockServices) {
    throw new Error('SharePoint not available in mock mode (set USE_MOCK_SERVICES=false)');
  }

  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl (Replit-only SharePoint integration)');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sharepoint',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('SharePoint not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSharePointClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// Upload document to SharePoint
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
  const client = await getUncachableSharePointClient();
  
  // Extract site and library from environment
  // SHAREPOINT_SITE_URL should be the full site URL (e.g., https://yourorg.sharepoint.com/sites/meetings)
  // SHAREPOINT_LIBRARY should be the document library name (e.g., "Meeting Minutes" or "Documents")
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
  
  try {
    // Parse site URL to get host and path
    // Example: https://contoso.sharepoint.com/sites/meetings
    const siteUrlObj = new URL(siteUrl);
    const hostName = siteUrlObj.hostname; // contoso.sharepoint.com
    const sitePath = siteUrlObj.pathname.replace(/^\//, ''); // sites/meetings
    
    // Step 1: Get site ID
    // GET /sites/{hostname}:/{server-relative-path}
    const siteResponse = await client.api(`/sites/${hostName}:/${sitePath}`).get();
    const siteId = siteResponse.id;
    
    // Step 2: Get drive ID for the document library
    // GET /sites/{site-id}/drives
    const drivesResponse = await client.api(`/sites/${siteId}/drives`).get();
    const drive = drivesResponse.value.find((d: any) => d.name === libraryName);
    
    if (!drive) {
      throw new Error(`Document library "${libraryName}" not found. Available libraries: ${drivesResponse.value.map((d: any) => d.name).join(', ')}`);
    }
    
    const driveId = drive.id;
    
    // Step 3: Upload file using correct Graph API format
    // PUT /drives/{drive-id}/root:/{folder-path}/{filename}:/content
    const uploadPath = `/drives/${driveId}/root:/${folderPath}/${fileName}:/content`;
    
    const uploadResponse = await client.api(uploadPath)
      .put(fileContent);
    
    // Step 4: Set metadata on the uploaded item
    const itemId = uploadResponse.id;
    await client.api(`/drives/${driveId}/items/${itemId}/listItem`)
      .patch({
        fields: {
          Classification: metadata.classificationLevel,
          MeetingDate: metadata.meetingDate.toISOString(),
          AttendeeCount: metadata.attendeeCount,
          MeetingID: metadata.meetingId
        }
      });
    
    return uploadResponse.webUrl;
  } catch (error: any) {
    console.error('SharePoint upload error:', error);
    throw new Error(`Failed to upload to SharePoint: ${error.message}`);
  }
}
