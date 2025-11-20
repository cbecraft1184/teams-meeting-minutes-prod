/**
 * Database Cleanup Service
 * 
 * Handles TTL-based cleanup of expired data for GDPR compliance and storage optimization
 * Runs periodically to purge:
 * - Expired conversation references (90 days)
 * - Expired user group cache entries (15 minutes)
 * - Orphaned job queue entries (30 days)
 */

import { db } from '../db';
import { teamsConversationReferences, userGroupCache, jobQueue } from '@shared/schema';
import { lt, and, eq } from 'drizzle-orm';

/**
 * Clean up expired Teams conversation references
 * Removes conversation refs older than 90 days (TTL)
 * CRITICAL: Prevents unbounded growth of bot conversation storage
 */
export async function cleanupExpiredConversationReferences(): Promise<number> {
  try {
    const now = new Date();
    
    const result = await db
      .delete(teamsConversationReferences)
      .where(lt(teamsConversationReferences.expiresAt, now))
      .returning({ id: teamsConversationReferences.id });
    
    const deletedCount = result.length;
    
    if (deletedCount > 0) {
      console.log(`[Cleanup] Purged ${deletedCount} expired conversation references`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Failed to clean expired conversation references:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

/**
 * Clean up expired user group cache entries
 * Removes cache entries older than expiresAt timestamp
 */
export async function cleanupExpiredUserGroupCache(): Promise<number> {
  try {
    const now = new Date();
    
    const result = await db
      .delete(userGroupCache)
      .where(lt(userGroupCache.expiresAt, now))
      .returning({ id: userGroupCache.azureAdId });
    
    const deletedCount = result.length;
    
    if (deletedCount > 0) {
      console.log(`[Cleanup] Purged ${deletedCount} expired user group cache entries`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Failed to clean expired user group cache:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

/**
 * Clean up old completed/failed jobs from queue
 * Removes jobs completed or failed more than 30 days ago
 */
export async function cleanupOldJobs(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db
      .delete(jobQueue)
      .where(
        and(
          lt(jobQueue.updatedAt, thirtyDaysAgo),
          // Only delete completed or permanently failed jobs
          eq(jobQueue.status, 'completed')
        )
      )
      .returning({ id: jobQueue.id });
    
    const deletedCount = result.length;
    
    if (deletedCount > 0) {
      console.log(`[Cleanup] Purged ${deletedCount} old completed jobs`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Failed to clean old jobs:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

/**
 * Run all cleanup tasks
 * Call this periodically (e.g., daily cron job)
 */
export async function runAllCleanupTasks(): Promise<void> {
  console.log('[Cleanup] Starting database cleanup tasks...');
  
  const [conversationRefsDeleted, userGroupCacheDeleted, jobsDeleted] = await Promise.all([
    cleanupExpiredConversationReferences(),
    cleanupExpiredUserGroupCache(),
    cleanupOldJobs(),
  ]);
  
  const totalDeleted = conversationRefsDeleted + userGroupCacheDeleted + jobsDeleted;
  
  console.log(`[Cleanup] Completed. Total records purged: ${totalDeleted}`);
}

// Scheduler state for graceful shutdown
let cleanupSchedulerHandle: NodeJS.Timeout | null = null;

/**
 * Calculate milliseconds until next 2 AM
 */
function millisecondsUntil2AM(): number {
  const now = new Date();
  const next2AM = new Date();
  
  // Set to 2 AM today
  next2AM.setHours(2, 0, 0, 0);
  
  // If 2 AM already passed today, schedule for tomorrow
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  return next2AM.getTime() - now.getTime();
}

/**
 * Schedule next cleanup at 2 AM
 */
function scheduleNext2AMCleanup(): void {
  const msUntil2AM = millisecondsUntil2AM();
  const hoursUntil = (msUntil2AM / (1000 * 60 * 60)).toFixed(1);
  
  console.log(`[Cleanup] Next cleanup scheduled in ${hoursUntil} hours (at 2:00 AM)`);
  
  cleanupSchedulerHandle = setTimeout(() => {
    runAllCleanupTasks()
      .catch(error => {
        console.error('[Cleanup] Scheduled cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
      })
      .finally(() => {
        // Schedule next cleanup for tomorrow at 2 AM
        scheduleNext2AMCleanup();
      });
  }, msUntil2AM);
}

/**
 * Initialize cleanup scheduler
 * Schedules cleanup tasks to run daily at 2:00 AM
 */
export function initializeCleanupScheduler(): void {
  // Run immediately on startup (don't wait for 2 AM)
  runAllCleanupTasks().catch(error => {
    console.error('[Cleanup] Startup cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
  });
  
  // Schedule first 2 AM cleanup
  scheduleNext2AMCleanup();
  
  console.log('[Cleanup] Scheduler initialized');
}

/**
 * Stop cleanup scheduler (called during graceful shutdown)
 */
export function stopCleanupScheduler(): void {
  if (cleanupSchedulerHandle) {
    clearTimeout(cleanupSchedulerHandle);
    cleanupSchedulerHandle = null;
    console.log('[Cleanup] Scheduler stopped');
  }
}
