const { Client } = require('pg');
const fs = require('fs');

async function runMigrations() {
  const connectionString = process.env.NEXT_PUBLIC_SUPABASE_URL 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:postgres@').replace('.supabase.co', ':54322/postgres')
    : 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  console.log('Connecting to', connectionString);
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    const m16 = fs.readFileSync('supabase/migrations/20260819_016_fix_provenance_constraint.sql', 'utf8');
    await client.query(m16);
    console.log('Applied migration 16');
    
    const m17 = fs.readFileSync('supabase/migrations/20260819_017_oauth_state_action.sql', 'utf8');
    await client.query(m17);
    console.log('Applied migration 17');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
