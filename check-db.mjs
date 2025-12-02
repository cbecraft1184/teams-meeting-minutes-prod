import postgres from 'postgres';

// Check what DATABASE_URL the dev environment is using
console.log('Checking development DATABASE_URL...');

// Get the Replit database URL
const devDB = process.env.DATABASE_URL;
console.log('Dev DATABASE_URL prefix:', devDB?.substring(0, 50) || 'NOT SET');

// Also check the production database for subscriptions
const prodDB = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(prodDB, { ssl: 'require' });

console.log('\nAzure Production Database Subscriptions:');
const subs = await sql`SELECT subscription_id, resource, status FROM graph_webhook_subscriptions`;
console.log(subs);
await sql.end();
