import postgres from 'postgres';

const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function check() {
  console.log('All subscriptions:');
  const subs = await sql`SELECT subscription_id, resource, status, created_at FROM graph_webhook_subscriptions ORDER BY created_at DESC`;
  console.log(subs);
  await sql.end();
}

check();
