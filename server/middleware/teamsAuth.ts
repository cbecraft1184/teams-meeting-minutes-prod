/**
 * Microsoft Teams Authentication Middleware
 * 
 * In production, validates Microsoft Teams SSO tokens using OBO (On-Behalf-Of) flow.
 * In development, uses a mock user for testing.
 * 
 * Integration flow:
 * 1. User opens app in Microsoft Teams
 * 2. Teams client provides SSO token (scoped to app)
 * 3. Backend exchanges SSO token for Graph token via OBO
 * 4. Backend calls Graph API to get user info
 * 5. Load user from database or create on first login
 * 6. Attach user to request
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { acquireTokenOnBehalfOf } from "../services/microsoftIdentity";

// Note: Express Request type extension is defined in authenticateUser.ts
// This file extends: user, session, and ssoToken properties

/**
 * Decode JWT token to extract user claims without validation
 * Used as fallback when OBO flow fails
 */
function decodeJwtClaims(token: string): { upn?: string; name?: string; oid?: string; tid?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return {
      upn: payload.upn || payload.preferred_username || payload.unique_name,
      name: payload.name,
      oid: payload.oid,
      tid: payload.tid
    };
  } catch (e) {
    return null;
  }
}

/**
 * Validate Microsoft Teams SSO token using On-Behalf-Of (OBO) flow
 * 
 * SECURITY: This function ONLY trusts tokens that successfully complete the OBO exchange.
 * The OBO flow validates the SSO token's signature with Azure AD before issuing a Graph token.
 * There is NO fallback to unvalidated token claims - this prevents token forgery attacks.
 * 
 * Production deployment:
 * 1. Extract JWT token from Authorization header
 * 2. Exchange SSO token for Graph token using OBO flow (validates signature)
 * 3. Call Graph API /me endpoint with Graph token
 * 4. Extract user claims (email, name, object ID)
 */
async function validateTeamsToken(ssoToken: string): Promise<{
  email: string;
  displayName: string;
  azureAdId: string;
} | null> {
  try {
    console.log('[AUTH] Starting SSO token validation via OBO flow');
    
    // Log token claims for debugging only - DO NOT trust these for authentication
    const tokenClaims = decodeJwtClaims(ssoToken);
    if (tokenClaims) {
      console.log('[AUTH] SSO Token claims (for debugging):', {
        upn: tokenClaims.upn,
        name: tokenClaims.name,
        oid: tokenClaims.oid,
        tid: tokenClaims.tid
      });
    }
    
    // Use OBO flow to exchange SSO token for Graph token
    // This validates the SSO token's signature with Azure AD
    // Using resource-qualified scope as required by MSAL
    let graphToken: string | null = null;
    try {
      graphToken = await acquireTokenOnBehalfOf(ssoToken, ['https://graph.microsoft.com/.default']);
      if (graphToken) {
        console.log('[AUTH] OBO flow succeeded, acquired Graph token');
      } else {
        console.error('[AUTH] OBO flow returned null token');
        return null;
      }
    } catch (oboError: any) {
      console.error('[AUTH] OBO flow failed:', oboError?.message || oboError);
      console.error('[AUTH] OBO error details:', JSON.stringify(oboError, null, 2));
      // SECURITY: Do NOT fall back to unvalidated token claims
      // The OBO failure means we cannot verify the token's authenticity
      return null;
    }
    
    // OBO succeeded - call Graph API to get user info
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${graphToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AUTH] Graph API call failed: ${response.status} ${response.statusText}`, errorText);
      return null;
    }
    
    const userInfo = await response.json();
    console.log('[AUTH] Graph API user info:', {
      mail: userInfo.mail,
      upn: userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      id: userInfo.id
    });
    
    return {
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      azureAdId: userInfo.id
    };
  } catch (error: any) {
    console.error("[AUTH] Error validating Teams token:", error);
    return null;
  }
}

/**
 * Get or create user in database
 */
async function getOrCreateUser(userInfo: {
  email: string;
  displayName: string;
  azureAdId: string;
}) {
  try {
    // Try to find existing user by email or Azure AD ID
    let user = await db.query.users.findFirst({
      where: eq(users.email, userInfo.email)
    });

    if (!user) {
      // Create new user on first login
      const [newUser] = await db.insert(users).values({
        email: userInfo.email,
        displayName: userInfo.displayName,
        azureAdId: userInfo.azureAdId,
        clearanceLevel: "UNCLASSIFIED", // Default clearance - admin must update
        role: "viewer", // Default role
        department: null,
        organizationalUnit: null,
        lastLogin: new Date(),
      }).returning();
      
      user = newUser;
      console.log(`[AUTH] New user created: ${userInfo.email}`);
    } else {
      // Update last login and Azure AD ID if needed
      await db.update(users)
        .set({ 
          lastLogin: new Date(),
          azureAdId: userInfo.azureAdId,
          displayName: userInfo.displayName
        })
        .where(eq(users.id, user.id));
      
      // Refresh user data
      user = await db.query.users.findFirst({
        where: eq(users.id, user.id)
      });
    }

    return user;
  } catch (error: any) {
    // If duplicate key error, try to fetch the user again
    if (error.code === '23505') {
      const user = await db.query.users.findFirst({
        where: eq(users.email, userInfo.email)
      });
      if (user) {
        return user;
      }
    }
    throw error;
  }
}

/**
 * Teams Authentication Middleware
 * 
 * Validates Teams SSO token and attaches user to request
 */
export async function teamsAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (process.env.NODE_ENV === "development") {
      // Development mode: Use mock user
      // In production, this would be replaced with real Teams SSO validation
      const mockUser = await getOrCreateUser({
        email: "john.doe@dod.gov",
        displayName: "John Doe",
        azureAdId: "mock-azure-id-123"
      });

      req.user = mockUser;
      return next();
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authentication token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate token with Azure AD
    const userInfo = await validateTeamsToken(token);
    if (!userInfo) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    // Get or create user in database
    const user = await getOrCreateUser(userInfo);
    
    // Attach user to request
    req.user = user;
    
    // Store raw SSO token for On-Behalf-Of flow (Graph API calls with delegated permissions)
    req.ssoToken = token;

    if (user) {
      console.log(`[AUTH] User authenticated: ${user.email} (clearance: ${user.clearanceLevel})`);
    }
    next();
  } catch (error: any) {
    console.error("[AUTH] Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Require specific role middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Require specific clearance level middleware
 */
export function requireClearance(requiredLevel: string) {
  const CLEARANCE_LEVELS = {
    "UNCLASSIFIED": 0,
    "CONFIDENTIAL": 1,
    "SECRET": 2,
    "TOP_SECRET": 3
  } as const;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userClearance = CLEARANCE_LEVELS[req.user.clearanceLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    const requiredClearance = CLEARANCE_LEVELS[requiredLevel as keyof typeof CLEARANCE_LEVELS] || 0;

    if (userClearance < requiredClearance) {
      return res.status(403).json({ 
        error: "Insufficient clearance level",
        required: requiredLevel,
        current: req.user.clearanceLevel
      });
    }

    next();
  };
}
