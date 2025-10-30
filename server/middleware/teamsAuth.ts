/**
 * Microsoft Teams Authentication Middleware
 * 
 * In production, this would validate Microsoft Teams SSO tokens from Azure AD.
 * In development, uses a mock user for testing.
 * 
 * Integration flow:
 * 1. User opens app in Microsoft Teams
 * 2. Teams client provides SSO token
 * 3. Backend validates token with Azure AD
 * 4. Extract user info (email, name, Azure AD object ID)
 * 5. Load user from database or create on first login
 * 6. Attach user to request
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        clearanceLevel: string;
        role: string;
        department: string | null;
        organizationalUnit: string | null;
        azureAdId: string | null;
      };
    }
  }
}

/**
 * Validate Microsoft Teams SSO token (production implementation)
 * 
 * In production deployment:
 * 1. Extract JWT token from Authorization header
 * 2. Validate with Azure AD using Microsoft Graph API
 * 3. Extract user claims (email, name, object ID)
 */
async function validateTeamsToken(token: string): Promise<{
  email: string;
  displayName: string;
  azureAdId: string;
} | null> {
  // Production implementation would look like:
  /*
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    return null;
  }
  
  const userInfo = await response.json();
  return {
    email: userInfo.mail || userInfo.userPrincipalName,
    displayName: userInfo.displayName,
    azureAdId: userInfo.id
  };
  */
  
  // Development fallback - not used in production
  return null;
}

/**
 * Get or create user in database
 */
async function getOrCreateUser(userInfo: {
  email: string;
  displayName: string;
  azureAdId: string;
}) {
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
    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));
  }

  return user;
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

    console.log(`[AUTH] User authenticated: ${user.email} (clearance: ${user.clearanceLevel})`);
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
