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
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks (build tools not needed after npm install)
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install build tools temporarily, install dependencies, then remove tools
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm ci --production && \
    apk del .build-deps

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy runtime assets and configuration
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/config ./config
COPY --from=builder /app/teams-app ./teams-app

# Expose port 5000 (required by application)
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=5000

# Health check for Azure Container Apps
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
