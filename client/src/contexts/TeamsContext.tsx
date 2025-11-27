import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';

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
      try {
        await app.initialize();
        
        app.notifySuccess();
        
        const ctx = await app.getContext();
        setContext(ctx);
        setIsInTeams(true);
        
        const teamsTheme = ctx.app.theme;
        setTheme(teamsTheme === 'dark' ? 'dark' : teamsTheme === 'contrast' ? 'contrast' : 'default');
        
        app.registerOnThemeChangeHandler((newTheme) => {
          setTheme(newTheme === 'dark' ? 'dark' : newTheme === 'contrast' ? 'contrast' : 'default');
        });
        
        console.log('[Teams SDK] Initialized successfully', ctx);
        
        try {
          const token = await authentication.getAuthToken();
          setAuthToken(token);
          console.log('[Teams SSO] Token acquired successfully');
        } catch (tokenErr: any) {
          console.error('[Teams SSO] Failed to get initial auth token:', tokenErr);
          setError('SSO authentication failed');
        }
        
        setIsInitialized(true);
      } catch (err: any) {
        console.warn('[Teams SDK] Not running in Teams, using standalone mode', err);
        setIsInTeams(false);
        clearAuthToken();
        setIsInitialized(true);
      }
    }

    initializeTeams();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    try {
      const token = await authentication.getAuthToken();
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
