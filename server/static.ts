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
    // Debug logging for all requests hitting catch-all
    const reqPath = req.originalUrl || req.path || '';
    const normalizedPath = reqPath.toLowerCase();
    
    console.log(`[Static Catch-All] Request received:`);
    console.log(`  - req.originalUrl: ${req.originalUrl}`);
    console.log(`  - req.path: ${req.path}`);
    console.log(`  - req.url: ${req.url}`);
    console.log(`  - normalized: ${normalizedPath}`);
    
    // Don't serve SPA for API or webhook routes - use normalized path for case-insensitive matching
    if (normalizedPath.startsWith('/webhooks/') || 
        normalizedPath.startsWith('/api/') || 
        normalizedPath.startsWith('/health') ||
        normalizedPath.includes('/webhooks/') ||
        normalizedPath.includes('/api/')) {
      console.log(`[Static] Skipping catch-all for API/webhook path: ${reqPath}`);
      return next();
    }
    
    console.log(`[Static] Serving SPA for: ${reqPath}`);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
