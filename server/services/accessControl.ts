/**
 * Access Control Service
 * 
 * SIMPLIFIED MODEL (restored from pre-Task 4.4):
 * - All authenticated users can see all meetings
 * - Classification filtering is optional (disabled by default for demo/pilot)
 * - Role-based permissions for actions (approve, admin functions)
 * 
 * This restores the original behavior where any logged-in user can view all meetings.
 */

import type { Meeting } from "@shared/schema";

// Simplified user type for access control (matches req.user from authentication middleware)
export type AuthenticatedUser = {
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
  } | null;
};

// Classification level hierarchy (higher number = higher clearance)
const CLEARANCE_LEVELS = {
  "UNCLASSIFIED": 0,
  "CONFIDENTIAL": 1,
  "SECRET": 2,
  "TOP_SECRET": 3
} as const;

// Feature flag: Set to true to enable strict attendee-based filtering
// When false (default), all authenticated users can see all meetings
const ENABLE_STRICT_FILTERING = false;

export class AccessControlService {
  /**
   * Get user's current clearance level
   */
  private getUserClearanceLevel(user: AuthenticatedUser): string {
    return user.azureAdGroups?.clearanceLevel || user.clearanceLevel || "UNCLASSIFIED";
  }

  /**
   * Get user's current role
   */
  private getUserRole(user: AuthenticatedUser): string {
    return user.azureAdGroups?.role || user.role || "viewer";
  }

  /**
   * Check if user can view a meeting
   * 
   * SIMPLIFIED: All authenticated users can see all meetings (original behavior)
   * Classification filtering only applies if meeting is above UNCLASSIFIED
   */
  canViewMeeting(user: AuthenticatedUser, meeting: Meeting): boolean {
    // If strict filtering is disabled, allow all authenticated users to see all meetings
    if (!ENABLE_STRICT_FILTERING) {
      return true; // Original behavior: everyone sees everything
    }

    // Optional: Classification-based filtering (only if meeting is classified)
    const meetingClassification = CLEARANCE_LEVELS[meeting.classificationLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    
    // UNCLASSIFIED meetings (level 0) are visible to everyone
    if (meetingClassification === 0) {
      return true;
    }

    // For classified meetings, check user's clearance
    const effectiveClearance = this.getUserClearanceLevel(user);
    const userClearance = CLEARANCE_LEVELS[effectiveClearance as keyof typeof CLEARANCE_LEVELS] || 0;
    
    return userClearance >= meetingClassification;
  }

  /**
   * Filter meetings array to only include meetings the user can access
   */
  filterMeetings(user: AuthenticatedUser, meetings: Meeting[]): Meeting[] {
    // Null-safe filtering
    if (!meetings || !Array.isArray(meetings)) {
      return [];
    }
    return meetings.filter(meeting => this.canViewMeeting(user, meeting));
  }

  /**
   * Check if user can approve minutes (must be approver or admin role)
   * Task 4.4: Updated to use Azure AD groups
   */
  canApproveMinutes(user: AuthenticatedUser): boolean {
    const effectiveRole = this.getUserRole(user);
    return effectiveRole === "approver" || effectiveRole === "admin";
  }

  /**
   * Check if user is an admin
   * Task 4.4: Updated to use Azure AD groups
   */
  isAdmin(user: AuthenticatedUser): boolean {
    const effectiveRole = this.getUserRole(user);
    return effectiveRole === "admin";
  }

  /**
   * Check if user can view all meetings (not just their own)
   * Task 4.4: Updated to use Azure AD groups
   */
  canViewAllMeetings(user: AuthenticatedUser): boolean {
    const effectiveRole = this.getUserRole(user);
    return effectiveRole === "admin" || effectiveRole === "auditor";
  }

  /**
   * Get user permissions summary
   * Task 4.4: Updated to use Azure AD groups
   */
  getUserPermissions(user: AuthenticatedUser) {
    const effectiveClearance = this.getUserClearanceLevel(user);
    const effectiveRole = this.getUserRole(user);

    return {
      canView: true, // All users can view their own meetings
      canViewAll: this.canViewAllMeetings(user), // Admin/auditor can view all meetings
      canApprove: this.canApproveMinutes(user),
      canManageUsers: this.isAdmin(user),
      canConfigureIntegrations: this.isAdmin(user),
      clearanceLevel: effectiveClearance,
      role: effectiveRole,
      azureAdGroupsActive: !!user.azureAdGroups // Indicates if Azure AD groups are being used
    };
  }

  /**
   * Validate if user has access to specific classification level
   * Task 4.4: Updated to use Azure AD groups
   */
  hasClassificationAccess(user: AuthenticatedUser, classificationLevel: string): boolean {
    const effectiveClearance = this.getUserClearanceLevel(user);
    const userClearance = CLEARANCE_LEVELS[effectiveClearance as keyof typeof CLEARANCE_LEVELS] || 0;
    const requiredClearance = CLEARANCE_LEVELS[classificationLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    return userClearance >= requiredClearance;
  }

  /**
   * Get maximum classification level user can access
   * Task 4.4: Updated to use Azure AD groups
   */
  getMaxAccessibleClassification(user: AuthenticatedUser): string {
    return this.getUserClearanceLevel(user);
  }

  /**
   * Build SQL where clause for database-level filtering
   * This prevents loading meetings the user cannot access
   * Task 4.4: Updated to use Azure AD groups and role-based filtering
   */
  buildMeetingWhereClause(user: AuthenticatedUser): { 
    userEmail: string | null; 
    maxClearance: number;
    canViewAll: boolean;
  } {
    const effectiveClearance = this.getUserClearanceLevel(user);
    const effectiveRole = this.getUserRole(user);
    const maxClearance = CLEARANCE_LEVELS[effectiveClearance as keyof typeof CLEARANCE_LEVELS] || 0;
    
    // Admins and auditors can view ALL meetings (not just attendee-filtered)
    const canViewAll = effectiveRole === "admin" || effectiveRole === "auditor";
    
    return {
      userEmail: canViewAll ? null : user.email, // null = no attendee filtering
      maxClearance: maxClearance,
      canViewAll: canViewAll
    };
  }

  /**
   * Generate audit log entry for access attempt
   * Task 4.4: Updated to log Azure AD groups and effective permissions
   */
  logAccessAttempt(user: AuthenticatedUser, meeting: Meeting, granted: boolean, reason?: string) {
    const effectiveClearance = this.getUserClearanceLevel(user);
    const effectiveRole = this.getUserRole(user);

    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingClassification: meeting.classificationLevel,
      userClearance: effectiveClearance,
      userRole: effectiveRole,
      azureAdGroupsUsed: !!user.azureAdGroups,
      azureAdGroups: user.azureAdGroups?.groupNames || [],
      accessGranted: granted,
      reason: reason || (granted ? "Access granted" : "Access denied"),
    };

    // In production, this would write to audit database
    console.log(`[ACCESS AUDIT] ${JSON.stringify(logEntry)}`);
    
    return logEntry;
  }
}

export const accessControlService = new AccessControlService();
