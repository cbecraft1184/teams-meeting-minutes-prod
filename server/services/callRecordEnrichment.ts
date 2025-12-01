/**
 * Call Record Enrichment Service
 * 
 * After a Teams meeting ends, this service fetches the callRecord, recordings,
 * and transcripts from Microsoft Graph API to enrich the meeting record.
 * 
 * Architecture:
 * - Event-driven: Triggered by webhook notifications when meeting ends
 * - Background catch-up: Scheduled job retries failed/stuck enrichments
 * - Exponential backoff: 5, 15, 45 minutes (Graph eventual consistency)
 * - Graceful degradation: Handles 404/202 responses (data not ready yet)
 */

import { db } from "../db";
import { meetings } from "@shared/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { getGraphClient } from "./microsoftIdentity";
import { minutesGeneratorService } from "./minutesGenerator";
import { 
  processingValidationService,
  countTranscriptWords,
  calculateActualDuration,
  validateForProcessing,
  recordProcessingDecision
} from "./processingValidation";

/**
 * Enrichment queue item
 */
interface EnrichmentTask {
  meetingId: string;
  onlineMeetingId: string;
  attempt: number;
}

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
 * In-memory enrichment queue
 */
const enrichmentQueue: EnrichmentTask[] = [];
let isProcessing = false;

/**
 * Track scheduled retry timers for cleanup on shutdown
 */
const scheduledRetries: Map<string, NodeJS.Timeout> = new Map();

/**
 * Exponential backoff delays (in minutes)
 * Attempt 1 → 2: 5 minutes
 * Attempt 2 → 3: 15 minutes
 * Attempt 3 → 4: 45 minutes
 */
const BACKOFF_DELAYS = [5, 15, 45];
const MAX_ATTEMPTS = 4; // Allow 4 attempts total (initial + 3 retries)

/**
 * Enqueue a meeting for enrichment
 * Called when webhook notification indicates meeting has ended
 */
export async function enqueueMeetingEnrichment(meetingId: string, onlineMeetingId: string): Promise<void> {
  console.log(`📥 [Enrichment] Enqueuing meeting ${meetingId} for enrichment`);
  
  // Mark as enriching immediately (prevents orphaned "pending" status if process crashes)
  await db.update(meetings)
    .set({
      enrichmentStatus: "enriching",
      enrichmentAttempts: 0,
      lastEnrichmentAt: new Date()
    })
    .where(eq(meetings.id, meetingId));
  
  // Add to queue
  enrichmentQueue.push({
    meetingId,
    onlineMeetingId,
    attempt: 1
  });
  
  // Start processing if not already running
  if (!isProcessing) {
    processEnrichmentQueue();
  }
}

/**
 * Process enrichment queue
 * Processes items asynchronously with retry logic
 */
async function processEnrichmentQueue(): Promise<void> {
  if (isProcessing || enrichmentQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  while (enrichmentQueue.length > 0) {
    const task = enrichmentQueue.shift()!;
    
    try {
      await enrichMeeting(task.meetingId, task.onlineMeetingId, task.attempt);
    } catch (error) {
      console.error(`❌ [Enrichment] Failed to enrich meeting ${task.meetingId}:`, error);
      
      // Retry with exponential backoff
      if (task.attempt < MAX_ATTEMPTS) {
        const delayMinutes = BACKOFF_DELAYS[task.attempt - 1] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
        const delayMs = delayMinutes * 60 * 1000;
        const retryAt = new Date(Date.now() + delayMs);
        
        console.log(`🔄 [Enrichment] Scheduling retry ${task.attempt + 1}/${MAX_ATTEMPTS} in ${delayMinutes} minutes`);
        
        // Update database with retry schedule
        await db.update(meetings)
          .set({
            enrichmentStatus: "enriching",
            enrichmentAttempts: task.attempt,
            lastEnrichmentAt: new Date(),
            callRecordRetryAt: retryAt
          })
          .where(eq(meetings.id, task.meetingId));
        
        // Schedule actual retry timer (implements true exponential backoff)
        const timerId = setTimeout(() => {
          console.log(`⏰ [Enrichment] Retry timer fired for meeting ${task.meetingId}`);
          enrichmentQueue.push({
            meetingId: task.meetingId,
            onlineMeetingId: task.onlineMeetingId,
            attempt: task.attempt + 1
          });
          scheduledRetries.delete(task.meetingId);
          
          // Start processing if not already running
          if (!isProcessing) {
            processEnrichmentQueue();
          }
        }, delayMs);
        
        // Track timer for cleanup
        scheduledRetries.set(task.meetingId, timerId);
      } else {
        // Max attempts reached, mark as failed
        console.error(`❌ [Enrichment] Max attempts (${MAX_ATTEMPTS}) reached for meeting ${task.meetingId}`);
        
        await db.update(meetings)
          .set({
            enrichmentStatus: "failed",
            enrichmentAttempts: MAX_ATTEMPTS,
            lastEnrichmentAt: new Date(),
            callRecordRetryAt: null // Clear retry timestamp
          })
          .where(eq(meetings.id, task.meetingId));
      }
    }
  }
  
  isProcessing = false;
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
  
  // Get Graph API client
  const useMockServices = process.env.USE_MOCK_SERVICES !== "false";
  
  if (useMockServices) {
    // Mock mode: Simulate enrichment with fake data
    console.log(`🧪 [Enrichment] Mock mode: Simulating enrichment for meeting ${meetingId}`);
    
    // Mock: Simulate a 30-minute meeting with 200-word transcript
    const mockDurationSeconds = 30 * 60; // 30 minutes
    const mockTranscriptWordCount = 200; // 200 words
    
    // Validate processing thresholds (DOD/Commercial compliance)
    const decision = validateForProcessing(mockDurationSeconds, mockTranscriptWordCount, true);
    await recordProcessingDecision(meetingId, decision);
    
    await db.update(meetings)
      .set({
        callRecordId: `mock-callrecord-${onlineMeetingId}`,
        recordingUrl: `https://mock-storage.example.com/recordings/${onlineMeetingId}.mp4`,
        transcriptUrl: `https://mock-storage.example.com/transcripts/${onlineMeetingId}.vtt`,
        enrichmentStatus: "enriched",
        enrichmentAttempts: attempt,
        lastEnrichmentAt: new Date(),
        callRecordRetryAt: null, // Clear retry timestamp
        graphSyncStatus: "enriched"
      })
      .where(eq(meetings.id, meetingId));
    
    console.log(`✅ [Enrichment] Mock enrichment complete for meeting ${meetingId}`);
    
    // Only trigger AI processing if validation passed
    if (decision.shouldProcess) {
      try {
        console.log(`🤖 [Enrichment] Triggering auto-generation of minutes...`);
        await minutesGeneratorService.autoGenerateMinutes(meetingId);
      } catch (error) {
        console.error(`❌ [Enrichment] Failed to auto-generate minutes:`, error);
        // Don't fail enrichment if minutes generation fails
      }
    } else {
      console.log(`⏭️ [Enrichment] Skipping AI processing: ${decision.reason}`);
    }
    
    return;
  }
  
  // Real mode: Fetch from Microsoft Graph API
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
    
    // Fetch recordings
    console.log(`📹 [Enrichment] Fetching recordings for ${onlineMeetingId}`);
    const recordingsResponse = await graphClient.get(
      `/communications/onlineMeetings/${onlineMeetingId}/recordings`
    );
    
    const recordings: Recording[] = recordingsResponse?.value || [];
    const latestRecording = recordings.sort((a, b) => 
      new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    )[0];
    
    // Fetch transcripts
    console.log(`📝 [Enrichment] Fetching transcripts for ${onlineMeetingId}`);
    const transcriptsResponse = await graphClient.get(
      `/communications/onlineMeetings/${onlineMeetingId}/transcripts`
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
          `/communications/onlineMeetings/${onlineMeetingId}/transcripts/${latestTranscript.id}/content?$format=text/vtt`
        );
        transcriptContent = transcriptResponse;
        console.log(`✅ [Enrichment] Transcript content downloaded (${transcriptContent?.length || 0} chars)`);
      } catch (transcriptError) {
        console.warn(`⚠️ [Enrichment] Could not download transcript content:`, transcriptError);
      }
    }
    
    // Fetch call record for actual duration (DOD/Commercial compliance)
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
    
    // Validate processing thresholds (DOD/Commercial compliance)
    const hasTranscript = !!transcriptContent && transcriptContent.length > 0;
    const decision = validateForProcessing(actualDurationSeconds, transcriptWordCount, hasTranscript);
    await recordProcessingDecision(meetingId, decision);
    
    // Update meeting record (clear retry timestamp on success)
    await db.update(meetings)
      .set({
        recordingUrl: latestRecording?.recordingContentUrl || null,
        transcriptUrl: latestTranscript?.transcriptContentUrl || null,
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
 * Runs every 30 minutes to catch meetings that need retry
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
    
    console.log(`🔄 Found ${stuckMeetings.length} stuck enrichment(s), re-queuing...`);
    
    for (const meeting of stuckMeetings) {
      if (!meeting.onlineMeetingId) {
        console.warn(`⚠️  Meeting ${meeting.id} has no onlineMeetingId, skipping`);
        continue;
      }
      
      enrichmentQueue.push({
        meetingId: meeting.id,
        onlineMeetingId: meeting.onlineMeetingId,
        attempt: (meeting.enrichmentAttempts || 0) + 1
      });
    }
    
    // Start processing
    if (!isProcessing) {
      processEnrichmentQueue();
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
 */
export function clearAllRetryTimers(): void {
  console.log(`🛑 Clearing ${scheduledRetries.size} scheduled enrichment retry timer(s)`);
  scheduledRetries.forEach((timerId) => {
    clearTimeout(timerId);
  });
  scheduledRetries.clear();
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
  processStuckEnrichments,
  manuallyEnrichMeeting,
  forceProcessMeeting,
  clearAllRetryTimers
};
