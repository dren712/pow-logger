const fs = require('fs');
const file = 'tests/protocol.test.ts';
let content = fs.readFileSync(file, 'utf8');

const suite13 = `

  // --- SUITE 13: Database Integration for Provenance States ---
  console.log('\\n► SUITE 13: Database Integration for Provenance States')
  
  if (supabaseUrl && anonKey && isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        const serviceClient = createClient(supabaseUrl, serviceKey)
        const levels = ['self_attested', 'source_linked', 'source_exists', 'identity_linked', 'source_verified', 'partner_attested']
        
        for (const level of levels) {
          const testNonce = 'DBTEST' + Date.now().toString() + Math.random().toString(36).substring(7)
          
          // Insert directly as service role to bypass API and test schema constraints
          const { error } = await serviceClient.from('logs').insert({
            content: 'Test content for ' + level,
            wallet_address: walletAddress,
            signature: 'fake_sig_' + testNonce,
            created_at: new Date().toISOString(),
            nonce: testNonce,
            domain: 'test.com',
            evidence_type: 'github_pr',
            provenance_level: level,
            source_provider: 'github'
          })
          
          assert(!error, \`Database schema successfully accepts provenance level: \${level}\`, error?.message)
        }
        
        // Test invalid state
        const testNonceInvalid = 'DBTEST' + Date.now().toString() + Math.random().toString(36).substring(7)
        const { error: errInvalid } = await serviceClient.from('logs').insert({
            content: 'Test content for invalid',
            wallet_address: walletAddress,
            signature: 'fake_sig_' + testNonceInvalid,
            created_at: new Date().toISOString(),
            nonce: testNonceInvalid,
            domain: 'test.com',
            evidence_type: 'github_pr',
            provenance_level: 'invalid_state',
            source_provider: 'github'
        })
        assert(!!errInvalid, 'Database schema successfully rejects invalid provenance level: invalid_state')

      } else {
         console.log('  ℹ️ Skipping Suite 13 DB Integration Test: No SUPABASE_SERVICE_ROLE_KEY available')
      }
    } catch (e) {
      console.error('Test error:', e)
    }
  } else {
    console.log('  ℹ️ Offline Protocol Test Mode: Skipping live DB integration test')
  }

  // --- SUMMARY ---
`

// Replace the summary start string with suite13 + summary start string
content = content.replace('  // --- SUMMARY ---', suite13);
content = content.replace("Level 2 Craftsman threshold is 7 logs", "Level 2 Attested Craftsman threshold is 7 logs");
content = content.replace("Level 3 Architect threshold is 30 logs", "Level 3 Senior Builder threshold is 30 logs");
content = content.replace("Level 4 Master threshold is 100 logs", "Level 4 Protocol Builder threshold is 100 logs");
content = content.replace("Level 5 Grand Legend threshold is 365 logs", "Level 5 Attested Legend threshold is 365 logs");

fs.writeFileSync(file, content);
console.log('Added Suite 13 to protocol.test.ts');
