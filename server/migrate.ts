/**
 * Database Schema Validator
 * 
 * IMPORTANT: This does NOT run migrations.
 * You must run `npm run db:push` against your Azure PostgreSQL database BEFORE deploying.
 * 
 * This validator ensures the database schema is present and healthy.
 * Prevents container startup if critical tables are missing.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export async function runMigrations(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('[Schema] ❌ DATABASE_URL not set');
    throw new Error('DATABASE_URL required for production startup');
  }

  try {
    console.log('[Schema] 🔍 Validating database schema...');
    
    // Check if all 12 critical tables exist
    const tableCheckQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    const result = await db.execute(tableCheckQuery);
    const existingTables = result.rows.map((r: any) => r.table_name);
    
    // All 12 tables required for production
    const requiredTables = [
      'meetings',
      'meeting_minutes',
      'action_items',
      'users',
      'meeting_templates',
      'graph_webhook_subscriptions',
      'user_group_cache',
      'teams_conversation_references',
      'sent_messages',
      'message_outbox',
      'job_queue',
      'app_settings'
    ];
    
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error('[Schema] ❌ Missing required tables:', missingTables.join(', '));
      console.error('[Schema] Run these commands to fix:');
      console.error('[Schema]   1. Set DATABASE_URL to your Azure PostgreSQL connection string');
      console.error('[Schema]   2. Run: npm run db:push');
      console.error('[Schema]   3. Redeploy the container');
      throw new Error(`Database schema incomplete - missing ${missingTables.length} tables: ${missingTables.join(', ')}`);
    }
    
    console.log('[Schema] ✅ All 12 required tables exist');
    console.log(`[Schema] Tables: ${existingTables.filter(t => requiredTables.includes(t)).join(', ')}`);
    
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database schema incomplete')) {
      throw error; // Re-throw validation errors
    }
    console.error('[Schema] ❌ Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Database connection required for production startup');
  }
}
