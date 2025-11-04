/**
 * Service Authentication Middleware
 * 
 * Validates service-to-service authentication for:
 * 1. Background jobs (using application tokens)
 * 2. Webhook endpoints (using validation tokens)
 * 3. Internal service calls (using signed tokens)
 */

import type { Request, Response, NextFunction } from 'express';
import { getConfig } from '../services/configValidator';
import { decodeToken } from '../services/microsoftIdentity';
import crypto from 'crypto';

/**
 * Validate webhook request from Microsoft Graph
 * Checks validationToken parameter for subscription validation
 * Checks clientState for webhook notifications
 */
export function requireWebhookAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getConfig();

  // Skip validation in mock mode
  if (config.useMockServices) {
    next();
    return;
  }

  // Handle subscription validation request
  if (req.query.validationToken) {
    const validationToken = req.query.validationToken as string;
    
    // For subscription validation, Microsoft sends a validationToken
    // We must respond with the exact same token
    res.status(200).send(validationToken);
    return;
  }

  // Validate webhook notification
  const clientState = req.headers['client-state'] as string;
  const expectedClientState = config.webhook.validationToken;

  if (!expectedClientState) {
    console.warn('Webhook validation token not configured');
    next();
    return;
  }

  if (clientState !== expectedClientState) {
    console.error('Invalid webhook client state');
    res.status(403).json({ message: 'Invalid webhook signature' });
    return;
  }

  next();
}

/**
 * Validate application token for background jobs
 * Checks for valid Microsoft Graph application token
 */
export async function requireApplicationAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const config = getConfig();

  // Skip validation in mock mode
  if (config.useMockServices) {
    next();
    return;
  }

  // Extract access token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Application authentication required' });
    return;
  }

  const accessToken = authHeader.substring(7);

  // Decode and validate token
  const decoded = decodeToken(accessToken);
  if (!decoded) {
    res.status(401).json({ message: 'Invalid application token' });
    return;
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    res.status(401).json({ message: 'Application token expired' });
    return;
  }

  // Verify token is an application token (has roles, not scp)
  if (!decoded.roles && decoded.scp) {
    res.status(403).json({ message: 'User token not allowed for this endpoint' });
    return;
  }

  // Verify tenant ID matches
  if (decoded.tid !== config.graph.tenantId) {
    res.status(403).json({ message: 'Invalid tenant' });
    return;
  }

  next();
}

/**
 * Validate internal service token
 * For calls between internal services within the application
 */
export function requireInternalServiceAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getConfig();

  // Skip validation in mock mode
  if (config.useMockServices) {
    next();
    return;
  }

  // Extract service token from header
  const serviceToken = req.headers['x-service-token'] as string;
  if (!serviceToken) {
    res.status(401).json({ message: 'Internal service authentication required' });
    return;
  }

  // Validate service token is signed correctly
  const expectedToken = generateInternalServiceToken();
  if (serviceToken !== expectedToken) {
    res.status(403).json({ message: 'Invalid service token' });
    return;
  }

  next();
}

/**
 * Generate internal service token
 * Creates HMAC-SHA256 signed token for internal service calls
 */
export function generateInternalServiceToken(): string {
  const config = getConfig();
  const secret = config.app.sessionSecret;
  const timestamp = Math.floor(Date.now() / 60000); // 1-minute window
  const message = `service-auth-${timestamp}`;

  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Validate API key (for external integrations if needed)
 */
export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;
  const config = getConfig();

  // Skip validation in mock mode
  if (config.useMockServices) {
    next();
    return;
  }

  if (!apiKey) {
    res.status(401).json({ message: 'API key required' });
    return;
  }

  // Validate API key (for now, use session secret as API key)
  // In production, implement proper API key management
  const validApiKey = config.app.sessionSecret;
  if (apiKey !== validApiKey) {
    res.status(403).json({ message: 'Invalid API key' });
    return;
  }

  next();
}
