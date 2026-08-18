import fs from 'fs'

function updateTestFile() {
  const file = 'tests/protocol.test.ts'
  let content = fs.readFileSync(file, 'utf8')

  const target = `    // Option B: Successful Identity Linking Test
    assert(
      typeof verifyGithubSource === 'function',
      'GitHub Verifier updated to accept walletAddress for identity linking (Option B)'
    )`

  const replacement = `    // Option B: Successful Identity Linking Test (Real Integration Tests)
    
    // We will intercept Supabase's fetch calls to wallet_identities table to mock the DB state
    const testWalletA = 'TestWalletA123456789012345678901' // Has github_id '123'
    const testWalletB = 'TestWalletB123456789012345678901' // Has github_id '999'
    const testWalletC = 'TestWalletC123456789012345678901' // No linked identity
    
    const originalFetchInner = global.fetch;
    global.fetch = async (url: any, options?: any) => {
      const urlStr = url.toString()
      
      // Mock Supabase REST API for wallet_identities
      if (urlStr.includes('wallet_identities')) {
        if (urlStr.includes('wallet_address=eq.TestWalletA')) {
          return new Response(JSON.stringify([{ github_id: '123' }]), { status: 200, headers: { 'content-type': 'application/vnd.pgrst.object+json' } })
        }
        if (urlStr.includes('wallet_address=eq.TestWalletB')) {
          return new Response(JSON.stringify([{ github_id: '999' }]), { status: 200, headers: { 'content-type': 'application/vnd.pgrst.object+json' } })
        }
        // Return 406 Not Acceptable (Supabase standard for .single() when 0 rows)
        return new Response(JSON.stringify({ code: "PGRST116" }), { status: 406, headers: { 'content-type': 'application/json' } })
      }
      
      // Mock GitHub REST API for test repo
      if (urlStr.includes('api.github.com/repos/test/repo/pulls/123')) {
        return new Response(JSON.stringify({
          user: { id: 123, login: 'testuser' },
          html_url: 'https://github.com/test/repo/pull/123',
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      
      return originalFetchInner(url, options)
    }

    // Test 1: Wallet A + github 123 + author 123 -> source_verified
    const res1 = await verifyGithubSource('https://github.com/test/repo/pull/123', testWalletA)
    assert(res1.status === 'verified' && res1.provenanceLevel === 'source_verified', 'Wallet A + github 123 + author 123 -> source_verified')

    // Test 2: Wallet B + github 999 + author 123 -> identity_linked (mismatch)
    const res2 = await verifyGithubSource('https://github.com/test/repo/pull/123', testWalletB)
    assert(res2.status === 'verified_source_exists' && res2.provenanceLevel === 'identity_linked', 'Wallet B + github 999 + author 123 -> identity_linked')

    // Test 3: Wallet C + no identity + author 123 -> source_exists
    const res3 = await verifyGithubSource('https://github.com/test/repo/pull/123', testWalletC)
    assert(res3.status === 'verified_source_exists' && res3.provenanceLevel === 'source_exists', 'Wallet C + no GitHub identity -> source_exists')
    
    // Restore fetch inside this block (the finally block restores it again)
    global.fetch = originalFetchInner`

  content = content.replace(target, replacement)
  fs.writeFileSync(file, content)
  console.log("Updated tests/protocol.test.ts")
}

updateTestFile()
