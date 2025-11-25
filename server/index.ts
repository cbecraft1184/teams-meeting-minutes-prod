import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { validateAndLogConfig } from "./services/configValidator";
import { startJobWorker, stopJobWorker } from "./services/jobWorker";
import { initializeKeyVaultClient } from "./services/azureKeyVault";
import { initializeCleanupScheduler, stopCleanupScheduler } from "./services/databaseCleanup";

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

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // CRITICAL: Direct process.env.NODE_ENV check for esbuild tree-shaking
  if (process.env.NODE_ENV === "development") {
    // Dynamic import to avoid bundling vite in production
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
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
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down...');
    stopJobWorker();
    stopCleanupScheduler();
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down...');
    stopJobWorker();
    stopCleanupScheduler();
  });
})();
