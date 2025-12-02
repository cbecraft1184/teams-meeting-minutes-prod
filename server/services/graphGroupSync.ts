/**
 * Azure AD Group Synchronization Service
 * 
 * Fetches user's Azure AD group memberships from Microsoft Graph API
 * and normalizes them to clearance levels and roles for access control.
 * 
 * Architecture:
 * - Primary: Fetch groups from Graph API (GET /users/{userId}/memberOf)
 * - Normalization: Extract clearance level + role from group names
 * - Pagination: Handle up to 50 pages (5,000 groups max)
 * - Throttling: Retry on 429 with exponential backoff
 * - Security: Fail-closed on errors (deny access)
 */

import { getGraphClient } from "./microsoftIdentity";
import { db } from '../db';
import { userGroupCache, classificationLevelEnum, userRoleEnum } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * User's normalized Azure AD groups
 */
export interface UserGroups {
  clearanceLevel: string | null;  // Highest clearance: UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET
  role: string | null;             // Highest role: viewer, approver, auditor, admin
  groupNames: string[];            // Raw group display names for audit
  source: 'graph' | 'mock' | 'cache'; // Data source
}

/**
 * Azure AD group from Graph API
 */
interface GraphGroup {
  id: string;
  displayName: string;
  mailNickname?: string;
}

/**
 * Clearance level hierarchy (higher number = higher clearance)
 */
const CLEARANCE_HIERARCHY = {
  'UNCLASSIFIED': 0,
  'CONFIDENTIAL': 1,
  'SECRET': 2,
  'TOP_SECRET': 3
} as const;

/**
 * Role hierarchy (higher number = higher privilege)
 */
const ROLE_HIERARCHY = {
  'viewer': 0,
  'approver': 1,
  'auditor': 2,
  'admin': 3
} as const;

/**
 * Configuration
 */
const MAX_PAGES = 50;           // Maximum pagination iterations
const PAGE_SIZE = 100;          // Groups per page (Graph API default)
const REQUEST_TIMEOUT = 30000;  // 30 seconds total timeout
const RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff for 429
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache TTL (Task 4.3)

/**
 * Get designated admin emails from environment variable
 * Format: DESIGNATED_ADMINS=email1@domain.com,email2@domain.com
 * These users get admin role and TOP_SECRET clearance regardless of group membership
 */
function getDesignatedAdmins(): string[] {
  const admins = process.env.DESIGNATED_ADMINS || '';
  return admins.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
}

/**
 * Azure AD Group Synchronization Service
 */
export class GraphGroupSyncService {
  
  /**
   * Check if email is a designated admin (bypasses Azure AD group requirements)
   * Uses DESIGNATED_ADMINS environment variable
   */
  isDesignatedAdmin(email: string): boolean {
    const designatedAdmins = getDesignatedAdmins();
    const isAdmin = designatedAdmins.includes(email.toLowerCase());
    if (isAdmin) {
      console.log(`👑 [GraphGroupSync] ${email} is a DESIGNATED ADMIN`);
    }
    return isAdmin;
  }
  
  /**
   * Get admin groups for designated admin users
   */
  getDesignatedAdminGroups(): UserGroups {
    return {
      clearanceLevel: 'TOP_SECRET',
      role: 'admin',
      groupNames: ['DESIGNATED-ADMIN'],
      source: 'mock'
    };
  }
  
  /**
   * Fetch user's Azure AD groups and normalize to clearance + role
   * 
   * @param azureAdId - User's Azure AD object ID
   * @param accessToken - Optional access token (for non-authenticated contexts)
   * @param userEmail - Optional email to check for designated admin override
   * @returns Normalized user groups
   * 
   * Note: forceRefresh option removed until Task 4.3 implements caching
   */
  async fetchUserGroups(
    azureAdId: string,
    accessToken?: string,
    userEmail?: string
  ): Promise<UserGroups> {
    // Check if user is a designated admin (bypasses all Azure AD requirements)
    if (userEmail && this.isDesignatedAdmin(userEmail)) {
      return this.getDesignatedAdminGroups();
    }
    
    // Match configValidator logic: default to mock mode in dev (when undefined)
    const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                            process.env.USE_MOCK_SERVICES === undefined;
    
    // Mock mode: Return fake groups for testing
    if (useMockServices) {
      console.log(`🔧 [GraphGroupSync] Using MOCK groups for ${azureAdId}`);
      return this.getMockUserGroups(azureAdId);
    }
    
    try {
      console.log(`🔍 [GraphGroupSync] Fetching groups for Azure AD user: ${azureAdId}`);
      
      // Fetch all group memberships with pagination
      const groups = await this.fetchAllGroups(azureAdId, accessToken);
      
      // Extract group display names
      const groupNames = groups.map(g => g.displayName);
      
      // Normalize to clearance level + role
      const clearanceLevel = this.extractClearanceLevel(groupNames);
      const role = this.extractRole(groupNames);
      
      console.log(`✅ [GraphGroupSync] User groups: Clearance=${clearanceLevel || 'NONE'}, Role=${role || 'viewer'}, Groups=${groupNames.length}`);
      
      return {
        clearanceLevel,
        role,
        groupNames,
        source: 'graph'
      };
      
    } catch (error: any) {
      console.error(`❌ [GraphGroupSync] Failed to fetch groups for ${azureAdId}:`, error.message);
      
      // Fail-closed: Deny access on error
      return {
        clearanceLevel: null,
        role: null,
        groupNames: [],
        source: 'graph'
      };
    }
  }
  
  /**
   * Fetch all user groups with pagination and 429 retry logic
   * Handles Microsoft Graph API pagination (@odata.nextLink)
   * 
   * SECURITY: Treats timeout/max-pages as ERRORS (fail-closed)
   */
  private async fetchAllGroups(
    azureAdId: string,
    accessToken?: string
  ): Promise<GraphGroup[]> {
    const graphClient = await getGraphClient(accessToken);
    
    if (!graphClient) {
      throw new Error('Failed to acquire Graph API client');
    }
    
    const allGroups: GraphGroup[] = [];
    let nextUrl: string | null = `/users/${azureAdId}/memberOf?$top=${PAGE_SIZE}`;
    let pageCount = 0;
    
    const startTime = Date.now();
    
    // Initial request
    let response = await this.fetchWithRetry(graphClient, nextUrl);
    
    // Process first page
    if (response.value && Array.isArray(response.value)) {
      allGroups.push(...response.value);
      pageCount++;
    }
    
    nextUrl = response['@odata.nextLink'] || null;
    
    // Paginate through remaining pages
    while (nextUrl && pageCount < MAX_PAGES) {
      // SECURITY: Timeout = ERROR (fail-closed, not partial success)
      if (Date.now() - startTime > REQUEST_TIMEOUT) {
        console.error(`❌ [GraphGroupSync] Request timeout after ${pageCount} pages - FAILING CLOSED`);
        throw new Error(`Graph API timeout after ${pageCount} pages`);
      }
      
      // Extract relative URL from @odata.nextLink (may be absolute)
      const url = nextUrl.startsWith('http') 
        ? new URL(nextUrl).pathname + new URL(nextUrl).search
        : nextUrl;
      
      // Fetch next page with retry
      response = await this.fetchWithRetry(graphClient, url);
      
      if (response.value && Array.isArray(response.value)) {
        allGroups.push(...response.value);
        pageCount++;
      }
      
      nextUrl = response['@odata.nextLink'] || null;
    }
    
    // SECURITY: Max pages = ERROR (fail-closed, not partial success)
    if (pageCount >= MAX_PAGES && nextUrl) {
      console.error(`❌ [GraphGroupSync] Hit max pages limit (${MAX_PAGES}) with more data - FAILING CLOSED`);
      throw new Error(`Too many groups (>${MAX_PAGES * PAGE_SIZE}), hit pagination limit`);
    }
    
    console.log(`📊 [GraphGroupSync] Fetched ${allGroups.length} groups across ${pageCount} pages`);
    
    return allGroups;
  }
  
  /**
   * Fetch with exponential backoff retry on 429
   * Implements retry logic using RETRY_DELAYS
   * 
   * SECURITY: All errors fail-closed (including 404)
   */
  private async fetchWithRetry(
    graphClient: NonNullable<Awaited<ReturnType<typeof getGraphClient>>>,
    url: string,
    attempt: number = 0
  ): Promise<any> {
    try {
      return await graphClient.get(url);
      
    } catch (error: any) {
      // Extract status code from structured error
      const statusCode = error.status ?? error.response?.status ?? 500;
      
      // Handle throttling (429 Too Many Requests) with retry
      if (statusCode === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`⏳ [GraphGroupSync] Throttled (429), retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        
        // Wait for delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry with next attempt
        return this.fetchWithRetry(graphClient, url, attempt + 1);
      }
      
      // SECURITY: 404 = FAIL CLOSED (user doesn't exist or not authorized)
      if (statusCode === 404) {
        console.error(`❌ [GraphGroupSync] User/resource not found (404), FAILING CLOSED: ${url}`);
        throw new Error(`User not found in Azure AD (404) - denying access`);
      }
      
      // Handle unauthorized (401/403)
      if (statusCode === 401 || statusCode === 403) {
        console.error(`🔒 [GraphGroupSync] Unauthorized (${statusCode}): ${url}`);
        throw new Error(`Unauthorized to fetch groups (${statusCode})`);
      }
      
      // Max retries exceeded for 429
      if (statusCode === 429) {
        console.error(`❌ [GraphGroupSync] Max 429 retries exceeded (${RETRY_DELAYS.length})`);
        throw new Error(`Graph API throttled, max retries exceeded`);
      }
      
      // Re-throw all other errors (fail-closed)
      console.error(`❌ [GraphGroupSync] Graph API error (${statusCode}): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extract highest clearance level from group names
   * Searches for groups matching pattern: DOD-Clearance-{LEVEL}
   * 
   * @param groupNames - Array of Azure AD group display names
   * @returns Highest clearance level or null if no clearance group found
   */
  private extractClearanceLevel(groupNames: string[]): string | null {
    const clearanceGroups = groupNames.filter(name => 
      name.startsWith('DOD-Clearance-')
    );
    
    if (clearanceGroups.length === 0) {
      console.warn(`⚠️  [GraphGroupSync] No clearance groups found, denying access`);
      return null; // No clearance group = deny access
    }
    
    // Find highest clearance level
    let highestClearance: string | null = null;
    let highestLevel = -1;
    
    for (const groupName of clearanceGroups) {
      const level = groupName.replace('DOD-Clearance-', '');
      const hierarchy = CLEARANCE_HIERARCHY[level as keyof typeof CLEARANCE_HIERARCHY];
      
      if (hierarchy !== undefined && hierarchy > highestLevel) {
        highestLevel = hierarchy;
        highestClearance = level;
      }
    }
    
    return highestClearance;
  }
  
  /**
   * Extract highest role from group names
   * Searches for groups matching pattern: DOD-Role-{ROLE}
   * 
   * @param groupNames - Array of Azure AD group display names
   * @returns Highest role or 'viewer' (default)
   */
  private extractRole(groupNames: string[]): string | null {
    const roleGroups = groupNames.filter(name => 
      name.startsWith('DOD-Role-')
    );
    
    if (roleGroups.length === 0) {
      console.log(`ℹ️  [GraphGroupSync] No role groups found, defaulting to 'viewer'`);
      return 'viewer'; // Default role if no role group
    }
    
    // Find highest role
    let highestRole: string = 'viewer';
    let highestLevel = -1;
    
    for (const groupName of roleGroups) {
      const role = groupName.replace('DOD-Role-', '').toLowerCase();
      const hierarchy = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY];
      
      if (hierarchy !== undefined && hierarchy > highestLevel) {
        highestLevel = hierarchy;
        highestRole = role;
      }
    }
    
    return highestRole;
  }
  
  /**
   * Get mock user groups for testing
   * Returns different groups based on Azure AD ID pattern
   */
  private getMockUserGroups(azureAdId: string): UserGroups {
    console.log(`🧪 [GraphGroupSync] Mock mode: Simulating groups for ${azureAdId}`);
    
    // Different mock scenarios based on user ID
    if (azureAdId.includes('admin')) {
      return {
        clearanceLevel: 'SECRET',
        role: 'admin',
        groupNames: [
          'DOD-Clearance-SECRET',
          'DOD-Role-Admin',
          'DOD-IT-Department',
          'All-Employees'
        ],
        source: 'mock'
      };
    }
    
    if (azureAdId.includes('approver')) {
      return {
        clearanceLevel: 'CONFIDENTIAL',
        role: 'approver',
        groupNames: [
          'DOD-Clearance-CONFIDENTIAL',
          'DOD-Role-Approver',
          'DOD-Operations-Team'
        ],
        source: 'mock'
      };
    }
    
    if (azureAdId.includes('auditor')) {
      return {
        clearanceLevel: 'TOP_SECRET',
        role: 'auditor',
        groupNames: [
          'DOD-Clearance-TOP_SECRET',
          'DOD-Role-Auditor',
          'DOD-Audit-Team'
        ],
        source: 'mock'
      };
    }
    
    // Default: Regular approver with UNCLASSIFIED clearance (for testing approval workflow)
    return {
      clearanceLevel: 'UNCLASSIFIED',
      role: 'approver',
      groupNames: [
        'DOD-Clearance-UNCLASSIFIED',
        'DOD-Role-Approver',
        'All-Employees'
      ],
      source: 'mock'
    };
  }
  
  /**
   * Sync user groups to database cache (optional)
   * Used for offline queries and background jobs
   * 
   * Task 4.3: Implements 15-minute TTL database cache
   * 
   * @param azureAdId - Azure AD object ID
   * @returns Cached group data or null on failure
   */
  async syncUserGroupsToCache(azureAdId: string): Promise<UserGroups | null> {
    try {
      // Fetch fresh groups from Graph API (or mock)
      const groups = await this.fetchUserGroups(azureAdId);
      
      if (!groups) {
        console.warn(`⚠️  [GraphGroupSync] No groups to cache for ${azureAdId}`);
        return null;
      }
      
      // SECURITY: Fail-closed behavior - do NOT cache partial/invalid Azure AD data
      // If clearanceLevel or role is null, the fetch failed - return null and don't cache
      if (!groups.clearanceLevel || !groups.role) {
        console.warn(`⚠️  [GraphGroupSync] Incomplete Azure AD data for ${azureAdId} (clearance: ${groups.clearanceLevel}, role: ${groups.role}) - NOT caching`);
        console.warn(`⚠️  [GraphGroupSync] User will fall back to database clearance/role`);
        return null; // Don't cache invalid data - preserve fail-closed security
      }
      
      // Calculate expiration (15 minutes from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL);
      
      // Upsert to database cache (insert or update if exists)
      // Only cache VALID Azure AD data (clearanceLevel and role are non-null)
      await db
        .insert(userGroupCache)
        .values({
          azureAdId,
          groupNames: groups.groupNames,
          clearanceLevel: groups.clearanceLevel as (typeof classificationLevelEnum.enumValues)[number],
          role: groups.role as (typeof userRoleEnum.enumValues)[number],
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: userGroupCache.azureAdId,
          set: {
            groupNames: groups.groupNames,
            clearanceLevel: groups.clearanceLevel as (typeof classificationLevelEnum.enumValues)[number],
            role: groups.role as (typeof userRoleEnum.enumValues)[number],
            fetchedAt: now,
            expiresAt,
          },
        });
      
      console.log(`✅ [GraphGroupSync] Cached VALID Azure AD groups for ${azureAdId} (${groups.role}/${groups.clearanceLevel}, expires in 15min)`);
      return groups;
      
    } catch (error) {
      console.error(`❌ [GraphGroupSync] Failed to sync groups to cache:`, error);
      // Don't throw - cache sync is optional (fail gracefully)
      return null;
    }
  }
  
  /**
   * Get user groups from database cache
   * Returns cached data if valid (not expired), otherwise fetches fresh data
   * 
   * Task 4.3: Hybrid caching strategy (DB cache as fallback)
   * 
   * @param azureAdId - Azure AD object ID
   * @returns Cached groups or null if expired/missing
   */
  async getUserGroupsFromCache(azureAdId: string): Promise<UserGroups | null> {
    try {
      const [cached] = await db
        .select()
        .from(userGroupCache)
        .where(eq(userGroupCache.azureAdId, azureAdId))
        .limit(1);
      
      if (!cached) {
        console.log(`ℹ️  [GraphGroupSync] No cache entry for ${azureAdId}`);
        return null;
      }
      
      // Check if cache is still valid (not expired)
      const now = new Date();
      if (now > cached.expiresAt) {
        console.log(`⏰ [GraphGroupSync] Cache expired for ${azureAdId} (${cached.expiresAt})`);
        return null;
      }
      
      console.log(`✅ [GraphGroupSync] Cache hit for ${azureAdId} (expires ${cached.expiresAt})`);
      return {
        clearanceLevel: cached.clearanceLevel,
        role: cached.role,
        groupNames: cached.groupNames,
        source: 'cache'
      };
      
    } catch (error) {
      console.error(`❌ [GraphGroupSync] Failed to read cache:`, error);
      return null;
    }
  }
}

/**
 * Singleton instance
 */
export const graphGroupSyncService = new GraphGroupSyncService();
