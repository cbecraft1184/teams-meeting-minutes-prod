/**
 * Minutes Generation Service
 * 
 * Automatically generates meeting minutes after enrichment completes
 * Uses Azure OpenAI (production) or Replit AI (development)
 */

import { db } from "../db";
import { meetings, meetingMinutes, actionItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateMeetingMinutes, extractActionItems } from "./azureOpenAI";

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
    
    // Generate mock transcript (in production, this would be fetched from Graph API)
    const mockTranscript = generateMockTranscript(meeting);
    
    console.log(`🔄 [MinutesGenerator] Calling AI to generate minutes...`);
    
    // Generate minutes using AI
    const minutesData = await generateMeetingMinutes(mockTranscript);
    
    console.log(`🔄 [MinutesGenerator] Extracting action items...`);
    
    // Extract action items
    const actionItemsData = await extractActionItems(mockTranscript);
    
    // Create meeting minutes record
    const [createdMinutes] = await db.insert(meetingMinutes)
      .values({
        meetingId: meeting.id,
        summary: minutesData.summary,
        keyDiscussions: minutesData.keyDiscussions,
        decisions: minutesData.decisions,
        attendeesPresent: meeting.attendees,
        processingStatus: "completed",
        approvalStatus: "pending_review"
      })
      .returning();
    
    console.log(`✅ [MinutesGenerator] Created meeting minutes ${createdMinutes.id}`);
    
    // Create action items
    if (actionItemsData.length > 0) {
      await db.insert(actionItems)
        .values(actionItemsData.map(item => ({
          meetingId: meeting.id,
          minutesId: createdMinutes.id,
          task: item.task,
          assignee: item.assignee,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          priority: item.priority as "high" | "medium" | "low",
          status: "pending" as const
        })));
      
      console.log(`✅ [MinutesGenerator] Created ${actionItemsData.length} action items`);
    }
    
    // Update meeting status
    await db.update(meetings)
      .set({
        status: "completed",
        graphSyncStatus: "minutes_generated"
      })
      .where(eq(meetings.id, meetingId));
    
    console.log(`✅ [MinutesGenerator] Meeting minutes generation complete for ${meetingId}`);
    
  } catch (error) {
    console.error(`❌ [MinutesGenerator] Failed to generate minutes for meeting ${meetingId}:`, error);
    
    // Update meeting minutes status to failed
    await db.insert(meetingMinutes)
      .values({
        meetingId: meetingId,
        summary: "",
        keyDiscussions: [],
        decisions: [],
        attendeesPresent: [],
        processingStatus: "failed",
        approvalStatus: "pending_review"
      })
      .onConflictDoNothing();
    
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

[02:00] ${attendeeNames[1]}: First, regarding the security compliance review - we've completed the initial assessment. All systems are meeting DOD standards. We identified a few minor areas for improvement, which we'll address this quarter.

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
