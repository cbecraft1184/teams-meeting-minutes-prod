import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { setAuthToken, clearAuthToken, getAuthToken as getStoredToken } from '@/lib/authToken';

const APP_ID_URI = 'api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/71383692-c5c6-40cc-94cf-96c97fed146c';

// Debug logging helper
function logAuth(stage: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[AUTH ${timestamp}] ${stage}`, data || '');
}

export interface TeamsContextValue {
  isInitialized: boolean;
  context: app.Context | null;
  theme: 'default' | 'dark' | 'contrast';
  getAuthToken: () => Promise<string>;
  isInTeams: boolean;
  error: string | null;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [context, setContext] = useState<app.Context | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<string | null>(null);
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
          theme: ctx.app.theme 
        });
        
        const teamsTheme = ctx.app.theme;
        setTheme(teamsTheme === 'dark' ? 'dark' : teamsTheme === 'contrast' ? 'contrast' : 'default');
        
        app.registerOnThemeChangeHandler((newTheme) => {
          setTheme(newTheme === 'dark' ? 'dark' : newTheme === 'contrast' ? 'contrast' : 'default');
        });
        
        // Get SSO token
        logAuth('SSO_TOKEN_REQUESTING', { resource: APP_ID_URI });
        try {
          const token = await authentication.getAuthToken({ resources: [APP_ID_URI] });
          logAuth('SSO_TOKEN_RECEIVED', { 
            tokenLength: token?.length,
            tokenPreview: token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : 'null'
          });
          
          setAuthToken(token);
          
          // Verify token was stored
          const storedToken = getStoredToken();
          logAuth('SSO_TOKEN_STORED', { 
            stored: !!storedToken,
            storedLength: storedToken?.length 
          });
          
        } catch (tokenErr: any) {
          logAuth('SSO_TOKEN_ERROR', { 
            error: tokenErr?.message || tokenErr,
            errorCode: tokenErr?.errorCode,
            errorSubCode: tokenErr?.errorSubCode
          });
          setError('SSO authentication failed');
        }
        
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_IN_TEAMS');
        
      } catch (err: any) {
        logAuth('TEAMS_SDK_ERROR', { 
          error: err?.message || err,
          name: err?.name 
        });
        setIsInTeams(false);
        clearAuthToken();
        setIsInitialized(true);
        logAuth('INIT_COMPLETE_STANDALONE');
      }
    }

    initializeTeams();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    try {
      const token = await authentication.getAuthToken({ resources: [APP_ID_URI] });
      setAuthToken(token);
      return token;
    } catch (err: any) {
      console.error('[Teams SSO] Failed to get auth token:', err);
      throw new Error('Failed to authenticate with Teams SSO');
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
