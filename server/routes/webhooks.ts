/**
 * Microsoft Graph Webhook Routes
 * 
 * Handles webhook callbacks from Microsoft Graph API for Teams meeting notifications
 * Implements Microsoft's webhook validation protocol
 * 
 * ARCHITECTURE: Uses PostgreSQL-backed durable queue for crash recovery.
 * All webhook notifications are immediately persisted to database before responding 202.
 */

import type { Request, Response, Router } from 'express';
import { graphSubscriptionManager } from '../services/graphSubscriptionManager';
import { callRecordEnrichmentService } from '../services/callRecordEnrichment';
import { enqueueJob } from '../services/durableQueue';
import { db } from '../db';
import { graphWebhookSubscriptions, meetings } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Register PUBLIC webhook routes
 * 
 * CRITICAL: These endpoints MUST be public - Microsoft Graph API calls them directly
 * They are registered OUTSIDE /api/* pattern to avoid user authentication middleware
 * Security is provided by clientState validation (shared secret with Microsoft)
 */
export function registerWebhookRoutes(router: Router): void {
  console.log('🔔 [Webhook Routes] Registering webhook routes...');
  
  // PUBLIC endpoints - NO authentication required (Microsoft Graph callbacks)
  // Using /webhooks/* instead of /api/webhooks/* to avoid auth middleware
  
  // Call Records webhook - triggers when meetings END (for transcript/recording fetch)
  router.post('/webhooks/graph/callRecords', handleCallRecordWebhook);
  router.get('/webhooks/graph/callRecords', handleValidationChallenge);
  
  console.log('🔔 [Webhook Routes] Registered: GET/POST /webhooks/graph/callRecords');
  
  // Online Meetings webhook - triggers for meeting schedule changes
  router.post('/webhooks/graph/teams/meetings', handleTeamsMeetingWebhook);
  router.get('/webhooks/graph/teams/meetings', handleValidationChallenge);
}

/**
 * Register AUTHENTICATED admin webhook routes
 * 
 * These are for subscription management (create/list/delete subscriptions)
 * Must be called AFTER authentication middleware in routes.ts
 * Only authenticated admin users can manage webhook subscriptions
 */
export function registerAdminWebhookRoutes(router: Router): void {
  // AUTHENTICATED endpoints for subscription management (admin only)
  router.post('/api/admin/webhooks/subscriptions', createSubscription);
  router.get('/api/admin/webhooks/subscriptions', listSubscriptions);
  router.delete('/api/admin/webhooks/subscriptions/:id', deleteSubscription);
  
  // Processing validation management (admin only)
  router.get('/api/admin/processing/skipped', listSkippedMeetings);
  router.post('/api/admin/meetings/:id/force-process', forceProcessMeetingEndpoint);
  router.get('/api/admin/meetings/:id/processing-status', getProcessingStatusEndpoint);
}

/**
 * Handle GET request for Microsoft Graph webhook validation
 * Microsoft sends a validation token that must be echoed back
 */
async function handleValidationChallenge(req: Request, res: Response): Promise<void> {
  const validationToken = req.query.validationToken as string;
  
  if (!validationToken) {
    res.status(400).send('Missing validationToken');
    return;
  }

  console.log('✅ Webhook validation challenge received');
  
  // Echo back the validation token as plain text
  res.type('text/plain').send(validationToken);
}

/**
 * Handle POST request with call record webhook notifications from Microsoft Graph
 * This is triggered when a Teams meeting ENDS and a call record is created
 * 
 * IMPORTANT: Microsoft Graph also sends validation requests as POST with validationToken
 * in query params. We must check for this FIRST before processing as notification.
 * 
 * ARCHITECTURE: Notifications are immediately persisted to the durable queue (PostgreSQL)
 * before responding 202. This ensures crash recovery - even if container restarts, the
 * job worker will process the notification from the database.
 */
async function handleCallRecordWebhook(req: Request, res: Response): Promise<void> {
  try {
    // CRITICAL: Check for validation token FIRST (Microsoft sends validation as POST!)
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      console.log('✅ Webhook validation challenge received (via POST)');
      console.log(`   Token: ${validationToken.substring(0, 50)}...`);
      res.type('text/plain').status(200).send(validationToken);
      return;
    }
    
    const { value: notifications } = req.body;

    if (!notifications || !Array.isArray(notifications)) {
      console.log('⚠️ [CallRecords] POST request without notifications or validationToken');
      console.log(`   Body: ${JSON.stringify(req.body).substring(0, 200)}`);
      res.status(202).send(); // Return 202 to avoid retries
      return;
    }

    console.log(`📞 [CallRecords] Received ${notifications.length} call record notification(s)`);

    // DURABLE QUEUE: Persist notifications to database BEFORE responding
    // This ensures we don't lose notifications on crash/restart
    let enqueuedCount = 0;
    for (const notification of notifications) {
      try {
        // Validate notification first
        const isValid = await validateNotification(notification);
        if (!isValid) {
          console.warn('⚠️ [CallRecords] Invalid notification, skipping');
          continue;
        }

        // Extract call record ID for idempotency key
        const callRecordId = notification.resource?.split('/').pop() || `unknown-${Date.now()}`;
        
        // Enqueue to durable queue with idempotency
        const jobId = await enqueueJob({
          jobType: 'process_call_record',
          idempotencyKey: `callrecord:${callRecordId}`,
          payload: {
            subscriptionId: notification.subscriptionId,
            changeType: notification.changeType,
            resource: notification.resource,
            resourceData: notification.resourceData,
            clientState: notification.clientState,
            tenantId: notification.tenantId,
            callRecordId,
          },
          maxRetries: 5, // More retries for webhook notifications
        });

        if (jobId) {
          enqueuedCount++;
          console.log(`✅ [CallRecords] Enqueued to durable queue: ${callRecordId} (job: ${jobId})`);
        } else {
          console.log(`ℹ️ [CallRecords] Already enqueued (duplicate): ${callRecordId}`);
        }
      } catch (error) {
        console.error('❌ [CallRecords] Error enqueueing notification:', error);
        // Continue processing other notifications
      }
    }

    console.log(`📞 [CallRecords] Enqueued ${enqueuedCount}/${notifications.length} notifications to durable queue`);

    // Respond 202 after database persistence (ensures durability)
    res.status(202).send();
  } catch (error) {
    console.error('❌ [CallRecords] Error handling webhook:', error);
    res.status(202).send(); // Still respond 202 to avoid retry storms
  }
}


/**
 * Handle POST request with webhook notifications from Microsoft Graph for Online Meetings
 * 
 * NOTE: This endpoint is kept for compatibility but is NOT actively used.
 * The architecture uses ONLY /communications/callRecords for meeting detection.
 * Meeting scheduling is detected via calendar delta sync instead.
 */
async function handleTeamsMeetingWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Handle validation challenge
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      console.log('✅ [OnlineMeetings] Webhook validation challenge received (via POST)');
      res.type('text/plain').status(200).send(validationToken);
      return;
    }

    // Log but don't process - this endpoint is deprecated
    const { value: notifications } = req.body;
    if (notifications?.length) {
      console.log(`📅 [OnlineMeetings] Received ${notifications.length} notification(s) - IGNORED (deprecated endpoint)`);
    }

    // Always respond 202 to avoid retries
    res.status(202).send();
  } catch (error) {
    console.error('[OnlineMeetings] Error handling webhook:', error);
    res.status(202).send();
  }
}

/**
 * Validate notification authenticity
 * Checks clientState matches our stored value
 */
async function validateNotification(notification: any): Promise<boolean> {
  try {
    const { subscriptionId, clientState } = notification;

    if (!subscriptionId || !clientState) {
      console.error('Missing subscriptionId or clientState');
      return false;
    }

    // Look up subscription in database
    const [subscription] = await db
      .select()
      .from(graphWebhookSubscriptions)
      .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId))
      .limit(1);

    if (!subscription) {
      console.error(`Unknown subscription: ${subscriptionId}`);
      return false;
    }

    // Validate clientState matches
    if (subscription.clientState !== clientState) {
      console.error(`Client state mismatch for subscription: ${subscriptionId}`);
      return false;
    }

    // Check subscription is active
    if (subscription.status !== 'active') {
      console.warn(`Subscription ${subscriptionId} is not active: ${subscription.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating notification:', error);
    return false;
  }
}


/**
 * Fetch meeting details from Graph API and upsert to database
 * Idempotent operation - safe to call multiple times
 */
async function upsertMeetingFromGraph(onlineMeetingId: string, resourceData: any): Promise<void> {
  try {
    const meetingData = {
      title: resourceData?.subject || 'Teams Meeting',
      description: resourceData?.subject || null,
      scheduledAt: resourceData?.startDateTime ? new Date(resourceData.startDateTime) : new Date(),
      duration: calculateDuration(resourceData?.startDateTime, resourceData?.endDateTime),
      attendees: extractAttendees(resourceData),
      status: determineStatus(resourceData) as "scheduled" | "in_progress" | "completed" | "archived",
      classificationLevel: 'UNCLASSIFIED' as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
      onlineMeetingId,
      organizerAadId: resourceData?.organizer?.emailAddress?.address || null,
      teamsJoinLink: resourceData?.joinUrl || null,
      graphSyncStatus: 'synced' as "synced" | "pending" | "enriched" | "failed" | "archived",
    };

    // Check if meeting already exists
    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.onlineMeetingId, onlineMeetingId))
      .limit(1);

    if (existingMeeting) {
      // Update existing meeting
      const updatedStatus = (existingMeeting.status === 'archived' ? 'archived' : meetingData.status) as "scheduled" | "in_progress" | "completed" | "archived";
      
      await db
        .update(meetings)
        .set({
          ...meetingData,
          status: updatedStatus,
        })
        .where(eq(meetings.onlineMeetingId, onlineMeetingId));
      
      console.log(`✅ Updated meeting: ${onlineMeetingId}`);
      
      // Trigger enrichment if meeting just completed
      if (updatedStatus === 'completed' && existingMeeting.status !== 'completed') {
        console.log(`🎬 [Enrichment Trigger] Meeting completed, enqueuing enrichment: ${onlineMeetingId}`);
        await callRecordEnrichmentService.enqueueMeetingEnrichment(existingMeeting.id, onlineMeetingId);
      }
    } else {
      // Insert new meeting
      const [newMeeting] = await db
        .insert(meetings)
        .values(meetingData)
        .returning({ id: meetings.id });
      
      console.log(`✅ Created meeting: ${onlineMeetingId}`);
      
      // Trigger enrichment if meeting is already completed
      if (meetingData.status === 'completed') {
        console.log(`🎬 [Enrichment Trigger] New meeting already completed, enqueuing enrichment: ${onlineMeetingId}`);
        await callRecordEnrichmentService.enqueueMeetingEnrichment(newMeeting.id, onlineMeetingId);
      }
    }
  } catch (error) {
    console.error(`Error upserting meeting ${onlineMeetingId}:`, error);
    throw error;
  }
}

/**
 * Handle meeting deletion notification
 */
async function handleMeetingDeletion(onlineMeetingId: string): Promise<void> {
  try {
    await db
      .update(meetings)
      .set({
        status: 'archived',
        graphSyncStatus: 'synced',
      })
      .where(eq(meetings.onlineMeetingId, onlineMeetingId));
    
    console.log(`✅ Archived deleted meeting: ${onlineMeetingId}`);
  } catch (error) {
    console.error(`Error archiving meeting ${onlineMeetingId}:`, error);
    throw error;
  }
}

/**
 * Helper: Calculate meeting duration from start/end times
 */
function calculateDuration(startDateTime?: string, endDateTime?: string): string {
  if (!startDateTime || !endDateTime) {
    return '1h';
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Helper: Extract attendee emails from resource data
 */
function extractAttendees(resourceData: any): string[] {
  if (!resourceData?.participants) {
    return [];
  }

  const attendees: string[] = [];
  
  if (resourceData.participants.organizer?.emailAddress?.address) {
    attendees.push(resourceData.participants.organizer.emailAddress.address);
  }

  if (Array.isArray(resourceData.participants.attendees)) {
    for (const attendee of resourceData.participants.attendees) {
      if (attendee.emailAddress?.address) {
        attendees.push(attendee.emailAddress.address);
      }
    }
  }

  return Array.from(new Set(attendees));
}

/**
 * Helper: Determine meeting status from resource data
 */
function determineStatus(resourceData: any): string {
  const now = new Date();
  const startDateTime = resourceData?.startDateTime ? new Date(resourceData.startDateTime) : null;
  const endDateTime = resourceData?.endDateTime ? new Date(resourceData.endDateTime) : null;

  if (!startDateTime) {
    return 'scheduled';
  }

  if (endDateTime && now > endDateTime) {
    return 'completed';
  } else if (now >= startDateTime && (!endDateTime || now < endDateTime)) {
    return 'in_progress';
  } else {
    return 'scheduled';
  }
}

// Admin endpoints for subscription management

async function createSubscription(req: Request, res: Response): Promise<void> {
  try {
    const { notificationUrl } = req.body;

    if (!notificationUrl) {
      res.status(400).json({ error: 'Missing notificationUrl' });
      return;
    }

    const subscriptionId = await graphSubscriptionManager.createSubscription(notificationUrl);

    if (!subscriptionId) {
      res.status(500).json({ error: 'Failed to create subscription' });
      return;
    }

    res.json({ subscriptionId, message: 'Subscription created successfully' });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listSubscriptions(req: Request, res: Response): Promise<void> {
  try {
    const subscriptions = await db
      .select()
      .from(graphWebhookSubscriptions);

    res.json({ subscriptions });
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteSubscription(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const success = await graphSubscriptionManager.deleteSubscription(id);

    if (!success) {
      res.status(500).json({ error: 'Failed to delete subscription' });
      return;
    }

    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Force process a meeting that was auto-skipped due to threshold validation
 * Requires admin role - records audit trail with override reason
 */
async function forceProcessMeetingEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Admin role required for manual processing override' });
      return;
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({ error: 'Override reason required (minimum 10 characters)' });
      return;
    }
    
    const adminUserId = user.azureAdId || user.id || user.email;
    
    console.log(`🔧 [Admin API] Force process request for meeting ${id} by ${adminUserId}`);
    
    const result = await callRecordEnrichmentService.forceProcessMeeting(
      id,
      adminUserId,
      reason.trim()
    );
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.message,
        meetingId: id,
        overrideBy: adminUserId,
        overrideReason: reason.trim()
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.message 
      });
    }
  } catch (error) {
    console.error('Error forcing meeting processing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * List meetings that were skipped during processing validation
 */
async function listSkippedMeetings(req: Request, res: Response): Promise<void> {
  try {
    const { PROCESSING_THRESHOLDS } = await import('../services/processingValidation');
    
    const skippedMeetings = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        status: meetings.status,
        enrichmentStatus: meetings.enrichmentStatus,
        actualDurationSeconds: meetings.actualDurationSeconds,
        transcriptWordCount: meetings.transcriptWordCount,
        processingDecision: meetings.processingDecision,
        processingDecisionReason: meetings.processingDecisionReason,
        processingDecisionAt: meetings.processingDecisionAt,
        organizerEmail: meetings.organizerEmail,
      })
      .from(meetings)
      .where(
        sql`${meetings.processingDecision} IN ('skipped_duration', 'skipped_content', 'skipped_no_transcript')`
      )
      .orderBy(sql`${meetings.processingDecisionAt} DESC NULLS LAST`)
      .limit(50);
    
    res.json({
      meetings: skippedMeetings.map(m => ({
        ...m,
        actualDurationMinutes: m.actualDurationSeconds 
          ? Math.floor(m.actualDurationSeconds / 60) 
          : null,
        canForceProcess: true,
      })),
      thresholds: {
        minDurationSeconds: PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS,
        minDurationMinutes: Math.floor(PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS / 60),
        minTranscriptWords: PROCESSING_THRESHOLDS.MIN_TRANSCRIPT_WORDS,
      },
      count: skippedMeetings.length,
    });
  } catch (error) {
    console.error('Error listing skipped meetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get processing status for a meeting
 */
async function getProcessingStatusEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    const [meeting] = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        status: meetings.status,
        enrichmentStatus: meetings.enrichmentStatus,
        actualDurationSeconds: meetings.actualDurationSeconds,
        transcriptWordCount: meetings.transcriptWordCount,
        processingDecision: meetings.processingDecision,
        processingDecisionReason: meetings.processingDecisionReason,
        processingDecisionAt: meetings.processingDecisionAt,
      })
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    
    const { PROCESSING_THRESHOLDS } = await import('../services/processingValidation');
    
    res.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        enrichmentStatus: meeting.enrichmentStatus,
      },
      processingValidation: {
        decision: meeting.processingDecision,
        reason: meeting.processingDecisionReason,
        decisionAt: meeting.processingDecisionAt,
        actualDurationSeconds: meeting.actualDurationSeconds,
        actualDurationMinutes: meeting.actualDurationSeconds 
          ? Math.floor(meeting.actualDurationSeconds / 60) 
          : null,
        transcriptWordCount: meeting.transcriptWordCount,
      },
      thresholds: {
        minDurationSeconds: PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS,
        minDurationMinutes: Math.floor(PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS / 60),
        minTranscriptWords: PROCESSING_THRESHOLDS.MIN_TRANSCRIPT_WORDS,
      },
      canForceProcess: meeting.processingDecision !== 'processed' && 
                       meeting.processingDecision !== 'manual_override',
    });
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
