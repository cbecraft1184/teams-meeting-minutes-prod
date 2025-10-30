// Reference: blueprint:sharepoint
import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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
  
  // Extract site and library from environment or use defaults
  const siteUrl = process.env.SHAREPOINT_SITE_URL || '';
  const libraryName = process.env.SHAREPOINT_LIBRARY_NAME || 'Meeting Minutes';
  
  // Create folder structure: YYYY/MM-Month/Classification
  const year = metadata.meetingDate.getFullYear();
  const month = String(metadata.meetingDate.getMonth() + 1).padStart(2, '0');
  const monthName = metadata.meetingDate.toLocaleString('default', { month: 'long' });
  const folderPath = `${year}/${month}-${monthName}/${metadata.classificationLevel}`;
  
  try {
    // Upload file
    const uploadPath = `/sites/${siteUrl}/Shared Documents/${libraryName}/${folderPath}/${fileName}`;
    
    await client.api(uploadPath)
      .put(fileContent);
    
    // Set metadata
    await client.api(`${uploadPath}:/listItem`)
      .update({
        fields: {
          Classification: metadata.classificationLevel,
          MeetingDate: metadata.meetingDate.toISOString(),
          AttendeeCount: metadata.attendeeCount,
          MeetingID: metadata.meetingId
        }
      });
    
    return uploadPath;
  } catch (error: any) {
    console.error('SharePoint upload error:', error);
    throw new Error(`Failed to upload to SharePoint: ${error.message}`);
  }
}
