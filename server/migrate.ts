/**
 * Database Migration Runner
 * Uses Drizzle's in-process migrator with SQL migrations
 * Automatically syncs schema on container startup
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('[Migrations] ❌ DATABASE_URL not set');
    throw new Error('DATABASE_URL required for production startup');
  }

  // Create a dedicated connection for migrations
  const migrationConnection = postgres(databaseUrl, { max: 1 });
  
  try {
    console.log('[Migrations] 🔄 Running database migrations...');
    
    // Create Drizzle instance for migrations
    const migrationDb = drizzle(migrationConnection);
    
    // Run migrations from ./migrations folder
    await migrate(migrationDb, { migrationsFolder: './migrations' });
    
    console.log('[Migrations] ✅ Database schema synchronized successfully');
    
    return true;
  } catch (error) {
    console.error('[Migrations] ❌ Migration failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Database migration failed - container startup blocked');
  } finally {
    // Always close the migration connection
    await migrationConnection.end();
  }
}
