import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { FluentProvider, webLightTheme, webDarkTheme, teamsHighContrastTheme, teamsDarkTheme, teamsLightTheme, makeStyles, tokens, shorthands, Button, Toaster } from "@fluentui/react-components";
import { Navigation24Regular } from "@fluentui/react-icons";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserSwitcher } from "@/components/user-switcher";
import { AppMenu } from "@/components/app-menu";
import { FluentNavigation } from "@/components/FluentNavigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { TeamsProvider, useTeams } from "@/contexts/TeamsContext";
import Dashboard from "@/pages/dashboard";
import Meetings from "@/pages/meetings";
import Search from "@/pages/search";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import SharedMeeting from "@/pages/shared-meeting";
import AdminJobs from "@/pages/admin-jobs";
import NotFound from "@/pages/not-found";
import { useState } from "react";

// Export constant toaster ID for use across the app
export const APP_TOASTER_ID = "app-toaster";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/search" component={Search} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin/jobs" component={AdminJobs} />
      <Route path="/help" component={Help} />
      <Route path="/share/:token" component={SharedMeeting} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Centralized theme selection helper
function getFluentTheme(isInTeams: boolean, theme: 'default' | 'dark' | 'contrast') {
  if (isInTeams) {
    if (theme === 'dark') return teamsDarkTheme;
    if (theme === 'contrast') return teamsHighContrastTheme;
    return teamsLightTheme;
  }
  if (theme === 'dark') return webDarkTheme;
  return webLightTheme;
}

const useStyles = makeStyles({
  appContainer: {
    display: "flex",
    height: "100vh",
    width: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  appContainerColumn: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  loadingContainer: {
    display: "flex",
    height: "100vh",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("12px", "24px"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  headerSpacer: {
    flex: 1,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("16px"),
  },
  content: {
    flex: 1,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding("24px"),
  },
  contentConstrained: {
    flex: 1,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding("24px"),
    maxWidth: "1280px",
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
  },
  classificationBadge: {
    fontSize: "12px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: tokens.colorPaletteRedBackground1,
    ...shorthands.padding("4px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorPaletteRedBorder1),
  },
});

function AppContent() {
  const { context, isInitialized, error, ssoError, isInTeams } = useTeams();
  const styles = useStyles();
  const [navOpen, setNavOpen] = useState(true);

  if (!isInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading...</div>
      </div>
    );
  }

  // Display SSO errors visibly for debugging (since DevTools is not available)
  if (error || ssoError) {
    return (
      <div style={{ 
        padding: '40px', 
        maxWidth: '800px', 
        margin: '0 auto',
        fontFamily: 'Segoe UI, sans-serif'
      }}>
        <h1 style={{ color: '#d13438', marginBottom: '20px' }}>
          Authentication Error
        </h1>
        <div style={{ 
          backgroundColor: '#fdf3f4', 
          border: '1px solid #d13438',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Error Message:</h3>
          <pre style={{ 
            backgroundColor: '#fff', 
            padding: '15px', 
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '13px'
          }}>
            {error || 'Unknown error'}
          </pre>
        </div>
        
        {ssoError && (
          <div style={{ 
            backgroundColor: '#f5f5f5', 
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>SSO Error Details:</h3>
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '15px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {JSON.stringify(ssoError, null, 2)}
            </pre>
          </div>
        )}
        
        <div style={{ 
          backgroundColor: '#f0f6ff', 
          border: '1px solid #0078d4',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0078d4' }}>Debug Info:</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>Running in Teams:</strong> {isInTeams ? 'Yes' : 'No'}</li>
            <li><strong>Context available:</strong> {context ? 'Yes' : 'No'}</li>
            <li><strong>App ID URI:</strong> api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/71383692-c5c6-40cc-94cf-96c97fed146c</li>
          </ul>
        </div>
        
        <p style={{ marginTop: '20px', color: '#666' }}>
          Please share a screenshot of this error with your developer.
        </p>
      </div>
    );
  }

  if (context) {
    return (
      <div className={styles.appContainerColumn}>
        <header className={styles.header}>
          <div className={styles.headerSpacer} />
          <div className={styles.headerActions}>
            <div className={styles.classificationBadge} data-testid="badge-classification-header">
              UNCLASSIFIED
            </div>
            <AppMenu />
          </div>
        </header>
        <main className={styles.contentConstrained}>
          <Router />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <FluentNavigation isOpen={navOpen} onClose={() => setNavOpen(false)} />
      <div className={styles.mainContainer}>
        <header className={styles.header}>
          <Button
            appearance="subtle"
            icon={<Navigation24Regular />}
            onClick={() => setNavOpen(!navOpen)}
            data-testid="button-sidebar-toggle"
            aria-label="Toggle navigation"
          />
          <div className={styles.headerSpacer} />
          <div className={styles.headerActions}>
            <div className={styles.classificationBadge} data-testid="badge-classification-header">
              UNCLASSIFIED
            </div>
            <UserSwitcher />
            <ThemeToggle />
            <AppMenu />
          </div>
        </header>
        <main className={styles.contentConstrained}>
          <Router />
        </main>
      </div>
    </div>
  );
}

function AppWithProviders() {
  const { theme, context } = useTeams();
  const isInTeams = !!context;

  return (
    <FluentProvider theme={getFluentTheme(isInTeams, theme)}>
      <ThemeProvider defaultTheme="light">
        <Toaster 
          toasterId={APP_TOASTER_ID} 
          position="top-end"
          timeout={4000}
          pauseOnHover={true}
          data-testid="app-toaster"
          style={{ zIndex: 10000000 }}
        />
        <AppContent />
      </ThemeProvider>
    </FluentProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TeamsProvider>
          <AppWithProviders />
        </TeamsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
