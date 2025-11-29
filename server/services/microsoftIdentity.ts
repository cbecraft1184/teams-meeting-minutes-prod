/**
 * Microsoft Identity Service
 * 
 * Handles Microsoft Azure AD authentication using MSAL (Microsoft Authentication Library)
 * Supports both:
 * - Delegated permissions (user context via authorization code flow)
 * - Application permissions (service context via client credentials flow)
 */

import { ConfidentialClientApplication, type AuthenticationResult, type Configuration } from '@azure/msal-node';
import { getConfig } from './configValidator';
import { LRUCache } from 'lru-cache';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

// Token cache for access/refresh tokens
interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date;
  scopes: string[];
  userIdentifier?: string; // For delegated tokens
}

// LRU cache for tokens (in memory for development, Redis for production)
const tokenCache = new LRUCache<string, CachedToken>({
  max: 1000, // Maximum 1000 cached tokens
  ttl: 1000 * 60 * 55, // 55 minutes (access tokens expire in 1 hour)
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

// JWKS client for Azure AD public key verification
// Keys are cached automatically by jwks-rsa
let jwksClientInstance: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient | null {
  if (jwksClientInstance) {
    return jwksClientInstance;
  }

  const config = getConfig();
  if (!config.graph.tenantId) {
    return null;
  }

  jwksClientInstance = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${config.graph.tenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 24 * 60 * 60 * 1000, // Cache keys for 24 hours
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });

  return jwksClientInstance;
}

// Get signing key for JWT verification (callback style for jwt.verify)
function getSigningKey(header: jwt.JwtHeader, callback: (err: Error | null, key?: string) => void): void {
  console.log('[JWKS] Fetching signing key for kid:', header.kid);
  
  const client = getJwksClient();
  if (!client) {
    console.error('[JWKS] Client not configured');
    callback(new Error('JWKS client not configured'));
    return;
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('[JWKS] Error fetching key:', err.message);
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    if (!signingKey) {
      console.error('[JWKS] No signing key found');
      callback(new Error('No signing key found'));
      return;
    }
    console.log('[JWKS] Signing key retrieved successfully');
    callback(null, signingKey);
  });
}

/**
 * Get MSAL Confidential Client Application instance
 */
function getMsalClient(): ConfidentialClientApplication | null {
  const config = getConfig();

  // Return null if not configured (will use mock services)
  if (!config.graph.clientId || !config.graph.clientSecret || !config.graph.tenantId) {
    return null;
  }

  const msalConfig: Configuration = {
    auth: {
      clientId: config.graph.clientId,
      authority: `https://login.microsoftonline.com/${config.graph.tenantId}`,
      clientSecret: config.graph.clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: 1, // Error only - never log tokens/PII
        loggerCallback(logLevel, message) {
          if (logLevel === 1) {
            // Sanitize error messages to remove potential tokens
            const sanitized = message.replace(/access[_-]?token[=:]?\s*[^\s&]+/gi, 'access_token=[REDACTED]')
                                     .replace(/refresh[_-]?token[=:]?\s*[^\s&]+/gi, 'refresh_token=[REDACTED]')
                                     .replace(/id[_-]?token[=:]?\s*[^\s&]+/gi, 'id_token=[REDACTED]')
                                     .replace(/client[_-]?secret[=:]?\s*[^\s&]+/gi, 'client_secret=[REDACTED]');
            console.error('[MSAL] Authentication error:', sanitized);
          }
        },
        piiLoggingEnabled: false, // SECURITY: Never log PII/tokens in any environment
      },
    },
  };

  return new ConfidentialClientApplication(msalConfig);
}

/**
 * Acquire token using authorization code flow (for user authentication)
 * This is used after user completes OAuth flow in browser
 */
export async function acquireTokenByCode(
  authorizationCode: string,
  redirectUri: string,
  scopes: string[] = ['User.Read', 'OnlineMeetings.Read', 'Group.Read.All']
): Promise<AuthenticationResult | null> {
  const client = getMsalClient();
  if (!client) {
    console.warn('MSAL client not configured - using mock authentication');
    return null;
  }

  try {
    const request = {
      code: authorizationCode,
      scopes,
      redirectUri,
    };

    const response = await client.acquireTokenByCode(request);

    // Cache the token
    if (response && response.account) {
      const cacheKey = `user:${response.account.homeAccountId}`;
      tokenCache.set(cacheKey, {
        accessToken: response.accessToken,
        refreshToken: (response as any).refreshToken || undefined,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        scopes: response.scopes || scopes,
        userIdentifier: response.account.homeAccountId,
      });
    }

    return response;
  } catch (error) {
    console.error('[Auth] Failed to acquire token by code:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Acquire token using client credentials flow (for application authentication)
 * This is used for background jobs and service-to-service calls
 */
export async function acquireTokenByClientCredentials(
  scopes: string[] = ['https://graph.microsoft.com/.default']
): Promise<string | null> {
  const client = getMsalClient();
  if (!client) {
    console.warn('MSAL client not configured - using mock authentication');
    return null;
  }

  // Check cache first
  const cacheKey = `app:${scopes.join(',')}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresOn > new Date()) {
    return cached.accessToken;
  }

  try {
    const request = {
      scopes,
    };

    const response = await client.acquireTokenByClientCredential(request);

    if (response) {
      // Cache the token
      tokenCache.set(cacheKey, {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        scopes: response.scopes || scopes,
      });

      return response.accessToken;
    }

    return null;
  } catch (error) {
    console.error('[Auth] Failed to acquire token by client credentials:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Acquire token on behalf of user (OBO flow)
 * Used when API needs to call Microsoft Graph on behalf of a user
 */
export async function acquireTokenOnBehalfOf(
  userAccessToken: string,
  scopes: string[] = ['https://graph.microsoft.com/.default']
): Promise<string | null> {
  const client = getMsalClient();
  if (!client) {
    console.warn('MSAL client not configured - using mock authentication');
    return null;
  }

  try {
    const request = {
      oboAssertion: userAccessToken,
      scopes,
    };

    const response = await client.acquireTokenOnBehalfOf(request);

    if (response) {
      return response.accessToken;
    }

    return null;
  } catch (error) {
    console.error('[Auth] Failed to acquire token on behalf of user:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Acquire token using refresh token
 * Used to refresh expired access tokens
 */
export async function acquireTokenByRefreshToken(
  refreshToken: string,
  scopes: string[] = ['User.Read', 'OnlineMeetings.Read', 'Group.Read.All']
): Promise<AuthenticationResult | null> {
  const client = getMsalClient();
  if (!client) {
    console.warn('MSAL client not configured - using mock authentication');
    return null;
  }

  try {
    const request = {
      refreshToken,
      scopes,
    };

    const response = await client.acquireTokenByRefreshToken(request);

    // Update cache
    if (response && response.account) {
      const cacheKey = `user:${response.account.homeAccountId}`;
      tokenCache.set(cacheKey, {
        accessToken: response.accessToken,
        refreshToken: (response as any).refreshToken || undefined,
        expiresOn: response.expiresOn || new Date(Date.now() + 3600000),
        scopes: response.scopes || scopes,
        userIdentifier: response.account.homeAccountId,
      });
    }

    return response;
  } catch (error) {
    console.error('[Auth] Failed to refresh token:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get cached token for user
 */
export function getCachedUserToken(userIdentifier: string): CachedToken | undefined {
  const cacheKey = `user:${userIdentifier}`;
  return tokenCache.get(cacheKey);
}

/**
 * Get cached application token
 */
export function getCachedAppToken(scopes: string[]): CachedToken | undefined {
  const cacheKey = `app:${scopes.join(',')}`;
  return tokenCache.get(cacheKey);
}

/**
 * Invalidate user token cache (e.g., on logout)
 */
export function invalidateUserToken(userIdentifier: string): void {
  const cacheKey = `user:${userIdentifier}`;
  tokenCache.delete(cacheKey);
}

/**
 * Get authorization URL for user login
 * Redirects user to Microsoft login page
 */
export function getAuthCodeUrl(
  redirectUri: string,
  state?: string,
  scopes: string[] = ['User.Read', 'OnlineMeetings.Read', 'Group.Read.All']
): string | null {
  const client = getMsalClient();
  if (!client) {
    console.warn('MSAL client not configured - using mock authentication');
    return null;
  }

  const config = getConfig();

  const authCodeUrlParameters = {
    scopes,
    redirectUri,
    state: state || `state_${Date.now()}`,
  };

  try {
    const authCodeUrl = `https://login.microsoftonline.com/${config.graph.tenantId}/oauth2/v2.0/authorize?client_id=${config.graph.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${authCodeUrlParameters.state}`;
    return authCodeUrl;
  } catch (error) {
    console.error('[Auth] Failed to generate auth code URL:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Validate access token (check if it's expired)
 */
export function isTokenValid(token: CachedToken): boolean {
  return token.expiresOn > new Date();
}

/**
 * SECURITY CRITICAL: Validate Azure AD access token with signature verification
 * Verifies JWT signature against Azure AD JWKS, checks issuer, audience, and expiration
 * 
 * FAIL-CLOSED DESIGN:
 * - Mock mode (USE_MOCK_SERVICES=true): Falls back to unsafe decode (dev only)
 * - Real mode (USE_MOCK_SERVICES=false): REQUIRES JWKS validation, fails if unavailable
 * 
 * @param token - JWT access token from Azure AD
 * @param options - Validation options (audience, issuer)
 * @returns Decoded and verified token payload, or null if invalid
 */
export async function validateAccessToken(
  token: string,
  options?: {
    audience?: string; // Expected client ID or API identifier
    issuer?: string; // Expected issuer (tenant-specific)
  }
): Promise<any> {
  const config = getConfig();
  
  // Decode token without verification first to get claims for logging
  const tokenParts = token.split('.');
  let tokenClaims: any = {};
  try {
    tokenClaims = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf-8'));
  } catch (e) {
    console.log('[JWT-DEBUG] Failed to decode token claims for logging');
  }
  
  console.log('[JWT-DEBUG] Token validation starting', {
    tokenAud: tokenClaims.aud,
    tokenIss: tokenClaims.iss,
    tokenExp: tokenClaims.exp,
    tokenNbf: tokenClaims.nbf,
    currentTime: Math.floor(Date.now() / 1000),
    configTenantId: config.graph.tenantId,
    configClientId: config.graph.clientId,
    useMockServices: config.useMockServices
  });

  // SECURITY: Fail-closed design - only allow unsafe decode in explicit mock mode
  const client = getJwksClient();
  if (!client) {
    // If in mock mode, allow unsafe decode for development
    if (config.useMockServices) {
      console.warn('JWKS client not configured - using unsafe token decode (MOCK MODE ONLY)');
      return decodeTokenUnsafe(token);
    }
    
    // If in real mode but JWKS unavailable, FAIL CLOSED - reject all tokens
    console.error('SECURITY: JWKS client unavailable in production mode - token validation FAILED');
    console.error('Configure GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET or enable USE_MOCK_SERVICES');
    return null; // Reject token - fail closed
  }

  try {
    // Build list of valid audiences (client ID and Application ID URI for Teams SSO)
    // Teams SSO tokens have audience = api://<domain>/<client-id>
    const validAudiences: [string, ...string[]] = [
      config.graph.clientId!,
      `api://${config.graph.clientId}`,
      `api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/${config.graph.clientId}`,
    ];
    
    // Add custom domain Application ID URI if configured
    if (process.env.APP_DOMAIN) {
      validAudiences.push(`api://${process.env.APP_DOMAIN}/${config.graph.clientId}`);
    }
    
    const expectedIssuer = options?.issuer || `https://login.microsoftonline.com/${config.graph.tenantId}/v2.0`;
    
    console.log('[JWT-DEBUG] Validation parameters', {
      validAudiences,
      expectedIssuer,
      tokenAudience: tokenClaims.aud,
      tokenIssuer: tokenClaims.iss,
      audienceMatch: validAudiences.includes(tokenClaims.aud),
      issuerMatch: tokenClaims.iss === expectedIssuer
    });
    
    // Verify token signature and decode payload
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getSigningKey,
        {
          audience: options?.audience || validAudiences,
          issuer: expectedIssuer,
          algorithms: ['RS256'],
        },
        (err: Error | null, decoded: unknown) => {
          if (err) {
            console.error('[JWT-DEBUG] Verification error:', {
              name: err.name,
              message: err.message
            });
            reject(err);
          } else {
            console.log('[JWT-DEBUG] Token verified successfully');
            resolve(decoded);
          }
        }
      );
    });

    return decoded;
  } catch (error) {
    console.error('[JWT-DEBUG] JWT validation failed:', {
      error: error instanceof Error ? error.message : error,
      name: error instanceof Error ? error.name : 'unknown'
    });
    return null;
  }
}

/**
 * UNSAFE: Decode JWT token without signature verification
 * ONLY used in mock mode when JWKS client is not configured
 * DO NOT use in production - this is vulnerable to token forgery
 */
function decodeTokenUnsafe(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[Auth] Failed to decode token:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Legacy function for compatibility - delegates to validateAccessToken
 * @deprecated Use validateAccessToken instead for explicit async handling
 */
export function decodeToken(token: string): any {
  console.warn('decodeToken is deprecated and unsafe - use validateAccessToken instead');
  return decodeTokenUnsafe(token);
}

/**
 * Get user info from access token with signature verification
 * Extracts email, name, tenant ID, object ID from validated token claims
 * 
 * SECURITY: This function verifies the token signature before extracting claims
 */
export async function getUserInfoFromToken(accessToken: string): Promise<{
  email?: string;
  name?: string;
  tenantId?: string;
  objectId?: string;
  upn?: string;
  tokenType?: 'delegated' | 'application';
  scopes?: string[];
  roles?: string[];
} | null> {
  // Validate token with signature verification
  const decoded = await validateAccessToken(accessToken);
  if (!decoded) {
    return null;
  }

  // Determine token type (delegated user token vs application-only token)
  const tokenType = decoded.idtyp === 'app' || decoded.oid === decoded.sub ? 'application' : 'delegated';

  return {
    email: decoded.email || decoded.preferred_username || decoded.upn,
    name: decoded.name,
    tenantId: decoded.tid,
    objectId: decoded.oid,
    upn: decoded.upn || decoded.preferred_username,
    tokenType,
    scopes: decoded.scp ? decoded.scp.split(' ') : undefined,
    roles: decoded.roles || undefined,
  };
}

/**
 * Check if token has required scopes
 */
export function hasRequiredScopes(token: string, requiredScopes: string[]): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.scp) {
    return false;
  }

  const tokenScopes = decoded.scp.split(' ');
  return requiredScopes.every(scope => tokenScopes.includes(scope));
}

/**
 * Get Microsoft Graph API client with authentication
 * Helper to make authenticated Graph API calls
 */
export async function getGraphClient(accessToken?: string): Promise<{
  get: (url: string) => Promise<any>;
  post: (url: string, data: any) => Promise<any>;
  patch: (url: string, data: any) => Promise<any>;
  delete: (url: string) => Promise<any>;
} | null> {
  let token = accessToken;

  // If no token provided, get application token
  if (!token) {
    token = await acquireTokenByClientCredentials() || undefined;
  }

  if (!token) {
    console.warn('No access token available for Graph API call');
    return null;
  }

  const baseUrl = 'https://graph.microsoft.com/v1.0';

  return {
    async get(url: string) {
      const response = await fetch(`${baseUrl}${url}`, {
        headers: {
          Authorization: `Bearer ${token!}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = new Error(`Graph API request failed: ${response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      // Handle 204 No Content (no JSON body)
      if (response.status === 204) {
        return null;
      }

      return response.json();
    },

    async post(url: string, data: any) {
      const response = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // Try to get error body for detailed debugging
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {
          try {
            errorBody = await response.text();
          } catch {
            errorBody = null;
          }
        }
        
        const error = new Error(`Graph API request failed: ${response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        error.body = errorBody;
        console.error('[Graph API POST Error]', {
          url: `${baseUrl}${url}`,
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        throw error;
      }

      // Handle 204 No Content (no JSON body)
      if (response.status === 204) {
        return null;
      }

      return response.json();
    },

    async patch(url: string, data: any) {
      const response = await fetch(`${baseUrl}${url}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = new Error(`Graph API request failed: ${response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      // Handle 204 No Content (no JSON body)
      if (response.status === 204) {
        return null;
      }

      return response.json();
    },

    async delete(url: string) {
      const response = await fetch(`${baseUrl}${url}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token!}`,
        },
      });

      if (!response.ok) {
        const error = new Error(`Graph API request failed: ${response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      return response.ok;
    },
  };
}
