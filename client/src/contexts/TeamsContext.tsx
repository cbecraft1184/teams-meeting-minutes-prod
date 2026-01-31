import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { setAuthToken, clearAuthToken, getAuthToken as getStoredToken } from '@/lib/authToken';
import { getMsalInstance, loginRequest, apiScopes } from '@/lib/msalConfig';
import type { AccountInfo } from '@azure/msal-browser';

const APP_ID_URI = 'api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/71383692-c5c6-40cc-94cf-96c97fed146c';

// Debug logging helper - logs to console with timestamp
function logAuth(stage: string, data?: any) {
  const timestamp = new Date().toISOString();
  const message = `[AUTH ${timestamp}] ${stage}`;
  console.log(message, data !== undefined ? JSON.stringify(data) : '');
  
  // Also log as error for visibility in Teams DevTools
  if (stage.includes('ERROR') || stage.includes('FAILED')) {
    console.error(message, data);
  }
}

export interface TeamsContextValue {
  isInitialized: boolean;
  context: app.Context | null;
  theme: 'default' | 'dark' | 'contrast';
  getAuthToken: () => Promise<string>;
  isInTeams: boolean;
  error: string | null;
  ssoError: any | null;
  hasToken: boolean;
  msalAccount: AccountInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [context, setContext] = useState<app.Context | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<any | null>(null);
  const [isInTeams, setIsInTeams] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [msalAccount, setMsalAccount] = useState<AccountInfo | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    async function initializeTeams() {
      logAuth('INIT_START', { appIdUri: APP_ID_URI });
      
      try {
        logAuth('TEAMS_SDK_INITIALIZING');
        await app.initialize();
        logAuth('TEAMS_SDK_INITIALIZED');
        
        // CRITICAL: Tell Teams the app has loaded (prevents timeout)
        // This must be called before notifySuccess() per Microsoft docs
        app.notifyAppLoaded();
        logAuth('TEAMS_NOTIFY_APP_LOADED');
        
        // CRITICAL: Get context first to verify Teams SDK is working
        const ctx = await app.getContext();
        
        // Store detailed context info for debugging display
        const contextInfo = {
          userPrincipalName: ctx.user?.userPrincipalName || 'NOT SET',
          tenantId: ctx.user?.tenant?.id || 'NOT SET',
          loginHint: ctx.user?.loginHint || 'NOT SET',
          theme: ctx.app.theme || 'NOT SET',
          hostName: ctx.app.host?.name || 'NOT SET',
          sessionId: ctx.app.sessionId || 'NOT SET',
          appId: ctx.app.appId || 'NOT SET'
        };
        
        logAuth('TEAMS_CONTEXT_RECEIVED', contextInfo);
        
        // CRITICAL CHECK: Verify UPN and TID are populated (per troubleshooting doc step 2)
        if (!ctx.user?.userPrincipalName || !ctx.user?.tenant?.id) {
          const missingInfo = {
            upnMissing: !ctx.user?.userPrincipalName,
            tidMissing: !ctx.user?.tenant?.id
          };
          logAuth('TEAMS_CONTEXT_INCOMPLETE', missingInfo);
          setSsoError({
            message: 'Teams context is incomplete - user identity not available',
            details: missingInfo,
            contextInfo
          });
          setError('Teams context incomplete: User identity not available. This may indicate a configuration issue.');
          setIsInitialized(true);
          return;
        }
        
        setContext(ctx);
        setIsInTeams(true);
        logAuth('TEAMS_CONTEXT_VALID', { 
          userPrincipalName: ctx.user?.userPrincipalName,
          tenantId: ctx.user?.tenant?.id
        });
        
        const teamsTheme = ctx.app.theme;
        setTheme(teamsTheme === 'dark' ? 'dark' : teamsTheme === 'contrast' ? 'contrast' : 'default');
        
        app.registerOnThemeChangeHandler((newTheme) => {
          setTheme(newTheme === 'dark' ? 'dark' : newTheme === 'contrast' ? 'contrast' : 'default');
        });
        
        // Get SSO token with detailed error handling
        logAuth('SSO_TOKEN_REQUESTING', { resource: APP_ID_URI });
        try {
          const token = await authentication.getAuthToken({ 
            resources: [APP_ID_URI],
            silent: true 
          });
          
          logAuth('SSO_TOKEN_RECEIVED', { 
            tokenLength: token?.length,
            tokenPreview: token ? `${token.substring(0, 30)}...` : 'null'
          });
          
          // Decode and log token claims for debugging
          if (token) {
            try {
              const parts = token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                logAuth('SSO_TOKEN_CLAIMS', {
                  aud: payload.aud,
                  iss: payload.iss,
                  sub: payload.sub,
                  upn: payload.upn,
                  name: payload.name,
                  tid: payload.tid,
                  exp: new Date(payload.exp * 1000).toISOString()
                });
              }
            } catch (decodeErr) {
              logAuth('SSO_TOKEN_DECODE_ERROR', { error: String(decodeErr) });
            }
          }
          
          setAuthToken(token);
          setHasToken(true);
          
          // Verify token was stored
          const storedToken = getStoredToken();
          logAuth('SSO_TOKEN_STORED', { 
            stored: !!storedToken,
            storedLength: storedToken?.length 
          });
          
        } catch (tokenErr: any) {
          // Detailed SSO error logging - this is critical for debugging
          const errorDetails = {
            message: tokenErr?.message || String(tokenErr),
            errorCode: tokenErr?.errorCode,
            errorSubCode: tokenErr?.errorSubCode,
            name: tokenErr?.name,
            stack: tokenErr?.stack,
            fullError: JSON.stringify(tokenErr, Object.getOwnPropertyNames(tokenErr))
          };
          
          logAuth('SSO_TOKEN_ERROR', errorDetails);
          console.error('SSO Token Acquisition Failed:', tokenErr);
          
          setSsoError(errorDetails);
          
          // Check for specific error types
          const errorMessage = tokenErr?.message?.toLowerCase() || '';
          const errorCode = tokenErr?.errorCode?.toLowerCase() || '';
          
          if (errorMessage.includes('consent') || errorCode.includes('consent')) {
            logAuth('SSO_CONSENT_REQUIRED', { suggestion: 'User needs to consent to permissions' });
            setError('Consent required - please grant permissions');
          } else if (errorMessage.includes('invalid_grant') || errorCode.includes('invalid_grant')) {
            logAuth('SSO_INVALID_GRANT', { suggestion: 'Token grant is invalid - check Azure AD config' });
            setError('Authentication failed - invalid grant');
          } else if (errorMessage.includes('audience') || errorMessage.includes('aud')) {
            logAuth('SSO_AUDIENCE_INVALID', { suggestion: 'APP_ID_URI mismatch with Azure AD' });
            setError('Authentication failed - audience mismatch');
          } else {
            setError(`SSO authentication failed: ${tokenErr?.message || 'Unknown error'}`);
          }
        }
        
        // Tell Teams initialization is complete (must be after all setup)
        app.notifySuccess();
        logAuth('TEAMS_NOTIFY_SUCCESS');
        
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_IN_TEAMS');
        
      } catch (err: any) {
        // Teams SDK initialization failed - running in standalone mode with MSAL
        const errorDetails = {
          message: err?.message || String(err),
          name: err?.name,
          stack: err?.stack
        };
        
        logAuth('TEAMS_SDK_ERROR', errorDetails);
        console.warn('[Teams SDK] Not running in Teams, using standalone mode with MSAL', err);
        
        setIsInTeams(false);
        
        // Initialize MSAL for browser-based authentication
        try {
          const msalInstance = await getMsalInstance();
          
          // Handle redirect response if returning from login
          const response = await msalInstance.handleRedirectPromise();
          if (response) {
            logAuth('MSAL_REDIRECT_RESPONSE', { account: response.account?.username });
            setMsalAccount(response.account);
            setAuthToken(response.accessToken);
            setHasToken(true);
          } else {
            // Check for existing accounts
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
              logAuth('MSAL_EXISTING_ACCOUNT', { account: accounts[0].username });
              setMsalAccount(accounts[0]);
              
              // Try to get a token silently
              try {
                const tokenResponse = await msalInstance.acquireTokenSilent({
                  ...apiScopes,
                  account: accounts[0],
                });
                setAuthToken(tokenResponse.accessToken);
                setHasToken(true);
                logAuth('MSAL_SILENT_TOKEN_SUCCESS');
              } catch (silentErr) {
                logAuth('MSAL_SILENT_TOKEN_FAILED', { error: String(silentErr) });
                // Token expired or unavailable, user will need to login again
              }
            } else {
              logAuth('MSAL_NO_ACCOUNTS');
              clearAuthToken();
            }
          }
        } catch (msalErr) {
          logAuth('MSAL_INIT_ERROR', { error: String(msalErr) });
          clearAuthToken();
        }
        
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_STANDALONE');
      }
    }

    initializeTeams();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    logAuth('GET_AUTH_TOKEN_CALLED', { isInTeams, hasMsalAccount: !!msalAccount });
    
    if (isInTeams) {
      try {
        const token = await authentication.getAuthToken({ 
          resources: [APP_ID_URI],
          silent: true 
        });
        logAuth('GET_AUTH_TOKEN_SUCCESS', { tokenLength: token?.length });
        setAuthToken(token);
        return token;
      } catch (err: any) {
        logAuth('GET_AUTH_TOKEN_ERROR', { 
          error: err?.message,
          errorCode: err?.errorCode 
        });
        console.error('[Teams SSO] Failed to get auth token:', err);
        throw new Error(`Failed to authenticate with Teams SSO: ${err?.message}`);
      }
    }
    
    // Use MSAL for browser-based auth
    if (msalAccount) {
      try {
        const msalInstance = await getMsalInstance();
        const tokenResponse = await msalInstance.acquireTokenSilent({
          ...apiScopes,
          account: msalAccount,
        });
        logAuth('MSAL_GET_TOKEN_SUCCESS', { tokenLength: tokenResponse.accessToken?.length });
        setAuthToken(tokenResponse.accessToken);
        return tokenResponse.accessToken;
      } catch (err: any) {
        logAuth('MSAL_GET_TOKEN_ERROR', { error: err?.message });
        throw new Error(`Failed to get MSAL token: ${err?.message}`);
      }
    }
    
    throw new Error('Not authenticated - please sign in');
  };

  const login = async (): Promise<void> => {
    logAuth('LOGIN_CALLED');
    setIsLoggingIn(true);
    setError(null);
    
    try {
      const msalInstance = await getMsalInstance();
      
      // Use popup for better UX (redirect is also available)
      const response = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: 'select_account',
      });
      
      logAuth('LOGIN_SUCCESS', { account: response.account?.username });
      setMsalAccount(response.account);
      
      // Get access token for API
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...apiScopes,
        account: response.account!,
      });
      
      setAuthToken(tokenResponse.accessToken);
      setHasToken(true);
      logAuth('LOGIN_TOKEN_ACQUIRED');
      
      // Reload the page to refresh all queries with new token
      window.location.reload();
    } catch (err: any) {
      logAuth('LOGIN_ERROR', { error: err?.message });
      setError(`Login failed: ${err?.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async (): Promise<void> => {
    logAuth('LOGOUT_CALLED');
    
    try {
      const msalInstance = await getMsalInstance();
      
      if (msalAccount) {
        await msalInstance.logoutPopup({
          account: msalAccount,
          postLogoutRedirectUri: window.location.origin,
        });
      }
      
      setMsalAccount(null);
      clearAuthToken();
      setHasToken(false);
      logAuth('LOGOUT_SUCCESS');
      
      window.location.reload();
    } catch (err: any) {
      logAuth('LOGOUT_ERROR', { error: err?.message });
    }
  };

  return (
    <TeamsContext.Provider
      value={{
        isInitialized,
        context,
        theme,
        getAuthToken,
        isInTeams,
        error,
        ssoError,
        hasToken,
        msalAccount,
        login,
        logout,
        isLoggingIn,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const context = useContext(TeamsContext);
  if (context === undefined) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
}
