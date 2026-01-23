/**
 * Background Jobs Service
 * 
 * Manages periodic background tasks:
 * - Webhook subscription renewal
 * - Azure AD group synchronization
 * - Meeting enrichment from callRecords
 */

import { graphSubscriptionManager } from './graphSubscriptionManager';
import { callRecordEnrichmentService } from './callRecordEnrichment';
import { callRecordPollingService } from './callRecordPolling';
import { getConfig } from './configValidator';

const INTERVALS = {
  WEBHOOK_RENEWAL: 60 * 60 * 1000, // 1 hour
  AD_GROUP_SYNC: 15 * 60 * 1000,   // 15 minutes (for future use)
  CALL_RECORD_ENRICHMENT: 5 * 60 * 1000, // 5 minutes - faster catch-up
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
  
  // Job 2: CallRecord enrichment catch-up
  startCallRecordEnrichmentJob();
  
  // Job 3: Active call record polling (backup to webhooks)
  callRecordPollingService.startCallRecordPolling();
  
  console.log('✅ Background jobs started');
}

/**
 * Stop all background jobs (for graceful shutdown)
 */
export function stopBackgroundJobs(): void {
  console.log('🛑 Stopping background jobs...');
  
  // Clear all interval timers
  for (const interval of runningIntervals) {
    clearInterval(interval);
  }
  runningIntervals.length = 0;
  
  // Stop call record polling
  callRecordPollingService.stopCallRecordPolling();
  
  // Clear all enrichment retry timers
  callRecordEnrichmentService.clearAllRetryTimers();
  
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
 * Job: Enrich meetings with callRecord data
 * Runs every 30 minutes, catches stuck enrichments and retries them
 */
function startCallRecordEnrichmentJob(): void {
  // Run immediately on startup
  processStuckEnrichments();
  
  // Then run every 30 minutes
  const interval = setInterval(async () => {
    await processStuckEnrichments();
  }, INTERVALS.CALL_RECORD_ENRICHMENT);
  
  runningIntervals.push(interval);
  
  console.log(`✅ CallRecord enrichment job scheduled (every ${INTERVALS.CALL_RECORD_ENRICHMENT / 1000 / 60} minutes)`);
}

/**
 * Process stuck enrichments (catch-up job)
 */
async function processStuckEnrichments(): Promise<void> {
  try {
    await callRecordEnrichmentService.processStuckEnrichments();
  } catch (error) {
    console.error('❌ [Background Job] Error processing stuck enrichments:', error);
  }
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
