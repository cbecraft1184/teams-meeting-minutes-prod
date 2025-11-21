import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { FluentProvider, webLightTheme, webDarkTheme, teamsHighContrastTheme, teamsDarkTheme, teamsLightTheme } from "@fluentui/react-components";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { TeamsProvider, useTeams } from "@/contexts/TeamsContext";
import Dashboard from "@/pages/dashboard";
import Meetings from "@/pages/meetings";
import Search from "@/pages/search";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/search" component={Search} />
      <Route path="/settings" component={Settings} />
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

function AppContent() {
  const { context, isInitialized } = useTeams();
  const isInTeams = !!context;

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isInTeams) {
    return (
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold" data-testid="text-app-title">Meeting Minutes</h1>
          </div>
          <div 
            className="text-xs font-medium text-destructive bg-destructive/10 px-3 py-1 rounded-md border border-destructive/20"
            data-testid="badge-classification-header"
          >
            UNCLASSIFIED
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container max-w-7xl mx-auto px-6 py-6">
            <Router />
          </div>
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <div 
                className="text-xs font-medium text-destructive bg-destructive/10 px-3 py-1 rounded-md border border-destructive/20"
                data-testid="badge-classification-header"
              >
                UNCLASSIFIED
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="container max-w-7xl mx-auto px-6 py-6">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppWithProviders() {
  const { theme, context } = useTeams();
  const isInTeams = !!context;

  return (
    <FluentProvider theme={getFluentTheme(isInTeams, theme)}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
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
