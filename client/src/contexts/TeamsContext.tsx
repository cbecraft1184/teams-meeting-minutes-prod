import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { setAuthToken, clearAuthToken, getAuthToken as getStoredToken } from '@/lib/authToken';

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
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [context, setContext] = useState<app.Context | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<any | null>(null);
  const [isInTeams, setIsInTeams] = useState(false);

  useEffect(() => {
    async function initializeTeams() {
      logAuth('INIT_START', { appIdUri: APP_ID_URI });
      
      try {
        logAuth('TEAMS_SDK_INITIALIZING');
        await app.initialize();
        logAuth('TEAMS_SDK_INITIALIZED');
        
        app.notifySuccess();
        logAuth('TEAMS_NOTIFY_SUCCESS');
        
        const ctx = await app.getContext();
        setContext(ctx);
        setIsInTeams(true);
        logAuth('TEAMS_CONTEXT_RECEIVED', { 
          userPrincipalName: ctx.user?.userPrincipalName,
          tenantId: ctx.user?.tenant?.id,
          loginHint: ctx.user?.loginHint,
          theme: ctx.app.theme,
          hostName: ctx.app.host?.name,
          sessionId: ctx.app.sessionId
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
        
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_IN_TEAMS');
        
      } catch (err: any) {
        // Teams SDK initialization failed - running in standalone mode
        const errorDetails = {
          message: err?.message || String(err),
          name: err?.name,
          stack: err?.stack
        };
        
        logAuth('TEAMS_SDK_ERROR', errorDetails);
        console.warn('[Teams SDK] Not running in Teams, using standalone mode', err);
        
        setIsInTeams(false);
        clearAuthToken();
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_STANDALONE');
      }
    }

    initializeTeams();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    logAuth('GET_AUTH_TOKEN_CALLED', { isInTeams });
    
    if (!isInTeams) {
      logAuth('GET_AUTH_TOKEN_NOT_IN_TEAMS');
      throw new Error('Not running in Teams - cannot get SSO token');
    }
    
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
