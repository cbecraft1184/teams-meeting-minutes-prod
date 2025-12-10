/**
 * Call Record Enrichment Service
 * 
 * After a Teams meeting ends, this service fetches the callRecord, recordings,
 * and transcripts from Microsoft Graph API to enrich the meeting record.
 * 
 * ARCHITECTURE (per architect recommendation):
 * - All background work flows through the durable queue (durableQueue.ts)
 * - The lease-based job worker (jobWorker.ts) governs all processing
 * - No in-memory queues - ensures crash recovery and single-worker execution
 * - Retries handled by durableQueue with exponential backoff
 */

import { db } from "../db";
import { meetings } from "@shared/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { getGraphClient } from "./microsoftIdentity";
import { minutesGeneratorService } from "./minutesGenerator";
import { 
  countTranscriptWords,
  calculateActualDuration,
  validateForProcessing,
  recordProcessingDecision
} from "./processingValidation";
import { enqueueJob, type JobType } from "./durableQueue";

/**
 * Graph API recording response
 */
interface Recording {
  id: string;
  recordingContentUrl?: string;
  createdDateTime: string;
}

/**
 * Graph API transcript response
 */
interface Transcript {
  id: string;
  transcriptContentUrl?: string;
  createdDateTime: string;
}

/**
 * Exponential backoff delays (in minutes) - used for logging only
 * Actual backoff is managed by durableQueue
 */
const BACKOFF_DELAYS = [5, 15, 45];
const MAX_ATTEMPTS = 4; // Allow 4 attempts total (initial + 3 retries)

/**
 * Enqueue a meeting for enrichment via durable queue
 * Called when webhook notification indicates meeting has ended
 * 
 * ARCHITECTURE: Uses durableQueue for crash recovery and single-worker execution
 */
export async function enqueueMeetingEnrichment(meetingId: string, onlineMeetingId: string): Promise<void> {
  console.log(`📥 [Enrichment] Enqueuing meeting ${meetingId} for enrichment via durable queue`);
  
  // Mark as enriching immediately (prevents orphaned "pending" status if process crashes)
  await db.update(meetings)
    .set({
      enrichmentStatus: "enriching",
      enrichmentAttempts: 0,
      lastEnrichmentAt: new Date()
    })
    .where(eq(meetings.id, meetingId));
  
  // Enqueue via durable queue - handled by lease-based job worker
  try {
    await enqueueJob({
      jobType: 'enrich_meeting',
      payload: { meetingId, onlineMeetingId },
      idempotencyKey: `enrich:${meetingId}`,
      maxRetries: MAX_ATTEMPTS
    });
    console.log(`✅ [Enrichment] Meeting ${meetingId} enqueued for processing`);
  } catch (error: any) {
    // Ignore duplicate key errors (job already enqueued)
    if (!error.message?.includes('duplicate key')) {
      console.error(`❌ [Enrichment] Failed to enqueue meeting ${meetingId}:`, error);
      throw error;
    }
    console.log(`⚠️ [Enrichment] Meeting ${meetingId} already enqueued, skipping duplicate`);
  }
}

/**
 * Enrich a single meeting with callRecord data
 */
async function enrichMeeting(meetingId: string, onlineMeetingId: string, attempt: number): Promise<void> {
  console.log(`🔍 [Enrichment] Processing meeting ${meetingId} (attempt ${attempt}/${MAX_ATTEMPTS})`);
  
  // Mark as enriching and clear retry timestamp (prevents double-enqueue from background job)
  await db.update(meetings)
    .set({
      enrichmentStatus: "enriching",
      enrichmentAttempts: attempt,
      lastEnrichmentAt: new Date(),
      callRecordRetryAt: null  // Clear to prevent background job from detecting "stale" timestamp
    })
    .where(eq(meetings.id, meetingId));
  
  // PRODUCTION ONLY: No mock services - always use real Microsoft Graph API
  // Mock data paths have been removed per production requirements
  try {
    // Import token acquisition for Graph API access
    const { acquireTokenByClientCredentials } = await import('./microsoftIdentity');
    
    // Get access token for Graph API
    const accessToken = await acquireTokenByClientCredentials([
      'https://graph.microsoft.com/.default'
    ]);
    
    if (!accessToken) {
      throw new Error('Failed to acquire Graph API access token');
    }
    
    const graphClient = await getGraphClient(accessToken);
    
    if (!graphClient) {
      throw new Error('Failed to get Graph API client');
    }
    
    // URL-encode the onlineMeetingId for Graph API (contains : and @ which must be encoded)
    const encodedMeetingId = encodeURIComponent(onlineMeetingId);
    console.log(`🔗 [Enrichment] Using encoded meeting ID: ${encodedMeetingId}`);
    
    // Fetch recordings
    console.log(`📹 [Enrichment] Fetching recordings for ${onlineMeetingId}`);
    const recordingsResponse = await graphClient.get(
      `/communications/onlineMeetings/${encodedMeetingId}/recordings`
    );
    
    const recordings: Recording[] = recordingsResponse?.value || [];
    const latestRecording = recordings.sort((a, b) => 
      new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    )[0];
    
    // Fetch transcripts
    console.log(`📝 [Enrichment] Fetching transcripts for ${onlineMeetingId}`);
    const transcriptsResponse = await graphClient.get(
      `/communications/onlineMeetings/${encodedMeetingId}/transcripts`
    );
    
    const transcripts: Transcript[] = transcriptsResponse?.value || [];
    const latestTranscript = transcripts.sort((a, b) => 
      new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    )[0];
    
    // Download transcript content if available
    let transcriptContent: string | null = null;
    if (latestTranscript?.transcriptContentUrl) {
      try {
        console.log(`📥 [Enrichment] Downloading transcript content...`);
        const transcriptResponse = await graphClient.get(
          `/communications/onlineMeetings/${encodedMeetingId}/transcripts/${latestTranscript.id}/content?$format=text/vtt`
        );
        transcriptContent = transcriptResponse;
        console.log(`✅ [Enrichment] Transcript content downloaded (${transcriptContent?.length || 0} chars)`);
      } catch (transcriptError) {
        console.warn(`⚠️ [Enrichment] Could not download transcript content:`, transcriptError);
      }
    }
    
    // Fetch call record for actual duration (compliance)
    let actualDurationSeconds: number | null = null;
    try {
      console.log(`📊 [Enrichment] Fetching call record details for duration...`);
      // Get the meeting's call record for actual start/end times
      const [meetingRecord] = await db.select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);
      
      if (meetingRecord?.callRecordId) {
        const callRecordResponse = await graphClient.get(
          `/communications/callRecords/${meetingRecord.callRecordId}`
        );
        if (callRecordResponse?.startDateTime && callRecordResponse?.endDateTime) {
          actualDurationSeconds = calculateActualDuration(
            callRecordResponse.startDateTime,
            callRecordResponse.endDateTime
          );
          console.log(`   Duration: ${actualDurationSeconds}s (${Math.floor((actualDurationSeconds || 0) / 60)}m)`);
        }
      }
    } catch (durationError) {
      console.warn(`⚠️ [Enrichment] Could not fetch call record duration:`, durationError);
    }
    
    // Count transcript words for content validation
    const transcriptWordCount = countTranscriptWords(transcriptContent);
    console.log(`   Transcript words: ${transcriptWordCount}`);
    
    // Validate processing thresholds (compliance)
    const hasTranscript = !!transcriptContent && transcriptContent.length > 0;
    const decision = validateForProcessing(actualDurationSeconds, transcriptWordCount, hasTranscript);
    await recordProcessingDecision(meetingId, decision);
    
    // Update meeting record (clear retry timestamp on success)
    // CRITICAL: Persist transcript content for AI minutes generation
    await db.update(meetings)
      .set({
        recordingUrl: latestRecording?.recordingContentUrl || null,
        transcriptUrl: latestTranscript?.transcriptContentUrl || null,
        transcriptContent: transcriptContent || null, // Persist full transcript for AI processing
        enrichmentStatus: "enriched",
        enrichmentAttempts: attempt,
        lastEnrichmentAt: new Date(),
        callRecordRetryAt: null, // Clear retry timestamp
        graphSyncStatus: "enriched"
      })
      .where(eq(meetings.id, meetingId));
    
    console.log(`✅ [Enrichment] Successfully enriched meeting ${meetingId}`);
    console.log(`   📹 Recording: ${latestRecording ? 'Found' : 'Not available'}`);
    console.log(`   📝 Transcript: ${latestTranscript ? 'Found' : 'Not available'}`);
    
    // Only trigger AI processing if validation passed
    if (decision.shouldProcess) {
      try {
        console.log(`🤖 [Enrichment] Triggering AI minutes generation...`);
        await minutesGeneratorService.autoGenerateMinutes(meetingId);
        console.log(`✅ [Enrichment] Minutes generation triggered for meeting ${meetingId}`);
      } catch (minutesError) {
        console.error(`❌ [Enrichment] Failed to auto-generate minutes:`, minutesError);
        // Don't fail enrichment if minutes generation fails
      }
    } else {
      console.log(`⏭️ [Enrichment] Skipping AI processing: ${decision.reason}`);
    }
    
  } catch (error: any) {
    // Handle Graph API errors
    if (error.statusCode === 404) {
      // Data not ready yet - this is expected, will retry
      console.log(`⏳ [Enrichment] CallRecord not ready yet for ${onlineMeetingId} (404)`);
      throw new Error('CallRecord not ready (404)');
    } else if (error.statusCode === 202) {
      // Processing in progress - will retry
      console.log(`⏳ [Enrichment] CallRecord processing for ${onlineMeetingId} (202)`);
      throw new Error('CallRecord processing (202)');
    } else {
      console.error(`❌ [Enrichment] Graph API error:`, error);
      throw error;
    }
  }
}

/**
 * Background job: Process stuck enrichments
 * ARCHITECTURE: Now uses durable queue - this function is kept for compatibility
 * but delegates to enqueueJob for crash-safe processing
 */
export async function processStuckEnrichments(): Promise<void> {
  console.log(`🔄 [Background Job] Checking for stuck enrichments...`);
  
  try {
    // Find meetings that need enrichment retry:
    // - Status "enriching" with retry time passed OR null (freshly enqueued/crashed)
    // - Haven't exceeded max attempts
    const now = new Date();
    
    const stuckMeetings = await db.select()
      .from(meetings)
      .where(
        and(
          eq(meetings.enrichmentStatus, "enriching"),
          sql`(${meetings.callRecordRetryAt} IS NULL OR ${meetings.callRecordRetryAt} < ${now})`,
          lt(meetings.enrichmentAttempts, MAX_ATTEMPTS)
        )
      );
    
    if (stuckMeetings.length === 0) {
      console.log(`✅ No stuck enrichments found`);
      return;
    }
    
    console.log(`🔄 Found ${stuckMeetings.length} stuck enrichment(s), re-queuing via durable queue...`);
    
    for (const meeting of stuckMeetings) {
      if (!meeting.onlineMeetingId) {
        console.warn(`⚠️  Meeting ${meeting.id} has no onlineMeetingId, skipping`);
        continue;
      }
      
      // Enqueue via durable queue for crash-safe processing
      try {
        await enqueueJob({
          jobType: 'enrich_meeting',
          payload: { meetingId: meeting.id, onlineMeetingId: meeting.onlineMeetingId },
          idempotencyKey: `enrich:${meeting.id}`,
          maxRetries: MAX_ATTEMPTS - (meeting.enrichmentAttempts || 0)
        });
      } catch (error: any) {
        // Ignore duplicate key errors (job already enqueued)
        if (!error.message?.includes('duplicate key')) {
          console.error(`❌ Failed to enqueue meeting ${meeting.id}:`, error);
        }
      }
    }
    
    console.log(`✅ [Background Job] Stuck enrichment check complete`);
    
  } catch (error) {
    console.error(`❌ [Background Job] Error checking stuck enrichments:`, error);
  }
}

/**
 * Manually trigger enrichment for a specific meeting
 * Useful for testing or manual retry
 */
export async function manuallyEnrichMeeting(meetingId: string): Promise<void> {
  const meeting = await db.select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  
  if (meeting.length === 0) {
    throw new Error(`Meeting ${meetingId} not found`);
  }
  
  if (!meeting[0].onlineMeetingId) {
    throw new Error(`Meeting ${meetingId} has no onlineMeetingId`);
  }
  
  await enqueueMeetingEnrichment(meetingId, meeting[0].onlineMeetingId);
}

/**
 * Clear all scheduled retry timers (for graceful shutdown)
 * ARCHITECTURE: No longer needed with durable queue - kept for API compatibility
 */
export function clearAllRetryTimers(): void {
  console.log(`✅ [Enrichment] Using durable queue - no in-memory timers to clear`);
  // No-op: All retries are now handled by the durable queue system
}

/**
 * Force process meeting with admin override
 * Bypasses duration and content thresholds for manual processing
 * 
 * @param meetingId - Meeting ID to process
 * @param adminUserId - Azure AD ID of admin performing override
 * @param overrideReason - Reason for manual override (for audit trail)
 */
export async function forceProcessMeeting(
  meetingId: string,
  adminUserId: string,
  overrideReason: string
): Promise<{ success: boolean; message: string }> {
  const { recordManualOverride } = await import('./processingValidation');
  
  const [meeting] = await db.select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  
  if (!meeting) {
    return { success: false, message: `Meeting ${meetingId} not found` };
  }
  
  // Check if meeting has already been processed
  if (meeting.processingDecision === "processed" || meeting.processingDecision === "manual_override") {
    return { success: false, message: `Meeting has already been processed (${meeting.processingDecision})` };
  }
  
  // Record the manual override decision for audit trail
  await recordManualOverride(meetingId, adminUserId, overrideReason);
  
  console.log(`🔧 [Manual Override] Admin ${adminUserId} forcing processing for meeting ${meetingId}`);
  console.log(`   Reason: ${overrideReason}`);
  
  // Trigger AI processing directly
  try {
    await minutesGeneratorService.autoGenerateMinutes(meetingId);
    return { 
      success: true, 
      message: `Manual processing triggered successfully. Minutes generation started.` 
    };
  } catch (error: any) {
    console.error(`❌ [Manual Override] Failed to generate minutes:`, error);
    return { 
      success: false, 
      message: `Failed to generate minutes: ${error.message}` 
    };
  }
}

export const callRecordEnrichmentService = {
  enqueueMeetingEnrichment,
  enrichMeeting,  // Export for direct calls from job worker
  processStuckEnrichments,
  manuallyEnrichMeeting,
  forceProcessMeeting,
  clearAllRetryTimers
};
