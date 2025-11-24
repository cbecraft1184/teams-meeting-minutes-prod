# Multi-stage build for Teams Meeting Minutes application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application (frontend + backend)
# Use custom build script that excludes Vite from production bundle
RUN node scripts/build-server.mjs

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks and ca-certificates for Azure PostgreSQL SSL
RUN apk add --no-cache curl ca-certificates

# Copy package files
COPY package*.json ./

# Install build dependencies for native modules (keep for runtime)
RUN apk add --no-cache python3 make g++

# Install production dependencies
RUN npm ci --include=optional --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy runtime assets and configuration
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/config ./config
COPY --from=builder /app/teams-app ./teams-app

# Expose port 8080 (Azure Container Apps requirement)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Health check for Azure Container Apps
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start the application (built server is at dist/index.js)
CMD ["node", "dist/index.js"]
