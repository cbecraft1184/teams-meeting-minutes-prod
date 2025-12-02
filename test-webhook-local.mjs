import postgres from 'postgres';
import { nanoid } from 'nanoid';

const REPLIT_URL = 'http://localhost:5000';
const sql = postgres(process.env.DATABASE_URL);

async function testWebhook() {
  const testSubId = 'test-' + nanoid(8);
  const testClientState = 'test-secret-' + nanoid(8);
  
  console.log('1. Creating test subscription in local Neon dev database...');
  try {
    await sql`
      INSERT INTO graph_webhook_subscriptions 
      (subscription_id, resource, change_type, notification_url, client_state, 
       expiration_date_time, status, tenant_id)
      VALUES 
      (${testSubId}, '/communications/callRecords', 'created', 'http://test', 
       ${testClientState}, NOW() + interval '1 day', 'active', 'test-tenant')
    `;
    console.log(`   Subscription ID: ${testSubId}`);
  } catch (error) {
    console.error('Error creating subscription:', error.message);
  }
  
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
    WHERE idempotency_key LIKE 'callrecord:%'
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
  
  // Cleanup test data
  console.log('\n4. Cleaning up test data...');
  await sql`DELETE FROM job_queue WHERE idempotency_key LIKE 'callrecord:test-%'`;
  await sql`DELETE FROM graph_webhook_subscriptions WHERE subscription_id = ${testSubId}`;
  console.log('   Done');
  
  await sql.end();
}

testWebhook().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
