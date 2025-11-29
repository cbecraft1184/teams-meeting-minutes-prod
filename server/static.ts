import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // In production, __dirname points to /app/dist (where index.js is)
  // Frontend assets are in /app/dist/public
  const distPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Catch-all for client-side routing
  // IMPORTANT: Exclude /webhooks/* and /api/* paths - those are handled by API routes
  app.use("*", (req, res, next) => {
    const path = req.originalUrl || req.path;
    
    // Don't serve SPA for API or webhook routes - let them 404 properly if not found
    if (path.startsWith('/webhooks/') || path.startsWith('/api/')) {
      return next();
    }
    
    res.sendFile(require('path').resolve(distPath, "index.html"));
  });
}
