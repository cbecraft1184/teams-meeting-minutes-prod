import { Configuration, PublicClientApplication, LogLevel } from '@azure/msal-browser';

const TENANT_ID = 'e6ba87bd-8d65-4db7-bdb8-708b31b9d985';
const CLIENT_ID = '71383692-c5c6-40cc-94cf-96c97fed146c';

const getRedirectUri = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io';
};

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: getRedirectUri(),
    postLogoutRedirectUri: getRedirectUri(),
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message);
            break;
          case LogLevel.Warning:
            console.warn('[MSAL]', message);
            break;
          case LogLevel.Info:
            console.log('[MSAL]', message);
            break;
          case LogLevel.Verbose:
            console.debug('[MSAL]', message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

export const apiScopes = {
  scopes: [`api://${CLIENT_ID}/access_as_user`],
};

let msalInstance: PublicClientApplication | null = null;

export const getMsalInstance = async (): Promise<PublicClientApplication> => {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
};
