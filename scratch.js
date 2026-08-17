const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://chdvxbofxmayaqkqmaoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZHZ4Ym9meG1heWFxa3FtYW95Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc5MTAwNiwiZXhwIjoyMDk5MzY3MDA2fQ.vsxJydhLDRfIooLm283Gl-DGwcgSPDaGKsQz9nOLPwU'
);

async function test() {
  const { data, error } = await supabase.rpc('atomic_insert_log', {
    p_content: 'test',
    p_wallet: 'test',
    p_signature: 'test',
    p_created_at: new Date().toISOString(),
    p_nonce: 'test',
    p_domain: 'test',
    p_evidence_url: null,
    p_github_url: null,
    p_skills: [],
    p_protocols: [],
    p_category: 'General',
    p_archival_state: 'not_requested',
    p_visibility: 'private',
    p_protocol_version: 2,
    p_challenge_id: null,
    p_evidence_type: 'self_attested',
    p_provenance_level: 'self_attested',
    p_source_provider: null,
    p_source_metadata: null,
    p_source_verification_status: 'not_verified',
    p_source_verified_at: null
  });
  console.log('Error:', error);
}
test();
