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
import { users, userGroupCache } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import mockUsers from '../../config/mockUsers.json';
import { graphGroupSyncService } from '../services/graphGroupSync';

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
      ssoToken?: string; // Raw SSO token for On-Behalf-Of (OBO) flow with Graph API
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
      // Create or update mock user in database (upsert to avoid conflicts)
      const [newUser] = await db
        .insert(users)
        .values({
          email: mockUser.email,
          displayName: mockUser.displayName,
          clearanceLevel: mockUser.clearanceLevel as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
          role: mockUser.role as "admin" | "approver" | "auditor" | "viewer",
          department: mockUser.department,
          organizationalUnit: mockUser.organizationalUnit,
          azureAdId: mockUser.azureAdId,
          azureUserPrincipalName: mockUser.azureUserPrincipalName,
          tenantId: mockUser.tenantId,
          lastLogin: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            displayName: mockUser.displayName,
            clearanceLevel: mockUser.clearanceLevel as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
            role: mockUser.role as "admin" | "approver" | "auditor" | "viewer",
            lastLogin: new Date(),
          }
        })
        .returning();
      dbUser = newUser;
    }

    // Task 4.5: Fetch Azure AD groups (or use cached)
    let azureAdGroups = null;
    if (dbUser.azureAdId) {
      try {
        // Check session cache first (15-min TTL)
        if (session && session.azureAdGroups) {
          const cached = session.azureAdGroups;
          const now = new Date();
          const expiresAt = new Date(cached.expiresAt);
          
          if (now < expiresAt) {
            console.log(`✅ [Auth] Using session-cached Azure AD groups for ${dbUser.email}`);
            azureAdGroups = cached;
          } else {
            console.log(`⏰ [Auth] Session cache expired for ${dbUser.email}, fetching fresh groups`);
          }
        }
        
        // If no valid session cache, fetch from Graph API or DB cache
        if (!azureAdGroups) {
          // First, try database cache
          const cachedGroups = await graphGroupSyncService.getUserGroupsFromCache(dbUser.azureAdId);
          
          if (cachedGroups) {
            console.log(`✅ [Auth] Using DB-cached Azure AD groups for ${dbUser.email}`);
            azureAdGroups = {
              groupNames: cachedGroups.groupNames,
              clearanceLevel: cachedGroups.clearanceLevel,
              role: cachedGroups.role,
              fetchedAt: new Date(),
              expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 min from now
            };
            
            // BUG FIX: Store in session cache immediately
            if (session) {
              session.azureAdGroups = azureAdGroups;
            }
          } else {
            // Cache miss/expired - fetch fresh and cache
            console.log(`📡 [Auth] Fetching fresh Azure AD groups for ${dbUser.email}`);
            const freshGroups = await graphGroupSyncService.syncUserGroupsToCache(dbUser.azureAdId);
            
            if (freshGroups) {
              azureAdGroups = {
                groupNames: freshGroups.groupNames,
                clearanceLevel: freshGroups.clearanceLevel,
                role: freshGroups.role,
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
              };
              
              // BUG FIX: Store in session cache immediately
              if (session) {
                session.azureAdGroups = azureAdGroups;
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [Auth] Failed to fetch Azure AD groups for ${dbUser.email}:`, error);
        // Don't fail auth - fall back to database clearance/role
      }
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
      azureAdGroups: azureAdGroups,
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
  const requestId = Math.random().toString(36).substring(7);
  const logAuth = (stage: string, data?: any) => {
    console.log(`[AUTH-BE ${requestId}] ${stage}`, data ? JSON.stringify(data) : '');
  };
  
  logAuth('REQUEST_RECEIVED', { 
    method: req.method, 
    url: req.url,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderPreview: req.headers.authorization ? `${req.headers.authorization.substring(0, 20)}...` : 'none'
  });
  
  try {
    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAuth('NO_BEARER_TOKEN', { authHeader: authHeader || 'missing' });
      
      // Check session for stored token
      const session = req.session as any;
      if (session && session.accessToken) {
        logAuth('USING_SESSION_TOKEN', { tokenLength: session.accessToken.length });
        await validateAndLoadUser(session.accessToken, req, res, next, logAuth);
        return;
      }

      logAuth('AUTH_FAILED', { reason: 'No token in header or session' });
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    logAuth('TOKEN_EXTRACTED', { 
      tokenLength: accessToken.length,
      tokenPreview: `${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)}`
    });
    
    await validateAndLoadUser(accessToken, req, res, next, logAuth);
  } catch (error) {
    logAuth('AUTH_ERROR', { error: error instanceof Error ? error.message : String(error) });
    console.error('Error in Microsoft authentication:', error);
    res.status(401).json({ message: 'Invalid authentication token' });
  }
}

// Admin email list - these users always get admin role regardless of Azure AD groups
// Set ADMIN_EMAILS environment variable as comma-separated list, or use defaults
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ChristopherBecraft@ChrisBecraft.onmicrosoft.com').toLowerCase().split(',').map(e => e.trim());

/**
 * Validate JWT token and load/create user
 */
async function validateAndLoadUser(
  accessToken: string,
  req: Request,
  res: Response,
  next: NextFunction,
  logAuth?: (stage: string, data?: any) => void
): Promise<void> {
  const log = logAuth || ((stage: string, data?: any) => console.log(`[AUTH-BE] ${stage}`, data || ''));
  
  log('VALIDATING_TOKEN', { tokenLength: accessToken.length });
  
  // Validate token with signature verification
  const tokenInfo = await getUserInfoFromToken(accessToken);
  
  if (!tokenInfo || !tokenInfo.objectId) {
    log('TOKEN_INVALID', { tokenInfo: tokenInfo ? 'missing objectId' : 'null' });
    res.status(401).json({ message: 'Invalid token' });
    return;
  }
  
  log('TOKEN_VALID', { 
    email: tokenInfo.email,
    objectId: tokenInfo.objectId?.substring(0, 8) + '...',
    tenantId: tokenInfo.tenantId?.substring(0, 8) + '...',
    tokenType: tokenInfo.tokenType
  });

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

  // Check if user is in admin email list (permanent super-admin access)
  const userEmail = (tokenInfo.email || '').toLowerCase();
  const isAdminEmail = ADMIN_EMAILS.includes(userEmail);
  
  if (isAdminEmail) {
    log('ADMIN_EMAIL_DETECTED', { email: tokenInfo.email });
  }

  // Load or create user in database
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.azureAdId, tokenInfo.objectId))
    .limit(1);

  if (!user) {
    // Auto-provision user on first login
    console.log(`Auto-provisioning new user: ${tokenInfo.email} (admin: ${isAdminEmail})`);

    const [newUser] = await db
      .insert(users)
      .values({
        email: tokenInfo.email || 'unknown@dod.gov',
        displayName: tokenInfo.name || 'Unknown User',
        clearanceLevel: isAdminEmail ? 'TOP_SECRET' : 'UNCLASSIFIED',
        role: isAdminEmail ? 'admin' : 'viewer',
        azureAdId: tokenInfo.objectId,
        azureUserPrincipalName: tokenInfo.upn || tokenInfo.email,
        tenantId: tokenInfo.tenantId,
        lastLogin: new Date(),
        lastGraphSync: null,
      })
      .returning();

    user = newUser;
  } else {
    // Update last login AND ensure admin emails always have admin role
    if (isAdminEmail && (user.role !== 'admin' || user.clearanceLevel !== 'TOP_SECRET')) {
      console.log(`[Auth] Promoting ${user.email} to admin (in ADMIN_EMAILS list)`);
      await db
        .update(users)
        .set({ 
          lastLogin: new Date(),
          role: 'admin',
          clearanceLevel: 'TOP_SECRET'
        })
        .where(eq(users.id, user.id));
      user.role = 'admin';
      user.clearanceLevel = 'TOP_SECRET';
    } else {
      await db
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
    }
  }

  // SIMPLIFIED: Skip Azure AD group sync for demo/pilot
  // All authenticated users can access the app - access control is handled at the meeting level
  const azureAdGroups = null;
  log('AUTH_SUCCESS', { 
    email: user.email, 
    role: user.role, 
    clearanceLevel: user.clearanceLevel,
    isAdminEmail: isAdminEmail 
  });

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
    azureAdGroups: azureAdGroups,
  };
  
  // Store SSO token for On-Behalf-Of flow (Graph API calls with delegated permissions)
  req.ssoToken = accessToken;

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
