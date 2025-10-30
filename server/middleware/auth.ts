import type { Request, Response, NextFunction } from "express";

// Authentication middleware - placeholder for Azure AD integration
// In production, this should verify Microsoft Identity Platform JWT tokens
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // TODO: Replace with actual Azure AD authentication
  // For now, this is a placeholder that should be replaced with proper Microsoft Identity Platform authentication
  // See INSTALLATION.md for Azure AD app registration and token verification setup
  
  const authHeader = req.headers.authorization;
  const sessionToken = req.headers['x-session-token'] as string;
  
  // Temporary development bypass - REMOVE IN PRODUCTION
  if (process.env.NODE_ENV === 'development') {
    // In development, allow all requests
    // This MUST be replaced with proper authentication before deployment
    return next();
  }
  
  // ⚠️ CRITICAL: Production authentication check PLACEHOLDER
  // This section MUST be implemented before production deployment
  if (!authHeader && !sessionToken) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Please provide valid credentials.",
        details: {
          required: "Bearer token or session token",
          hint: "Authenticate via Microsoft Identity Platform"
        }
      }
    });
  }
  
  /* 
   * ⚠️⚠️⚠️ PRODUCTION IMPLEMENTATION REQUIRED ⚠️⚠️⚠️
   * 
   * The code below is a PLACEHOLDER and provides NO real security.
   * Before deploying to production, you MUST implement Azure AD JWT verification:
   * 
   * Required Steps:
   * 1. Install JWT library: npm install jsonwebtoken jwks-rsa
   * 2. Extract token: const token = authHeader.replace('Bearer ', '')
   * 3. Fetch Azure AD signing keys from: 
   *    https://login.microsoftonline.us/{tenantId}/discovery/v2.0/keys
   * 4. Verify token signature using Azure AD public keys
   * 5. Validate claims:
   *    - iss: https://sts.windows.net/{tenantId}/
   *    - aud: {clientId} (your app's client ID)
   *    - exp: token not expired
   *    - nbf: token is valid now
   * 6. Extract user info from token claims (oid, email, roles, etc.)
   * 7. Query user directory for security clearance level
   * 8. Attach verified user context to request
   * 
   * Example implementation:
   * 
   *   const jwt = require('jsonwebtoken');
   *   const jwksClient = require('jwks-rsa');
   *   
   *   const client = jwksClient({
   *     jwksUri: `https://login.microsoftonline.us/${tenantId}/discovery/v2.0/keys`
   *   });
   *   
   *   function getKey(header, callback) {
   *     client.getSigningKey(header.kid, (err, key) => {
   *       const signingKey = key.publicKey || key.rsaPublicKey;
   *       callback(null, signingKey);
   *     });
   *   }
   *   
   *   const token = authHeader.replace('Bearer ', '');
   *   jwt.verify(token, getKey, {
   *     audience: clientId,
   *     issuer: `https://sts.windows.net/${tenantId}/`,
   *     algorithms: ['RS256']
   *   }, (err, decoded) => {
   *     if (err) return res.status(401).json({ error: 'Invalid token' });
   *     req.user = {
   *       id: decoded.oid,
   *       email: decoded.email || decoded.upn,
   *       roles: decoded.roles || [],
   *       clearanceLevel: lookupClearanceLevel(decoded.oid)
   *     };
   *     next();
   *   });
   * 
   * See INSTALLATION.md and CONFIGURATION.md for complete setup instructions.
   */
  
  // ⚠️ TEMPORARY PLACEHOLDER - REPLACE BEFORE PRODUCTION ⚠️
  console.error(
    "\n" +
    "═══════════════════════════════════════════════════════════════\n" +
    "⚠️  WARNING: Using placeholder authentication - NOT SECURE!\n" +
    "⚠️  This provides NO real authentication or authorization.\n" +
    "⚠️  MUST implement Azure AD JWT verification before production.\n" +
    "⚠️  See server/middleware/auth.ts for implementation guide.\n" +
    "═══════════════════════════════════════════════════════════════\n"
  );
  
  // Placeholder user context - REPLACE WITH REAL TOKEN VALIDATION
  (req as any).user = {
    id: "placeholder-user-id",
    email: "user@dod.gov",
    roles: ["user"],
    clearanceLevel: "SECRET" // MUST be fetched from real user profile
  };
  
  next();
}

// Authorization middleware - check user permissions
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required"
        }
      });
    }
    
    const hasRole = user.roles?.some((role: string) => roles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
          details: {
            required: roles,
            actual: user.roles
          }
        }
      });
    }
    
    next();
  };
}

// Classification level check - ensure user can access documents at this level
export function requireClearance(classificationLevel: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required"
        }
      });
    }
    
    // TODO: Implement actual clearance level checking against user profile
    // This should verify user's security clearance from Azure AD or database
    
    const clearanceLevels = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET'];
    const requiredLevel = clearanceLevels.indexOf(classificationLevel);
    const userClearance = user.clearanceLevel || 'UNCLASSIFIED';
    const userLevel = clearanceLevels.indexOf(userClearance);
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient security clearance",
          details: {
            required: classificationLevel,
            actual: userClearance
          }
        }
      });
    }
    
    next();
  };
}
