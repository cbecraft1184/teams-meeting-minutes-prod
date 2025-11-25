/**
 * Database Migration Runner
 * Runs Drizzle schema push at container startup to ensure tables exist
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runMigrations(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('[Migrations] DATABASE_URL not set, skipping migrations');
    return false;
  }

  try {
    console.log('[Migrations] Running database schema sync...');
    
    // Use drizzle-kit push to sync schema without migration files
    // This is safe because we're using the same schema as development
    const { stdout, stderr } = await execAsync('npx drizzle-kit push --force', {
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
    
    if (stdout) console.log('[Migrations]', stdout);
    if (stderr && !stderr.includes('No schema changes')) {
      console.error('[Migrations]', stderr);
    }
    
    console.log('[Migrations] ✅ Database schema synchronized');
    return true;
  } catch (error) {
    console.error('[Migrations] ❌ Failed to run migrations:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Migrations] Application will continue but database operations may fail');
    return false;
  }
}
