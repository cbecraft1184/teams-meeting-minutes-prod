/**
 * Minutes Generation Service
 * 
 * Automatically generates meeting minutes after enrichment completes
 * Uses Azure OpenAI (production) or Replit AI (development)
 * 
 * STRICT VALIDATION:
 * - All meeting minutes validated before database writes
 * - All action items validated before database writes
 * - Validation failures throw detailed errors for debugging
 */

import { db } from "../db";
import { 
  meetings, 
  meetingMinutes, 
  actionItems,
  insertMeetingMinutesSchema,
  insertActionItemSchema
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateMeetingMinutes, extractActionItems } from "./azureOpenAI";
import { ZodError } from "zod";
import { storage } from "../storage";
import { enqueueJob } from "./durableQueue";

/**
 * Generate meeting minutes automatically after enrichment
 */
export async function autoGenerateMinutes(meetingId: string): Promise<void> {
  console.log(`🤖 [MinutesGenerator] Auto-generating minutes for meeting ${meetingId}`);
  
  try {
    // Get meeting details
    const [meeting] = await db.select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));
    
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }
    
    // Check if minutes already exist
    const existingMinutes = await db.select()
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, meetingId));
    
    if (existingMinutes.length > 0) {
      console.log(`ℹ️  [MinutesGenerator] Minutes already exist for meeting ${meetingId}, skipping`);
      return;
    }
    
    // Use persisted transcript content from enrichment
    const transcript = meeting.transcriptContent;
    
    // Only check if transcript exists - no minimum length requirement
    if (!transcript || transcript.trim().length === 0) {
      console.error(`❌ [MinutesGenerator] No transcript content available for meeting ${meetingId}`);
      throw new Error(`No transcript available for meeting ${meetingId}. Meetings require a recorded transcript for AI minutes generation.`);
    }
    
    console.log(`🔄 [MinutesGenerator] Using transcript (${transcript.length} characters) to generate minutes...`);
    
    // Generate minutes using AI with real transcript
    const minutesData = await generateMeetingMinutes(transcript);
    
    console.log(`🔄 [MinutesGenerator] Extracting action items...`);
    
    // Get attendees for action item assignment - normalize to display names
    const rawInvitees = (meeting as any).invitees || [];
    const existingAttendees = meeting.attendees || [];
    
    // Normalize attendees to display names (handle both string[] and object[] formats)
    const normalizeAttendees = (attendees: any[]): string[] => {
      return attendees.map(a => {
        if (typeof a === 'string') {
          // If it's an email, try to extract name part
          if (a.includes('@')) {
            const namePart = a.split('@')[0];
            // Convert "john.doe" or "johndoe" to "John Doe"
            return namePart
              .replace(/[._]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
          return a;
        }
        if (typeof a === 'object' && a !== null) {
          // Handle Graph API attendee objects
          return a.displayName || a.name || a.emailAddress?.name || a.email?.split('@')[0] || 'Unknown';
        }
        return 'Unknown';
      }).filter(name => name && name !== 'Unknown');
    };
    
    const normalizedInvitees = normalizeAttendees(rawInvitees);
    const normalizedAttendees = normalizeAttendees(existingAttendees);
    const attendeesForAI = normalizedInvitees.length > 0 ? normalizedInvitees : normalizedAttendees;
    
    console.log(`👥 [MinutesGenerator] Normalized attendees for AI: ${attendeesForAI.join(', ')}`);
    
    // Extract action items from real transcript, passing attendee names for accurate assignment
    let actionItemsData = await extractActionItems(transcript, attendeesForAI);
    
    // Build a matching set that includes both display names and raw emails/strings
    const attendeeMatchSet = new Set<string>();
    rawInvitees.forEach((a: any) => {
      if (typeof a === 'string') {
        attendeeMatchSet.add(a.toLowerCase());
      } else if (typeof a === 'object' && a !== null) {
        if (a.displayName) attendeeMatchSet.add(a.displayName.toLowerCase());
        if (a.name) attendeeMatchSet.add(a.name.toLowerCase());
        if (a.email) attendeeMatchSet.add(a.email.toLowerCase());
        if (a.emailAddress?.address) attendeeMatchSet.add(a.emailAddress.address.toLowerCase());
      }
    });
    // Also add normalized names
    attendeesForAI.forEach(name => attendeeMatchSet.add(name.toLowerCase()));
    
    // Post-process: Validate assignees match actual attendees or set to "Unassigned"
    actionItemsData = actionItemsData.map(item => {
      const assignee = item.assignee?.trim() || 'Unassigned';
      
      if (assignee === 'Unassigned') {
        return { ...item, assignee };
      }
      
      // Check if assignee matches any known attendee (case-insensitive exact or partial match)
      const assigneeLower = assignee.toLowerCase();
      const matchedAttendee = attendeesForAI.find(a => {
        const aLower = a.toLowerCase();
        return aLower === assigneeLower ||
               aLower.includes(assigneeLower) ||
               assigneeLower.includes(aLower);
      });
      
      // Also check against the full match set (emails, raw names)
      const directMatch = attendeeMatchSet.has(assigneeLower);
      
      if (matchedAttendee) {
        // Use the normalized display name from our attendee list
        return { ...item, assignee: matchedAttendee };
      } else if (directMatch) {
        // Found in raw data but not in normalized list - try to find the display name
        const displayName = attendeesForAI[0] || assignee; // Fallback to first attendee or keep original
        return { ...item, assignee };
      } else {
        // No match found - set to "Unassigned"
        console.log(`⚠️ [MinutesGenerator] Unknown assignee "${assignee}" - setting to Unassigned`);
        return { ...item, assignee: 'Unassigned' };
      }
    });
    
    console.log(`📋 [MinutesGenerator] Extracted ${actionItemsData.length} action items with attendee matching`);
    
    // Extract simulated speakers from transcript text: "[Name] speaking" patterns
    // This is for solo test mode where one person role-plays multiple participants
    // Supports: "Alex speaking", "Alex speaking:", "Alex Johnson speaking", etc.
    const speakingPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+speaking[.,!:]?/gi;
    const transcriptSimulatedSpeakers: string[] = [];
    let match;
    while ((match = speakingPattern.exec(transcript)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !transcriptSimulatedSpeakers.some(s => s.toLowerCase() === speakerName.toLowerCase())) {
        transcriptSimulatedSpeakers.push(speakerName);
      }
    }
    console.log(`🎭 [MinutesGenerator] Extracted ${transcriptSimulatedSpeakers.length} simulated speakers from transcript: ${transcriptSimulatedSpeakers.join(', ')}`);
    
    // Check for simulated speakers (from transcript parsing or AI response)
    const aiSimulatedSpeakers = minutesData.simulatedSpeakers || [];
    const simulatedSpeakers = transcriptSimulatedSpeakers.length > 0 ? transcriptSimulatedSpeakers : aiSimulatedSpeakers;
    const isSoloTest = simulatedSpeakers.length > 0;
    
    // Determine final attendees list:
    // Priority: simulated speakers (solo test) > normalized invitees > existing attendees
    let uniqueAttendees: string[];
    if (isSoloTest) {
      // Solo test: use simulated speakers as attendees (the roles being played)
      uniqueAttendees = [...simulatedSpeakers];
      console.log(`👥 [MinutesGenerator] SOLO TEST detected - Using simulated speakers as attendees: ${uniqueAttendees.join(', ')}`);
    } else {
      // Normal meeting: use normalized attendees
      uniqueAttendees = attendeesForAI.length > 0 ? attendeesForAI : normalizedAttendees;
      console.log(`👥 [MinutesGenerator] Normal meeting - Using attendees: ${uniqueAttendees.length}`);
    }
    
    // Update the meeting record with attendees if needed
    if (uniqueAttendees.length > 0 && uniqueAttendees.length !== existingAttendees.length) {
      console.log(`📝 [MinutesGenerator] Updating meeting record with attendees`);
      await db.update(meetings)
        .set({ attendees: uniqueAttendees })
        .where(eq(meetings.id, meetingId));
    }
    
    // Check approval settings
    const settings = await storage.getSettings();
    const requiresApproval = settings.requireApprovalForMinutes;
    const initialApprovalStatus = requiresApproval ? "pending_review" as const : "approved" as const;
    
    console.log(`⚙️  [MinutesGenerator] Approval required: ${requiresApproval} → Initial status: ${initialApprovalStatus}`);
    
    // STRICT VALIDATION: Validate meeting minutes data before database write
    const minutesPayload = {
      meetingId: meeting.id,
      summary: minutesData.summary,
      keyDiscussions: minutesData.keyDiscussions,
      decisions: minutesData.decisions,
      attendeesPresent: uniqueAttendees,
      processingStatus: "completed" as const,
      approvalStatus: initialApprovalStatus
    };
    
    try {
      const validatedMinutes = insertMeetingMinutesSchema.parse(minutesPayload);
      
      // Create meeting minutes record with validated data
      const [createdMinutes] = await db.insert(meetingMinutes)
        .values(validatedMinutes)
        .returning();
      
      console.log(`✅ [MinutesGenerator] Created meeting minutes ${createdMinutes.id}`);
      
      // STRICT VALIDATION: Validate each action item before database write
      if (actionItemsData.length > 0) {
        const validatedActionItems = [];
        
        for (const item of actionItemsData) {
          const actionItemPayload = {
            meetingId: meeting.id,
            minutesId: createdMinutes.id,
            task: item.task,
            assignee: item.assignee || "Unassigned",
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: item.priority as "high" | "medium" | "low",
            status: "pending" as const
          };
          
          try {
            const validatedItem = insertActionItemSchema.parse(actionItemPayload);
            validatedActionItems.push(validatedItem);
          } catch (error) {
            if (error instanceof ZodError) {
              console.error(`❌ [MinutesGenerator] Invalid action item data:`, {
                item: actionItemPayload,
                errors: error.errors
              });
              // Skip invalid action items but continue with valid ones
              continue;
            }
            throw error;
          }
        }
        
        if (validatedActionItems.length > 0) {
          await db.insert(actionItems).values(validatedActionItems);
          console.log(`✅ [MinutesGenerator] Created ${validatedActionItems.length}/${actionItemsData.length} action items (skipped ${actionItemsData.length - validatedActionItems.length} invalid)`);
        }
      }
      
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`❌ [MinutesGenerator] Invalid meeting minutes data:`, {
          payload: minutesPayload,
          errors: error.errors
        });
        throw new Error(`Validation failed for meeting minutes: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
    
    // Update meeting status
    await db.update(meetings)
      .set({
        status: "completed",
        graphSyncStatus: "enriched"
      })
      .where(eq(meetings.id, meetingId));
    
    console.log(`✅ [MinutesGenerator] Meeting minutes generation complete for ${meetingId}`);
    
    // If approval not required, automatically trigger distribution workflow
    if (!requiresApproval) {
      console.log(`🚀 [MinutesGenerator] Auto-approval enabled - triggering approval workflow automatically`);
      
      // Use the same workflow as manual approval to ensure proper document generation and distribution
      const { triggerApprovalWorkflow } = await import("./meetingOrchestrator");
      const minutesRecord = await db.select()
        .from(meetingMinutes)
        .where(eq(meetingMinutes.meetingId, meetingId))
        .limit(1);
      
      if (minutesRecord[0]) {
        await triggerApprovalWorkflow({
          meetingId: meetingId,
          minutesId: minutesRecord[0].id
        });
        console.log(`✅ [MinutesGenerator] Auto-distribution workflow triggered for meeting ${meetingId}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ [MinutesGenerator] Failed to generate minutes for meeting ${meetingId}:`, error);
    
    // Get meeting for fallback attendees
    const [meeting] = await db.select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));
    
    if (meeting) {
      // STRICT VALIDATION: Create failure record with schema-compliant placeholder values
      const fallbackPayload = {
        meetingId: meetingId,
        summary: "Failed to generate meeting minutes. Please regenerate or create manually.",
        keyDiscussions: ["Minutes generation failed - no discussions captured"],
        decisions: ["Minutes generation failed - no decisions captured"],
        attendeesPresent: meeting.attendees || ["unknown@example.com"], // Use meeting attendees or fallback
        processingStatus: "failed" as const,
        approvalStatus: "pending_review" as const
      };
      
      try {
        // Validate fallback data before insert
        const validatedFallback = insertMeetingMinutesSchema.parse(fallbackPayload);
        await db.insert(meetingMinutes)
          .values(validatedFallback)
          .onConflictDoNothing();
      } catch (validationError) {
        // If even the fallback fails validation, log error but don't create record
        console.error(`❌ [MinutesGenerator] Fallback record validation failed:`, validationError);
      }
    }
    
    throw error;
  }
}

// REMOVED: generateMockTranscript function - now uses real transcript from meeting.transcriptContent

export const minutesGeneratorService = {
  autoGenerateMinutes
};
