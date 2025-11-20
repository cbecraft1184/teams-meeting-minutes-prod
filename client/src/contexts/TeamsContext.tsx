import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { app, authentication } from '@microsoft/teams-js';

export interface TeamsContextValue {
  isInitialized: boolean;
  context: app.Context | null;
  theme: 'default' | 'dark' | 'contrast';
  getAuthToken: () => Promise<string>;
  error: string | null;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [context, setContext] = useState<app.Context | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeTeams() {
      try {
        await app.initialize();
        
        app.notifySuccess();
        
        const ctx = await app.getContext();
        setContext(ctx);
        
        const teamsTheme = ctx.app.theme;
        setTheme(teamsTheme === 'dark' ? 'dark' : teamsTheme === 'contrast' ? 'contrast' : 'default');
        
        app.registerOnThemeChangeHandler((newTheme) => {
          setTheme(newTheme === 'dark' ? 'dark' : newTheme === 'contrast' ? 'contrast' : 'default');
        });
        
        setIsInitialized(true);
        console.log('[Teams SDK] Initialized successfully', ctx);
      } catch (err: any) {
        console.warn('[Teams SDK] Not running in Teams, using standalone mode', err);
        setIsInitialized(true);
      }
    }

    initializeTeams();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    try {
      const token = await authentication.getAuthToken();
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
