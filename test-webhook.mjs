import postgres from 'postgres';
import { nanoid } from 'nanoid';

const REPLIT_URL = 'http://localhost:5000';
const DATABASE_URL = 'postgresql://adminuser:TeamsMinutes2025!Secure@teams-minutes-db.postgres.database.azure.com:5432/teams_minutes_db?sslmode=require';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function testWebhook() {
  // Get existing subscription
  console.log('1. Getting existing production subscription...');
  const subs = await sql`
    SELECT subscription_id, client_state 
    FROM graph_webhook_subscriptions 
    WHERE status = 'active' AND resource = '/communications/callRecords'
    LIMIT 1
  `;
  
  if (subs.length === 0) {
    console.log('   ❌ No active subscription found');
    await sql.end();
    return;
  }
  
  const testSubId = subs[0].subscription_id;
  const testClientState = subs[0].client_state;
  console.log(`   Subscription ID: ${testSubId}`);
  
  // Now test the webhook endpoint
  console.log('\n2. Sending test webhook notification...');
  const callRecordId = 'test-callrecord-' + nanoid(8);
  
  const response = await fetch(`${REPLIT_URL}/webhooks/graph/callRecords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: [{
        subscriptionId: testSubId,
        changeType: 'created',
        resource: `/communications/callRecords/${callRecordId}`,
        clientState: testClientState,
        tenantId: 'test-tenant',
        resourceData: {
          joinWebUrl: 'https://teams.microsoft.com/test',
          organizer: { user: { id: 'test-user-id' } }
        }
      }]
    })
  });
  
  console.log(`   Response Status: ${response.status}`);
  console.log(`   Expected: 202`);
  
  // Check if job was enqueued
  console.log('\n3. Checking if job was enqueued to durable queue...');
  const jobs = await sql`
    SELECT id, job_type, idempotency_key, status, created_at 
    FROM job_queue 
    WHERE idempotency_key LIKE 'callrecord:test-callrecord-%'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  if (jobs.length > 0) {
    console.log('   ✅ SUCCESS! Job found in durable queue:');
    console.log(`      ID: ${jobs[0].id}`);
    console.log(`      Type: ${jobs[0].job_type}`);
    console.log(`      Key: ${jobs[0].idempotency_key}`);
    console.log(`      Status: ${jobs[0].status}`);
  } else {
    console.log('   ❌ No job found in durable queue');
  }
  
  // Cleanup test jobs
  console.log('\n4. Cleaning up test data...');
  await sql`DELETE FROM job_queue WHERE idempotency_key LIKE 'callrecord:test-callrecord-%'`;
  console.log('   Done');
  
  await sql.end();
}

testWebhook().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
