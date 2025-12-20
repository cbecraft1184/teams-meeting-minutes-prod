import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./static";
import { validateAndLogConfig, getConfig } from "./services/configValidator";
import { startJobWorker, stopJobWorker } from "./services/jobWorker";
import { initializeKeyVaultClient } from "./services/azureKeyVault";
import { initializeCleanupScheduler, stopCleanupScheduler } from "./services/databaseCleanup";
import { graphSubscriptionManager } from "./services/graphSubscriptionManager";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Azure Key Vault client with Managed Identity
  // CRITICAL: Must be called BEFORE config validation
  // In Azure: Uses Managed Identity to load secrets
  // Locally: Falls back to environment variables
  initializeKeyVaultClient();

  // Run database migrations at startup (Azure production only)
  if (process.env.NODE_ENV === "production" && process.env.RUN_MIGRATIONS === "true") {
    const { runMigrations } = await import("./migrate");
    await runMigrations();
  }

  // Validate configuration at startup
  validateAndLogConfig();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[Error Handler] ${status}: ${message}`, err.stack || err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // CRITICAL: Direct process.env.NODE_ENV check for esbuild tree-shaking
  if (process.env.NODE_ENV === "development") {
    // Dynamic import to avoid bundling vite in production
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  }
  // NOTE: In production, static serving is now handled inside registerRoutes
  // to ensure webhook routes are registered BEFORE the catch-all middleware

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Start durable job worker after server is running (disabled until Redis/durable queue is provisioned)
    if (process.env.ENABLE_JOB_WORKER === "true") {
      startJobWorker().catch(console.error);
    } else {
      log("Job worker disabled (set ENABLE_JOB_WORKER=true to enable)");
    }
    
    // Initialize database cleanup scheduler (runs daily) - disabled until tables exist
    if (process.env.ENABLE_CLEANUP_SCHEDULER === "true") {
      initializeCleanupScheduler();
    } else {
      log("Database cleanup scheduler disabled (set ENABLE_CLEANUP_SCHEDULER=true to enable)");
    }
    
    // Initialize Microsoft Graph webhook subscriptions for call record detection
    // NOTE: Requires CallRecords.Read.All permission with admin consent
    // Until then, use polling-based enrichment in jobWorker (default behavior)
    const config = getConfig();
    if (!config.useMockServices && process.env.ENABLE_GRAPH_WEBHOOKS === "true") {
      const baseUrl = process.env.APP_URL || `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io`;
      log(`Initializing Graph webhooks (baseUrl: ${baseUrl})...`);
      graphSubscriptionManager.initializeSubscription(baseUrl).catch(err => {
        console.error('Failed to initialize Graph webhooks:', err);
      });
    } else {
      log("Graph webhooks disabled - using polling-based enrichment instead");
      log("  (Set ENABLE_GRAPH_WEBHOOKS=true after granting CallRecords.Read.All permission)");
    }
  });

  // BUGFIX: Proper graceful shutdown that closes HTTP server and database pool
  let shuttingDown = false;
  
  async function gracefulShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    
    log(`${signal} received, initiating graceful shutdown...`);
    
    // Stop background workers first
    stopJobWorker();
    stopCleanupScheduler();
    
    // Close HTTP server (stop accepting new connections)
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error('[Shutdown] Error closing HTTP server:', err);
          reject(err);
        } else {
          log('HTTP server closed');
          resolve();
        }
      });
    });
    
    // Close database pool
    try {
      const { pool } = await import('./db');
      await pool.end();
      log('Database pool closed');
    } catch (err) {
      console.error('[Shutdown] Error closing database pool:', err);
    }
    
    log('Graceful shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})().catch((err) => {
  // BUGFIX: Handle startup errors to prevent unhandled promise rejection
  console.error('[Startup] Fatal error during initialization:', err);
  process.exit(1);
});
