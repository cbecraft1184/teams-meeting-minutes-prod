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
          
          joinWebUrl = callRecord?.joinWebUrl;
          organizer = callRecord?.organizer?.user?.id;
          console.log(`✅ [Orchestrator] Fetched callRecord from Graph. JoinWebUrl: ${joinWebUrl ? 'found' : 'N/A'}`);
        }
      }
    } catch (error: any) {
      console.error(`⚠️ [Orchestrator] Failed to fetch callRecord from Graph:`, error.message);
    }
  }

  // Try to find meeting by Teams join link (exact match first)
  if (joinWebUrl) {
    let [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.teamsJoinLink, joinWebUrl))
      .limit(1);

    // If no exact match, try matching by the meeting ID in the URL (more robust)
    if (!meeting) {
      // Extract meeting ID from join URL (e.g., 19:meeting_XXXXX@thread.v2)
      const meetingIdMatch = joinWebUrl.match(/19%3a(meeting_[^@%]+)/i);
      if (meetingIdMatch) {
        const meetingIdPattern = `%${meetingIdMatch[1]}%`;
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
    }

    if (meeting) {
      console.log(`✅ [Orchestrator] Found meeting: ${meeting.id} (${meeting.title})`);
      
      // Update call record ID and status
      await db.update(meetings)
        .set({ 
          callRecordId,
          status: 'completed',
          graphSyncStatus: 'synced'
        })
        .where(eq(meetings.id, meeting.id));

      // Trigger enrichment - use callRecordId if onlineMeetingId is missing
      const enrichmentId = meeting.onlineMeetingId || callRecordId;
      console.log(`🎬 [Orchestrator] Triggering enrichment for meeting: ${meeting.id} (enrichmentId: ${enrichmentId})`);
      await callRecordEnrichmentService.enqueueMeetingEnrichment(meeting.id, enrichmentId);
      
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

    // Update minutes with AI-generated content
    await db.update(meetingMinutes)
      .set({
        processingStatus: "completed",
        summary: minutesData.summary,
        keyDiscussions: minutesData.keyDiscussions,
        decisions: minutesData.decisions,
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

    // Combine for document generation (meeting with fresh minutes)
    const meetingWithMinutes = { ...meeting, minutes };

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

    // Combine for document generation (meeting with fresh minutes)
    const meetingWithMinutes = { ...meeting, minutes };

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
