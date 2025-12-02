/**
 * Microsoft Graph Subscription Manager
 * 
 * Manages webhook subscriptions for Microsoft Graph API notifications
 * Handles subscription creation, renewal, deletion, and lifecycle management
 */

import { db } from '../db';
import { graphWebhookSubscriptions } from '@shared/schema';
import { eq, lt, and } from 'drizzle-orm';
import { acquireTokenByClientCredentials, getGraphClient } from './microsoftIdentity';
import { getConfig } from './configValidator';
import crypto from 'crypto';

/**
 * Subscription Configuration
 * 
 * ARCHITECTURE (per architect recommendation):
 * - Use ONLY callRecords webhook for meeting completion detection
 * - Meeting scheduling is handled via calendar delta sync (graphCalendarSync)
 * - This reduces Graph API load, avoids quota issues, and eliminates duplicate notifications
 */
const SUBSCRIPTION_CONFIG = {
  resource: '/communications/callRecords',
  changeTypes: ['created'],
  expirationHours: 48, // Max 4230 minutes (~70 hours) for callRecords
  renewalBufferHours: 12,
};

export class GraphSubscriptionManager {
  /**
   * Create a new webhook subscription
   * @param notificationUrl - Public HTTPS URL for webhook callbacks
   * @returns Subscription ID or null if failed
   */
  async createSubscription(notificationUrl: string): Promise<string | null> {
    const config = getConfig();
    
    // Use mock mode if Graph API not configured
    if (config.useMockServices || !config.graph.clientId) {
      console.warn('Graph API not configured - subscription creation skipped (mock mode)');
      return this.createMockSubscription(notificationUrl);
    }

    try {
      // Get application access token (client credentials flow)
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('Failed to acquire access token for subscription creation');
        return null;
      }

      // Generate secure client state for validation
      const clientState = this.generateClientState();
      
      // Calculate expiration (48 hours from now)
      const expirationDateTime = new Date();
      expirationDateTime.setHours(expirationDateTime.getHours() + SUBSCRIPTION_CONFIG.expirationHours);

      // Create subscription via Graph API
      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('Failed to create Graph client');
        return null;
      }
      
      // Build subscription payload
      // Note: For callRecords, we use basic notifications (no encrypted resource data)
      // This avoids the need for encryption certificates while still getting call completion events
      const subscriptionPayload = {
        changeType: SUBSCRIPTION_CONFIG.changeTypes.join(','),
        notificationUrl,
        resource: SUBSCRIPTION_CONFIG.resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState,
      };
      
      console.log('🔔 [Webhook] Creating subscription with payload:', JSON.stringify(subscriptionPayload, null, 2));
      
      let subscription;
      try {
        subscription = await graphClient.post('/subscriptions', subscriptionPayload);
      } catch (postError: any) {
        // Extract detailed error from Graph API
        const errorBody = postError?.body || postError?.message || postError;
        console.error('🔔 [Webhook] Graph API error details:', JSON.stringify(errorBody, null, 2));
        throw postError;
      }

      // Store subscription in database
      const [dbSubscription] = await db
        .insert(graphWebhookSubscriptions)
        .values({
          subscriptionId: subscription.id,
          resource: SUBSCRIPTION_CONFIG.resource,
          changeType: SUBSCRIPTION_CONFIG.changeTypes.join(','),
          notificationUrl,
          clientState,
          expirationDateTime,
          status: 'active',
          tenantId: config.graph.tenantId,
        })
        .returning();

      console.log(`✅ Created Graph subscription: ${subscription.id}`);
      console.log(`   Resource: ${SUBSCRIPTION_CONFIG.resource}`);
      console.log(`   Expires: ${expirationDateTime.toISOString()}`);

      return dbSubscription.subscriptionId;
    } catch (error) {
      console.error('Error creating Graph subscription:', error);
      return null;
    }
  }

  /**
   * Renew an existing subscription
   * @param subscriptionId - Graph API subscription ID
   * @returns Success boolean
   */
  async renewSubscription(subscriptionId: string): Promise<boolean> {
    const config = getConfig();

    // Mock mode renewal
    if (config.useMockServices || !config.graph.clientId) {
      return this.renewMockSubscription(subscriptionId);
    }

    try {
      // Get application access token
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('Failed to acquire access token for subscription renewal');
        return false;
      }

      // Calculate new expiration (48 hours from now)
      const expirationDateTime = new Date();
      expirationDateTime.setHours(expirationDateTime.getHours() + SUBSCRIPTION_CONFIG.expirationHours);

      // Renew subscription via Graph API
      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('Failed to create Graph client');
        return false;
      }
      
      await graphClient.patch(`/subscriptions/${subscriptionId}`, {
        expirationDateTime: expirationDateTime.toISOString(),
      });

      // Update database
      await db
        .update(graphWebhookSubscriptions)
        .set({
          expirationDateTime,
          lastRenewedAt: new Date(),
          status: 'active',
          lastFailureReason: null,
          failureCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));

      console.log(`✅ Renewed subscription: ${subscriptionId}`);
      console.log(`   New expiration: ${expirationDateTime.toISOString()}`);

      return true;
    } catch (error) {
      console.error(`Error renewing subscription ${subscriptionId}:`, error);
      
      // Update failure count in database
      const currentSubscription = await this.getSubscription(subscriptionId);
      const currentCount = currentSubscription?.failureCount || 0;
      
      await db
        .update(graphWebhookSubscriptions)
        .set({
          status: 'failed',
          lastFailureReason: error instanceof Error ? error.message : 'Unknown error',
          failureCount: currentCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));

      return false;
    }
  }

  /**
   * Delete a subscription
   * @param subscriptionId - Graph API subscription ID
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const config = getConfig();

    // Mock mode deletion
    if (config.useMockServices || !config.graph.clientId) {
      await db
        .delete(graphWebhookSubscriptions)
        .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));
      console.log(`🗑️  Deleted mock subscription: ${subscriptionId}`);
      return true;
    }

    try {
      // Get application access token
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('Failed to acquire access token for subscription deletion');
        return false;
      }

      // Delete subscription via Graph API
      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('Failed to create Graph client');
        return false;
      }
      
      await graphClient.delete(`/subscriptions/${subscriptionId}`);

      // Remove from database
      await db
        .delete(graphWebhookSubscriptions)
        .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));

      console.log(`🗑️  Deleted subscription: ${subscriptionId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting subscription ${subscriptionId}:`, error);
      return false;
    }
  }

  /**
   * Get subscription from database
   */
  async getSubscription(subscriptionId: string) {
    const [subscription] = await db
      .select()
      .from(graphWebhookSubscriptions)
      .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId))
      .limit(1);
    return subscription;
  }

  /**
   * Get all subscriptions needing renewal (expiring within buffer hours)
   */
  async getSubscriptionsNeedingRenewal(): Promise<typeof graphWebhookSubscriptions.$inferSelect[]> {
    const renewalThreshold = new Date();
    renewalThreshold.setHours(renewalThreshold.getHours() + SUBSCRIPTION_CONFIG.renewalBufferHours);

    return db
      .select()
      .from(graphWebhookSubscriptions)
      .where(
        and(
          lt(graphWebhookSubscriptions.expirationDateTime, renewalThreshold),
          eq(graphWebhookSubscriptions.status, 'active')
        )
      );
  }

  /**
   * Renew all subscriptions that are expiring soon
   */
  async renewAllExpiringSubscriptions(): Promise<void> {
    const subscriptions = await this.getSubscriptionsNeedingRenewal();
    
    if (subscriptions.length === 0) {
      console.log('✅ No subscriptions need renewal');
      return;
    }

    console.log(`🔄 Renewing ${subscriptions.length} expiring subscription(s)...`);

    for (const subscription of subscriptions) {
      const success = await this.renewSubscription(subscription.subscriptionId);
      
      // If renewal fails after 3 attempts, try to recreate
      if (!success && (subscription.failureCount || 0) >= 3) {
        console.warn(`⚠️  Subscription ${subscription.subscriptionId} failed 3 times, attempting recreate...`);
        await this.deleteSubscription(subscription.subscriptionId);
        await this.createSubscription(subscription.notificationUrl);
      }
    }
  }

  /**
   * Generate secure random client state for validation
   */
  private generateClientState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate client state from notification
   */
  validateClientState(subscriptionId: string, receivedClientState: string): boolean {
    // This will be implemented in the webhook endpoint
    // For now, just return true in mock mode
    return true;
  }

  /**
   * Mock subscription creation for development
   */
  private async createMockSubscription(notificationUrl: string): Promise<string> {
    const clientState = this.generateClientState();
    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + SUBSCRIPTION_CONFIG.expirationHours);

    const [subscription] = await db
      .insert(graphWebhookSubscriptions)
      .values({
        subscriptionId: `mock-${crypto.randomUUID()}`,
        resource: SUBSCRIPTION_CONFIG.resource,
        changeType: SUBSCRIPTION_CONFIG.changeTypes.join(','),
        notificationUrl,
        clientState,
        expirationDateTime,
        status: 'active',
        tenantId: 'mock-tenant',
      })
      .returning();

    console.log(`✅ Created MOCK subscription: ${subscription.subscriptionId} (dev mode)`);
    return subscription.subscriptionId;
  }

  /**
   * Mock subscription renewal for development
   */
  private async renewMockSubscription(subscriptionId: string): Promise<boolean> {
    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + SUBSCRIPTION_CONFIG.expirationHours);

    await db
      .update(graphWebhookSubscriptions)
      .set({
        expirationDateTime,
        lastRenewedAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));

    console.log(`✅ Renewed MOCK subscription: ${subscriptionId} (dev mode)`);
    return true;
  }

  /**
   * Initialize webhook subscriptions on app startup
   * Creates subscriptions for both call records (meeting end) and online meetings (meeting scheduled)
   * 
   * CRITICAL STARTUP HEALTH CHECK:
   * 1. Detects EXPIRED subscriptions and recreates them
   * 2. Renews subscriptions expiring soon
   * 3. Creates missing subscriptions
   * 
   * IMPORTANT: Delays initialization to ensure app is fully warmed up
   * Graph API validation requests can fail if app isn't ready to respond
   */
  async initializeSubscription(baseUrl: string): Promise<void> {
    const WARMUP_DELAY_MS = 30000; // 30 seconds
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 15000; // 15 seconds between retries
    
    console.log(`🔔 [Webhook] Waiting ${WARMUP_DELAY_MS/1000}s for app warmup before subscription creation...`);
    await new Promise(resolve => setTimeout(resolve, WARMUP_DELAY_MS));
    
    console.log('🔔 [Webhook] STARTUP HEALTH CHECK - Checking subscription status...');
    
    // Get ALL subscriptions (not just active) to detect expired ones
    const allSubscriptions = await db
      .select()
      .from(graphWebhookSubscriptions);
    
    const now = new Date();
    
    // Separate into categories
    const expiredSubscriptions = allSubscriptions.filter(s => s.expirationDateTime < now);
    const activeSubscriptions = allSubscriptions.filter(s => s.expirationDateTime >= now && s.status === 'active');
    
    console.log(`🔔 [Webhook] Found ${expiredSubscriptions.length} EXPIRED, ${activeSubscriptions.length} active subscriptions`);
    
    // CRITICAL: Delete expired subscriptions from DB (they're dead in Graph API too)
    if (expiredSubscriptions.length > 0) {
      console.log('⚠️ [Webhook] Cleaning up EXPIRED subscriptions...');
      for (const expired of expiredSubscriptions) {
        console.log(`   Removing expired ${expired.resource} subscription (expired: ${expired.expirationDateTime})`);
        await db.delete(graphWebhookSubscriptions).where(eq(graphWebhookSubscriptions.id, expired.id));
      }
    }
    
    // Check what's still valid
    const hasValidCallRecords = activeSubscriptions.some(s => s.resource === '/communications/callRecords');
    const hasValidOnlineMeetings = activeSubscriptions.some(s => s.resource === '/communications/onlineMeetings');
    
    console.log(`🔔 [Webhook] Valid subscriptions - callRecords: ${hasValidCallRecords}, onlineMeetings: ${hasValidOnlineMeetings}`);
    
    // Renew any subscriptions expiring soon
    if (activeSubscriptions.length > 0) {
      await this.renewAllExpiringSubscriptions();
    }
    
    // Create call records subscription if missing or expired (meeting end detection)
    if (!hasValidCallRecords) {
      console.log('🔔 [Webhook] Creating callRecords subscription (meeting end detection)...');
      await this.createSubscriptionWithRetry(
        `${baseUrl}/webhooks/graph/callRecords`,
        SUBSCRIPTION_CONFIGS.callRecords,
        MAX_RETRIES,
        RETRY_DELAY_MS
      );
    }
    
    // Create online meetings subscription if missing or expired (meeting scheduled detection)
    if (!hasValidOnlineMeetings) {
      console.log('🔔 [Webhook] Creating onlineMeetings subscription (meeting scheduled detection)...');
      await this.createSubscriptionWithRetry(
        `${baseUrl}/webhooks/graph/teams/meetings`,
        SUBSCRIPTION_CONFIGS.onlineMeetings,
        MAX_RETRIES,
        RETRY_DELAY_MS
      );
    }
    
    console.log('📊 [Webhook] Subscription initialization complete');
  }

  /**
   * Create a subscription with retry logic for a specific resource type
   */
  private async createSubscriptionWithRetry(
    notificationUrl: string,
    subscriptionConfig: typeof SUBSCRIPTION_CONFIGS.callRecords,
    maxRetries: number,
    retryDelayMs: number
  ): Promise<string | null> {
    console.log(`🔔 [Webhook] Notification URL: ${notificationUrl}`);
    console.log(`🔔 [Webhook] Resource: ${subscriptionConfig.resource}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔔 [Webhook] Subscription creation attempt ${attempt}/${maxRetries}...`);
      
      const subscriptionId = await this.createSubscriptionForResource(notificationUrl, subscriptionConfig);
      
      if (subscriptionId) {
        console.log(`✅ [Webhook] Subscription created successfully: ${subscriptionId}`);
        return subscriptionId;
      }
      
      if (attempt < maxRetries) {
        console.log(`⚠️ [Webhook] Attempt ${attempt} failed, retrying in ${retryDelayMs/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
    
    console.error(`❌ [Webhook] Failed to create ${subscriptionConfig.resource} subscription after all retries`);
    return null;
  }

  /**
   * Create a subscription for a specific resource type
   */
  async createSubscriptionForResource(
    notificationUrl: string,
    subscriptionConfig: typeof SUBSCRIPTION_CONFIGS.callRecords
  ): Promise<string | null> {
    const config = getConfig();
    
    if (config.useMockServices || !config.graph.clientId) {
      console.warn('Graph API not configured - subscription creation skipped (mock mode)');
      return this.createMockSubscriptionForResource(notificationUrl, subscriptionConfig);
    }

    try {
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        console.error('Failed to acquire access token for subscription creation');
        return null;
      }

      const clientState = this.generateClientState();
      
      const expirationDateTime = new Date();
      expirationDateTime.setHours(expirationDateTime.getHours() + subscriptionConfig.expirationHours);

      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        console.error('Failed to create Graph client');
        return null;
      }
      
      const subscriptionPayload = {
        changeType: subscriptionConfig.changeTypes.join(','),
        notificationUrl,
        resource: subscriptionConfig.resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState,
      };
      
      console.log('🔔 [Webhook] Creating subscription with payload:', JSON.stringify(subscriptionPayload, null, 2));
      
      let subscription;
      try {
        subscription = await graphClient.post('/subscriptions', subscriptionPayload);
      } catch (postError: any) {
        const errorBody = postError?.body || postError?.message || postError;
        console.error('🔔 [Webhook] Graph API error details:', JSON.stringify(errorBody, null, 2));
        throw postError;
      }

      const [dbSubscription] = await db
        .insert(graphWebhookSubscriptions)
        .values({
          subscriptionId: subscription.id,
          resource: subscriptionConfig.resource,
          changeType: subscriptionConfig.changeTypes.join(','),
          notificationUrl,
          clientState,
          expirationDateTime,
          status: 'active',
          tenantId: config.graph.tenantId,
        })
        .returning();

      console.log(`✅ Created Graph subscription: ${subscription.id}`);
      console.log(`   Resource: ${subscriptionConfig.resource}`);
      console.log(`   Expires: ${expirationDateTime.toISOString()}`);

      return dbSubscription.subscriptionId;
    } catch (error) {
      console.error('Error creating Graph subscription:', error);
      return null;
    }
  }

  /**
   * Create mock subscription for a specific resource type (development)
   */
  private async createMockSubscriptionForResource(
    notificationUrl: string,
    subscriptionConfig: typeof SUBSCRIPTION_CONFIGS.callRecords
  ): Promise<string> {
    const config = getConfig();
    const mockId = `mock-${subscriptionConfig.resource.replace(/\//g, '-')}-${Date.now()}`;
    const clientState = this.generateClientState();
    
    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + subscriptionConfig.expirationHours);

    const [subscription] = await db
      .insert(graphWebhookSubscriptions)
      .values({
        subscriptionId: mockId,
        resource: subscriptionConfig.resource,
        changeType: subscriptionConfig.changeTypes.join(','),
        notificationUrl,
        clientState,
        expirationDateTime,
        status: 'active',
        tenantId: config.graph.tenantId || 'mock-tenant',
      })
      .returning();

    console.log(`✅ Created MOCK subscription for ${subscriptionConfig.resource}: ${mockId}`);
    return subscription.subscriptionId;
  }
}

// Export singleton instance
export const graphSubscriptionManager = new GraphSubscriptionManager();
