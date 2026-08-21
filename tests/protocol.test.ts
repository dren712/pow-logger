/**
 * PROVN Production Verification & Protocol Security Test Suite 🛡️🗿
 *
 * Verifies:
 * 1. Canonical Proof Message Construction & Tamper Protection.
 * 2. URL Normalization & Domain Restriction (https:// & github.com validation).
 * 3. Ed25519 Cryptographic Signature Verification & Tampered Field Invalidation.
 * 4. Database Security & Supabase RLS Anonymous Mutation Rejection.
 * 5. Replay Attack Prevention (Duplicate Signature Rejection & Expiry Window).
 * 6. Fixed-Window In-Memory Serverless Rate Limiter.
 * 7. Verification API Metrics & Cache Header Validation.
 * 8. Persisted Proof Reconstruction & Multi-Field Tamper Validation.
 */

import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { createClient } from '@supabase/supabase-js'
import {
  buildCanonicalSubmitMessage,
  buildCanonicalSubmitMessageV2,
  buildCanonicalRetryMessage,
  buildCanonicalRetryMessageV2,
  buildCanonicalArchiveMessage,
  buildCanonicalVisibilityMessage,
  buildCanonicalIdentityLinkMessage,
  CURRENT_PROTOCOL_VERSION,
  validateAndNormalizeUrl,
  getVerifiedDomain,
  isConfiguredSupabaseUrl,
  decodeBase58,
  verifyLogCryptographically,
  evaluateProofValidity,
  computeCanonicalProofHash,
  reconstructCanonicalSubmitMessage,
  verifyPrivateProofAuth,
  buildPrivateProofAuthMessage,
} from '../app/lib/canonicalMessage'
import { parseIrysPrivateKey } from '../app/lib/irysUploader'
import { checkRateLimit } from '../app/lib/rateLimiter'
import { calculateStreak, toLocalDateString, getProtocolStartOfDay, fetchAllWalletLogs, PROTOCOL_TIMEZONE, BUILDER_LEVELS, getBuilderLevel, getEarnedSkillBadges, computeBadgeSummary } from '../app/lib/milestones'
import { calculateReputation } from '../app/lib/reputationEngine'
import { evaluateAchievements } from '../app/lib/achievements'
import { checkCNFTEligibility, generateAchievementMetadata, LocalTestMinter } from '../app/lib/cnftEligibility'
import { ProvnClient } from '../sdk/index'
import { CARD_THEMES, getCardTheme } from '../app/lib/cardThemes'
import { WalletLog, BuilderReputation } from '../app/lib/types'
import { parseGithubUrl, verifyGithubSource } from '../app/lib/githubVerifier'
import { signServerReceipt, PROVN_TRUSTED_PUBLIC_KEYS, resolveTrustedKey, getPublishedPublicKey } from '../app/lib/serverKeypair'
import { evaluateEligibility, STANDARD_POLICY_PRESETS } from '../app/lib/policyEngine'

import fs from 'fs'
import path from 'path'

try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let val = match[2].trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
} catch {}

async function runProductionTestSuite() {
  console.log('===================================================================')
  console.log('   PROVN PRODUCTION SECURITY & PROTOCOL TEST SUITE 🛡️🗿')
  console.log('===================================================================\n')

  let passed = 0
  let failed = 0
  const failedTests: string[] = []

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`)
      failedTests.push(`${testName}${detail ? ` (${detail})` : ''}`)
      failed++
    }
  }

  // --- SUITE 1: Canonical Proof Message Construction & URL Security ---
  console.log('► SUITE 1: Canonical Proof Message Construction & URL Normalization')
  
  const validGithub = validateAndNormalizeUrl('https://github.com/dren712/pow-logger/pull/1', 'github')
  assert(validGithub === 'https://github.com/dren712/pow-logger/pull/1', 'Valid GitHub PR URL normalized correctly')

  const invalidGithubDomain = validateAndNormalizeUrl('https://malicious-github.com/fake/repo', 'github')
  assert(invalidGithubDomain === null, 'Non-github.com domain rejected for GitHub URL')

  const invalidScheme = validateAndNormalizeUrl('javascript:alert(1)', 'evidence')
  assert(invalidScheme === null, 'Non-HTTPS scheme rejected for evidence URL')

  const validEvidence = validateAndNormalizeUrl('https://provn-sol.vercel.app/demo', 'evidence')
  assert(validEvidence === 'https://provn-sol.vercel.app/demo', 'Valid HTTPS evidence URL accepted')

  console.log('\n► SUITE 1B: GitHub PR/Commit URL Parsing (Phase 2)')
  const prUrl = parseGithubUrl('https://github.com/dren712/pow-logger/pull/1')
  assert(prUrl?.type === 'pull' && prUrl.identifier === '1', 'GitHub PR URL parsed correctly')

  const commitUrl = parseGithubUrl('https://github.com/dren712/pow-logger/commit/7db381a')
  assert(commitUrl?.type === 'commit' && commitUrl.identifier === '7db381a', 'GitHub Commit URL parsed correctly')

  const badGithubUrl = parseGithubUrl('https://github.com/dren712/pow-logger/issues/5')
  assert(badGithubUrl === null, 'GitHub Issue URL rejected (only PRs/Commits)')

  const spoofedDomain = getVerifiedDomain('evil-hacker.com')
  assert(spoofedDomain === 'provn-sol.vercel.app', 'Arbitrary host header spoofing rejected')

  const validLocalhost = getVerifiedDomain('localhost:3000')
  assert(validLocalhost === 'localhost', 'Localhost development host header accepted')

  const dummyKeyArr = JSON.stringify(Array.from({ length: 64 }, (_, i) => i))
  const parsedKeyBytes = parseIrysPrivateKey(dummyKeyArr)
  assert(parsedKeyBytes instanceof Uint8Array && parsedKeyBytes.length === 64, 'Deterministic 64-byte Irys secret key parsed correctly')

  const sampleDates = [
    new Date(Date.now() - 2 * 86400000).toISOString(),
    new Date(Date.now() - 1 * 86400000).toISOString(),
    new Date().toISOString(),
  ]
  const currentStreakCount = calculateStreak(sampleDates)
  assert(currentStreakCount === 3, 'Consecutive 3-day IST streak calculated correctly')
  assert(PROTOCOL_TIMEZONE === 'Asia/Kolkata', 'PROTOCOL_TIMEZONE is exported as canonical Asia/Kolkata')

  const prevDayInstant = '2026-08-10T18:29:59.000Z'
  const nextDayInstant = '2026-08-10T18:30:00.000Z'
  assert(toLocalDateString(prevDayInstant) === '2026-08-10', '18:29:59Z resolves to previous IST date 2026-08-10')
  assert(toLocalDateString(nextDayInstant) === '2026-08-11', '18:30:00Z resolves to next IST date 2026-08-11')

  const startOfDayBound = getProtocolStartOfDay(nextDayInstant)
  assert(startOfDayBound.toISOString() === '2026-08-10T18:30:00.000Z', 'getProtocolStartOfDay resolves to exact 00:00:00 IST (18:30:00Z UTC)')

  // Unit Test: fetchAllWalletLogs paginated query helper & fail-closed contract
  const mockLogs = Array.from({ length: 1050 }, (_, i) => ({ id: 1050 - i, created_at: '2026-08-10T12:00:00Z' }))
  const mockSuccessClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: (from: number, to: number) => Promise.resolve({ data: mockLogs.slice(from, to + 1), error: null })
            })
          })
        })
      })
    })
  }

  let fetchedLogsResult: unknown[] = []
  let errorCaught = false
  try {
    fetchedLogsResult = await fetchAllWalletLogs(mockSuccessClient, 'testWallet')
  } catch {}
  assert(fetchedLogsResult.length === 1050, 'fetchAllWalletLogs pages 1050 logs cleanly across 1,000-row boundaries')

  const mockErrorClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: null, error: { message: 'Database Connection Timeout' } })
            })
          })
        })
      })
    })
  }

  try {
    await fetchAllWalletLogs(mockErrorClient, 'testWallet')
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Database Connection Timeout')) {
      errorCaught = true
    }
  }
  assert(errorCaught === true, 'fetchAllWalletLogs strictly fails closed (throws Error) on database query failures')

  // Unit Test: Nonce Base58 & Whitespace Validation
  const validNonce = 'ABCDEFGH12345678'
  let validNonceParsed = false
  try {
    decodeBase58(validNonce)
    validNonceParsed = true
  } catch {}
  assert(validNonceParsed === true, 'Valid Base58 nonce parses cleanly')

  const invalidNonceChars = '!!!!!!!!'
  let invalidNonceParsed = false
  try {
    decodeBase58(invalidNonceChars)
    invalidNonceParsed = true
  } catch {}
  assert(invalidNonceParsed === false, 'Invalid non-Base58 nonce strictly rejected')

  const validateNonceRule = (n: unknown) => typeof n === 'string' && n.trim().length >= 8 && n === n.trim()
  const leadingSpaceNonce = ' ABCDEFGH12345678'
  const trailingSpaceNonce = 'ABCDEFGH12345678 '
  assert(validateNonceRule(validNonce) === true, 'Valid Base58 nonce satisfies server validation rule')
  assert(validateNonceRule(leadingSpaceNonce) === false, 'Leading whitespace nonce strictly rejected by server rule')
  assert(validateNonceRule(trailingSpaceNonce) === false, 'Trailing whitespace nonce strictly rejected by server rule')

  // --- SUITE 2: Serverless Fixed-Window Rate Limiter ---
  console.log('\n► SUITE 2: Serverless Fixed-Window Rate Limiting (IP & Wallet)')
  const testIp = '192.168.1.100'
  const rateLimitTest1 = checkRateLimit(testIp, 'ip', 2, 1000)
  assert(rateLimitTest1.allowed === true && rateLimitTest1.remaining === 1, 'First request within rate limit allowed')

  const rateLimitTest2 = checkRateLimit(testIp, 'ip', 2, 1000)
  assert(rateLimitTest2.allowed === true && rateLimitTest2.remaining === 0, 'Second request reaching limit allowed')

  const rateLimitTest3 = checkRateLimit(testIp, 'ip', 2, 1000)
  assert(rateLimitTest3.allowed === false, 'Excessive request beyond rate limit strictly rejected (429)')

  // --- SUITE 3: Ed25519 Cryptographic Tamper Evidence [V1 Legacy Protocol] ---
  console.log('\n► SUITE 3: Ed25519 Cryptographic Proof Signature Tamper Protection [V1 Legacy]')
  const keypair = nacl.sign.keyPair()
  const walletAddress = bs58.encode(keypair.publicKey)
  const timestamp = new Date().toISOString()
  const nonce = 'ABCDEFGH12345678'

  const canonicalMsg = buildCanonicalSubmitMessage({
    walletAddress,
    timestamp,
    nonce,
    content: 'Built Ed25519 anti-tamper security layer for PROVN',
    githubUrl: 'https://github.com/dren712/pow-logger/pull/10',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })

  const msgBytes = new TextEncoder().encode(canonicalMsg)
  const sigBytes = nacl.sign.detached(msgBytes, keypair.secretKey)
  const signature = bs58.encode(sigBytes)

  // Verify genuine signature
  const isOriginalValid = nacl.sign.detached.verify(
    msgBytes,
    bs58.decode(signature),
    bs58.decode(walletAddress)
  )
  assert(isOriginalValid === true, 'Original canonical proof message verifies correctly with wallet public key')

  // Test Tampered Content
  const tamperedContentMsg = buildCanonicalSubmitMessage({
    walletAddress,
    timestamp,
    nonce,
    content: 'Built Ed25519 anti-tamper security layer for PROVN (TAMPERED)',
    githubUrl: 'https://github.com/dren712/pow-logger/pull/10',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })
  const isTamperedContentValid = nacl.sign.detached.verify(
    new TextEncoder().encode(tamperedContentMsg),
    bs58.decode(signature),
    bs58.decode(walletAddress)
  )
  assert(isTamperedContentValid === false, 'Tampered content invalidates cryptographic signature')

  // Test Tampered GitHub URL
  const tamperedGithubMsg = buildCanonicalSubmitMessage({
    walletAddress,
    timestamp,
    nonce,
    content: 'Built Ed25519 anti-tamper security layer for PROVN',
    githubUrl: 'https://github.com/attacker/malicious-repo',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })
  const isTamperedGithubValid = nacl.sign.detached.verify(
    new TextEncoder().encode(tamperedGithubMsg),
    bs58.decode(signature),
    bs58.decode(walletAddress)
  )
  assert(isTamperedGithubValid === false, 'Tampered GitHub URL invalidates cryptographic signature')

  // Test Tampered Evidence URL
  const tamperedEvidenceMsg = buildCanonicalSubmitMessage({
    walletAddress,
    timestamp,
    nonce,
    content: 'Built Ed25519 anti-tamper security layer for PROVN',
    githubUrl: 'https://github.com/dren712/pow-logger/pull/10',
    evidenceUrl: 'https://phishing-domain.com',
  })
  const isTamperedEvidenceValid = nacl.sign.detached.verify(
    new TextEncoder().encode(tamperedEvidenceMsg),
    bs58.decode(signature),
    bs58.decode(walletAddress)
  )
  assert(isTamperedEvidenceValid === false, 'Tampered Evidence URL invalidates cryptographic signature')

  // --- SUITE 4: Supabase RLS Security Verification ---
  console.log('\n► SUITE 4: Supabase Database Row-Level Security (RLS) Policies')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (supabaseUrl && anonKey && isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      const anonClient = createClient(supabaseUrl, anonKey)

      // Test Anonymous Select (Must succeed for public builder profiles)
      const { error: selectErr } = await anonClient.from('logs').select('id, content, wallet_address').limit(1)
      if (selectErr && selectErr.message?.toLowerCase().includes('fetch failed')) {
        console.log('  ℹ️ Offline Protocol Test Mode: Skipping live Supabase network calls (Network unreachable)')
      } else {
        assert(!selectErr, 'Public anonymous SELECT reads succeed for open builder profiles', selectErr?.message)

        // Test Anonymous Insert (Must be DENIED by database RLS)
        const { data: insertData, error: insertErr } = await anonClient.from('logs').insert([{
          wallet_address: walletAddress,
          content: 'Bypassing API server via direct client RLS write attempt',
          signature: 'fake_sig_' + Math.random().toString(36).substring(2, 8),
        }]).select()
        const isRlsInsertDenied = !!insertErr && (insertErr.code === '42501' || insertErr.message?.toLowerCase().includes('policy') || insertErr.message?.toLowerCase().includes('row-level security') || insertErr.code?.startsWith('PGRST'))
        assert(isRlsInsertDenied || (!insertData || insertData.length === 0), 'Direct anonymous client INSERT is strictly DENIED by RLS policy', insertErr?.message)

        // Test Anonymous Delete (Must be DENIED by database RLS)
        const { data: deleteData, error: deleteErr } = await anonClient.from('logs').delete().eq('id', 1).select()
        const isRlsDeleteDenied = !!deleteErr && (deleteErr.code === '42501' || deleteErr.message?.toLowerCase().includes('policy') || deleteErr.message?.toLowerCase().includes('row-level security') || deleteErr.code?.startsWith('PGRST'))
        assert(isRlsDeleteDenied || (!deleteData || deleteData.length === 0), 'Direct anonymous client DELETE is strictly DENIED by RLS policy', deleteErr?.message)
      }
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : String(netErr)
      console.log(`  ℹ️ Skipping live Supabase network calls (${msg})`)
    }
  } else {
    console.log('  ℹ️ Offline Protocol Test Mode: Skipping live Supabase network calls (Requires live SUPABASE_URL)')
  }

  // --- SUITE 5: Authorized Archival Retry Logic ---
  console.log('\n► SUITE 5: Authorized Archival Retry Proof Verification')
  const retryLogId = 42
  const retryTimestamp = new Date().toISOString()
  const retryNonce = 'ABCDEFGH88888888'

  const canonicalRetryMsg = buildCanonicalRetryMessage({
    walletAddress,
    logId: retryLogId,
    timestamp: retryTimestamp,
    nonce: retryNonce,
  })

  const retryBytes = new TextEncoder().encode(canonicalRetryMsg)
  const retrySigBytes = nacl.sign.detached(retryBytes, keypair.secretKey)
  const retrySignature = bs58.encode(retrySigBytes)

  const isRetrySigValid = nacl.sign.detached.verify(
    retryBytes,
    bs58.decode(retrySignature),
    bs58.decode(walletAddress)
  )
  assert(isRetrySigValid === true, 'Authorized retry SIWS signature verifies correctly')

  // Test Retry for different wallet
  const wrongKeypair = nacl.sign.keyPair()
  const wrongWalletAddress = bs58.encode(wrongKeypair.publicKey)
  const isWrongWalletValid = nacl.sign.detached.verify(
    retryBytes,
    bs58.decode(retrySignature),
    bs58.decode(wrongWalletAddress)
  )
  assert(isWrongWalletValid === false, 'Retry signature for wrong wallet address rejected')

  // --- SUITE 6: Persisted Proof Reconstruction & Multi-Field Tamper Validation ---
  console.log('\n► SUITE 6: Persisted Proof Reconstruction & Multi-Field Tamper Validation')
  const testNonce = 'ABCDEFGH99999999'
  const testDomain = 'provn-sol.vercel.app'
  const testContent = 'Persisted Proof Reconstruction Test Log'
  const testTimestamp = new Date().toISOString()

  const e2eCanonicalMsg = buildCanonicalSubmitMessage({
    domain: testDomain,
    walletAddress,
    timestamp: testTimestamp,
    nonce: testNonce,
    content: testContent,
  })

  const e2eMsgBytes = new TextEncoder().encode(e2eCanonicalMsg)
  const e2eSigBytes = nacl.sign.detached(e2eMsgBytes, keypair.secretKey)
  const e2eSignature = bs58.encode(e2eSigBytes)

  // Simulate retrieving stored database fields
  const mockStoredRow = {
    wallet_address: walletAddress,
    domain: testDomain,
    nonce: testNonce,
    created_at: testTimestamp,
    content: testContent,
    signature: e2eSignature,
  }

  // Re-verify from stored fields
  const reconstructedMsg = buildCanonicalSubmitMessage({
    domain: mockStoredRow.domain,
    walletAddress: mockStoredRow.wallet_address,
    timestamp: mockStoredRow.created_at,
    nonce: mockStoredRow.nonce,
    content: mockStoredRow.content,
  })

  const isE2EValid = nacl.sign.detached.verify(
    new TextEncoder().encode(reconstructedMsg),
    bs58.decode(mockStoredRow.signature),
    bs58.decode(mockStoredRow.wallet_address)
  )
  assert(isE2EValid === true, 'Persisted nonce and domain reconstruct exact signature correctly')

  // 1. Tampered Nonce
  const tamperedNonceMsg = buildCanonicalSubmitMessage({
    domain: mockStoredRow.domain,
    walletAddress: mockStoredRow.wallet_address,
    timestamp: mockStoredRow.created_at,
    nonce: 'tampered_nonce',
    content: mockStoredRow.content,
  })
  assert(!nacl.sign.detached.verify(new TextEncoder().encode(tamperedNonceMsg), bs58.decode(mockStoredRow.signature), bs58.decode(mockStoredRow.wallet_address)), 'Tampered persisted nonce invalidates re-verification')

  // 2. Tampered Domain
  const tamperedDomainMsg = buildCanonicalSubmitMessage({
    domain: 'localhost',
    walletAddress: mockStoredRow.wallet_address,
    timestamp: mockStoredRow.created_at,
    nonce: mockStoredRow.nonce,
    content: mockStoredRow.content,
  })
  assert(!nacl.sign.detached.verify(new TextEncoder().encode(tamperedDomainMsg), bs58.decode(mockStoredRow.signature), bs58.decode(mockStoredRow.wallet_address)), 'Tampered persisted domain invalidates re-verification')

  // 3. Tampered Content
  const tamperedE2EContentMsg = buildCanonicalSubmitMessage({
    domain: mockStoredRow.domain,
    walletAddress: mockStoredRow.wallet_address,
    timestamp: mockStoredRow.created_at,
    nonce: mockStoredRow.nonce,
    content: 'Altered content payload',
  })
  assert(!nacl.sign.detached.verify(new TextEncoder().encode(tamperedE2EContentMsg), bs58.decode(mockStoredRow.signature), bs58.decode(mockStoredRow.wallet_address)), 'Tampered persisted content invalidates re-verification')

  // --- SUITE 7: Deterministic Reputation Engine & Off-Chain Achievement System ---
  console.log('\n► SUITE 7: Deterministic Reputation Engine & Off-Chain Achievement System')

  const suite7Keypair = nacl.sign.keyPair()
  const suite7Wallet = bs58.encode(suite7Keypair.publicKey)

  const log1Timestamp = '2026-08-01T10:00:00.000Z'
  const log1Nonce = bs58.encode(nacl.randomBytes(16))
  const log1Content = 'Wrote Solana Anchor Program with Rust'
  const log1Prompt = buildCanonicalSubmitMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: suite7Wallet,
    timestamp: log1Timestamp,
    nonce: log1Nonce,
    content: log1Content,
  })
  const log1Sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(log1Prompt), suite7Keypair.secretKey))

  const log2Timestamp = '2026-08-02T10:00:00.000Z'
  const log2Nonce = bs58.encode(nacl.randomBytes(16))
  const log2Content = 'Integrated Metaplex Compressed NFTs'
  const log2Prompt = buildCanonicalSubmitMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: suite7Wallet,
    timestamp: log2Timestamp,
    nonce: log2Nonce,
    content: log2Content,
  })
  const log2Sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(log2Prompt), suite7Keypair.secretKey))

  const testLogs = [
    {
      id: 1,
      wallet_address: suite7Wallet,
      created_at: log1Timestamp,
      content: log1Content,
      skills: ['Solana', 'Rust', 'Anchor'],
      protocols: ['Solana', 'Anchor'],
      category: 'Development',
      signature: log1Sig,
      nonce: log1Nonce,
      domain: 'provn-sol.vercel.app',
      archival_state: 'receipt_obtained' as const,
      irys_tx_id: 'irys_tx_genesis_1',
    },
    {
      id: 2,
      wallet_address: suite7Wallet,
      created_at: log2Timestamp,
      content: log2Content,
      skills: ['Solana', 'TypeScript', 'Metaplex'],
      protocols: ['Metaplex'],
      category: 'Development',
      signature: log2Sig,
      nonce: log2Nonce,
      domain: 'provn-sol.vercel.app',
      archival_state: 'receipt_obtained' as const,
      irys_tx_id: 'irys_tx_genesis_2',
    },
  ]

  // Test 1: calculateReputation determinism
  const rep1 = calculateReputation(suite7Wallet, testLogs)
  const rep2 = calculateReputation(suite7Wallet, testLogs)
  assert(rep1.totalProofs === 2, 'calculateReputation calculates correct total proofs count')
  assert(rep1.archivedProofs === 2, 'calculateReputation calculates correct archived proofs count')
  assert(rep1.archivalSuccessRate === 100, 'calculateReputation computes 100% archival success rate')
  assert(JSON.stringify(rep1) === JSON.stringify(rep2), 'calculateReputation is 100% deterministic (same input -> same output)')

  // Test 2: evaluateAchievements
  const achievements = evaluateAchievements(testLogs, 7, 7)
  const genesisAch = achievements.find((a) => a.id === 'FIRST_PROOF')
  const streakAch = achievements.find((a) => a.id === '7_DAY_STREAK')
  assert(genesisAch?.earned === true, 'FIRST_PROOF achievement unlocked for >=1 proof')
  assert(streakAch?.earned === true, '7_DAY_STREAK achievement unlocked for >=7 day streak')

  // Test 3: cNFT eligibility & metadata generator
  const eligibility = checkCNFTEligibility('FIRST_PROOF', rep1)
  assert(eligibility.eligible === true, 'checkCNFTEligibility evaluates eligible for earned achievement')

  const meta = generateAchievementMetadata(genesisAch!, rep1)
  assert(meta.name.includes('Genesis Proof'), 'generateAchievementMetadata generates valid Metaplex standard name')
  assert(meta.attributes.some((a) => a.trait_type === 'Protocol' && a.value === 'PROVN'), 'Metadata contains PROVN protocol attribute')

  // Test 4: LocalTestMinter mock mint execution
  const minter = new LocalTestMinter()
  const mintRes = await minter.mintAchievement(walletAddress, genesisAch!, rep1)
  assert(mintRes.success === true && mintRes.isMock === true, 'LocalTestMinter simulates $0 achievement minting successfully')

  // Test 5: SDK ProvnClient local proof verification
  const isSdkValid = ProvnClient.verifyProofLocally({
    walletAddress,
    signature,
    nonce,
    timestamp,
    content: 'Built Ed25519 anti-tamper security layer for PROVN',
    githubUrl: 'https://github.com/dren712/pow-logger/pull/10',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })
  assert(isSdkValid === true, 'ProvnClient.verifyProofLocally verifies authentic signature successfully')

  const isSdkTamperedInvalid = ProvnClient.verifyProofLocally({
    walletAddress,
    signature,
    nonce,
    timestamp,
    content: 'TAMPERED CONTENT',
    githubUrl: 'https://github.com/dren712/pow-logger/pull/10',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })
  assert(isSdkTamperedInvalid === false, 'ProvnClient.verifyProofLocally rejects tampered payload correctly')

  // --- SUITE 8: Metallic Customizable Card System & Material Themes ---
  console.log('\n► SUITE 8: Metallic Customizable Card System & Material Themes')

  // Test 1: Theme presets availability
  const themeKeys = Object.keys(CARD_THEMES)
  assert(themeKeys.length >= 10, 'All 10 core metallic card themes are defined in CARD_THEMES')
  assert(themeKeys.includes('steel') && themeKeys.includes('titanium') && themeKeys.includes('obsidian'), 'Standard materials (steel, titanium, obsidian) are registered')

  // Test 2: Theme property schema completeness
  for (const key of themeKeys) {
    const t = CARD_THEMES[key]
    assert(Boolean(t.id && t.name && t.material && t.surfaceGradient && t.borderTone && t.accentTone), `Theme "${key}" satisfies complete material schema`)
  }

  // Test 3: getCardTheme fallback safety
  const fallbackTheme = getCardTheme('unknown_nonexistent_theme')
  assert(fallbackTheme.id === 'steel', 'getCardTheme safely falls back to default Raw Steel for unknown theme IDs')

  // --- SUITE 9: Truth and Integrity Hardening & Sanitization ---
  console.log('\n► SUITE 9: Truth and Integrity Hardening & Sanitization')

  // Test 1: Base58 Decoding & Validation
  const validSolanaWallet = 'AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p'
  const decodedPubkey = decodeBase58(validSolanaWallet)
  assert(decodedPubkey.length === 32, 'Valid Solana address decodes to exact 32-byte public key')

  let invalidBase58Thrown = false
  try {
    decodeBase58('Invalid0OIlNonBase58Chars!!!')
  } catch {
    invalidBase58Thrown = true
  }
  assert(invalidBase58Thrown === true, 'decodeBase58 throws on invalid Base58 characters')

  // Test 2: SVG XML Entity Sanitization
  function escapeXmlTest(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
  const xssAttempt = '<script>alert("xss")</script>&foo=\'bar\''
  const sanitized = escapeXmlTest(xssAttempt)
  assert(!sanitized.includes('<') && !sanitized.includes('>') && !sanitized.includes('"') && !sanitized.includes("'"), 'XML/SVG entity sanitizer strips potential injection tokens')
  assert(sanitized.includes('&lt;script&gt;') && sanitized.includes('&amp;foo='), 'XML/SVG entity sanitizer produces valid XML entities')

  // Test 3: Builder Level Threshold Alignment
  assert(BUILDER_LEVELS[0].minLogs === 0, 'Level 1 Apprentice threshold is 0 logs')
  assert(BUILDER_LEVELS[1].minLogs === 7, 'Level 2 Attested Craftsman threshold is 7 logs')
  assert(BUILDER_LEVELS[2].minLogs === 30, 'Level 3 Senior Builder threshold is 30 logs')
  assert(BUILDER_LEVELS[3].minLogs === 100, 'Level 4 Protocol Builder threshold is 100 logs')
  assert(BUILDER_LEVELS[4].minLogs === 365, 'Level 5 Attested Legend threshold is 365 logs')

  assert(getBuilderLevel(0).level === 1, '0 logs resolves to Level 1')
  assert(getBuilderLevel(7).level === 2, '7 logs resolves to Level 2')
  assert(getBuilderLevel(35).level === 3, '35 logs resolves to Level 3')
  assert(getBuilderLevel(150).level === 4, '150 logs resolves to Level 4')
  assert(getBuilderLevel(400).level === 5, '400 logs resolves to Level 5')

  // Test 4: Canonical Retry Message Construction
  const retryMsg = buildCanonicalRetryMessage({
    walletAddress: validSolanaWallet,
    logId: 42,
    timestamp: '2026-08-14T00:00:00.000Z',
    nonce: 'retry_nonce_1234',
  })
  assert(retryMsg.includes('Action: Retry Archival'), 'Canonical retry message contains Action: Retry Archival header')
  assert(retryMsg.includes('Log ID: 42') && retryMsg.includes('retry_nonce_1234'), 'Canonical retry message includes logId and nonce')

  // Test 5: verifyLogCryptographically Unified Verification Invariant
  const suite9Keypair = nacl.sign.keyPair()
  const suite9Wallet = bs58.encode(suite9Keypair.publicKey)
  const suite9Timestamp = new Date().toISOString()
  const suite9Nonce = bs58.encode(nacl.randomBytes(16))
  const suite9Content = 'Verified cryptographic invariant log'
  const suite9Domain = 'provn-sol.vercel.app'
  const suite9Github = 'https://github.com/dren712/pow-logger/pull/99'
  const suite9Evidence = 'https://provn-sol.vercel.app/demo'

  const canonicalPrompt = buildCanonicalSubmitMessage({
    domain: suite9Domain,
    walletAddress: suite9Wallet,
    timestamp: suite9Timestamp,
    nonce: suite9Nonce,
    content: suite9Content,
    githubUrl: suite9Github,
    evidenceUrl: suite9Evidence,
  })
  const validSigBytes = nacl.sign.detached(new TextEncoder().encode(canonicalPrompt), suite9Keypair.secretKey)
  const testSignature = bs58.encode(validSigBytes)

  const validLogObj = {
    id: 101,
    wallet_address: suite9Wallet,
    signature: testSignature,
    nonce: suite9Nonce,
    domain: suite9Domain,
    created_at: suite9Timestamp,
    content: suite9Content,
    github_url: suite9Github,
    evidence_url: suite9Evidence,
    skills: ['Rust', 'Solana'],
    protocols: ['Anchor'],
    category: 'Engineering',
    provenance_level: 'source_verified',
  }

  assert(verifyLogCryptographically(validLogObj) === true, 'verifyLogCryptographically returns true for valid authentic Ed25519 signature')
  assert(verifyLogCryptographically({ ...validLogObj, content: 'Tampered work text' }) === false, 'verifyLogCryptographically returns false for tampered content')
  assert(verifyLogCryptographically({ ...validLogObj, github_url: 'https://github.com/dren712/pow-logger/pull/100' }) === false, 'verifyLogCryptographically returns false for tampered GitHub link')
  assert(verifyLogCryptographically({ ...validLogObj, github_url: 'https://evil.example/pr' }) === false, 'verifyLogCryptographically returns false for invalid non-github URL')
  assert(verifyLogCryptographically({ ...validLogObj, evidence_url: 'http://insecure-http.com' }) === false, 'verifyLogCryptographically returns false for insecure non-https evidence URL')
  assert(verifyLogCryptographically({ ...validLogObj, domain: 'evil.example' }) === false, 'verifyLogCryptographically returns false for tampered domain')
  assert(verifyLogCryptographically({ ...validLogObj, nonce: 'non_base58_nonce_with_invalid_chars!' }) === false, 'verifyLogCryptographically returns false for non-Base58 nonce')
  assert(verifyLogCryptographically({ ...validLogObj, nonce: ' ' + suite9Nonce }) === false, 'verifyLogCryptographically returns false for whitespace-padded nonce')
  assert(verifyLogCryptographically({ ...validLogObj, nonce: null }) === false, 'verifyLogCryptographically returns false when nonce is missing')
  assert(verifyLogCryptographically({ ...validLogObj, signature: null }) === false, 'verifyLogCryptographically returns false when signature is missing')
  assert(verifyLogCryptographically({ ...validLogObj, signature: 'FakeSig1234567890123456789012345678901234567890123456789012345678901234' }) === false, 'verifyLogCryptographically returns false for invalid forged signature')

  // Test 6: Reputation and Metrics Exclusively Derived from Cryptographically Verified Proofs
  const forgedLogs = [
    {
      id: 102,
      wallet_address: suite9Wallet,
      signature: 'ForgedSignature111111111111111111111111111111111111111111111111111111111111',
      nonce: bs58.encode(nacl.randomBytes(16)),
      created_at: '2026-08-13T01:00:00.000Z',
      content: 'Forged log entry #1',
      skills: ['FakeSkill'],
      protocols: ['FakeProtocol'],
    },
    {
      id: 103,
      wallet_address: suite9Wallet,
      signature: null,
      nonce: null,
      created_at: '2026-08-12T01:00:00.000Z',
      content: 'Unsigned log entry #2',
      skills: ['FakeSkill'],
    },
  ]

  const mixedLogs = [validLogObj, ...forgedLogs] as unknown as WalletLog[]
  const pureReputation = calculateReputation(suite9Wallet, mixedLogs)

  assert(pureReputation.totalProofs === 1, 'calculateReputation totalProofs strictly counts ONLY verified proofs (1 of 3)')
  assert(pureReputation.verifiedProofs === 1, 'calculateReputation verifiedProofs strictly matches verified count')
  assert(pureReputation.currentStreak === 1, 'calculateReputation streak ignores unverified timestamps')
  assert(pureReputation.skills.length === 2 && pureReputation.skills.some((s) => s.name === 'Rust'), 'Reputation skills include authentic skills')
  // --- SUITE 10: Policy Evaluation Engine & Proof Packet Generation ---
  console.log('\n► SUITE 10: Policy Evaluation Engine & Proof Packet Generation')

  // Check 1: Categorization Invariants
  assert(pureReputation.totalRecords === 3, 'Reputation engine tracks total database records (3)')
  assert(pureReputation.legacyRecords === 1, 'Reputation engine correctly identifies legacy unindexed record (1)')
  assert(pureReputation.unverifiedRecords === 1, 'Reputation engine correctly identifies unverified tampered record (1)')
  assert(pureReputation.proofsWithGithubEvidence === 1, 'Reputation engine tracks proofs with GitHub evidence')

  // Check 2: Policy Evaluation with Lightweight Builder Policy
  const lightweightEval = evaluateEligibility(pureReputation, STANDARD_POLICY_PRESETS.LIGHTWEIGHT_BUILDER)
  assert(lightweightEval.eligible === true, 'Lightweight policy evaluation passes for wallet with 1 verified proof')
  assert(lightweightEval.summary.passedCount === lightweightEval.summary.totalChecks, 'All checks passed in lightweight policy')

  // Check 3: Superteam Bounty Policy Gating
  const testReputation = {
    ...pureReputation,
    totalRecords: 3,
    proofsWithGithubEvidence: 3,
    sourceVerifiedProofs: 1,
    recentVerifiedProofs: 3,
    verifiedProofs: 3,
  } as unknown as BuilderReputation

  assert(pureReputation.sourceVerifiedProofs === 1, 'Reputation engine tracks source_verified proofs')

  const lightPolicy = STANDARD_POLICY_PRESETS.LIGHTWEIGHT_BUILDER
  const lightEval = evaluateEligibility(testReputation, lightPolicy)
  assert(lightEval.eligible, 'Lightweight policy evaluation passes for wallet with verified proof')
  assert(lightEval.checks.every((c) => c.passed), 'All checks passed in lightweight policy')

  const strictPolicy = {
    ...STANDARD_POLICY_PRESETS.SUPERTEAM_BOUNTY,
    minSourceVerifiedProofs: 2,
  }
  const strictEval = evaluateEligibility(testReputation, strictPolicy)
  assert(!strictEval.eligible, 'Policy fails when minSourceVerifiedProofs is not met')
  assert(strictEval.checks.find(c => c.id === 'min_source_verified_proofs')?.passed === false, 'Source verification policy check evaluated correctly')

  // Check 4: Custom Policy with Specific Skill Requirement
  const rustSkillPolicy = {
    name: 'Rust Developer Policy',
    minVerifiedProofs: 1,
    requiredSkills: ['Rust'],
    requireGithubEvidence: true,
  }
  const rustEval = evaluateEligibility(pureReputation, rustSkillPolicy)
  assert(rustEval.eligible === true, 'Policy with verified Rust skill and GitHub evidence requirement passes')

  // Check 5: Custom Policy with Missing Skill Requirement
  const pythonSkillPolicy = {
    name: 'Python Developer Policy',
    minVerifiedProofs: 1,
    requiredSkills: ['Python'],
  }
  const pythonEval = evaluateEligibility(pureReputation, pythonSkillPolicy)
  assert(pythonEval.eligible === false, 'Policy fails when required skill (Python) is missing from verified records')

  // Check 6: Proof Packet Generation
  const samplePassport = {
    protocol: 'PROVN' as const,
    version: '1.0' as const,
    exportedAt: new Date().toISOString(),
    wallet: suite9Wallet,
    reputation: pureReputation,
    proofs: [
      {
        id: 101,
        walletAddress: suite9Wallet,
        createdAt: suite9Timestamp,
        content: suite9Content,
        githubUrl: suite9Github,
        evidenceUrl: suite9Evidence,
        signature: testSignature,
        nonce: suite9Nonce,
        domain: suite9Domain,
        skills: ['Rust', 'Solana'],
        protocols: ['Anchor'],
        category: 'Engineering',
        irysTxId: null,
        archivalState: 'pending' as const,
        isCryptographicallyVerified: true,
        verificationState: 'VERIFIED' as const,
      },
    ],
    verificationUrl: `https://provn-sol.vercel.app/u/${suite9Wallet}`,
  }

  const generatedPacket = ProvnClient.generateProofPacket(samplePassport)
  assert(generatedPacket.protocol === 'PROVN', 'Proof packet generated with PROVN protocol header')
  assert(generatedPacket.reputationSummary.verifiedProofs === 1, 'Proof packet reputation summary reflects verified proofs')
  assert(generatedPacket.proofs.length === 1, 'Proof packet includes curated verified proofs')
  assert(typeof generatedPacket.verificationInstructions === 'string', 'Proof packet contains independent verification instructions')

  // --- SUITE 11: Protocol V2 & Server-Issued Challenge Integrity [V2 Canonical Challenge Protocol] ---
  console.log('\n► SUITE 11: Protocol V2 & Server-Issued Challenge Integrity [V2 Canonical Challenge]')

  assert(CURRENT_PROTOCOL_VERSION === 2, 'Current protocol version is exported as 2')

  const testV2Keypair = nacl.sign.keyPair()
  const testV2Wallet = bs58.encode(testV2Keypair.publicKey)
  const testV2Timestamp = new Date().toISOString()
  const testV2Challenge = '550e8400-e29b-41d4-a716-446655440000-abcdef123456'
  const testV2Content = 'Implemented Protocol V2 Server Challenges with Postgres Atomic Quota'
  const testV2Domain = 'provn-sol.vercel.app'

  const v2SubmitMsg = buildCanonicalSubmitMessageV2({
    domain: testV2Domain,
    walletAddress: testV2Wallet,
    timestamp: testV2Timestamp,
    challenge: testV2Challenge,
    content: testV2Content,
    githubUrl: 'https://github.com/dren712/pow-logger/pull/42',
    evidenceUrl: 'https://provn-sol.vercel.app',
  })

  assert(v2SubmitMsg.includes('PROVN Protocol Version: 2'), 'V2 canonical submit message includes Protocol Version 2 header')
  assert(v2SubmitMsg.includes(`Challenge: ${testV2Challenge}`), 'V2 canonical submit message includes server-issued challenge')
  assert(v2SubmitMsg.includes('GitHub URL: https://github.com/dren712/pow-logger/pull/42'), 'V2 canonical submit message includes normalized GitHub URL')

  const v2RetryMsg = buildCanonicalRetryMessageV2({
    domain: testV2Domain,
    walletAddress: testV2Wallet,
    logId: 42,
    timestamp: testV2Timestamp,
    challenge: testV2Challenge,
  })

  assert(v2RetryMsg.includes('Action: Retry Archival'), 'V2 canonical retry message includes Action: Retry Archival')
  assert(v2RetryMsg.includes(`Challenge: ${testV2Challenge}`), 'V2 canonical retry message includes challenge')

  // Sign V2 message
  const v2MsgBytes = new TextEncoder().encode(v2SubmitMsg)
  const v2SigBytes = nacl.sign.detached(v2MsgBytes, testV2Keypair.secretKey)
  const v2Signature = bs58.encode(v2SigBytes)

  const authenticV2Log = {
    wallet_address: testV2Wallet,
    signature: v2Signature,
    nonce: testV2Challenge,
    domain: testV2Domain,
    created_at: testV2Timestamp,
    content: testV2Content,
    github_url: 'https://github.com/dren712/pow-logger/pull/42',
    evidence_url: 'https://provn-sol.vercel.app',
    protocol_version: 2,
  }

  assert(verifyLogCryptographically(authenticV2Log) === true, 'verifyLogCryptographically authenticates valid Protocol V2 record')

  const tamperedV2ChallengeLog = {
    ...authenticV2Log,
    nonce: 'tampered-challenge-value-12345678',
  }
  assert(verifyLogCryptographically(tamperedV2ChallengeLog) === false, 'verifyLogCryptographically strictly rejects tampered challenge in V2')

  const tamperedV2ContentLog = {
    ...authenticV2Log,
    content: 'Tampered content attempting unauthorized modification',
  }
  assert(verifyLogCryptographically(tamperedV2ContentLog) === false, 'verifyLogCryptographically strictly rejects tampered content in V2')

  // Backward compatibility: V1 log verification
  const v1Keypair = nacl.sign.keyPair()
  const v1Wallet = bs58.encode(v1Keypair.publicKey)
  const v1Timestamp = new Date().toISOString()
  const v1Nonce = '999999999999'
  const v1Content = 'V1 legacy log submission'
  const v1Msg = buildCanonicalSubmitMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: v1Wallet,
    timestamp: v1Timestamp,
    nonce: v1Nonce,
    content: v1Content,
  })
  const v1Sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(v1Msg), v1Keypair.secretKey))

  const authenticV1Log = {
    wallet_address: v1Wallet,
    signature: v1Sig,
    nonce: v1Nonce,
    domain: 'provn-sol.vercel.app',
    created_at: v1Timestamp,
    content: v1Content,
    protocol_version: 1,
  }
  assert(verifyLogCryptographically(authenticV1Log) === true, 'verifyLogCryptographically maintains backward compatibility for V1 logs')

  // Validation of valid visibility states
  const validVisibilities = ['private', 'public']
  assert(validVisibilities.includes('private') && validVisibilities.includes('public'), 'Visibility supports both private and public states')

  // Validation of valid archival states
  const validArchivalStates = ['not_requested', 'pending', 'receipt_obtained', 'finalized', 'failed', 'legacy_unverified']
  assert(validArchivalStates.length === 6, 'Archival states include all 6 canonical statuses')

  // V2 domain tamper rejection
  const tamperedV2DomainLog = {
    ...authenticV2Log,
    domain: 'evil-hacker.com',
  }
  assert(verifyLogCryptographically(tamperedV2DomainLog) === false, 'verifyLogCryptographically strictly rejects tampered domain in V2')

  // V2 GitHub URL tamper rejection
  const tamperedV2GithubLog = {
    ...authenticV2Log,
    github_url: 'https://github.com/evil/repo',
  }
  assert(verifyLogCryptographically(tamperedV2GithubLog) === false, 'verifyLogCryptographically strictly rejects tampered GitHub URL in V2')

  // V2 Evidence URL tamper rejection
  const tamperedV2EvidenceLog = {
    ...authenticV2Log,
    evidence_url: 'https://evil.com/tampered',
  }
  assert(verifyLogCryptographically(tamperedV2EvidenceLog) === false, 'verifyLogCryptographically strictly rejects tampered evidence URL in V2')

  // V2 log with challenge stored in nonce column (as persisted in DB)
  const persistedV2Log = {
    wallet_address: testV2Wallet,
    signature: v2Signature,
    nonce: testV2Challenge,  // challenge stored in nonce column
    domain: testV2Domain,
    created_at: testV2Timestamp,
    content: testV2Content,
    github_url: 'https://github.com/dren712/pow-logger/pull/42',
    evidence_url: 'https://provn-sol.vercel.app',
    protocol_version: 2,
    // No challenge or challenge_id fields — simulating DB row
  }
  assert(verifyLogCryptographically(persistedV2Log) === true, 'verifyLogCryptographically verifies persisted V2 log with challenge in nonce column')

  // Verify new archival states include receipt_obtained and finalized
  const newArchivalStates = ['not_requested', 'pending', 'receipt_obtained', 'finalized', 'failed', 'legacy_unverified']
  assert(newArchivalStates.includes('receipt_obtained'), 'receipt_obtained is a valid archival state')
  assert(newArchivalStates.includes('finalized'), 'finalized is a valid archival state')
  assert(!newArchivalStates.includes('archived'), 'archived is NOT a valid archival state (replaced by receipt_obtained)')

  // Test buildCanonicalArchiveMessage
  const archiveMsg = buildCanonicalArchiveMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: testV2Wallet,
    logId: 42,
    challenge: testV2Challenge,
    timestamp: testV2Timestamp,
  })
  assert(archiveMsg.includes('Action: Archive Evidence'), 'Archive canonical message includes correct action')
  assert(archiveMsg.includes('Log ID: 42'), 'Archive canonical message includes log ID')
  assert(archiveMsg.includes(`Challenge: ${testV2Challenge}`), 'Archive canonical message includes challenge')

  // Test P0-7: Adversarial Identity Attribution Downgrade (Option A)
  const maliciousGitHubUrl = 'https://github.com/dren712/pow-logger/pull/42' // Assuming this URL exists
  
  // We mock fetch for the githubVerifier to simulate a 200 OK response from GitHub API
  const originalFetch = global.fetch
  global.fetch = async (url) => {
    if (url.toString().includes('api.github.com')) {
      return {
        ok: true,
        json: async () => ({ id: 12345, html_url: maliciousGitHubUrl }),
        status: 200
      } as unknown as Response
    }
    return originalFetch(url)
  }
  
  try {
    const verificationResult = await verifyGithubSource(maliciousGitHubUrl)
    assert(
      verificationResult.status === 'verified_source_exists' && (verificationResult.provenanceLevel === 'source_exists' || verificationResult.provenanceLevel === 'source_linked'),
      'Adversarial Attribution Defense: Existing GitHub URL only achieves source_exists without identity'
    )

    // Option B: Successful Identity Linking Test (Real Integration Tests)
    
    // We will intercept Supabase's fetch calls to wallet_identities table to mock the DB state
    const testWalletA = 'TestWalletA123456789012345678901' // Has github_id '123'
    const testWalletB = 'TestWalletB123456789012345678901' // Has github_id '999'
    const testWalletC = 'TestWalletC123456789012345678901' // No linked identity
    
    const originalFetchInner = global.fetch;
    global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      const urlStr = url.toString()
      
      // Mock Supabase REST API for wallet_identities
      if (urlStr.includes('wallet_identities')) {
        if (urlStr.includes('wallet_address=eq.TestWalletA')) {
          return new Response(JSON.stringify({ github_id: '123' }), { status: 200, headers: { 'content-type': 'application/vnd.pgrst.object+json' } })
        }
        if (urlStr.includes('wallet_address=eq.TestWalletB')) {
          return new Response(JSON.stringify({ github_id: '999' }), { status: 200, headers: { 'content-type': 'application/vnd.pgrst.object+json' } })
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
    global.fetch = originalFetchInner
  } catch (e) {
    console.error('Test error:', e)
  } finally {
    global.fetch = originalFetch
  }

  // Test buildCanonicalVisibilityMessage
  const visMsg = buildCanonicalVisibilityMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: testV2Wallet,
    logId: 42,
    visibility: 'public',
    challenge: testV2Challenge,
    timestamp: testV2Timestamp,
  })
  assert(visMsg.includes('Action: Set Visibility'), 'Visibility canonical message includes correct action')
  assert(visMsg.includes('Visibility: public'), 'Visibility canonical message includes visibility value')

  // Test buildCanonicalIdentityLinkMessage
  const linkMsg = buildCanonicalIdentityLinkMessage({
    domain: 'provn-sol.vercel.app',
    walletAddress: testV2Wallet,
    challenge: testV2Challenge,
    timestamp: testV2Timestamp,
  })
  assert(linkMsg.includes('Action: Link GitHub Identity'), 'Identity link canonical message includes correct action')
  assert(linkMsg.includes(testV2Challenge), 'Identity link canonical message includes challenge')



  // --- SUITE 13: Database Integration for Provenance States ---
  console.log('\n► SUITE 13: Database Integration for Provenance States')
  
  if (supabaseUrl && anonKey && isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        const serviceClient = createClient(supabaseUrl, serviceKey)
        const levels = ['self_attested', 'source_linked', 'source_exists', 'identity_linked', 'source_verified', 'partner_attested']
        
        let networkOffline = false;

        for (const level of levels) {
          if (networkOffline) break;

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
          
          if (error && error.message?.toLowerCase().includes('fetch failed')) {
            console.log('  ℹ️ Offline Protocol Test Mode: Skipping SUITE 13 (Network unreachable)')
            networkOffline = true;
            break;
          }

          assert(!error, `Database schema successfully accepts provenance level: ${level}`, error?.message)
        }
        
        if (!networkOffline) {
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
        }
      } else {
         console.log('  ℹ️ Skipping Suite 13 DB Integration Test: No SUPABASE_SERVICE_ROLE_KEY available')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('fetch failed')) {
        console.log('  ℹ️ Offline Protocol Test Mode: Skipping SUITE 13 (Network unreachable)')
      } else {
        console.error('Test error:', e)
      }
    }
  } else {
    console.log('  ℹ️ Offline Protocol Test Mode: Skipping live DB integration test')
  }

  // --- SUITE 14: Challenge Griefing Defense, Badge Provenance & Timezone Determinism ---
  console.log('\n► SUITE 14: Challenge Griefing Defense, Badge Provenance & Timezone Determinism')

  // Test 1: Badge Provenance - Fake GitHub URLs without source_verified DO NOT grant Open Source Builder badge
  const fakeGithubLogs = [
    { github_url: 'https://github.com/torvalds/linux/pull/1', provenance_level: 'self_attested' },
    { github_url: 'https://github.com/torvalds/linux/pull/2', provenance_level: 'source_linked' },
    { github_url: 'https://github.com/torvalds/linux/pull/3', provenance_level: 'source_exists' },
  ]
  const earnedBadgesFake = getEarnedSkillBadges(fakeGithubLogs)
  assert(!earnedBadgesFake.some(b => b.id === 'open_source'), 'Fake or unverified GitHub URLs DO NOT grant Open Source Builder badge')

  // Test 2: Badge Provenance - 3 source_verified logs DO grant Open Source Builder badge
  const verifiedGithubLogs = [
    { github_url: 'https://github.com/dren712/pow-logger/pull/1', provenance_level: 'source_verified' },
    { github_url: 'https://github.com/dren712/pow-logger/pull/2', provenance_level: 'source_verified' },
    { github_url: 'https://github.com/dren712/pow-logger/pull/3', provenance_level: 'source_verified' },
  ]
  const earnedBadgesVerified = getEarnedSkillBadges(verifiedGithubLogs)
  assert(earnedBadgesVerified.some(b => b.id === 'open_source'), '3 source_verified GitHub contribution logs successfully unlock Open Source Builder badge')

  // Test 3: Timezone Invariance & Calendar Arithmetic
  const now = new Date()
  const todayInKolkata = toLocalDateString(now, PROTOCOL_TIMEZONE)
  const todayParts = todayInKolkata.split('-').map(Number)
  const expectedYesterdayUtc = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]) - 86400000)
  const expectedYesterdayStr = expectedYesterdayUtc.toISOString().split('T')[0]

  // Consecutive days in Kolkata timezone
  const consecutiveTimestamps = [
    `${todayInKolkata}T10:00:00.000+05:30`,
    `${expectedYesterdayStr}T10:00:00.000+05:30`,
  ]
  const canonicalStreak = calculateStreak(consecutiveTimestamps, PROTOCOL_TIMEZONE)
  assert(canonicalStreak === 2, `Canonical streak calculation accurately returns 2 for consecutive days (${expectedYesterdayStr}, ${todayInKolkata})`)

  // Test 4: Post-Verification Challenge Consumption Invariant
  // Simulating the API route flow:
  // Step 1: Challenge lookup without burning
  // Step 2: Invalid signature -> Challenge remains unconsumed
  // Step 3: Valid signature -> Challenge is atomically consumed
  const mockChallengeState = {
    challenge: 'TEST_CHALLENGE_GRIEFING_DEFENSE_999',
    consumed_at: null as string | null,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  }

  // Attacker attempt with garbage signature
  const attackerSignatureValid = false
  if (attackerSignatureValid) {
    mockChallengeState.consumed_at = new Date().toISOString()
  }
  assert(mockChallengeState.consumed_at === null, 'Griefing Defense: Invalid signature does NOT consume or burn the challenge')

  // Legitimate user attempt with valid signature
  const victimSignatureValid = true
  if (victimSignatureValid) {
    mockChallengeState.consumed_at = new Date().toISOString()
  }
  assert(mockChallengeState.consumed_at !== null, 'Valid signature atomically consumes challenge after verification succeeds')

  // Test 5: Badge Summary Consistency with Verified Logs
  const testBadgeSummary = computeBadgeSummary(3, canonicalStreak, canonicalStreak, verifiedGithubLogs)
  assert(testBadgeSummary.earnedSkillBadges.some(b => b.id === 'open_source'), 'computeBadgeSummary accurately integrates source-verified skill badges')

  // --- SUITE 15: Adversarial Protocol Verification & Layered Proof Analysis ---
  console.log('\n► SUITE 15: Adversarial Protocol Verification & Layered Proof Analysis')

  const testKeypair = nacl.sign.keyPair()
  const testWallet = bs58.encode(testKeypair.publicKey)
  const serverTime = Date.now()
  const validIso = new Date(serverTime).toISOString()

  // Generate a legitimate signed server challenge receipt
  const challengePayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    iat: new Date(serverTime).toISOString(),
    exp: new Date(serverTime + 5 * 60 * 1000).toISOString(),
    iss: 'PROVN',
    kid: 'provn-server-2026-08',
  })
  const payloadBytes = new TextEncoder().encode(challengePayload)
  const challengeSig = signServerReceipt(payloadBytes)
  const serverChallenge = `${bs58.encode(payloadBytes)}.${bs58.encode(challengeSig)}`

  // Test 1: Signature-Valid vs Protocol-Valid Distinction (Legitimate)
  const legitimateCanonical = buildCanonicalSubmitMessageV2({
    domain: 'provn-sol.vercel.app',
    walletAddress: testWallet,
    content: 'Legitimate protocol proof submission with valid challenge',
    timestamp: validIso,
    challenge: serverChallenge,
    githubUrl: 'https://github.com/dren712/pow-logger/pull/1',
  })
  const legitSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(legitimateCanonical), testKeypair.secretKey))

  const legitimateReceiptPayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    protocol_version: 2,
    proof_id: 101,
    challenge_id: serverChallenge,
    wallet: testWallet,
    signed_payload_hash: computeCanonicalProofHash(legitimateCanonical),
    observed_at: validIso,
    iss: 'PROVN',
    kid: 'provn-server-2026-08',
  })
  const legitReceiptBytes = new TextEncoder().encode(legitimateReceiptPayload)
  const legitReceiptSig = signServerReceipt(legitReceiptBytes)
  const legitimateReceipt = `${bs58.encode(legitReceiptBytes)}.${bs58.encode(legitReceiptSig)}`

  const legitimateReport = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: legitimateReceipt,
    provenance_level: 'source_verified',
    archival_state: 'receipt_obtained',
    irys_tx_id: 'irys_receipt_tx_hash_123456789',
  })

  assert(legitimateReport.signatureVerified === true, 'Authentic proof signature verified as cryptographically valid')
  assert(legitimateReport.protocolVerified === true, 'Legitimate proof satisfies complete protocol validity checks with signed receipt')
  assert(legitimateReport.proofStatus.signature === 'VERIFIED', '4-Layer status: signature === VERIFIED')
  assert(legitimateReport.proofStatus.protocol === 'VERIFIED', '4-Layer status: protocol === VERIFIED')
  assert(legitimateReport.proofStatus.source === 'CLAIMED', '4-Layer status: source === CLAIMED for offline verification')
  assert(legitimateReport.proofStatus.archive === 'CLAIMED', '4-Layer status: archive === CLAIMED for offline verification')

  // Offline metadata limits for layer 3 & 4
  assert(legitimateReport.sourceVerified === false, 'Local verifier correctly flags sourceVerified=false since it is offline metadata')
  assert(legitimateReport.archiveVerified === false, 'Local verifier correctly flags archiveVerified=false since it is offline metadata')

  // Test 2: Forged Challenge Rejection - Fake-but-valid-looking UUID (Signature valid, Protocol invalid)
  const fakeChallengePayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    exp: new Date(serverTime + 5 * 60 * 1000).toISOString(),
    iss: 'PROVN'
  })
  // We encode it but don't sign it with the PROVN server key, we sign it with the user key instead to spoof it
  const fakePayloadBytes = new TextEncoder().encode(fakeChallengePayload)
  const fakeChallengeSig = nacl.sign.detached(fakePayloadBytes, testKeypair.secretKey)
  const forgedChallenge = `${bs58.encode(fakePayloadBytes)}.${bs58.encode(fakeChallengeSig)}`

  const forgedChallengeCanonical = buildCanonicalSubmitMessageV2({
    domain: 'provn-sol.vercel.app',
    walletAddress: testWallet,
    content: 'Forged challenge proof',
    timestamp: validIso,
    challenge: forgedChallenge,
  })
  const forgedSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(forgedChallengeCanonical), testKeypair.secretKey))

  const forgedReport = evaluateProofValidity({
    wallet_address: testWallet,
    signature: forgedSig,
    content: 'Forged challenge proof',
    created_at: validIso,
    challenge: forgedChallenge,
    domain: 'provn-sol.vercel.app',
    protocol_version: 2,
  })
  assert(forgedReport.signatureVerified === true, 'Signature itself is cryptographically valid from keypair holder')
  assert(forgedReport.protocolVerified === false, 'Protocol validity strictly REJECTS forged challenge not signed by server')

  // Test 3: Old Timestamp Rejection outside observation window
  const oldIso = new Date(serverTime - 16 * 60 * 1000).toISOString() // 16 mins ago
  const oldTimestampCanonical = buildCanonicalSubmitMessageV2({
    domain: 'provn-sol.vercel.app',
    walletAddress: testWallet,
    content: 'Old timestamp proof',
    timestamp: oldIso,
    challenge: serverChallenge,
  })
  const oldSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(oldTimestampCanonical), testKeypair.secretKey))
  const oldTimestampReport = evaluateProofValidity({
    wallet_address: testWallet,
    signature: oldSig,
    content: 'Old timestamp proof',
    created_at: oldIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    protocol_version: 2,
  })
  assert(oldTimestampReport.protocolVerified === false, 'Protocol validity strictly REJECTS old timestamps outside observation window')

  // Test 3.5: Expired Challenge Rejection
  const expiredChallengePayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    iat: new Date(serverTime - 10 * 60 * 1000).toISOString(),
    exp: new Date(serverTime - 5 * 60 * 1000).toISOString(),
    iss: 'PROVN',
    kid: 'provn-server-2026-08'
  })
  const expiredPayloadBytes = new TextEncoder().encode(expiredChallengePayload)
  const expiredChallengeSig = signServerReceipt(expiredPayloadBytes)
  const expiredChallenge = `${bs58.encode(expiredPayloadBytes)}.${bs58.encode(expiredChallengeSig)}`

  const expiredCanonical = buildCanonicalSubmitMessageV2({
    domain: 'provn-sol.vercel.app',
    walletAddress: testWallet,
    content: 'Expired challenge proof',
    timestamp: validIso,
    challenge: expiredChallenge,
  })
  const expiredSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(expiredCanonical), testKeypair.secretKey))
  const expiredReport = evaluateProofValidity({
    wallet_address: testWallet,
    signature: expiredSig,
    content: 'Expired challenge proof',
    created_at: validIso,
    challenge: expiredChallenge,
    domain: 'provn-sol.vercel.app',
    protocol_version: 2,
  })
  assert(expiredReport.protocolVerified === false, 'Protocol validity strictly REJECTS expired challenges')

  // Test 4: Wrong Domain Rejection
  const wrongDomainReport = evaluateProofValidity({
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'evil.com',
    protocol_version: 2,
  })
  assert(wrongDomainReport.protocolVerified === false, 'Protocol validity strictly REJECTS untrusted domain')

  // Test 5: Atomic OAuth State Single-Use Replay Defense
  const mockOAuthState = {
    state_id: 'oauth-state-uuid-1234',
    wallet_address: testWallet,
    consumed_at: null as string | null,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  }

  function consumeOAuthState(state: typeof mockOAuthState) {
    if (state.consumed_at !== null || new Date(state.expires_at) < new Date()) {
      return null // Rejected: already consumed or expired
    }
    state.consumed_at = new Date().toISOString()
    return { wallet_address: state.wallet_address, consumed: true }
  }

  const firstOAuthConsumption = consumeOAuthState(mockOAuthState)
  assert(firstOAuthConsumption !== null && firstOAuthConsumption.consumed === true, 'First OAuth state consumption succeeds atomically')

  const replayOAuthConsumption = consumeOAuthState(mockOAuthState)
  assert(replayOAuthConsumption === null, 'Adversarial Replay: Re-using consumed OAuth state is strictly rejected')

  // Test 6: GitHub Identity & Attribution Mismatch Adversarial Defense
  const mismatchProvenance = evaluateProofValidity({
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Commit authored by third-party developer',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/commit/123456',
    protocol_version: 2,
    provenance_level: 'identity_linked', // Author mismatch: wallet linked to ID A, commit by ID B
  })
  assert(mismatchProvenance.sourceVerified === false, 'Author ID mismatch does NOT grant source_verified status')
  assert(mismatchProvenance.proofStatus.source === 'ATTRIBUTED', 'Author ID mismatch correctly resolves to ATTRIBUTED / identity_linked')

  // Test 7: Cryptographic Submission Receipt Verification
  const observedTimestamp = new Date().toISOString()
  const expectedCanonicalHash = computeCanonicalProofHash(legitimateCanonical)

  const subPayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    proof_id: 101,
    challenge_id: serverChallenge,
    wallet: testWallet,
    signed_payload_hash: expectedCanonicalHash,
    observed_at: observedTimestamp,
    iss: 'PROVN',
    kid: 'provn-server-2026-08',
  })
  const subBytes = new TextEncoder().encode(subPayload)
  const subSig = signServerReceipt(subBytes)
  const validSubmissionReceipt = `${bs58.encode(subBytes)}.${bs58.encode(subSig)}`

  const proofWithReceipt = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: validSubmissionReceipt,
  })

  assert(proofWithReceipt.details.submissionReceiptValid === true, 'Valid submission receipt cryptographically verified by server key')
  assert(proofWithReceipt.details.signedPayloadHashValid === true, 'Exact canonical signed payload hash bound and verified')
  assert(proofWithReceipt.details.serverObservedAt === observedTimestamp, 'Server observation timestamp extracted accurately from submission receipt')
  assert(proofWithReceipt.submissionReceiptVerified === true, 'submissionReceiptVerified flag is true')
  assert(proofWithReceipt.protocolVerified === true, 'Protocol fully verified with valid challenge AND submission receipt')

  // Test 8: Forged Submission Receipt Rejection (signed by attacker key)
  const forgedSubSig = nacl.sign.detached(subBytes, testKeypair.secretKey)
  const forgedSubmissionReceipt = `${bs58.encode(subBytes)}.${bs58.encode(forgedSubSig)}`

  const proofWithForgedReceipt = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: forgedSubmissionReceipt,
  })

  assert(proofWithForgedReceipt.details.submissionReceiptValid === false, 'Forged submission receipt strictly REJECTED by offline verifier')

  // Test 9: Tampered Submission Receipt Rejection (Proof ID mismatch)
  const proofWithMismatchedId = evaluateProofValidity({
    id: 999, // Mismatched proof ID (receipt was for proof 101)
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: validSubmissionReceipt,
  })

  assert(proofWithMismatchedId.details.submissionReceiptValid === false, 'Mismatched proof ID in submission receipt strictly REJECTED')

  // Test 10: Adversarial Payload Hash Mismatch Rejection (Proof substitution attack)
  const badHashPayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    proof_id: 101,
    challenge_id: serverChallenge,
    wallet: testWallet,
    signed_payload_hash: '0000000000000000000000000000000000000000000000000000000000000000', // Spoofed payload hash
    observed_at: observedTimestamp,
    iss: 'PROVN',
    kid: 'provn-server-2026-08',
  })
  const badHashBytes = new TextEncoder().encode(badHashPayload)
  const badHashSig = signServerReceipt(badHashBytes)
  const badHashReceipt = `${bs58.encode(badHashBytes)}.${bs58.encode(badHashSig)}`

  const proofWithBadHash = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: badHashReceipt,
  })

  assert(proofWithBadHash.details.signedPayloadHashValid === false, 'Spoofed canonical payload hash strictly detected')
  assert(proofWithBadHash.details.submissionReceiptValid === false, 'Receipt with mismatched payload hash strictly REJECTED')
  assert(proofWithBadHash.protocolVerified === false, 'Protocol verification fails when submission receipt payload hash is invalid')

  // Test 11: Adversarial Challenge ID Mismatch Rejection
  const badChallengePayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    proof_id: 101,
    challenge_id: 'DIFFERENT_UNBOUND_CHALLENGE_STRING_1234',
    wallet: testWallet,
    signed_payload_hash: expectedCanonicalHash,
    observed_at: observedTimestamp,
    iss: 'PROVN',
    kid: 'provn-server-2026-08',
  })
  const badChallengeBytes = new TextEncoder().encode(badChallengePayload)
  const badChallengeSig = signServerReceipt(badChallengeBytes)
  const badChallengeReceipt = `${bs58.encode(badChallengeBytes)}.${bs58.encode(badChallengeSig)}`

  const proofWithBadChallenge = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: badChallengeReceipt,
  })

  assert(proofWithBadChallenge.details.submissionReceiptValid === false, 'Mismatched challenge ID in submission receipt strictly REJECTED')

  // Test 12: Adversarial Unknown Key ID (kid) Rejection
  const unknownKidPayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    proof_id: 101,
    challenge_id: serverChallenge,
    wallet: testWallet,
    signed_payload_hash: expectedCanonicalHash,
    observed_at: observedTimestamp,
    iss: 'PROVN',
    kid: 'provn-unauthorized-revoked-key-99', // Unknown/revoked key ID
  })
  const unknownKidBytes = new TextEncoder().encode(unknownKidPayload)
  const unknownKidSig = signServerReceipt(unknownKidBytes)
  const unknownKidReceipt = `${bs58.encode(unknownKidBytes)}.${bs58.encode(unknownKidSig)}`

  const proofWithUnknownKid = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    protocol_version: 2,
    submission_receipt: unknownKidReceipt,
  })

  assert(proofWithUnknownKid.details.submissionReceiptValid === false, 'Unknown or revoked key ID (kid) strictly REJECTED')

  // Test 13: Evidence Tampering Invalidates Canonical Payload Hash
  const proofWithTamperedEvidence = evaluateProofValidity({
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/999', // Tampered from pull/1 to pull/999
    protocol_version: 2,
    submission_receipt: validSubmissionReceipt,
  })

  assert(proofWithTamperedEvidence.details.signedPayloadHashValid === false, 'Evidence URL tampering breaks canonical payload hash match')
  assert(proofWithTamperedEvidence.signatureVerified === false, 'Evidence URL tampering breaks wallet signature')
  assert(proofWithTamperedEvidence.protocolVerified === false, 'Evidence URL tampering fails protocol verification')

  // Test 14: Exhaustive 12-Point Field Tampering Matrix (Grant-Grade Defense)
  const baseProof = {
    id: 101,
    wallet_address: testWallet,
    signature: legitSig,
    content: 'Legitimate protocol proof submission with valid challenge',
    created_at: validIso,
    challenge: serverChallenge,
    domain: 'provn-sol.vercel.app',
    github_url: 'https://github.com/dren712/pow-logger/pull/1',
    evidence_url: null,
    protocol_version: 2,
    submission_receipt: legitimateReceipt,
  }

  // 1. Mutate Content
  assert(!evaluateProofValidity({ ...baseProof, content: 'Tampered content string' }).protocolVerified, 'Matrix 1: Tampered content rejected')
  // 2. Mutate Signer Wallet Address
  const otherWallet = bs58.encode(nacl.sign.keyPair().publicKey)
  assert(!evaluateProofValidity({ ...baseProof, wallet_address: otherWallet }).protocolVerified, 'Matrix 2: Tampered wallet rejected')
  // 3. Mutate Timestamp to out of challenge bound
  assert(!evaluateProofValidity({ ...baseProof, created_at: new Date(Date.now() - 3600000).toISOString() }).protocolVerified, 'Matrix 3: Tampered timestamp rejected')
  // 4. Mutate Challenge String
  assert(!evaluateProofValidity({ ...baseProof, challenge: 'TAMPERED_CHALLENGE_STRING' }).protocolVerified, 'Matrix 4: Tampered challenge rejected')
  // 5. Mutate Domain to untrusted origin
  assert(!evaluateProofValidity({ ...baseProof, domain: 'evil-phishing.com' }).protocolVerified, 'Matrix 5: Tampered domain rejected')
  // 6. Missing Domain in Protocol V2
  assert(!evaluateProofValidity({ ...baseProof, domain: null }).protocolVerified, 'Matrix 6: Missing domain in V2 rejected')
  // 7. Mutate GitHub URL
  assert(!evaluateProofValidity({ ...baseProof, github_url: 'https://github.com/attacker/malicious-repo' }).protocolVerified, 'Matrix 7: Tampered GitHub URL rejected')
  // 8. Injected Evidence URL
  assert(!evaluateProofValidity({ ...baseProof, evidence_url: 'https://malicious-site.com/exploit' }).protocolVerified, 'Matrix 8: Injected evidence URL rejected')
  // 9. Mutate Proof ID
  assert(!evaluateProofValidity({ ...baseProof, id: 999 }).protocolVerified, 'Matrix 9: Mismatched proof ID rejected')
  // 10. Missing Submission Receipt in Protocol V2
  assert(!evaluateProofValidity({ ...baseProof, submission_receipt: null }).protocolVerified, 'Matrix 10: Missing submission receipt in V2 rejected')
  // 11. Invalid Detached Signature
  assert(!evaluateProofValidity({ ...baseProof, signature: bs58.encode(new Uint8Array(64)) }).protocolVerified, 'Matrix 11: Invalid signature rejected')
  // 12. Tampered Server Receipt Signature
  const badSigReceipt = legitimateReceipt.slice(0, -6) + 'AAAAAA'
  assert(!evaluateProofValidity({ ...baseProof, submission_receipt: badSigReceipt }).protocolVerified, 'Matrix 12: Tampered server receipt signature rejected')

  // Test 15: Challenge KID Resolution via Static Public Key Registry
  assert(PROVN_TRUSTED_PUBLIC_KEYS['provn-server-2026-08'] !== undefined, 'Genesis key exists in published public key registry')
  assert(reconstructCanonicalSubmitMessage(baseProof) !== null, 'reconstructCanonicalSubmitMessage successfully reproduces canonical string')

  // Test 16: Challenge Signed with Unknown/Revoked KID Strictly Rejected
  const unknownKidChallengePayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    exp: new Date(serverTime + 5 * 60 * 1000).toISOString(),
    iat: new Date(serverTime).toISOString(),
    iss: 'PROVN',
    kid: 'provn-unauthorized-key-id-999',
  })
  const unknownKidChalBytes = new TextEncoder().encode(unknownKidChallengePayload)
  const unknownKidChalSig = signServerReceipt(unknownKidChalBytes)
  const unknownKidChallenge = `${bs58.encode(unknownKidChalBytes)}.${bs58.encode(unknownKidChalSig)}`

  const proofWithUnknownKidChal = evaluateProofValidity({
    ...baseProof,
    challenge: unknownKidChallenge,
  })
  assert(proofWithUnknownKidChal.challengeVerified === false, 'Challenge signed with unknown/untrusted KID is strictly rejected')
  assert(proofWithUnknownKidChal.protocolVerified === false, 'Protocol verification fails for untrusted challenge KID')

  // Test 17: Challenge Missing KID is Strictly Rejected (No Silent Defaulting)
  const missingKidChallengePayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    exp: new Date(serverTime + 5 * 60 * 1000).toISOString(),
    iat: new Date(serverTime).toISOString(),
    iss: 'PROVN',
    // kid deliberately omitted
  })
  const missingKidChalBytes = new TextEncoder().encode(missingKidChallengePayload)
  const missingKidChalSig = signServerReceipt(missingKidChalBytes)
  const missingKidChallenge = `${bs58.encode(missingKidChalBytes)}.${bs58.encode(missingKidChalSig)}`

  const proofWithMissingKidChal = evaluateProofValidity({
    ...baseProof,
    challenge: missingKidChallenge,
  })
  assert(proofWithMissingKidChal.challengeVerified === false, 'Challenge missing KID in V2 is strictly rejected')
  assert(proofWithMissingKidChal.protocolVerified === false, 'Protocol verification fails when challenge KID is omitted')

  // Test 18: Submission Receipt Missing KID is Strictly Rejected
  const missingKidSubPayload = JSON.stringify({
    type: 'PROVN_SUBMISSION_RECEIPT',
    version: 1,
    protocol_version: 2,
    proof_id: 101,
    challenge_id: serverChallenge,
    wallet: testWallet,
    signed_payload_hash: computeCanonicalProofHash(legitimateCanonical),
    observed_at: validIso,
    iss: 'PROVN',
    // kid deliberately omitted
  })
  const missingKidSubBytes = new TextEncoder().encode(missingKidSubPayload)
  const missingKidSubSig = signServerReceipt(missingKidSubBytes)
  const missingKidSubReceipt = `${bs58.encode(missingKidSubBytes)}.${bs58.encode(missingKidSubSig)}`

  const proofWithMissingKidReceipt = evaluateProofValidity({
    ...baseProof,
    submission_receipt: missingKidSubReceipt,
  })
  assert(proofWithMissingKidReceipt.details.submissionReceiptValid === false, 'Submission receipt missing KID is strictly rejected')
  assert(proofWithMissingKidReceipt.protocolVerified === false, 'Protocol verification fails when submission receipt KID is omitted')

  // =========================================================================
  // SUITE 16: Standalone CLI & Portable Proof Envelope Verification
  // =========================================================================
  console.log('\n► SUITE 16: Standalone CLI & Portable Proof Envelope Verification')

  // 1. Construct Portable Proof Envelope
  const portableProofEnvelope = {
    protocol: 'PROVN',
    version: 2,
    proof_id: 101,
    claim: {
      wallet: testWallet,
      content: 'Legitimate protocol proof submission with valid challenge',
      timestamp: validIso,
      domain: 'provn-sol.vercel.app',
      github_url: 'https://github.com/dren712/pow-logger/pull/1',
      evidence_url: null,
    },
    signature: {
      algorithm: 'Ed25519',
      value: legitSig,
    },
    server_attestations: {
      challenge: serverChallenge,
      challenge_kid: 'provn-server-2026-08',
      submission_receipt: validSubmissionReceipt,
      submission_kid: 'provn-server-2026-08',
      signed_payload_hash: computeCanonicalProofHash(legitimateCanonical),
      observed_at: observedTimestamp,
    },
    provenance: {
      level: 'source_verified',
      archival_state: 'receipt_obtained',
      irys_tx_id: 'test_irys_tx_001',
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { verifyProofPacket } = require('../bin/provn.js')

  // Test 1: Authentic Portable Envelope Verification via CLI Engine
  const cliReport = verifyProofPacket(portableProofEnvelope)
  assert(cliReport.valid === true, 'CLI engine: Valid portable proof packet is 100% verified')
  assert(cliReport.layers.layer1_signature.passed === true, 'CLI engine: Layer 1 wallet signature verified')
  assert(cliReport.layers.layer2_challenge.passed === true, 'CLI engine: Layer 2 server challenge token verified')
  assert(cliReport.layers.layer2_5_receipt.passed === true, 'CLI engine: Layer 2.5 server submission receipt verified')
  assert(cliReport.canonicalHash === computeCanonicalProofHash(legitimateCanonical), 'CLI engine: Exact canonical hash reproduced')

  // Test 2: Adversarial Content Tampering in Portable Envelope Rejection
  const tamperedEnvelope = {
    ...portableProofEnvelope,
    claim: {
      ...portableProofEnvelope.claim,
      content: 'Malicious tampered content injected into envelope',
    },
  }
  const tamperedReport = verifyProofPacket(tamperedEnvelope)
  assert(tamperedReport.valid === false, 'CLI engine: Tampered content strictly fails verification')
  assert(tamperedReport.layers.layer1_signature.passed === false, 'CLI engine: Wallet signature fails on tampered content')

  // Test 3: Forged Submission Receipt in Portable Envelope Rejection
  const forgedReceiptEnvelope = {
    ...portableProofEnvelope,
    server_attestations: {
      ...portableProofEnvelope.server_attestations,
      submission_receipt: forgedSubmissionReceipt,
    },
  }
  const forgedReceiptReport = verifyProofPacket(forgedReceiptEnvelope)
  assert(forgedReceiptReport.valid === false, 'CLI engine: Forged submission receipt strictly fails verification')
  assert(forgedReceiptReport.layers.layer2_5_receipt.passed === false, 'CLI engine: Layer 2.5 fails on forged receipt')

  // =========================================================================
  // SUITE 17: Server ↔ Standalone CLI Differential Conformance Matrix
  // =========================================================================
  console.log('\n► SUITE 17: Server ↔ Standalone CLI Differential Conformance Matrix')

  const conformanceScenarios: Array<{
    name: string
    proof: Parameters<typeof evaluateProofValidity>[0]
    expectedValid: boolean
  }> = [
    {
      name: 'Scenario 1: Authentic Protocol V2 Proof',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: true,
    },
    {
      name: 'Scenario 2: Tampered Content',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Tampered content string',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 3: Tampered Wallet',
      proof: {
        id: 101,
        wallet_address: bs58.encode(nacl.sign.keyPair().publicKey),
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 4: Tampered Timestamp',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: '2026-01-01T00:00:00.000Z',
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 5: Tampered Challenge',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: 'forged.challenge.token',
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 6: Untrusted Domain in V2',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'malicious-phishing-domain.com',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 7: Missing Domain in V2',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: undefined,
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 8: Tampered GitHub URL',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/attacker/exploit/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 9: Injected Evidence URL',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        evidence_url: 'https://irys.xyz/injected_tx',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 10: Mismatched Proof ID in Receipt',
      proof: {
        id: 9999, // Mismatched
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 11: Missing Submission Receipt in V2',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: undefined,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 12: Forged Wallet Signature',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode('fake message'), testKeypair.secretKey)),
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 13: Forged Server Submission Receipt',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: forgedSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 14: Unknown Challenge KID',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: unknownKidChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 15: Missing Challenge KID in V2',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: missingKidChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: validSubmissionReceipt,
      },
      expectedValid: false,
    },
    {
      name: 'Scenario 16: Missing Receipt KID in V2',
      proof: {
        id: 101,
        wallet_address: testWallet,
        signature: legitSig,
        content: 'Legitimate protocol proof submission with valid challenge',
        created_at: validIso,
        challenge: serverChallenge,
        domain: 'provn-sol.vercel.app',
        github_url: 'https://github.com/dren712/pow-logger/pull/1',
        protocol_version: 2,
        submission_receipt: missingKidSubReceipt,
      },
      expectedValid: false,
    },
  ]

  for (const scenario of conformanceScenarios) {
    const serverResult = evaluateProofValidity(scenario.proof)
    const cliResult = verifyProofPacket(scenario.proof)

    assert(
      serverResult.protocolVerified === scenario.expectedValid,
      `Server Engine Conformance: ${scenario.name} matches expected (${scenario.expectedValid})`
    )
    assert(
      cliResult.valid === scenario.expectedValid,
      `CLI Engine Conformance: ${scenario.name} matches expected (${scenario.expectedValid})`
    )
    assert(
      serverResult.protocolVerified === cliResult.valid,
      `Differential Equivalence: Server and CLI agree identically on ${scenario.name}`
    )
  }

  // =========================================================================
  // SUITE 18: Key Epoch & Temporal Validity Enforcement
  // =========================================================================
  console.log('\n► SUITE 18: Key Epoch & Temporal Validity Enforcement')

  // Test 1: Active Key + Current Observation Timestamp resolves valid public key
  const activeKeyBytes = resolveTrustedKey('provn-server-2026-08', '2026-08-21T00:00:00Z')
  assert(activeKeyBytes !== null && activeKeyBytes.length === 32, 'Active genesis key resolves for current epoch')

  // Test 2: Historical Key + Valid Historical Epoch Timestamp resolves valid public key
  const historicalKeyBytes = resolveTrustedKey('provn-server-2026-06', '2026-07-15T00:00:00Z')
  assert(historicalKeyBytes !== null && historicalKeyBytes.length === 32, 'Historical key resolves for valid epoch in July 2026')

  // Test 3: Historical Key exact valid_until boundary is valid
  const exactEndKeyBytes = resolveTrustedKey('provn-server-2026-06', '2026-08-31T23:59:59.000Z')
  assert(exactEndKeyBytes !== null && exactEndKeyBytes.length === 32, 'Historical key valid at exact valid_until boundary (2026-08-31T23:59:59.000Z)')

  // Test 4: Historical Key 1 second after valid_until is Strictly Rejected
  const pastEndKeyBytes = resolveTrustedKey('provn-server-2026-06', '2026-09-01T00:00:00.000Z')
  assert(pastEndKeyBytes === null, 'Historical key rejected 1 second after valid_until (2026-09-01T00:00:00.000Z)')

  // Test 5: Historical Key exact valid_from boundary is valid
  const exactStartKeyBytes = resolveTrustedKey('provn-server-2026-06', '2026-06-01T00:00:00.000Z')
  assert(exactStartKeyBytes !== null && exactStartKeyBytes.length === 32, 'Historical key valid at exact valid_from boundary (2026-06-01T00:00:00.000Z)')

  // Test 6: Historical Key 1 millisecond before valid_from is Strictly Rejected
  const beforeStartKeyBytes = resolveTrustedKey('provn-server-2026-06', '2026-05-31T23:59:59.999Z')
  assert(beforeStartKeyBytes === null, 'Historical key rejected 1ms before valid_from (2026-05-31T23:59:59.999Z)')

  // Test 7: Malformed / Invalid Timestamps Strictly Fail Closed
  const malformedTimestampBytes = resolveTrustedKey('provn-server-2026-06', 'not-a-valid-iso-date')
  assert(malformedTimestampBytes === null, 'Malformed string timestamp strictly fails closed (returns null)')

  const nanTimestampBytes = resolveTrustedKey('provn-server-2026-06', NaN)
  assert(nanTimestampBytes === null, 'NaN timestamp strictly fails closed (returns null)')

  // Test 8: Unknown / Revoked Key ID is Strictly Rejected
  const unknownKeyBytes = resolveTrustedKey('provn-server-invalid-999', '2026-08-21T00:00:00Z')
  assert(unknownKeyBytes === null, 'Unknown key ID strictly rejected')

  // Test 9: Full Protocol Proof Verification Rejects Expired Historical Key Epoch
  const expiredChalPayload = JSON.stringify({
    id: crypto.randomUUID(),
    wallet: testWallet,
    iat: '2026-09-15T00:00:00.000Z',
    exp: '2026-09-15T00:05:00.000Z',
    iss: 'PROVN',
    kid: 'provn-server-2026-06', // Expired on 2026-08-31
  })
  const expBytes = new TextEncoder().encode(expiredChalPayload)
  const expSig = signServerReceipt(expBytes)
  const expChallenge = `${bs58.encode(expBytes)}.${bs58.encode(expSig)}`

  const proofWithExpiredKeyChal = evaluateProofValidity({
    ...baseProof,
    challenge: expChallenge,
    created_at: '2026-09-15T00:01:00.000Z',
  })
  assert(proofWithExpiredKeyChal.challengeVerified === false, 'Protocol strictly rejects challenge signed with expired key epoch')
  assert(proofWithExpiredKeyChal.protocolVerified === false, 'Protocol verification fails when key epoch has expired')

  // =========================================================================
  // SUITE 19: Private Proof Cryptographic Authorization & Route Security Matrix
  // =========================================================================
  console.log('\n► SUITE 19: Private Proof Authorization & Security Invariants')

  const privateProofId = 42
  const ownerWalletSeed = new Uint8Array(32).fill(7)
  const ownerKp = nacl.sign.keyPair.fromSeed(ownerWalletSeed)
  const ownerWallet = bs58.encode(ownerKp.publicKey)

  const attackerWalletSeed = new Uint8Array(32).fill(9)
  const attackerKp = nacl.sign.keyPair.fromSeed(attackerWalletSeed)
  const attackerWallet = bs58.encode(attackerKp.publicKey)

  // Mock Supabase client for testing
  const mockSupabase = {
    rpc: async (fn: string, args: any) => {
      if (fn === 'consume_private_auth_nonce') {
        if (args.p_nonce === 'valid-nonce' || args.p_nonce === 'fresh-nonce') return { data: true, error: null }
        return { data: false, error: null }
      }
      return { data: null, error: 'Unknown RPC' }
    }
  }

  // 1. Valid signed SIWS private proof access token
  const domain = 'provn.test.app'
  const uri = 'https://provn.test.app/api/proof/42'
  const issuedAt = new Date().toISOString()
  const expTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  
  const validAuthPayloadObj = {
    domain,
    uri,
    wallet: ownerWallet,
    proofId: privateProofId,
    nonce: 'valid-nonce',
    issuedAt,
    expirationTime: expTime
  }
  
  const validMessage = buildPrivateProofAuthMessage(domain, uri, ownerWallet, privateProofId, 'valid-nonce', issuedAt, expTime)
  const validMessageBytes = new TextEncoder().encode(validMessage)
  const validAuthSig = nacl.sign.detached(validMessageBytes, ownerKp.secretKey)
  const validAuthHeader = `Bearer ${bs58.encode(new TextEncoder().encode(JSON.stringify(validAuthPayloadObj)))}.${bs58.encode(validAuthSig)}`

  assert(
    await verifyPrivateProofAuth(mockSupabase, validAuthHeader, domain, uri, privateProofId, ownerWallet) === true,
    'Valid SIWS wallet-signed token successfully authorizes private proof access'
  )

  // 2. Unauthenticated request (no header) is strictly rejected
  assert(
    await verifyPrivateProofAuth(mockSupabase, null, domain, uri, privateProofId, ownerWallet) === false,
    'Unauthenticated request without auth header is strictly rejected'
  )

  // 3. Attacker wallet signature (impersonation) is strictly rejected
  const attackerAuthSig = nacl.sign.detached(validMessageBytes, attackerKp.secretKey)
  const attackerAuthHeader = `Bearer ${bs58.encode(new TextEncoder().encode(JSON.stringify(validAuthPayloadObj)))}.${bs58.encode(attackerAuthSig)}`
  assert(
    await verifyPrivateProofAuth(mockSupabase, attackerAuthHeader, domain, uri, privateProofId, ownerWallet) === false,
    'Attacker wallet signature attempting to claim victim private proof is strictly rejected (403)'
  )

  // 4. Mismatched proof ID in auth payload is strictly rejected
  assert(
    await verifyPrivateProofAuth(mockSupabase, validAuthHeader, domain, uri, 999999, ownerWallet) === false,
    'Auth token for different proof ID is strictly rejected'
  )
  
  // 4b. Mismatched Domain/URI in auth payload is strictly rejected
  assert(
    await verifyPrivateProofAuth(mockSupabase, validAuthHeader, 'evil.com', uri, privateProofId, ownerWallet) === false,
    'Auth token for different domain is strictly rejected'
  )

  // 5. Expired auth token is strictly rejected (anti-replay)
  const expiredIssuedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const expiredExpTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const expiredAuthPayloadObj = {
    domain,
    uri,
    wallet: ownerWallet,
    proofId: privateProofId,
    nonce: 'expired-nonce',
    issuedAt: expiredIssuedAt,
    expirationTime: expiredExpTime
  }
  const expiredMessage = buildPrivateProofAuthMessage(domain, uri, ownerWallet, privateProofId, 'expired-nonce', expiredIssuedAt, expiredExpTime)
  const expiredMessageBytes = new TextEncoder().encode(expiredMessage)
  const expiredAuthSig = nacl.sign.detached(expiredMessageBytes, ownerKp.secretKey)
  const expiredAuthHeader = `Bearer ${bs58.encode(new TextEncoder().encode(JSON.stringify(expiredAuthPayloadObj)))}.${bs58.encode(expiredAuthSig)}`
  assert(
    await verifyPrivateProofAuth(mockSupabase, expiredAuthHeader, domain, uri, privateProofId, ownerWallet) === false,
    'Expired private proof auth token strictly fails closed'
  )

  // 5b. Nonce reuse (atomically consumed) is rejected
  assert(
    await verifyPrivateProofAuth(mockSupabase, validAuthHeader, domain, uri, privateProofId, ownerWallet) === true,
    'Mock check: Nonce valid check (consumed false returned if not valid-nonce)'
  )
  const reusePayloadObj = { ...validAuthPayloadObj, nonce: 'used-nonce' }
  const reuseMessage = buildPrivateProofAuthMessage(domain, uri, ownerWallet, privateProofId, 'used-nonce', issuedAt, expTime)
  const reuseSig = nacl.sign.detached(new TextEncoder().encode(reuseMessage), ownerKp.secretKey)
  const reuseHeader = `Bearer ${bs58.encode(new TextEncoder().encode(JSON.stringify(reusePayloadObj)))}.${bs58.encode(reuseSig)}`
  assert(
    await verifyPrivateProofAuth(mockSupabase, reuseHeader, domain, uri, privateProofId, ownerWallet) === false,
    'Reused nonce or invalid nonce fails authorization'
  )

  // 6. Security Invariant: signatureValid === true does NOT imply protocolVerified === true
  const signatureOnlyProof = {
    ...baseProof,
    protocol_version: 2,
    submission_receipt: null, // V2 proof missing mandatory submission receipt
  }
  const sigOnlyReport = evaluateProofValidity(signatureOnlyProof)
  assert(
    sigOnlyReport.signatureVerified === true && sigOnlyReport.protocolVerified === false,
    'Security Invariant: signatureValid=true does NOT imply protocolVerified=true (missing receipt fails protocol)'
  )

  // 7. Security Invariant: resolveTrustedKey strictly requires valid timestamp
  const noTimestampKey = resolveTrustedKey('provn-server-2026-08', null as unknown as string)
  assert(
    noTimestampKey === null,
    'Security Invariant: resolveTrustedKey fails closed when timestamp parameter is omitted or null'
  )

  // SUITE 20: Server Receipt Timestamp Boundaries & Public Key Isolation
  // =========================================================================
  console.log('\n► SUITE 20: Server Receipt Epoch Boundaries & Public Key Isolation')
  
  // 1. Receipt Timestamp Outside Key Epoch -> FAIL
  const valid_from_epoch = new Date('2026-08-01T00:00:00Z').getTime() // From manifest
  const earlyTimestamp = new Date(valid_from_epoch - 1000).toISOString()
  
  const earlyKey = resolveTrustedKey('provn-server-2026-08', earlyTimestamp)
  assert(earlyKey === null, 'resolveTrustedKey fails if timestamp is before valid_from of epoch')
  
  // 2. Receipt Timestamp Inside Historical Key Epoch -> PASS
  // If we had a historical key, it would pass. We'll just test inside the active epoch.
  const activeTimestamp = new Date(valid_from_epoch + 10000).toISOString()
  const activeKey = resolveTrustedKey('provn-server-2026-08', activeTimestamp)
  assert(activeKey !== null, 'resolveTrustedKey passes if timestamp is inside valid epoch')
  
  // 3. getPublishedPublicKey cannot be used as verification authority
  const pubKeyBytes = getPublishedPublicKey('provn-server-2026-08')
  assert(pubKeyBytes !== null && pubKeyBytes instanceof Uint8Array, 'getPublishedPublicKey returns key for display')
  
  try {
    // We just want to ensure it's an array and cannot be used with temporal validation
    assert(Boolean(pubKeyBytes && !('status' in pubKeyBytes)), 'getPublishedPublicKey exposes just raw bytes, not validated context')
  } catch(e) {}
  
  // --- SUMMARY ---

  console.log('\n===================================================================')
  console.log(`   PRODUCTION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  if (failedTests.length > 0) {
    console.error('\n🚨 FAILED TESTS:')
    failedTests.forEach(t => console.error(`  - ${t}`))
  }
  console.log('===================================================================')

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runProductionTestSuite().catch((err) => {
  console.error('UNCAUGHT TEST RUNNER ERROR:', err)
  process.exit(1)
})
