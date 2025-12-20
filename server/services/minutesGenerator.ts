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
  emailToDisplayName,
  buildIdentityProfiles,
  findMatchingIdentity,
  extractSpeakersFromTranscript,
  type IdentityProfile
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
    
    // STEP 1: Get ALL invitees - these are people who could have action items assigned
    const rawInvitees = (meeting as any).invitees || [];
    const existingAttendees = meeting.attendees || [];
    const normalizedInvitees = normalizeAttendeesArray(rawInvitees);
    const normalizedAttendees = normalizeAttendeesArray(existingAttendees);
    const attendeeObjects: AttendeePresent[] = normalizedInvitees.length > 0 ? normalizedInvitees : normalizedAttendees;
    
    // STEP 2: Extract speaker names from transcript to learn REAL names
    // (The transcript has accurate names like "Thomas Dulaney" while attendee list may have "Thomas")
    const transcriptSpeakers = extractSpeakersFromTranscript(transcript);
    console.log(`🎤 [MinutesGenerator] Extracted ${transcriptSpeakers.length} speakers from transcript: ${transcriptSpeakers.join(', ')}`);
    
    // STEP 3: Build a map of email → real name by matching speakers to invitees
    const emailToRealName = new Map<string, string>();
    
    for (const speakerName of transcriptSpeakers) {
      const speakerTokens = speakerName.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      let bestMatch: { attendee: AttendeePresent; score: number } | null = null;
      
      for (const attendee of attendeeObjects) {
        if (!attendee.email) continue;
        let score = 0;
        const attendeeName = attendee.name.toLowerCase();
        const attendeeEmail = attendee.email.toLowerCase();
        
        // Normalized match (remove spaces/numbers)
        const speakerNorm = speakerName.toLowerCase().replace(/[^a-z]/g, '');
        const attendeeNorm = attendeeName.replace(/[^a-z]/g, '');
        const emailLocalNorm = attendeeEmail.split('@')[0].replace(/[^a-z]/g, '');
        
        if (speakerNorm === attendeeNorm || speakerNorm === emailLocalNorm) {
          score = 95;
        } else {
          // Token overlap with email parts and domain
          const emailParts = attendeeEmail.split('@');
          const emailTokens = emailParts[0].replace(/[._]/g, ' ').replace(/[0-9]/g, '').toLowerCase().split(/\s+/).filter(t => t.length > 1);
          const domain = emailParts[1] || '';
          const domainFirst = domain.split('.')[0];
          if (domainFirst && !['gmail', 'hotmail', 'outlook', 'yahoo', 'live', 'icloud'].includes(domainFirst)) {
            emailTokens.push(domainFirst);
          }
          
          const commonTokens = speakerTokens.filter(t => emailTokens.some(et => et.includes(t) || t.includes(et)));
          if (commonTokens.length > 0) {
            score = 50 + commonTokens.length * 15;
          }
        }
        
        if (score >= 50 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { attendee, score };
        }
      }
      
      if (bestMatch) {
        emailToRealName.set(bestMatch.attendee.email.toLowerCase(), speakerName);
        console.log(`✅ [MinutesGenerator] Learned: "${speakerName}" = ${bestMatch.attendee.email} (score: ${bestMatch.score})`);
      }
    }
    
    // STEP 4: Build identity profiles for ALL invitees (not just speakers)
    // Use real names from transcript where available, otherwise derive from email
    const identityProfiles: IdentityProfile[] = [];
    
    for (const attendee of attendeeObjects) {
      const email = attendee.email.toLowerCase();
      
      // Use real name from transcript if we matched it, otherwise use email-derived name
      const realName = emailToRealName.get(email);
      const canonicalName = realName || attendee.name || emailToDisplayName(attendee.email);
      
      const tokens = canonicalName.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      const aliases = [canonicalName];
      if (canonicalName.includes(' ')) {
        aliases.push(canonicalName.split(' ')[0]); // First name
        aliases.push(canonicalName.split(' ').slice(-1)[0]); // Last name
      }
      if (attendee.name && attendee.name !== canonicalName) {
        aliases.push(attendee.name);
      }
      
      identityProfiles.push({
        canonicalName,
        email: attendee.email,
        aliases,
        tokens
      });
    }
    
    // Extract canonical names for AI prompt - all invitees with best available names
    const attendeesForAI = identityProfiles.map(p => p.canonicalName).filter(n => n.length > 0);
    
    console.log(`👥 [MinutesGenerator] Identity profiles for ${identityProfiles.length} invitees:`);
    identityProfiles.forEach(p => {
      console.log(`   - "${p.canonicalName}" (${p.email})`);
    });
    
    // Build lookups for post-processing assignee matching (legacy, used as fallback)
    const { emailToName, nameToEmail, allIdentifiers } = buildAttendeeLookups(attendeeObjects);
    
    // Extract action items from real transcript, passing attendee names for accurate assignment
    let actionItemsData = await extractActionItems(transcript, attendeesForAI);
    
    // Post-process: Validate assignees match actual attendees using identity profiles
    // Uses enriched identity matching with aliases derived from names AND emails
    actionItemsData = actionItemsData.map(item => {
      const assignee = item.assignee?.trim() || 'Unassigned';
      
      if (assignee === 'Unassigned' || assignee.toLowerCase() === 'unassigned') {
        return { ...item, assignee: 'Unassigned' };
      }
      
      // Use the new identity matching system
      const matchedProfile = findMatchingIdentity(assignee, identityProfiles);
      
      if (matchedProfile) {
        console.log(`✅ [MinutesGenerator] Matched assignee "${assignee}" → "${matchedProfile.canonicalName}" (email: ${matchedProfile.email})`);
        return { 
          ...item, 
          assignee: matchedProfile.canonicalName, 
          assigneeEmail: matchedProfile.email 
        };
      }
      
      // Fallback: Check if assignee is an email directly
      const assigneeLower = assignee.toLowerCase();
      if (assignee.includes('@')) {
        const displayName = emailToName.get(assigneeLower);
        if (displayName) {
          return { ...item, assignee: displayName, assigneeEmail: assignee.toLowerCase() };
        }
      }
      
      // No match found - set to "Unassigned"
      console.log(`⚠️ [MinutesGenerator] Unknown assignee "${assignee}" - no match found in ${identityProfiles.length} identity profiles, setting to Unassigned`);
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
