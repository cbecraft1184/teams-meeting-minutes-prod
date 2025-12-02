/**
 * Access Control Service
 * 
 * Implements multi-level access control for DOD Teams Meeting Minutes System:
 * 1. Attendee-based filtering (users only see meetings they attended)
 * 2. Classification-level filtering (clearance-based access via Azure AD groups)
 * 3. Role-based permissions (admin, approver, viewer via Azure AD groups)
 * 
 * Task 4.4: Updated to use Azure AD group membership with database fallback
 */

import type { Meeting } from "@shared/schema";

// Simplified user type for access control (matches req.user from authentication middleware)
export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  clearanceLevel: string; // Fallback from database if Azure AD groups unavailable
  role: string; // Fallback from database if Azure AD groups unavailable
  department: string | null;
  organizationalUnit: string | null;
  azureAdId: string | null;
  azureAdGroups?: {
    groupNames: string[];
    clearanceLevel: string;
    role: string;
    fetchedAt: Date;
    expiresAt: Date;
  } | null; // Azure AD group membership (Task 4.3)
};

// Classification level hierarchy (higher number = higher clearance)
const CLEARANCE_LEVELS = {
  "UNCLASSIFIED": 0,
  "CONFIDENTIAL": 1,
  "SECRET": 2,
  "TOP_SECRET": 3
} as const;

export class AccessControlService {
  /**
   * Get user's current clearance level (Azure AD groups or database fallback)
   * Task 4.4: Prioritize Azure AD groups over database
   */
  private getUserClearanceLevel(user: AuthenticatedUser): string {
    const clearance = user.azureAdGroups?.clearanceLevel || user.clearanceLevel;
    
    // Log warning if falling back to database (indicates Azure AD sync gap)
    if (!user.azureAdGroups && user.azureAdId) {
      console.warn(`⚠️  [AccessControl] Azure AD groups unavailable for ${user.email}, falling back to DB clearance: ${clearance}`);
    }
    
    return clearance;
  }

  /**
   * Get user's current role (Azure AD groups or database fallback)
   * Task 4.4: Prioritize Azure AD groups over database
   */
  private getUserRole(user: AuthenticatedUser): string {
    const role = user.azureAdGroups?.role || user.role;
    
    // Log warning if falling back to database (indicates Azure AD sync gap)
    if (!user.azureAdGroups && user.azureAdId) {
      console.warn(`⚠️  [AccessControl] Azure AD groups unavailable for ${user.email}, falling back to DB role: ${role}`);
    }
    
    return role;
  }

  /**
   * Check if user has sufficient clearance to view meeting
   * Task 4.4: Updated to use Azure AD groups
   * 
   * Users can see meetings if they:
   * 1. Created the meeting (are the organizer)
   * 2. Were invited to the meeting (are in attendees)
   * 3. Are admin/auditor (full access)
   */
  canViewMeeting(user: AuthenticatedUser, meeting: Meeting): boolean {
    // Get effective clearance and role (Azure AD or database fallback)
    const effectiveClearance = this.getUserClearanceLevel(user);
    const effectiveRole = this.getUserRole(user);

    // Admins and auditors can view ALL meetings (subject to clearance)
    const hasFullAccess = effectiveRole === "admin" || effectiveRole === "auditor";

    // 1. Check if user is organizer or attendee (skip for admin/auditor)
    if (!hasFullAccess) {
      const userEmail = user.email?.toLowerCase();
      const organizerEmail = meeting.organizerEmail?.toLowerCase();
      
      // Check if user is the organizer
      const isOrganizer = (organizerEmail && userEmail === organizerEmail) || 
                          (meeting.organizerAadId && user.azureAdId === meeting.organizerAadId);
      
      // Check if user was an attendee (case-insensitive)
      const isAttendee = meeting.attendees.some(
        attendee => attendee.toLowerCase() === userEmail
      );
      
      if (!isOrganizer && !isAttendee) {
        return false; // Regular users can ONLY see meetings they organized or were invited to
      }
    }

    // 2. Check clearance level (applies to ALL users including admin/auditor)
    const userClearance = CLEARANCE_LEVELS[effectiveClearance as keyof typeof CLEARANCE_LEVELS] || 0;
    const meetingClassification = CLEARANCE_LEVELS[meeting.classificationLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    
    if (userClearance < meetingClassification) {
      return false; // Insufficient clearance
    }

    return true;
  }

  /**
   * Filter meetings array to only include meetings the user can access
   */
  filterMeetings(user: AuthenticatedUser, meetings: Meeting[]): Meeting[] {
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
