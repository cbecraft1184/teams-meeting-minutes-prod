/**
 * Access Control Service
 * 
 * Implements multi-level access control for DOD Teams Meeting Minutes System:
 * 1. Attendee-based filtering (users only see meetings they attended)
 * 2. Classification-level filtering (clearance-based access)
 * 3. Role-based permissions (admin, approver, viewer)
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
   * Check if user has sufficient clearance to view meeting
   */
  canViewMeeting(user: AuthenticatedUser, meeting: Meeting): boolean {
    // Admins and auditors can view ALL meetings (subject to clearance)
    const hasFullAccess = user.role === "admin" || user.role === "auditor";

    // 1. Check if user was an attendee (skip for admin/auditor)
    if (!hasFullAccess) {
      const isAttendee = meeting.attendees.includes(user.email);
      if (!isAttendee) {
        return false; // Regular users can ONLY see meetings they attended
      }
    }

    // 2. Check clearance level (applies to ALL users including admin/auditor)
    const userClearance = CLEARANCE_LEVELS[user.clearanceLevel as keyof typeof CLEARANCE_LEVELS] || 0;
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
   */
  canApproveMinutes(user: AuthenticatedUser): boolean {
    return user.role === "approver" || user.role === "admin";
  }

  /**
   * Check if user is an admin
   */
  isAdmin(user: AuthenticatedUser): boolean {
    return user.role === "admin";
  }

  /**
   * Check if user can view all meetings (not just their own)
   */
  canViewAllMeetings(user: AuthenticatedUser): boolean {
    return user.role === "admin" || user.role === "auditor";
  }

  /**
   * Get user permissions summary
   */
  getUserPermissions(user: AuthenticatedUser) {
    return {
      canView: true, // All users can view their own meetings
      canViewAll: this.canViewAllMeetings(user), // Admin/auditor can view all meetings
      canApprove: this.canApproveMinutes(user),
      canManageUsers: this.isAdmin(user),
      canConfigureIntegrations: this.isAdmin(user),
      clearanceLevel: user.clearanceLevel,
      role: user.role
    };
  }

  /**
   * Validate if user has access to specific classification level
   */
  hasClassificationAccess(user: AuthenticatedUser, classificationLevel: string): boolean {
    const userClearance = CLEARANCE_LEVELS[user.clearanceLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    const requiredClearance = CLEARANCE_LEVELS[classificationLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    return userClearance >= requiredClearance;
  }

  /**
   * Get maximum classification level user can access
   */
  getMaxAccessibleClassification(user: AuthenticatedUser): string {
    return user.clearanceLevel;
  }

  /**
   * Build SQL where clause for database-level filtering
   * This prevents loading meetings the user cannot access
   */
  buildMeetingWhereClause(user: AuthenticatedUser): { userEmail: string; maxClearance: number } {
    const maxClearance = CLEARANCE_LEVELS[user.clearanceLevel as keyof typeof CLEARANCE_LEVELS] || 0;
    
    return {
      userEmail: user.email,
      maxClearance: maxClearance
    };
  }

  /**
   * Generate audit log entry for access attempt
   */
  logAccessAttempt(user: AuthenticatedUser, meeting: Meeting, granted: boolean, reason?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingClassification: meeting.classificationLevel,
      userClearance: user.clearanceLevel,
      accessGranted: granted,
      reason: reason || (granted ? "Access granted" : "Access denied"),
    };

    // In production, this would write to audit database
    console.log(`[ACCESS AUDIT] ${JSON.stringify(logEntry)}`);
    
    return logEntry;
  }
}

export const accessControlService = new AccessControlService();
