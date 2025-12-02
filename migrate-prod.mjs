import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';

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
