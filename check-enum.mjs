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

async function checkEnums() {
  console.log('=== CHECKING ENRICHMENT_STATUS ENUM ===\n');
  
  const enums = await sql`
    SELECT e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'enrichment_status'
    ORDER BY e.enumsortorder
  `;
  console.log('Current enrichment_status enum values:');
  enums.forEach(e => console.log(`  - ${e.enumlabel}`));

  // Check meetings table enrichment_status values
  const statuses = await sql`
    SELECT DISTINCT enrichment_status, COUNT(*) as count 
    FROM meetings 
    GROUP BY enrichment_status
  `;
  console.log('\nMeetings by enrichment_status:');
  statuses.forEach(s => console.log(`  - ${s.enrichment_status}: ${s.count}`));

  await sql.end();
}

checkEnums();
