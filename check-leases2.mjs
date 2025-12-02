import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function check() {
  try {
    const leases = await sql`SELECT *, NOW() as current_time, lease_expires_at > NOW() as is_valid FROM job_worker_leases`;
    console.log('Current leases:', JSON.stringify(leases, null, 2));
    await sql.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

check();
