import postgres from 'postgres';

// SECURITY: Load DATABASE_URL from environment - never hardcode credentials
const DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL_PROD or DATABASE_URL environment variable is required');
  console.error('   Set it to your Azure PostgreSQL connection string');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function migrate() {
  try {
    console.log('🚀 Starting production database migrations...\n');

    // 1. job_worker_leases table
    await sql`
      CREATE TABLE IF NOT EXISTS job_worker_leases (
        worker_name varchar(100) PRIMARY KEY,
        instance_id varchar(100) NOT NULL,
        acquired_at timestamptz NOT NULL DEFAULT now(),
        last_heartbeat timestamptz NOT NULL DEFAULT now(),
        lease_expires_at timestamptz NOT NULL
      )
    `;
    console.log('✅ job_worker_leases table created/verified');

    // 2. dismissed_meetings table - CRITICAL for /api/meetings query
    await sql`
      CREATE TABLE IF NOT EXISTS dismissed_meetings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id text NOT NULL,
        meeting_id varchar NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_email text NOT NULL,
        dismissed_at timestamptz NOT NULL DEFAULT now(),
        restored_at timestamptz
      )
    `;
    console.log('✅ dismissed_meetings table created/verified');

    // 3. Create indexes for dismissed_meetings
    await sql`
      CREATE INDEX IF NOT EXISTS dismissed_meetings_user_idx 
      ON dismissed_meetings(tenant_id, user_email, restored_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS dismissed_meetings_meeting_idx 
      ON dismissed_meetings(meeting_id)
    `;
    console.log('✅ dismissed_meetings indexes created/verified');

    // Verify tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('job_worker_leases', 'dismissed_meetings')
      ORDER BY table_name
    `;
    console.log('\n📋 Verified tables:', tables.map(t => t.table_name).join(', '));

    await sql.end();
    console.log('\n✅ All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    await sql.end();
    process.exit(1);
  }
}

migrate();
