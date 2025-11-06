/**
 * User Authentication Middleware
 * 
 * Validates user authentication via:
 * 1. Microsoft Teams SSO (real mode) - validates JWT tokens from Azure AD
 * 2. Mock authentication (development mode) - uses config/mockUsers.json
 * 
 * Attaches authenticated user to request.user
 */

import type { Request, Response, NextFunction } from 'express';
import { getConfig } from '../services/configValidator';
import { getUserInfoFromToken, decodeToken } from '../services/microsoftIdentity';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import mockUsers from '../../config/mockUsers.json';

// Extend Express Request type to include user
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
        azureAdGroups?: {
          groupNames: string[];
          clearanceLevel: string;
          role: string;
          fetchedAt: Date;
          expiresAt: Date;
        } | null; // Azure AD group membership with TTL (Task 4.3)
      };
      session: any; // Session from express-session
    }
  }
}

/**
 * Authenticate user middleware
 * Validates JWT token or uses mock auth in development
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const config = getConfig();

  // Use mock authentication in development mode
  if (config.useMockServices) {
    await authenticateWithMock(req, res, next);
    return;
  }

  // Use real Microsoft SSO authentication
  await authenticateWithMicrosoft(req, res, next);
}

/**
 * Mock authentication for development
 * Uses session to simulate authenticated user
 */
async function authenticateWithMock(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if user is already in session
    const session = req.session as any;
    if (session && session.userId) {
      // Load user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          clearanceLevel: user.clearanceLevel,
          role: user.role,
          department: user.department,
          organizationalUnit: user.organizationalUnit,
          azureAdId: user.azureAdId,
        };
        next();
        return;
      }
    }

    // If no session, use default mock user
    const defaultEmail = mockUsers.defaultUser;
    const mockUser = mockUsers.users.find(u => u.email === defaultEmail);

    if (!mockUser) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Ensure mock user exists in database
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, mockUser.email))
      .limit(1);

    if (!dbUser) {
      // Create mock user in database
      const [newUser] = await db
        .insert(users)
        .values({
          email: mockUser.email,
          displayName: mockUser.displayName,
          clearanceLevel: mockUser.clearanceLevel,
          role: mockUser.role,
          department: mockUser.department,
          organizationalUnit: mockUser.organizationalUnit,
          azureAdId: mockUser.azureAdId,
          azureUserPrincipalName: mockUser.azureUserPrincipalName,
          tenantId: mockUser.tenantId,
          lastLogin: new Date(),
        })
        .returning();
      dbUser = newUser;
    }

    // Set user in request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      clearanceLevel: dbUser.clearanceLevel,
      role: dbUser.role,
      department: dbUser.department,
      organizationalUnit: dbUser.organizationalUnit,
      azureAdId: dbUser.azureAdId,
    };

    // Store in session
    if (session) {
      session.userId = dbUser.id;
    }

    next();
  } catch (error) {
    console.error('Error in mock authentication:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * Microsoft SSO authentication
 * Validates JWT token from Azure AD and loads/creates user
 */
async function authenticateWithMicrosoft(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check session for stored token
      const session = req.session as any;
      if (session && session.accessToken) {
        await validateAndLoadUser(session.accessToken, req, res, next);
        return;
      }

      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    await validateAndLoadUser(accessToken, req, res, next);
  } catch (error) {
    console.error('Error in Microsoft authentication:', error);
    res.status(401).json({ message: 'Invalid authentication token' });
  }
}

/**
 * Validate JWT token and load/create user
 */
async function validateAndLoadUser(
  accessToken: string,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Validate token with signature verification
  const tokenInfo = await getUserInfoFromToken(accessToken);
  if (!tokenInfo || !tokenInfo.objectId) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  // Check if token is expired (redundant check - validateAccessToken already checks expiry)
  const decoded = decodeToken(accessToken);
  if (!decoded || !decoded.exp) {
    res.status(401).json({ message: 'Invalid token format' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp < now) {
    res.status(401).json({ message: 'Token expired' });
    return;
  }

  // Load or create user in database
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.azureAdId, tokenInfo.objectId))
    .limit(1);

  if (!user) {
    // Auto-provision user on first login
    console.log(`Auto-provisioning new user: ${tokenInfo.email}`);

    const [newUser] = await db
      .insert(users)
      .values({
        email: tokenInfo.email || 'unknown@dod.gov',
        displayName: tokenInfo.name || 'Unknown User',
        clearanceLevel: 'UNCLASSIFIED', // Default clearance (Azure AD groups will determine actual clearance)
        role: 'viewer', // Default role
        azureAdId: tokenInfo.objectId,
        azureUserPrincipalName: tokenInfo.upn || tokenInfo.email,
        tenantId: tokenInfo.tenantId,
        lastLogin: new Date(),
        lastGraphSync: null, // Will be synced by Azure AD group sync service
      })
      .returning();

    user = newUser;
  } else {
    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));
  }

  // Set user in request
  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    clearanceLevel: user.clearanceLevel,
    role: user.role,
    department: user.department,
    organizationalUnit: user.organizationalUnit,
    azureAdId: user.azureAdId,
  };

  // Store in session
  const session = req.session as any;
  if (session) {
    session.userId = user.id;
    session.accessToken = accessToken;
  }

  next();
}

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Require specific role middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Require specific clearance level middleware
 */
export function requireClearance(...levels: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!levels.includes(req.user.clearanceLevel)) {
      res.status(403).json({ message: 'Insufficient clearance level' });
      return;
    }

    next();
  };
}
