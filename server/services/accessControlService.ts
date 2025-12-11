import { db } from "../db";
import { actionItems, meetings } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface ActionItemPermissionResult {
  allowed: boolean;
  reason: string;
  actionItem?: {
    id: string;
    assignee: string;
    meetingId: string;
  };
  meeting?: {
    id: string;
    organizerEmail: string | null;
  };
}

export async function canManageActionItem(
  user: AuthenticatedUser,
  actionItemId: string
): Promise<ActionItemPermissionResult> {
  const [item] = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.id, actionItemId))
    .limit(1);

  if (!item) {
    return {
      allowed: false,
      reason: "Action item not found",
    };
  }

  const [meeting] = await db
    .select({
      id: meetings.id,
      organizerEmail: meetings.organizerEmail,
    })
    .from(meetings)
    .where(eq(meetings.id, item.meetingId))
    .limit(1);

  if (!meeting) {
    return {
      allowed: false,
      reason: "Meeting not found for action item",
      actionItem: { id: item.id, assignee: item.assignee, meetingId: item.meetingId },
    };
  }

  if (user.role === "admin") {
    return {
      allowed: true,
      reason: "Admin access",
      actionItem: { id: item.id, assignee: item.assignee, meetingId: item.meetingId },
      meeting: { id: meeting.id, organizerEmail: meeting.organizerEmail },
    };
  }

  const userEmailLower = user.email.toLowerCase();
  const organizerEmailLower = meeting.organizerEmail?.toLowerCase() || "";
  const assigneeEmailLower = item.assigneeEmail?.toLowerCase() || "";

  // Check if user is the assignee (by email)
  const isAssignee = assigneeEmailLower !== "" && userEmailLower === assigneeEmailLower;

  if (isAssignee) {
    return {
      allowed: true,
      reason: "User is the assignee",
      actionItem: { id: item.id, assignee: item.assignee, meetingId: item.meetingId },
      meeting: { id: meeting.id, organizerEmail: meeting.organizerEmail },
    };
  }

  const isOrganizer = userEmailLower === organizerEmailLower;

  if (isOrganizer) {
    return {
      allowed: true,
      reason: "User is the meeting organizer",
      actionItem: { id: item.id, assignee: item.assignee, meetingId: item.meetingId },
      meeting: { id: meeting.id, organizerEmail: meeting.organizerEmail },
    };
  }

  return {
    allowed: false,
    reason: "User is neither the assignee nor the meeting organizer",
    actionItem: { id: item.id, assignee: item.assignee, meetingId: item.meetingId },
    meeting: { id: meeting.id, organizerEmail: meeting.organizerEmail },
  };
}
