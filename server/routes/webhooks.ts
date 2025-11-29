/**
 * Microsoft Graph Webhook Routes
 * 
 * Handles webhook callbacks from Microsoft Graph API for Teams meeting notifications
 * Implements Microsoft's webhook validation protocol
 */

import type { Request, Response, Router } from 'express';
import { graphSubscriptionManager } from '../services/graphSubscriptionManager';
import { callRecordEnrichmentService } from '../services/callRecordEnrichment';
import { db } from '../db';
import { graphWebhookSubscriptions, meetings } from '@shared/schema';
import { eq } from 'drizzle-orm';

// In-memory queue for webhook notifications (will be replaced with Redis/SQS in production)
interface WebhookNotification {
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData: any;
  clientState: string;
  tenantId?: string;
}

const notificationQueue: WebhookNotification[] = [];
let isProcessing = false;

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

    // Respond immediately with 202 Accepted (Microsoft requires fast response)
    res.status(202).send();

    // Process each notification asynchronously
    for (const notification of notifications) {
      try {
        await processCallRecordNotification(notification);
      } catch (error) {
        console.error('❌ [CallRecords] Error processing notification:', error);
      }
    }
  } catch (error) {
    console.error('❌ [CallRecords] Error handling webhook:', error);
    res.status(202).send(); // Still respond 202 to avoid retry storms
  }
}

/**
 * Process a single call record notification
 * Extracts meeting ID and triggers enrichment (transcript/recording fetch)
 */
async function processCallRecordNotification(notification: any): Promise<void> {
  const { subscriptionId, clientState, resource, resourceData } = notification;

  console.log(`📞 [CallRecords] Processing notification for resource: ${resource}`);

  // Validate client state
  const isValid = await validateNotification(notification);
  if (!isValid) {
    console.warn('⚠️ [CallRecords] Invalid notification, skipping');
    return;
  }

  // Extract call record ID from resource
  // Resource format: "/communications/callRecords/{callRecordId}"
  const callRecordId = resource?.split('/').pop();
  
  if (!callRecordId) {
    console.error('❌ [CallRecords] Could not extract callRecordId from resource:', resource);
    return;
  }

  console.log(`📞 [CallRecords] Call record ID: ${callRecordId}`);

  // Find meeting by matching join URL or organizer
  // Call records contain participants and join info we can use to match
  const joinWebUrl = resourceData?.joinWebUrl;
  const organizer = resourceData?.organizer?.user?.id;

  if (joinWebUrl) {
    // Try to find meeting by Teams join link
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.teamsJoinLink, joinWebUrl))
      .limit(1);

    if (meeting) {
      console.log(`✅ [CallRecords] Found meeting by join URL: ${meeting.id} (${meeting.title})`);
      
      // Update call record ID
      await db.update(meetings)
        .set({ 
          callRecordId,
          status: 'completed',
          graphSyncStatus: 'synced'
        })
        .where(eq(meetings.id, meeting.id));

      // Trigger enrichment
      if (meeting.onlineMeetingId) {
        console.log(`🎬 [CallRecords] Triggering enrichment for meeting: ${meeting.id}`);
        await callRecordEnrichmentService.enqueueMeetingEnrichment(meeting.id, meeting.onlineMeetingId);
      }
      return;
    }
  }

  // If no match found by join URL, try to match by time window and organizer
  console.log(`⚠️ [CallRecords] Could not match call record to a meeting. CallRecordId: ${callRecordId}`);
  console.log(`   Join URL: ${joinWebUrl || 'N/A'}`);
  console.log(`   Organizer: ${organizer || 'N/A'}`);
}

/**
 * Handle POST request with webhook notifications from Microsoft Graph
 */
async function handleTeamsMeetingWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { value: notifications } = req.body;

    if (!notifications || !Array.isArray(notifications)) {
      res.status(400).json({ error: 'Invalid notification payload' });
      return;
    }

    console.log(`📬 Received ${notifications.length} webhook notification(s)`);

    // Validate and queue each notification
    for (const notification of notifications) {
      const isValid = await validateNotification(notification);
      
      if (!isValid) {
        console.warn('⚠️  Invalid notification received:', notification.subscriptionId);
        continue;
      }

      // Add to processing queue
      notificationQueue.push({
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resource: notification.resource,
        resourceData: notification.resourceData,
        clientState: notification.clientState,
        tenantId: notification.tenantId,
      });

      console.log(`✅ Queued notification: ${notification.changeType} for ${notification.resource}`);
    }

    // Respond immediately with 202 Accepted
    res.status(202).send();

    // Start processing queue asynchronously (don't block response)
    processNotificationQueue();
  } catch (error) {
    console.error('Error handling webhook notification:', error);
    // Still respond 202 to avoid retry storms
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
 * Process queued notifications asynchronously
 * Implements retry logic and idempotent meeting upserts
 */
async function processNotificationQueue(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    while (notificationQueue.length > 0) {
      const notification = notificationQueue.shift();
      
      if (!notification) {
        continue;
      }

      try {
        await processNotification(notification);
      } catch (error) {
        console.error('Error processing notification:', error);
        
        // Re-queue failed notifications (max 3 retries)
        if (!notification.resourceData?._retryCount || notification.resourceData._retryCount < 3) {
          notification.resourceData = notification.resourceData || {};
          notification.resourceData._retryCount = (notification.resourceData._retryCount || 0) + 1;
          notificationQueue.push(notification);
          console.warn(`⚠️  Re-queued notification (retry ${notification.resourceData._retryCount}/3)`);
        } else {
          console.error('❌ Notification failed after 3 retries, dropping:', notification);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Process individual notification
 * Fetches full meeting details from Graph API and upserts to database
 */
async function processNotification(notification: WebhookNotification): Promise<void> {
  const { changeType, resource, resourceData } = notification;

  console.log(`🔄 Processing ${changeType} notification for ${resource}`);

  // Extract meeting ID from resource URL
  // Resource format: "/communications/onlineMeetings/{meetingId}"
  const meetingId = resource.split('/').pop();

  if (!meetingId) {
    console.error('Could not extract meeting ID from resource:', resource);
    return;
  }

  // Handle different change types
  switch (changeType) {
    case 'created':
    case 'updated':
      await upsertMeetingFromGraph(meetingId, resourceData);
      break;
    
    case 'deleted':
      await handleMeetingDeletion(meetingId);
      break;
    
    default:
      console.warn(`Unknown change type: ${changeType}`);
  }
}

/**
 * Fetch meeting details from Graph API and upsert to database
 * Idempotent operation - safe to call multiple times
 */
async function upsertMeetingFromGraph(onlineMeetingId: string, resourceData: any): Promise<void> {
  try {
    // In mock mode, use resourceData directly (no Graph API call)
    // In real mode, would fetch full meeting details from Graph API:
    // const graphClient = await getGraphClient(accessToken);
    // const meeting = await graphClient.api(`/communications/onlineMeetings/${onlineMeetingId}`).get();
    
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
    throw error; // Re-throw for retry logic
  }
}

/**
 * Handle meeting deletion notification
 */
async function handleMeetingDeletion(onlineMeetingId: string): Promise<void> {
  try {
    // Don't actually delete from database (preserve historical data)
    // Instead, mark as archived
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
    return '1h'; // Default
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
  
  // Extract organizer
  if (resourceData.participants.organizer?.emailAddress?.address) {
    attendees.push(resourceData.participants.organizer.emailAddress.address);
  }

  // Extract attendees
  if (Array.isArray(resourceData.participants.attendees)) {
    for (const attendee of resourceData.participants.attendees) {
      if (attendee.emailAddress?.address) {
        attendees.push(attendee.emailAddress.address);
      }
    }
  }

  return Array.from(new Set(attendees)); // Remove duplicates
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
