import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function check() {
  const leases = await sql`SELECT *, NOW() as now FROM job_worker_leases`;
  console.log(JSON.stringify(leases, null, 2));
  await sql.end();
}

check();
