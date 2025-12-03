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
    await sql`
      CREATE TABLE IF NOT EXISTS job_worker_leases (
        worker_name varchar(100) PRIMARY KEY,
        instance_id varchar(100) NOT NULL,
        acquired_at timestamptz NOT NULL DEFAULT now(),
        last_heartbeat timestamptz NOT NULL DEFAULT now(),
        lease_expires_at timestamptz NOT NULL
      )
    `;
    console.log('✅ job_worker_leases table created successfully');
    
    const result = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'job_worker_leases'`;
    console.log('✅ Verified:', result);
    
    await sql.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

migrate();
