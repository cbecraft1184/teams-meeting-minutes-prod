/**
 * Minutes Generation Service
 * 
 * Automatically generates meeting minutes after enrichment completes.
 * Uses Azure OpenAI Service exclusively.
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
import { getConfig } from "./configValidator";

/**
 * Generate meeting minutes automatically after enrichment
 * @param meetingId - ID of the meeting to generate minutes for
 * @param transcriptContent - Optional real transcript content from Graph API (if not provided, uses mock)
 */
export async function autoGenerateMinutes(meetingId: string, transcriptContent?: string | null): Promise<void> {
  console.log(`[MinutesGenerator] Auto-generating minutes for meeting ${meetingId}`);
  
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
      console.log(`[MinutesGenerator] Minutes already exist for meeting ${meetingId}, skipping`);
      return;
    }
    
    // Use real transcript if provided
    // In production (useMockServices=false), require real transcript - no mock data
    const config = getConfig();
    let transcript: string;
    
    if (transcriptContent && transcriptContent.trim().length > 0) {
      console.log(`[MinutesGenerator] Using real transcript (${transcriptContent.length} chars)`);
      transcript = transcriptContent;
    } else if (config.useMockServices) {
      // Development only: Use mock transcript for testing
      console.log(`[MinutesGenerator] No transcript provided - using mock transcript (DEV MODE ONLY)`);
      transcript = generateMockTranscript(meeting);
    } else {
      // Production: Fail if no real transcript available
      throw new Error(
        `[PRODUCTION ERROR] No transcript available for meeting ${meetingId}. ` +
        `In production mode (USE_MOCK_SERVICES=false), real transcripts are required. ` +
        `Ensure meeting has transcription enabled or wait for transcript to be available.`
      );
    }
    
    console.log(`[MinutesGenerator] Calling Azure OpenAI to generate minutes...`);
    
    // Generate minutes using AI
    const minutesData = await generateMeetingMinutes(transcript);
    
    console.log(`[MinutesGenerator] Extracting action items...`);
    
    // Extract action items from the same transcript
    const actionItemsData = await extractActionItems(transcript);
    
    // Check approval settings
    const settings = await storage.getSettings();
    const requiresApproval = settings.requireApprovalForMinutes;
    const initialApprovalStatus = requiresApproval ? "pending_review" as const : "approved" as const;
    
    console.log(`[MinutesGenerator] Approval required: ${requiresApproval} -> Initial status: ${initialApprovalStatus}`);
    
    // STRICT VALIDATION: Validate meeting minutes data before database write
    const minutesPayload = {
      meetingId: meeting.id,
      summary: minutesData.summary,
      keyDiscussions: minutesData.keyDiscussions,
      decisions: minutesData.decisions,
      attendeesPresent: meeting.attendees,
      processingStatus: "completed" as const,
      approvalStatus: initialApprovalStatus
    };
    
    try {
      const validatedMinutes = insertMeetingMinutesSchema.parse(minutesPayload);
      
      // Create meeting minutes record with validated data
      const [createdMinutes] = await db.insert(meetingMinutes)
        .values(validatedMinutes)
        .returning();
      
      console.log(`[MinutesGenerator] Created meeting minutes ${createdMinutes.id}`);
      
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
              console.error(`[MinutesGenerator] Invalid action item data:`, {
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
          console.log(`[MinutesGenerator] Created ${validatedActionItems.length}/${actionItemsData.length} action items (skipped ${actionItemsData.length - validatedActionItems.length} invalid)`);
        }
      }
      
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`[MinutesGenerator] Invalid meeting minutes data:`, {
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
    
    console.log(`[MinutesGenerator] Meeting minutes generation complete for ${meetingId}`);
    
    // If approval not required, automatically trigger distribution workflow
    if (!requiresApproval) {
      console.log(`[MinutesGenerator] Auto-approval enabled - triggering approval workflow automatically`);
      
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
        console.log(`[MinutesGenerator] Auto-distribution workflow triggered for meeting ${meetingId}`);
      }
    }
    
  } catch (error) {
    console.error(`[MinutesGenerator] Failed to generate minutes for meeting ${meetingId}:`, error);
    
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
        console.error(`[MinutesGenerator] Fallback record validation failed:`, validationError);
      }
    }
    
    throw error;
  }
}

/**
 * Generate a realistic mock transcript for testing
 */
function generateMockTranscript(meeting: any): string {
  const meetingTitle = meeting.title || "Team Meeting";
  const attendeeNames = meeting.attendees.map((email: string) => {
    const name = email.split('@')[0].replace('.', ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  
  // Generate realistic meeting transcript
  return `
MEETING TRANSCRIPT
==================
Meeting: ${meetingTitle}
Date: ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : 'Today'}
Duration: ${meeting.duration || 30} minutes
Attendees: ${attendeeNames.join(', ')}

[00:00] ${attendeeNames[0]}: Good morning everyone, thank you for joining. Let's get started with today's ${meetingTitle}.

[00:30] ${attendeeNames[0]}: The main objective of this meeting is to review our project status and discuss next steps. I'd like to cover three key areas today.

[01:00] ${attendeeNames[1]}: Thanks for organizing this. I've reviewed the latest reports and have some updates to share.

[02:00] ${attendeeNames[1]}: First, regarding the security compliance review - we've completed the initial assessment. All systems are meeting compliance standards. We identified a few minor areas for improvement, which we'll address this quarter.

[03:30] ${attendeeNames[0]}: That's excellent progress. Can you provide more details on the timeline for those improvements?

[04:00] ${attendeeNames[1]}: Absolutely. I'll send a detailed timeline by end of week. We're targeting completion by the 15th of next month.

[04:30] ${attendeeNames.length > 2 ? attendeeNames[2] : attendeeNames[0]}: I have an update on the technical integration. The Microsoft Teams integration is now functional and we've successfully tested the webhook system.

[05:30] ${attendeeNames.length > 2 ? attendeeNames[2] : attendeeNames[0]}: We need to coordinate with the infrastructure team for the production deployment. I'll schedule a follow-up meeting with them this week.

[06:30] ${attendeeNames[0]}: Great work everyone. Let's make sure we document all action items. ${attendeeNames[1]}, can you take the lead on the security compliance improvements?

[07:00] ${attendeeNames[1]}: Yes, I'll handle that and provide weekly status updates.

[07:30] ${attendeeNames[0]}: And ${attendeeNames.length > 2 ? attendeeNames[2] : attendeeNames[1]}, you'll coordinate the production deployment meeting?

[08:00] ${attendeeNames.length > 2 ? attendeeNames[2] : attendeeNames[1]}: Confirmed. I'll send out invites today.

[08:30] ${attendeeNames[0]}: Perfect. Before we wrap up, does anyone have additional items to discuss?

[09:00] ${attendeeNames[1]}: Just a quick note - we should consider scheduling a demo for stakeholders once the production deployment is complete.

[09:30] ${attendeeNames[0]}: Good point. Let's plan for that in the next sprint. I'll add it to our roadmap.

[10:00] ${attendeeNames[0]}: Alright, I think we've covered everything. Thanks everyone for your time and great work. Meeting adjourned.

END OF TRANSCRIPT
  `.trim();
}

export const minutesGeneratorService = {
  autoGenerateMinutes
};
