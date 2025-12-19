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
  insertActionItemSchema,
  type AttendeePresent
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateMeetingMinutes, extractActionItems } from "./azureOpenAI";
import { ZodError } from "zod";
import { storage } from "../storage";
import { enqueueJob } from "./durableQueue";
import { 
  normalizeAttendeesArray, 
  buildAttendeeLookups,
  emailToDisplayName 
} from "@shared/attendeeHelpers";

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
    
    // Get attendees for action item assignment - normalize to AttendeePresent objects
    const rawInvitees = (meeting as any).invitees || [];
    const existingAttendees = meeting.attendees || [];
    
    // Normalize all attendees to {name, email} objects using shared helper
    const normalizedInvitees = normalizeAttendeesArray(rawInvitees);
    const normalizedAttendees = normalizeAttendeesArray(existingAttendees);
    const attendeeObjects: AttendeePresent[] = normalizedInvitees.length > 0 ? normalizedInvitees : normalizedAttendees;
    
    // Extract just names for AI prompt (AI works better with simple name list)
    const attendeesForAI = attendeeObjects.map(a => a.name).filter(n => n.length > 0);
    
    console.log(`👥 [MinutesGenerator] Normalized attendees for AI: ${attendeesForAI.join(', ')}`);
    
    // Build lookups for post-processing assignee matching
    const { emailToName, nameToEmail, allIdentifiers } = buildAttendeeLookups(attendeeObjects);
    
    // Extract action items from real transcript, passing attendee names for accurate assignment
    let actionItemsData = await extractActionItems(transcript, attendeesForAI);
    
    // Post-process: Validate assignees match actual attendees or set to "Unassigned"
    // Uses smart fuzzy matching to handle name variations
    actionItemsData = actionItemsData.map(item => {
      const assignee = item.assignee?.trim() || 'Unassigned';
      
      if (assignee === 'Unassigned' || assignee.toLowerCase() === 'unassigned') {
        return { ...item, assignee: 'Unassigned' };
      }
      
      const assigneeLower = assignee.toLowerCase();
      
      // Helper: Tokenize a name into lowercase words (removes punctuation, titles)
      // Also splits camelCase/concatenated names like "ChristopherBecraft" → ["christopher", "becraft"]
      const tokenize = (name: string): string[] => {
        // First, split camelCase: "ChristopherBecraft" → "Christopher Becraft"
        const withSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2');
        return withSpaces
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')  // Remove non-alpha chars (including numbers)
          .split(/\s+/)
          .filter(t => t.length > 1 && !['mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'ii', 'iii'].includes(t));
      };
      
      const assigneeTokens = tokenize(assignee);
      
      // Helper: Score how well two names match (higher = better)
      const matchScore = (attendeeName: string): number => {
        const attendeeLower = attendeeName.toLowerCase();
        const attendeeTokens = tokenize(attendeeName);
        
        // Exact match = highest score
        if (attendeeLower === assigneeLower) return 100;
        
        // Full containment (one name contains the other)
        if (attendeeLower.includes(assigneeLower)) return 90;
        if (assigneeLower.includes(attendeeLower)) return 85;
        
        // Normalized comparison: remove all spaces and non-alpha chars
        // "Mairaj Ali" → "mairajali", "Mairajali75" → "mairajali"
        const normalizedAssignee = assigneeLower.replace(/[^a-z]/g, '');
        const normalizedAttendee = attendeeLower.replace(/[^a-z]/g, '');
        if (normalizedAssignee === normalizedAttendee) return 95;
        if (normalizedAttendee.includes(normalizedAssignee) && normalizedAssignee.length >= 4) return 88;
        if (normalizedAssignee.includes(normalizedAttendee) && normalizedAttendee.length >= 4) return 83;
        
        // Token-based matching
        const commonTokens = assigneeTokens.filter(t => attendeeTokens.includes(t));
        if (commonTokens.length === 0) return 0;
        
        // First name match (first token matches)
        if (assigneeTokens[0] && attendeeTokens[0] === assigneeTokens[0]) {
          return 70 + (commonTokens.length * 5);
        }
        
        // Last name match (last token matches)
        if (assigneeTokens.length > 0 && attendeeTokens.length > 0) {
          const assigneeLastToken = assigneeTokens[assigneeTokens.length - 1];
          const attendeeLastToken = attendeeTokens[attendeeTokens.length - 1];
          if (assigneeLastToken === attendeeLastToken) {
            return 65 + (commonTokens.length * 5);
          }
        }
        
        // Any token match
        if (commonTokens.length > 0) {
          return 50 + (commonTokens.length * 10);
        }
        
        return 0;
      };
      
      // Find best matching attendee
      let bestMatch: { name: string; score: number } | null = null;
      for (const attendeeName of attendeesForAI) {
        const score = matchScore(attendeeName);
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { name: attendeeName, score };
        }
      }
      
      // Accept match if score is high enough (at least partial name match)
      if (bestMatch && bestMatch.score >= 50) {
        const email = nameToEmail.get(bestMatch.name.toLowerCase()) || '';
        console.log(`✅ [MinutesGenerator] Matched assignee "${assignee}" → "${bestMatch.name}" (score: ${bestMatch.score})`);
        return { ...item, assignee: bestMatch.name, assigneeEmail: email };
      }
      
      // Check if assignee is an email - use lookup to get display name
      if (assignee.includes('@')) {
        const displayName = emailToName.get(assigneeLower);
        if (displayName) {
          return { ...item, assignee: displayName, assigneeEmail: assignee.toLowerCase() };
        }
        // Email not in lookup - derive display name from email
        const derivedName = emailToDisplayName(assignee);
        // Check if derived name matches any attendee
        const derivedMatch = attendeesForAI.find(a => 
          a.toLowerCase() === derivedName.toLowerCase()
        );
        if (derivedMatch) {
          return { ...item, assignee: derivedMatch };
        }
      }
      
      // Check against the full match set (emails, raw names)
      const directMatch = allIdentifiers.has(assigneeLower);
      
      if (directMatch) {
        // Found in raw data - try to find the corresponding display name via lookup
        const displayName = emailToName.get(assigneeLower);
        if (displayName) {
          return { ...item, assignee: displayName, assigneeEmail: assigneeLower };
        }
        // Fallback: keep original if it's already a valid name in the set
        return { ...item, assignee };
      }
      
      // No match found - set to "Unassigned"
      console.log(`⚠️ [MinutesGenerator] Unknown assignee "${assignee}" - no match found in attendees, setting to Unassigned`);
      return { ...item, assignee: 'Unassigned' };
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
    
    // Determine final attendees list as AttendeePresent objects:
    // Priority: simulated speakers (solo test) > attendee objects
    let uniqueAttendeesObjects: AttendeePresent[];
    if (isSoloTest) {
      // Solo test: convert simulated speaker names to objects (no email available)
      uniqueAttendeesObjects = simulatedSpeakers.map(name => ({ name, email: '' }));
      console.log(`👥 [MinutesGenerator] SOLO TEST detected - Using simulated speakers as attendees: ${simulatedSpeakers.join(', ')}`);
    } else {
      // Normal meeting: use normalized attendee objects
      uniqueAttendeesObjects = attendeeObjects;
      console.log(`👥 [MinutesGenerator] Normal meeting - Using attendees: ${uniqueAttendeesObjects.length}`);
    }
    
    // Update the meeting record with attendee names if needed (meetings.attendees is string[])
    const attendeeNames = uniqueAttendeesObjects.map(a => a.name).filter(n => n.length > 0);
    if (attendeeNames.length > 0 && attendeeNames.length !== existingAttendees.length) {
      console.log(`📝 [MinutesGenerator] Updating meeting record with attendees`);
      await db.update(meetings)
        .set({ attendees: attendeeNames })
        .where(eq(meetings.id, meetingId));
    }
    
    // Check approval settings
    const settings = await storage.getSettings();
    const requiresApproval = settings.requireApprovalForMinutes;
    const initialApprovalStatus = requiresApproval ? "pending_review" as const : "approved" as const;
    
    console.log(`⚙️  [MinutesGenerator] Approval required: ${requiresApproval} → Initial status: ${initialApprovalStatus}`);
    
    // STRICT VALIDATION: Validate meeting minutes data before database write
    // Store attendees as objects with both name and email
    const minutesPayload = {
      meetingId: meeting.id,
      summary: minutesData.summary,
      keyDiscussions: minutesData.keyDiscussions,
      decisions: minutesData.decisions,
      attendeesPresent: uniqueAttendeesObjects,
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
