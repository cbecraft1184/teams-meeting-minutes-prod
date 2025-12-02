import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function cleanup() {
  try {
    const leases = await sql`SELECT * FROM job_worker_leases`;
    console.log('Current leases:', leases);
    
    await sql`DELETE FROM job_worker_leases`;
    console.log('✅ All leases deleted');
    
    await sql.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

cleanup();
