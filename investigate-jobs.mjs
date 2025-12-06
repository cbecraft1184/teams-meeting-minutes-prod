import postgres from 'postgres';
const token = process.env.PG_TOKEN;
const sql = postgres({
  host: 'teams-minutes-db.postgres.database.azure.com',
  port: 5432,
  database: 'teams_minutes_db',
  username: 'teams-minutes-sp',
  password: token,
  ssl: 'require',
});

async function investigate() {
  console.log('=== INVESTIGATING STUCK JOBS ===\n');

  // 1. Check job_queue status
  const jobs = await sql`
    SELECT id, job_type, status, attempt_count, max_retries, last_error, 
           scheduled_for, last_attempt_at, created_at, idempotency_key
    FROM job_queue 
    ORDER BY created_at DESC
  `;
  console.log(`Job Queue (${jobs.length} jobs):`);
  jobs.forEach(j => {
    console.log(`  ${j.job_type} | Status: ${j.status} | Attempts: ${j.attempt_count}/${j.max_retries} | Error: ${j.last_error || 'none'}`);
    console.log(`    Key: ${j.idempotency_key} | Scheduled: ${j.scheduled_for}`);
  });

  // 2. Check job worker lease
  const leases = await sql`SELECT * FROM job_worker_leases`;
  console.log(`\nWorker Leases (${leases.length}):`);
  leases.forEach(l => {
    const expired = new Date(l.lease_expires_at) < new Date();
    console.log(`  ${l.worker_name} | Instance: ${l.instance_id} | Expired: ${expired} | Last Heartbeat: ${l.last_heartbeat}`);
  });

  // 3. Check meetings that need enrichment
  const meetings = await sql`
    SELECT id, title, enrichment_status, enrichment_attempts, last_enrichment_at, status
    FROM meetings 
    WHERE enrichment_status != 'completed'
    ORDER BY created_at DESC
  `;
  console.log(`\nMeetings Pending Enrichment (${meetings.length}):`);
  meetings.forEach(m => {
    console.log(`  ${m.title} | Status: ${m.status} | Enrichment: ${m.enrichment_status} | Attempts: ${m.enrichment_attempts}`);
  });

  // 4. Check for failed jobs
  const failedJobs = await sql`
    SELECT * FROM job_queue WHERE status = 'failed' OR attempt_count >= max_retries
  `;
  console.log(`\nFailed/Exhausted Jobs (${failedJobs.length}):`);
  failedJobs.forEach(j => {
    console.log(`  ${j.job_type} | ${j.idempotency_key} | Error: ${j.last_error}`);
  });

  await sql.end();
}

investigate();
