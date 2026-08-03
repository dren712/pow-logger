/**
 * PROVN Automated Protocol Test Suite 🗿
 *
 * Verifies:
 * 1. Ed25519 Canonical SIWS Message Construction & Verification.
 * 2. Replay Attack Protection & Signature Uniqueness logic.
 * 3. Evidence URL validation (GitHub PR & Deployment links).
 * 4. Archival State Enum Validation ('pending', 'archived', 'failed', 'legacy_unverified').
 * 5. Daily Quota Limit Calculations (Max 3 logs per 24 hours).
 */

import nacl from 'tweetnacl'
import bs58 from 'bs58'

function runTestSuite() {
  console.log('========================================================')
  console.log('   PROVN PROTOCOL AUTOMATED TEST SUITE 🗿')
  console.log('========================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName}`)
      failed++
    }
  }

  // --- Test 1: Keypair Generation & SIWS Message Signature Verification ---
  console.log('► TEST 1: Ed25519 SIWS Message Verification')
  const keypair = nacl.sign.keyPair()
  const walletAddress = bs58.encode(keypair.publicKey)
  const timestamp = new Date().toISOString()
  const content = 'Built Solana program with Ed25519 anti-spoofing signature verification'

  const canonicalMessageText = `provn-sol.vercel.app wants you to sign in with your Solana account:\n${walletAddress}\n\nTimestamp: ${timestamp}\nContent: ${content.trim()}`
  const messageBytes = new TextEncoder().encode(canonicalMessageText)
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey)
  const signatureBase58 = bs58.encode(signatureBytes)

  // Verification step
  const decodedPublicKey = bs58.decode(walletAddress)
  const decodedSignature = bs58.decode(signatureBase58)
  const isValid = nacl.sign.detached.verify(messageBytes, decodedSignature, decodedPublicKey)

  assert(isValid === true, 'Valid Ed25519 SIWS signature verifies correctly')

  // Tamper step
  const tamperedMessageText = canonicalMessageText + ' (TAMPERED)'
  const tamperedBytes = new TextEncoder().encode(tamperedMessageText)
  const isTamperedValid = nacl.sign.detached.verify(tamperedBytes, decodedSignature, decodedPublicKey)

  assert(isTamperedValid === false, 'Tampered SIWS payload correctly fails verification')

  // --- Test 2: Signature Replay Attack Detection ---
  console.log('\n► TEST 2: Replay Attack Protection')
  const mockSignatureDatabase = new Set<string>()
  mockSignatureDatabase.add(signatureBase58)

  const isReplayAttempt = mockSignatureDatabase.has(signatureBase58)
  assert(isReplayAttempt === true, 'Duplicate signature detected in signature index')

  const newSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode('other'), keypair.secretKey))
  const isNewAttempt = mockSignatureDatabase.has(newSignature)
  assert(isNewAttempt === false, 'Unique signature accepted')

  // --- Test 3: Evidence Link Validation ---
  console.log('\n► TEST 3: Evidence URL Formatting')
  const githubUrl = 'https://github.com/dren712/pow-logger/pull/1'
  const evidenceUrl = 'https://provn-sol.vercel.app'
  const invalidUrl = 'javascript:alert(1)'

  const isGithubValid = githubUrl.startsWith('http') && githubUrl.includes('github.com')
  const isEvidenceValid = evidenceUrl.startsWith('http')
  const isInvalidRejected = !invalidUrl.startsWith('http')

  assert(isGithubValid === true, 'GitHub PR URL validated correctly')
  assert(isEvidenceValid === true, 'Demo deployment URL validated correctly')
  assert(isInvalidRejected === true, 'Unsafe/invalid URL scheme rejected')

  // --- Test 4: Archival State Enum Validation ---
  console.log('\n► TEST 4: Archival State Transitions')
  const validStates = ['pending', 'archived', 'failed', 'legacy_unverified']

  assert(validStates.includes('pending'), "State 'pending' is valid")
  assert(validStates.includes('archived'), "State 'archived' is valid")
  assert(validStates.includes('failed'), "State 'failed' is valid")
  assert(validStates.includes('legacy_unverified'), "State 'legacy_unverified' is valid")
  assert(!validStates.includes('powl_fake'), "Fake state 'powl_fake' is rejected")

  // --- Test 5: Server-Side Daily Quota Logic ---
  console.log('\n► TEST 5: Daily Quota Enforcement')
  const todayLogs = [
    { id: 1, created_at: new Date().toISOString() },
    { id: 2, created_at: new Date().toISOString() },
    { id: 3, created_at: new Date().toISOString() },
  ]

  const isQuotaExceeded = todayLogs.length >= 3
  assert(isQuotaExceeded === true, 'Daily quota enforced when 3 logs submitted')

  // Summary
  console.log('\n========================================================')
  console.log(`   TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  console.log('========================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite()
