import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function check() {
  console.log('Webhook subscriptions:');
  const subs = await sql`SELECT id, resource, expiration_date_time, created_at FROM graph_webhook_subscriptions ORDER BY created_at DESC LIMIT 3`;
  console.log(subs);
  
  console.log('\nJob worker leases:');
  const leases = await sql`SELECT *, NOW() as current_time FROM job_worker_leases`;
  console.log(leases);
  
  await sql.end();
}

check();
