/**
 * Background Jobs Service
 * 
 * Manages periodic background tasks:
 * - Webhook subscription renewal
 * - Azure AD group synchronization
 * - Meeting enrichment from callRecords
 */

import { graphSubscriptionManager } from './graphSubscriptionManager';
import { getConfig } from './configValidator';

// Job intervals (in milliseconds)
const INTERVALS = {
  WEBHOOK_RENEWAL: 60 * 60 * 1000, // 1 hour
  AD_GROUP_SYNC: 15 * 60 * 1000,   // 15 minutes (for future use)
  CALL_RECORD_ENRICHMENT: 30 * 60 * 1000, // 30 minutes (for future use)
};

// Track running intervals for cleanup
const runningIntervals: NodeJS.Timeout[] = [];

/**
 * Start all background jobs
 */
export function startBackgroundJobs(): void {
  const config = getConfig();
  
  console.log('🔄 Starting background jobs...');
  
  // Job 1: Webhook subscription renewal
  startWebhookRenewalJob();
  
  // Job 2: Azure AD group sync (future - Task 4)
  // startADGroupSyncJob();
  
  // Job 3: CallRecord enrichment (future - Task 3.6)
  // startCallRecordEnrichmentJob();
  
  console.log('✅ Background jobs started');
}

/**
 * Stop all background jobs (for graceful shutdown)
 */
export function stopBackgroundJobs(): void {
  console.log('🛑 Stopping background jobs...');
  
  for (const interval of runningIntervals) {
    clearInterval(interval);
  }
  
  runningIntervals.length = 0;
  console.log('✅ Background jobs stopped');
}

/**
 * Job: Renew expiring webhook subscriptions
 * Runs every hour, renews subscriptions expiring within 12 hours
 */
function startWebhookRenewalJob(): void {
  const config = getConfig();
  
  // Run immediately on startup
  renewWebhookSubscriptions();
  
  // Then run every hour
  const interval = setInterval(async () => {
    await renewWebhookSubscriptions();
  }, INTERVALS.WEBHOOK_RENEWAL);
  
  runningIntervals.push(interval);
  
  console.log(`✅ Webhook renewal job scheduled (every ${INTERVALS.WEBHOOK_RENEWAL / 1000 / 60} minutes)`);
}

/**
 * Renew expiring webhook subscriptions
 */
async function renewWebhookSubscriptions(): Promise<void> {
  try {
    console.log('🔄 [Background Job] Checking webhook subscriptions for renewal...');
    await graphSubscriptionManager.renewAllExpiringSubscriptions();
    console.log('✅ [Background Job] Webhook renewal check complete');
  } catch (error) {
    console.error('❌ [Background Job] Error renewing webhooks:', error);
  }
}

/**
 * Job: Sync Azure AD group memberships (future implementation - Task 4)
 * Runs every 15 minutes, syncs user group memberships from Azure AD
 */
function startADGroupSyncJob(): void {
  console.log('⚠️  Azure AD group sync job not yet implemented (Task 4)');
  // Will be implemented in Task 4
}

/**
 * Job: Enrich meetings with callRecord data (future implementation - Task 3.6)
 * Runs every 30 minutes, fetches callRecord data for completed meetings
 */
function startCallRecordEnrichmentJob(): void {
  console.log('⚠️  CallRecord enrichment job not yet implemented (Task 3.6)');
  // Will be implemented in Task 3.6
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping background jobs...');
  stopBackgroundJobs();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping background jobs...');
  stopBackgroundJobs();
});
