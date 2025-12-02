import { db } from "../db";
import { meetings, meetingMinutes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { enqueueJob, completeJob, failJob } from "./durableQueue";
import type { Job } from "@shared/schema";
import { teamsProactiveMessaging } from "./teamsProactiveMessaging";
import { callRecordEnrichmentService } from "./callRecordEnrichment";

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

  // Extract join URL and organizer from resource data
  const joinWebUrl = resourceData?.joinWebUrl;
  const organizer = resourceData?.organizer?.user?.id;

  // Try to find meeting by Teams join link
  if (joinWebUrl) {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.teamsJoinLink, joinWebUrl))
      .limit(1);

    if (meeting) {
      console.log(`✅ [Orchestrator] Found meeting by join URL: ${meeting.id} (${meeting.title})`);
      
      // Update call record ID and status
      await db.update(meetings)
        .set({ 
          callRecordId,
          status: 'completed',
          graphSyncStatus: 'synced'
        })
        .where(eq(meetings.id, meeting.id));

      // Trigger enrichment if we have the online meeting ID
      if (meeting.onlineMeetingId) {
        console.log(`🎬 [Orchestrator] Triggering enrichment for meeting: ${meeting.id}`);
        await callRecordEnrichmentService.enqueueMeetingEnrichment(meeting.id, meeting.onlineMeetingId);
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
 */
async function processEnrichmentJob(job: Job): Promise<void> {
  const { meetingId } = job.payload;
  if (!meetingId) throw new Error("meetingId required");

  // Update meeting status to enriching
  await db.update(meetings)
    .set({
      enrichmentStatus: "enriching",
      enrichmentAttempts: job.attemptCount,
      lastEnrichmentAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  try {
    // TODO: Call enrichment service to fetch meeting data from Graph API
    // const enrichedData = await enrichmentService.enrichMeeting(meetingId);

    // For now, mark as enriched (placeholder)
    await db.update(meetings)
      .set({
        enrichmentStatus: "enriched",
        graphSyncStatus: "enriched",
      })
      .where(eq(meetings.id, meetingId));

    // Enqueue next step: AI minutes generation
    await enqueueJob({
      jobType: "generate_minutes",
      idempotencyKey: `generate_minutes:${meetingId}`,
      payload: { meetingId },
    });

    console.log(`[Orchestrator] Enrichment complete for meeting: ${meetingId}`);
  } catch (error: any) {
    // Rollback: Mark enrichment as failed
    await db.update(meetings)
      .set({
        enrichmentStatus: "failed",
      })
      .where(eq(meetings.id, meetingId));

    throw error;
  }
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
    // TODO: Call AI service to generate minutes
    // const generatedMinutes = await aiService.generateMinutes(meetingId);

    // For now, use placeholder data
    await db.update(meetingMinutes)
      .set({
        processingStatus: "completed",
        summary: "Meeting summary generated by AI (placeholder)",
        keyDiscussions: ["Discussion point 1", "Discussion point 2"],
        decisions: ["Decision 1", "Decision 2"],
      })
      .where(eq(meetingMinutes.id, minutes.id));

    console.log(`[Orchestrator] Minutes generation complete for meeting: ${meetingId}`);

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
