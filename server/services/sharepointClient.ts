/**
 * SharePoint Client
 * 
 * Uses Microsoft Graph API with Azure AD client credentials flow.
 * Production deployment: Azure Container Apps.
 */
import { Client } from '@microsoft/microsoft-graph-client';
import { getConfig } from './configValidator';
import { acquireTokenByClientCredentials } from './microsoftIdentity';

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  
  if (config.useMockServices) {
    throw new Error('SharePoint not available in mock mode (set USE_MOCK_SERVICES=false)');
  }

  const token = await acquireTokenByClientCredentials();
  
  if (!token) {
    throw new Error(
      '[CONFIGURATION ERROR] Failed to acquire Azure AD token for SharePoint. ' +
      'Ensure AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET are configured, ' +
      'and Sites.ReadWrite.All permission is granted with admin consent.'
    );
  }
  
  return token;
}

async function getClient() {
  const accessToken = await getAccessToken();
  return Client.init({
    authProvider: (done) => done(null, accessToken)
  });
}

export async function getSiteId(siteUrl: string): Promise<string> {
  const client = await getClient();
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  const site = await client.api(`/sites/${hostname}:${sitePath}`).get();
  return site.id;
}

export async function getLibraryDriveId(siteId: string, libraryName: string): Promise<string> {
  const client = await getClient();
  const drives = await client.api(`/sites/${siteId}/drives`).get();
  const library = drives.value.find((d: any) => d.name === libraryName);
  if (!library) {
    throw new Error(`Library "${libraryName}" not found in site`);
  }
  return library.id;
}

export async function uploadDocument(
  siteUrl: string,
  libraryName: string,
  fileName: string,
  content: Buffer,
  folderPath?: string
): Promise<{ webUrl: string; id: string }> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  const uploadPath = folderPath 
    ? `/drives/${driveId}/root:/${folderPath}/${fileName}:/content`
    : `/drives/${driveId}/root:/${fileName}:/content`;

  const result = await client.api(uploadPath)
    .put(content);

  return {
    webUrl: result.webUrl,
    id: result.id
  };
}

export async function createFolder(
  siteUrl: string,
  libraryName: string,
  folderPath: string
): Promise<{ id: string; webUrl: string }> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  const pathParts = folderPath.split('/').filter(Boolean);
  let currentPath = '';
  let lastResult: any = null;

  for (const part of pathParts) {
    const parentPath = currentPath 
      ? `/drives/${driveId}/root:/${currentPath}:/children`
      : `/drives/${driveId}/root/children`;

    try {
      lastResult = await client.api(parentPath).post({
        name: part,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail'
      });
    } catch (error: any) {
      if (error.statusCode === 409) {
        const checkPath = currentPath 
          ? `/drives/${driveId}/root:/${currentPath}/${part}`
          : `/drives/${driveId}/root:/${part}`;
        lastResult = await client.api(checkPath).get();
      } else {
        throw error;
      }
    }
    currentPath = currentPath ? `${currentPath}/${part}` : part;
  }

  return {
    id: lastResult?.id || '',
    webUrl: lastResult?.webUrl || ''
  };
}

export async function listFolderContents(
  siteUrl: string,
  libraryName: string,
  folderPath?: string
): Promise<Array<{ name: string; type: 'file' | 'folder'; webUrl: string }>> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  const listPath = folderPath
    ? `/drives/${driveId}/root:/${folderPath}:/children`
    : `/drives/${driveId}/root/children`;

  const result = await client.api(listPath).get();

  return result.value.map((item: any) => ({
    name: item.name,
    type: item.folder ? 'folder' : 'file',
    webUrl: item.webUrl
  }));
}

export async function getDocumentMetadata(
  siteUrl: string,
  libraryName: string,
  filePath: string
): Promise<{ id: string; name: string; webUrl: string; size: number; lastModified: string }> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  const result = await client.api(`/drives/${driveId}/root:/${filePath}`).get();

  return {
    id: result.id,
    name: result.name,
    webUrl: result.webUrl,
    size: result.size,
    lastModified: result.lastModifiedDateTime
  };
}

export async function downloadDocument(
  siteUrl: string,
  libraryName: string,
  filePath: string
): Promise<Buffer> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  const result = await client.api(`/drives/${driveId}/root:/${filePath}:/content`).get();

  return Buffer.from(result);
}

export async function deleteDocument(
  siteUrl: string,
  libraryName: string,
  filePath: string
): Promise<void> {
  const client = await getClient();
  const siteId = await getSiteId(siteUrl);
  const driveId = await getLibraryDriveId(siteId, libraryName);

  await client.api(`/drives/${driveId}/root:/${filePath}`).delete();
}
