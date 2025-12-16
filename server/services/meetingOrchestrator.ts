import { db } from "../db";
import { meetings, meetingMinutes, meetingEvents } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { enqueueJob, completeJob, failJob } from "./durableQueue";
import type { Job, InsertMeetingEvent } from "@shared/schema";
import { teamsProactiveMessaging } from "./teamsProactiveMessaging";
import { callRecordEnrichmentService } from "./callRecordEnrichment";
import { acquireTokenByClientCredentials, getGraphClient } from "./microsoftIdentity";

/**
 * Helper to log meeting events in the audit trail
 */
async function logMeetingEvent(event: InsertMeetingEvent): Promise<void> {
  try {
    await db.insert(meetingEvents).values(event);
  } catch (error) {
    console.error("[Orchestrator] Failed to log meeting event:", error);
    // Don't throw - event logging should not break workflow
  }
}

/**
 * Meeting Lifecycle Orchestrator
 * 
 * Manages the complete meeting workflow with transactional guarantees:
 * 1. Webhook capture → enrichment job
 * 2. Enrichment complete → AI minutes generation job
 * 3. Minutes approved → email + SharePoint jobs
 * 
 * All state transitions are transactional with compensating actions on failure
 */

/**
 * Process a job from the durable queue
 * This is the main job processor that routes to specific handlers
 */
export async function processJob(job: Job): Promise<void> {
  try {
    console.log(`[Orchestrator] Processing job: ${job.jobType} (${job.id})`);

    switch (job.jobType) {
      case "process_call_record":
        await processCallRecordJob(job);
        break;
      case "enrich_meeting":
        await processEnrichmentJob(job);
        break;
      case "generate_minutes":
        await processMinutesGenerationJob(job);
        break;
      case "send_email":
        await processSendEmailJob(job);
        break;
      case "upload_sharepoint":
        await processUploadSharePointJob(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }

    await completeJob(job.id);
  } catch (error: any) {
    console.error(`[Orchestrator] Job failed: ${job.jobType}`, error);
    await failJob({
      jobId: job.id,
      error: error.message || "Unknown error",
      currentAttempt: job.attemptCount,
      maxRetries: job.maxRetries,
    });
  }
}

/**
 * Step 0: Process call record webhook notification (durable)
 * 
 * This job is enqueued when a callRecords webhook is received.
 * Matches the call record to a meeting and triggers enrichment.
 * 
 * CRITICAL FIX: Webhook payload does NOT include joinWebUrl - we must fetch
 * the full callRecord from Graph API to get it.
 * 
 * CRASH RECOVERY: If container crashes after receiving webhook but before
 * processing, this job will be picked up on restart from the durable queue.
 */
async function processCallRecordJob(job: Job): Promise<void> {
  const { resource, resourceData, callRecordId } = job.payload;
  
  if (!callRecordId) {
    throw new Error("callRecordId required in payload");
  }

  console.log(`📞 [Orchestrator] Processing call record: ${callRecordId}`);
  console.log(`   Resource: ${resource}`);

  // Extract join URL from resource data (might be missing in webhook payload)
  let joinWebUrl = resourceData?.joinWebUrl;
  let organizer = resourceData?.organizer?.user?.id;

  // CRITICAL: If joinWebUrl is missing, fetch full callRecord from Graph API
  let onlineMeetingId: string | null = null;
  
  if (!joinWebUrl) {
    console.log(`📥 [Orchestrator] JoinWebUrl missing from webhook, fetching from Graph API...`);
    try {
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);
      
      if (accessToken) {
        const graphClient = await getGraphClient(accessToken);
        if (graphClient) {
          const callRecord = await graphClient.get(`/communications/callRecords/${callRecordId}`);
          
          // Try joinWebUrl first, fall back to onlineMeetingUrl
          joinWebUrl = callRecord?.joinWebUrl || callRecord?.onlineMeetingUrl;
          organizer = callRecord?.organizer?.user?.id;
          
          // Extract onlineMeetingId from the URL if present (used for enrichment)
          // The join URL contains the meeting thread ID in format: 19:meeting_XXXXX@thread.v2
          // It may be URL-encoded (19%3ameeting_...) or decoded (19:meeting_...)
          if (joinWebUrl) {
            // Decode URL first to normalize
            const decodedUrl = decodeURIComponent(joinWebUrl);
            // Match pattern: 19:meeting_{base64-like-id}@thread.v2
            const meetingIdMatch = decodedUrl.match(/19:(meeting_[A-Za-z0-9_-]+)@thread\.v2/i);
            if (meetingIdMatch) {
              onlineMeetingId = `19:${meetingIdMatch[1]}@thread.v2`;
              console.log(`✅ [Orchestrator] Extracted onlineMeetingId: ${onlineMeetingId}`);
            }
          }
          
          console.log(`✅ [Orchestrator] Fetched callRecord from Graph. JoinWebUrl: ${joinWebUrl ? 'found' : 'N/A'}, OnlineMeetingId: ${onlineMeetingId || 'N/A'}`);
        }
      }
    } catch (error: any) {
      console.error(`⚠️ [Orchestrator] Failed to fetch callRecord from Graph:`, error.message);
    }
  }

  // Extract onlineMeetingId from joinWebUrl (regardless of source - webhook or Graph API)
  // The join URL contains the meeting thread ID in format: 19:meeting_XXXXX@thread.v2
  if (joinWebUrl && !onlineMeetingId) {
    try {
      const decodedUrl = decodeURIComponent(joinWebUrl);
      const meetingIdMatch = decodedUrl.match(/19:(meeting_[A-Za-z0-9_-]+)@thread\.v2/i);
      if (meetingIdMatch) {
        onlineMeetingId = `19:${meetingIdMatch[1]}@thread.v2`;
        console.log(`✅ [Orchestrator] Extracted onlineMeetingId from URL: ${onlineMeetingId}`);
      }
    } catch (e) {
      console.warn(`⚠️ [Orchestrator] Failed to decode joinWebUrl for onlineMeetingId extraction`);
    }
  }

  // Try to find meeting by Teams join link
  if (joinWebUrl) {
    // Normalize URL for matching - handle both encoded and decoded formats
    const normalizedUrl = decodeURIComponent(joinWebUrl);
    
    // Extract the meeting thread ID for pattern matching (handles both encoded and decoded)
    // Matches: 19:meeting_XXXXX or 19%3ameeting_XXXXX
    const meetingThreadMatch = normalizedUrl.match(/19:(meeting_[^@\/]+)/i) || 
                               joinWebUrl.match(/19%3[aA](meeting_[^@%\/]+)/i);
    
    let meeting = null;
    
    // Try exact match first
    const [exactMatch] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.teamsJoinLink, joinWebUrl))
      .limit(1);
    
    if (exactMatch) {
      meeting = exactMatch;
    }
    
    // Try normalized exact match
    if (!meeting && normalizedUrl !== joinWebUrl) {
      const [normalizedMatch] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.teamsJoinLink, normalizedUrl))
        .limit(1);
      if (normalizedMatch) {
        meeting = normalizedMatch;
      }
    }

    // If no exact match, try pattern matching by meeting thread ID
    if (!meeting && meetingThreadMatch) {
      const meetingIdPattern = `%${meetingThreadMatch[1]}%`;
      console.log(`🔍 [Orchestrator] Trying pattern match with: ${meetingIdPattern}`);
      
      const matchedMeetings = await db
        .select()
        .from(meetings)
        .where(sql`${meetings.teamsJoinLink} LIKE ${meetingIdPattern}`)
        .limit(1);
      
      if (matchedMeetings.length > 0) {
        meeting = matchedMeetings[0];
      }
    }

    if (meeting) {
      console.log(`✅ [Orchestrator] Found meeting: ${meeting.id} (${meeting.title})`);
      
      // Determine the best onlineMeetingId for enrichment
      const enrichmentMeetingId = meeting.onlineMeetingId || onlineMeetingId;
      
      // Fetch call record details for duration and timestamps
      let newCallRecordDuration = 0;
      let sessionStartTime: Date | null = null;
      let sessionEndTime: Date | null = null;
      try {
        const accessToken = await acquireTokenByClientCredentials([
          'https://graph.microsoft.com/.default'
        ]);
        if (accessToken) {
          const graphClient = await getGraphClient(accessToken);
          if (graphClient) {
            const callRecordDetails = await graphClient.get(`/communications/callRecords/${callRecordId}`);
            if (callRecordDetails?.startDateTime && callRecordDetails?.endDateTime) {
              sessionStartTime = new Date(callRecordDetails.startDateTime);
              sessionEndTime = new Date(callRecordDetails.endDateTime);
              newCallRecordDuration = Math.floor((sessionEndTime.getTime() - sessionStartTime.getTime()) / 1000);
              console.log(`📊 [Orchestrator] New call record duration: ${newCallRecordDuration}s`);
            }
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ [Orchestrator] Could not fetch call record duration:`, e.message);
      }
      
      // Check if this meeting already has a call record (existing session)
      // If it does, create a NEW child meeting record for this session
      const isNewSession = !!meeting.callRecordId && meeting.callRecordId !== callRecordId;
      
      let targetMeetingId = meeting.id;
      
      if (isNewSession) {
        // Multi-session support: Create child meeting record linked to canonical parent
        // The canonical parent is the meeting with parentMeetingId IS NULL
        const canonicalParentId = meeting.parentMeetingId || meeting.id;
        
        console.log(`🔄 [Orchestrator] Creating child session record (parent: ${canonicalParentId})`);
        
        // Count existing sessions for this parent to determine session number
        // Include the parent (session 1) plus any existing children
        const existingChildren = await db
          .select()
          .from(meetings)
          .where(eq(meetings.parentMeetingId, canonicalParentId));
        const sessionNumber = existingChildren.length + 2; // +2 because parent is session 1
        
        // Create child meeting record linked to parent
        // Child inherits Graph identifiers from parent - partial unique indexes allow this
        const [newMeeting] = await db.insert(meetings).values({
          title: `${meeting.title.replace(/ \(Session \d+\)$/, '')} (Session ${sessionNumber})`,
          description: meeting.description,
          scheduledAt: sessionStartTime || meeting.scheduledAt,
          duration: meeting.duration,
          location: meeting.location,
          organizerEmail: meeting.organizerEmail,
          organizerAadId: meeting.organizerAadId,
          attendees: meeting.attendees,
          invitees: meeting.invitees,
          classificationLevel: meeting.classificationLevel,
          isOnlineMeeting: meeting.isOnlineMeeting,
          teamsJoinLink: meeting.teamsJoinLink,
          onlineMeetingId: enrichmentMeetingId,
          graphEventId: meeting.graphEventId,
          iCalUid: meeting.iCalUid,
          callRecordId: callRecordId,
          actualDurationSeconds: newCallRecordDuration,
          status: 'completed',
          graphSyncStatus: 'synced',
          sourceType: 'graph_webhook',
          parentMeetingId: canonicalParentId, // Link to canonical parent
          sessionNumber: sessionNumber,
        }).returning();
        
        targetMeetingId = newMeeting.id;
        console.log(`✅ [Orchestrator] Created child session: ${newMeeting.id} (Session ${sessionNumber}, parent: ${canonicalParentId})`);
      } else {
        // First session for this meeting - update the existing record
        const updateData: any = { 
          callRecordId,
          actualDurationSeconds: newCallRecordDuration,
          status: 'completed',
          graphSyncStatus: 'synced'
        };
        
        if (!meeting.onlineMeetingId && onlineMeetingId) {
          updateData.onlineMeetingId = onlineMeetingId;
        }
        
        await db.update(meetings)
          .set(updateData)
          .where(eq(meetings.id, meeting.id));
          
        console.log(`✅ [Orchestrator] Updated first session: ${meeting.id}`);
      }

      // Trigger enrichment only if we have a valid onlineMeetingId
      if (enrichmentMeetingId) {
        console.log(`🎬 [Orchestrator] Triggering enrichment for meeting: ${targetMeetingId} (onlineMeetingId: ${enrichmentMeetingId})`);
        await callRecordEnrichmentService.enqueueMeetingEnrichment(targetMeetingId, enrichmentMeetingId);
      } else {
        console.log(`⚠️ [Orchestrator] Cannot trigger enrichment - no onlineMeetingId available for meeting: ${targetMeetingId}`);
      }
      
      return;
    }
  }

  // If no match found by join URL, log for manual review
  console.log(`⚠️ [Orchestrator] Could not match call record to a meeting. CallRecordId: ${callRecordId}`);
  console.log(`   Join URL: ${joinWebUrl || 'N/A'}`);
  console.log(`   Organizer: ${organizer || 'N/A'}`);
  
  // Don't throw an error - just log. This is not a failure condition since
  // not all call records will have matching meetings (e.g., ad-hoc calls)
}

/**
 * Step 1: Enrich meeting with data from Microsoft Graph API
 * PRODUCTION: Calls callRecordEnrichmentService.enrichMeeting which:
 * 1. Fetches recordings/transcripts from Microsoft Graph API
 * 2. Persists transcript content to database
 * 3. Triggers AI minutes generation upon successful enrichment
 */
async function processEnrichmentJob(job: Job): Promise<void> {
  const { meetingId, onlineMeetingId } = job.payload;
  if (!meetingId) throw new Error("meetingId required");
  if (!onlineMeetingId) throw new Error("onlineMeetingId required for enrichment");

  console.log(`[Orchestrator] Starting enrichment for meeting: ${meetingId}`);

  // Call enrichMeeting directly - this does the actual work:
  // - Fetches recordings/transcripts from Graph API
  // - Persists transcript content to database
  // - Triggers AI minutes generation upon successful enrichment
  await callRecordEnrichmentService.enrichMeeting(meetingId, onlineMeetingId, job.attemptCount);
  
  console.log(`[Orchestrator] Enrichment completed for meeting: ${meetingId}`);
}

/**
 * Step 2: Generate meeting minutes using AI
 */
async function processMinutesGenerationJob(job: Job): Promise<void> {
  const { meetingId } = job.payload;
  if (!meetingId) throw new Error("meetingId required");

  // Get or create meeting minutes record
  let minutes = await db.query.meetingMinutes.findFirst({
    where: (minutes, { eq }) => eq(minutes.meetingId, meetingId),
  });

  if (!minutes) {
    // Create new minutes record
    const [newMinutes] = await db.insert(meetingMinutes).values({
      meetingId,
      summary: "",
      keyDiscussions: [],
      decisions: [],
      attendeesPresent: [],
      processingStatus: "generating",
    }).returning();
    minutes = newMinutes;
  } else {
    // Update existing minutes to generating status
    await db.update(meetingMinutes)
      .set({
        processingStatus: "generating",
      })
      .where(eq(meetingMinutes.id, minutes.id));
  }

  try {
    // Get meeting to access transcript data (persisted by callRecordEnrichment)
    const meeting = await db.query.meetings.findFirst({
      where: (m, { eq }) => eq(m.id, meetingId),
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // Use persisted transcript content from enrichment
    const transcript = meeting.transcriptContent;
    
    if (!transcript || transcript.length < 50) {
      throw new Error(`No transcript available for meeting ${meetingId}. Meetings require a recorded transcript for AI minutes generation.`);
    }

    console.log(`[Orchestrator] Using persisted transcript (${transcript.length} chars) for meeting: ${meetingId}`);

    // Import AI services
    const { generateMeetingMinutes, extractActionItems } = await import("./azureOpenAI");
    
    // Generate minutes using AI with real transcript
    const minutesData = await generateMeetingMinutes(transcript);
    
    // Extract action items from real transcript
    const actionItemsData = await extractActionItems(transcript);

    // Get invitees from Graph calendar sync (the authoritative list)
    const invitees = (meeting as any).invitees || [];
    const existingAttendees = meeting.attendees || [];
    
    // Extract speakers from WEBVTT transcript format: <v Speaker Name>...</v>
    // Also handles class qualifiers like <v.identifier Name>
    const webvttSpeakers: string[] = [];
    const webvttPattern = /<v(?:\.[^ >]+)?\s*([^>]+)>/gi;
    let match;
    while ((match = webvttPattern.exec(transcript)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !webvttSpeakers.some(s => s.toLowerCase() === speakerName.toLowerCase())) {
        webvttSpeakers.push(speakerName);
      }
    }
    console.log(`🎤 [Orchestrator] Extracted ${webvttSpeakers.length} speakers from WEBVTT: ${webvttSpeakers.join(', ')}`);
    
    // Extract simulated speakers from transcript text: "[Name] speaking" patterns
    // This is for solo test mode where one person role-plays multiple participants
    // Supports: "Alex speaking", "Alex speaking:", "Alex Johnson speaking", etc.
    const speakingPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+speaking[.,!:]?/gi;
    const transcriptSimulatedSpeakers: string[] = [];
    while ((match = speakingPattern.exec(transcript)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !transcriptSimulatedSpeakers.some(s => s.toLowerCase() === speakerName.toLowerCase())) {
        transcriptSimulatedSpeakers.push(speakerName);
      }
    }
    console.log(`🎭 [Orchestrator] Extracted ${transcriptSimulatedSpeakers.length} simulated speakers from transcript: ${transcriptSimulatedSpeakers.join(', ')}`);
    
    // Check for simulated speakers (from AI response or transcript parsing)
    const aiSimulatedSpeakers = minutesData.simulatedSpeakers || [];
    const simulatedSpeakers = transcriptSimulatedSpeakers.length > 0 ? transcriptSimulatedSpeakers : aiSimulatedSpeakers;
    const isSoloTest = simulatedSpeakers.length > 0;
    
    // Determine final attendees list:
    // Priority: simulated speakers (solo test) > WEBVTT speakers > invitees > existing attendees
    // Solo test: one person role-plays multiple participants using "[Name] speaking" patterns
    let uniqueAttendees: string[];
    if (isSoloTest) {
      // Solo test: use simulated speakers as attendees (the roles being played)
      uniqueAttendees = [...simulatedSpeakers];
      console.log(`👥 [Orchestrator] SOLO TEST detected - Using simulated speakers as attendees: ${uniqueAttendees.join(', ')}`);
    } else if (webvttSpeakers.length > 0) {
      // Real transcript with WEBVTT speaker tags - use those as attendees
      const allSources = [...webvttSpeakers, ...invitees, ...existingAttendees];
      uniqueAttendees = Array.from(new Set(allSources.filter(Boolean)));
      console.log(`👥 [Orchestrator] Using WEBVTT speakers as attendees: ${uniqueAttendees.length}`);
    } else {
      // Normal meeting: use invitees from Graph, fall back to existing attendees
      uniqueAttendees = invitees.length > 0 ? invitees : existingAttendees;
      console.log(`👥 [Orchestrator] Normal meeting - Using attendees: ${uniqueAttendees.length}`);
    }
    
    // Update the meeting record with attendees if needed
    if (uniqueAttendees.length > 0 && uniqueAttendees.length !== existingAttendees.length) {
      console.log(`📝 [Orchestrator] Updating meeting record with ${uniqueAttendees.length} attendees`);
      await db.update(meetings)
        .set({ attendees: uniqueAttendees })
        .where(eq(meetings.id, meetingId));
    }

    // Update minutes with AI-generated content and attendees
    await db.update(meetingMinutes)
      .set({
        processingStatus: "completed",
        summary: minutesData.summary,
        keyDiscussions: minutesData.keyDiscussions,
        decisions: minutesData.decisions,
        attendeesPresent: uniqueAttendees,
      })
      .where(eq(meetingMinutes.id, minutes.id));

    // Create action items if extracted
    if (actionItemsData.length > 0) {
      const { actionItems: actionItemsTable } = await import("@shared/schema");
      for (const item of actionItemsData) {
        await db.insert(actionItemsTable).values({
          meetingId,
          minutesId: minutes.id,
          task: item.task,
          assignee: item.assignee || "Unassigned",
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          priority: (item.priority as "high" | "medium" | "low") || "medium",
          status: "pending",
        }).onConflictDoNothing();
      }
      console.log(`[Orchestrator] Created ${actionItemsData.length} action items`);
    }

    console.log(`[Orchestrator] Minutes generation complete for meeting: ${meetingId}`);

    // Log the minutes generation event
    await logMeetingEvent({
      meetingId,
      tenantId: null,
      eventType: "minutes_generated",
      title: "Meeting Minutes Generated",
      description: "AI-powered meeting minutes have been successfully generated and are ready for review.",
      actorEmail: "system",
      actorName: "System",
      actorAadId: null,
      metadata: { 
        minutesId: minutes.id,
        jobId: job.id
      },
      correlationId: job.idempotencyKey,
    });

    // Send Teams Adaptive Card notification if minutes are approved
    const updatedMinutes = await db.query.meetingMinutes.findFirst({
      where: (m, { eq }) => eq(m.id, minutes.id),
    });

    if (updatedMinutes && updatedMinutes.approvalStatus === 'approved') {
      const meeting = await db.query.meetings.findFirst({
        where: (m, { eq }) => eq(m.id, meetingId),
      });

      if (meeting) {
        await teamsProactiveMessaging.notifyMeetingProcessed(meeting, updatedMinutes);
      }
    }
  } catch (error: any) {
    // Rollback: Mark minutes generation as failed
    await db.update(meetingMinutes)
      .set({
        processingStatus: "failed",
      })
      .where(eq(meetingMinutes.id, minutes.id));

    throw error;
  }
}

/**
 * Step 3a: Send approved minutes via email
 */
async function processSendEmailJob(job: Job): Promise<void> {
  const { meetingId, minutesId } = job.payload;
  if (!meetingId || !minutesId) throw new Error("meetingId and minutesId required");

  try {
    // Get latest meeting data
    const meeting = await db.query.meetings.findFirst({
      where: (meetings, { eq }) => eq(meetings.id, meetingId)
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // Get latest minutes data (ensuring we have fresh post-approval data)
    const minutes = await db.query.meetingMinutes.findFirst({
      where: (meetingMinutes, { eq }) => eq(meetingMinutes.id, minutesId)
    });

    if (!minutes) {
      throw new Error(`Minutes not found: ${minutesId}`);
    }

    // Get action items for this meeting
    const meetingActionItems = await db.query.actionItems.findMany({
      where: (actionItems, { eq }) => eq(actionItems.meetingId, meetingId)
    });

    // Combine for document generation (meeting with minutes AND action items)
    const meetingWithMinutes = { ...meeting, minutes, actionItems: meetingActionItems };

    // Generate documents with fresh minutes data
    const { documentExportService } = await import("./documentExport");
    const docxBuffer = await documentExportService.generateDOCX(meetingWithMinutes);
    const pdfBuffer = await documentExportService.generatePDF(meetingWithMinutes);

    // Send email with attachments
    const { emailDistributionService } = await import("./emailDistribution");
    await emailDistributionService.distributeMinutes(meetingWithMinutes, [
      {
        filename: `meeting-minutes-${meeting.id}.docx`,
        content: docxBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      {
        filename: `meeting-minutes-${meeting.id}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]);

    console.log(`[Orchestrator] Email sent for meeting: ${meetingId} to ${meeting.attendees.length} attendees`);

    // Log the email sent event
    await logMeetingEvent({
      meetingId,
      tenantId: null,
      eventType: "email_sent",
      title: "Minutes Distributed via Email",
      description: `Meeting minutes distributed to ${meeting.attendees.length} attendees with DOCX and PDF attachments.`,
      actorEmail: "system",
      actorName: "System",
      actorAadId: null,
      metadata: { 
        minutesId,
        recipientCount: meeting.attendees.length,
        attachments: ["DOCX", "PDF"],
        jobId: job.id
      },
      correlationId: job.idempotencyKey,
    });
  } catch (error: any) {
    console.error(`[Orchestrator] Email failed for meeting ${meetingId}:`, error.message);
    throw error;
  }
}

/**
 * Step 3b: Upload approved minutes to SharePoint
 */
async function processUploadSharePointJob(job: Job): Promise<void> {
  const { meetingId, minutesId } = job.payload;
  if (!meetingId || !minutesId) throw new Error("meetingId and minutesId required");

  try {
    // Get latest meeting data
    const meeting = await db.query.meetings.findFirst({
      where: (meetings, { eq }) => eq(meetings.id, meetingId)
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // Get latest minutes data (ensuring we have fresh post-approval data)
    const minutes = await db.query.meetingMinutes.findFirst({
      where: (meetingMinutes, { eq }) => eq(meetingMinutes.id, minutesId)
    });

    if (!minutes) {
      throw new Error(`Minutes not found: ${minutesId}`);
    }

    // Get action items for this meeting
    const meetingActionItems = await db.query.actionItems.findMany({
      where: (actionItems, { eq }) => eq(actionItems.meetingId, meetingId)
    });

    // Combine for document generation (meeting with minutes AND action items)
    const meetingWithMinutes = { ...meeting, minutes, actionItems: meetingActionItems };

    // Generate DOCX for SharePoint
    const { documentExportService } = await import("./documentExport");
    const docxBuffer = await documentExportService.generateDOCX(meetingWithMinutes);

    // Upload to SharePoint
    const { uploadToSharePoint } = await import("./sharepointClient");
    const sharepointUrl = await uploadToSharePoint(
      `meeting-minutes-${meeting.id}.docx`,
      docxBuffer,
      {
        classificationLevel: meeting.classificationLevel,
        meetingDate: new Date(meeting.scheduledAt),
        attendeeCount: meeting.attendees.length,
        meetingId: meeting.id
      }
    );

    // Update minutes with SharePoint URL
    await db.update(meetingMinutes)
      .set({
        sharepointUrl,
      })
      .where(eq(meetingMinutes.id, minutesId));

    // Update meeting status to archived
    await db.update(meetings)
      .set({
        status: "archived",
        graphSyncStatus: "archived",
      })
      .where(eq(meetings.id, meetingId));

    console.log(`[Orchestrator] SharePoint upload complete for meeting: ${meetingId} - ${sharepointUrl}`);

    // Log the SharePoint upload event
    await logMeetingEvent({
      meetingId,
      tenantId: null,
      eventType: "sharepoint_uploaded",
      title: "Minutes Archived to SharePoint",
      description: `Meeting minutes have been successfully uploaded to SharePoint document library.`,
      actorEmail: "system",
      actorName: "System",
      actorAadId: null,
      metadata: { 
        minutesId,
        sharepointUrl,
        classificationLevel: meeting.classificationLevel,
        jobId: job.id
      },
      correlationId: job.idempotencyKey,
    });
  } catch (error: any) {
    console.error(`[Orchestrator] SharePoint upload failed for meeting ${meetingId}:`, error.message);
    throw error;
  }
}

/**
 * Trigger the complete approval workflow (email + SharePoint + Teams cards)
 * Called when minutes are approved
 * Respects app settings for distribution channels
 */
export async function triggerApprovalWorkflow(params: {
  meetingId: string;
  minutesId: string;
}): Promise<{ emailJobId: string | null; sharepointJobId: string | null }> {
  const { meetingId, minutesId } = params;

  // Get current settings to check which distribution channels are enabled
  const { storage } = await import("../storage");
  const settings = await storage.getSettings();

  let emailJobId: string | null = null;
  let sharepointJobId: string | null = null;

  // Only enqueue email job if enabled in settings
  if (settings.enableEmailDistribution) {
    emailJobId = await enqueueJob({
      jobType: "send_email",
      idempotencyKey: `send_email:${minutesId}`,
      payload: { meetingId, minutesId },
      maxRetries: 3,
    });
    console.log(`[Orchestrator] Email distribution job enqueued: ${emailJobId}`);
  } else {
    console.log(`[Orchestrator] Email distribution disabled in settings - skipping`);
  }

  // Only enqueue SharePoint upload job if enabled in settings
  if (settings.enableSharePointArchival) {
    sharepointJobId = await enqueueJob({
      jobType: "upload_sharepoint",
      idempotencyKey: `upload_sharepoint:${minutesId}`,
      payload: { meetingId, minutesId },
      maxRetries: 3,
    });
    console.log(`[Orchestrator] SharePoint archival job enqueued: ${sharepointJobId}`);
  } else {
    console.log(`[Orchestrator] SharePoint archival disabled in settings - skipping`);
  }

  // Send Teams Adaptive Card notification if enabled in settings
  if (settings.enableTeamsCardNotifications) {
    // Get meeting and minutes data for card generation
    const meeting = await db.query.meetings.findFirst({
      where: (meetings, { eq }) => eq(meetings.id, meetingId)
    });

    const minutes = await db.query.meetingMinutes.findFirst({
      where: (meetingMinutes, { eq }) => eq(meetingMinutes.id, minutesId)
    });

    if (meeting && minutes) {
      const { teamsProactiveMessaging } = await import("./teamsProactiveMessaging");
      await teamsProactiveMessaging.notifyMeetingProcessed(meeting, minutes);
      console.log(`[Orchestrator] Teams card notification sent for meeting: ${meetingId}`);
    }
  } else {
    console.log(`[Orchestrator] Teams card notifications disabled in settings - skipping`);
  }

  console.log(`[Orchestrator] Triggered approval workflow for meeting: ${meetingId}`);

  return { emailJobId, sharepointJobId };
}

/**
 * Trigger the complete meeting processing workflow
 * Called when a new meeting webhook is received
 */
export async function triggerMeetingWorkflow(meetingId: string): Promise<string | null> {
  // Enqueue enrichment job (first step)
  const jobId = await enqueueJob({
    jobType: "enrich_meeting",
    idempotencyKey: `enrich_meeting:${meetingId}`,
    payload: { meetingId },
    maxRetries: 3,
  });

  if (jobId) {
    console.log(`[Orchestrator] Triggered meeting workflow for: ${meetingId}`);
  }

  return jobId;
}
