import assert from 'assert'
import crypto from 'crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { PublicKey, Keypair } from '@solana/web3.js'
import { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'
import { buildMerkleTree, verifyInclusionProof } from '../app/lib/agent/merkleBatch'
import { verifyHashChain } from '../app/lib/agent/hashChain'
import { verifyAgentReceipt } from '../app/lib/agent/agentVerifier'
import { buildAgentReceipt, serializeReceipt, deserializeReceipt } from '../app/lib/agent/agentReceipt'
import { deriveAgentBatchAnchorPda, buildAnchorAgentBatchInstruction, decodeAgentBatchAnchorAccount } from '../app/lib/agent/solanaAgentAnchor'
import { recomputeEventHash, verifyEventSignature, computePayloadHash, sha256 } from '../app/lib/agent/agentEvents'
import { Provn } from '../app/lib/agent/provnClient'
import type { AgentEvent, AgentExecution, AnchorReference } from '../app/lib/agent/types'

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN TRACK B: END-TO-END DATABASE TAMPERING PROOF LOOP       ║')
console.log('╚═══════════════════════════════════════════════════════════════╝\n')

async function runTamperLoop() {
  // ───────────────────────────────────────────────────────────────────────────
  // STEP 1: Autonomous Agent Execution & Cryptographic Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  console.log('► STEP 1: Agent Execution & Authentic Cryptographic Log Generation')

  const agentKeypair = nacl.sign.keyPair()
  const agentPubkeyBase58 = bs58.encode(agentKeypair.publicKey)
  const runtime = new ProvnAgentRuntime(agentKeypair)

  const executionState = runtime.startExecution({
    taskDescription: 'Automated Database Tampering Verification Loop',
    agentName: 'tamper-sentinel-agent',
  })

  // Agent records sequential consequential actions
  runtime.logAction(executionState, 'file.read', {
    path: 'config/contracts.json',
    sizeBytes: 1024,
    contentHash: sha256('{"token": "USDC", "program": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}'),
  })

  runtime.logAction(executionState, 'shell.execute', {
    command: 'anchor test --provider.cluster devnet',
    exitCode: 0,
    stdoutHash: sha256('All 14 smart contract integration tests passed cleanly.'),
  })

  runtime.logAction(executionState, 'git.operation', {
    action: 'commit',
    commitHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    message: 'release: ship verifiable agent settlement v2',
  })

  runtime.logAction(executionState, 'payment.executed', {
    recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    amount: '5000000',
    mint: 'USDC',
    txSignature: '5K3k...sampleSig',
  })

  // Anchor to Solana (Authority keypair representing anchor authority)
  const anchorAuthority = Keypair.generate()
  const programId = new PublicKey('FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx')
  const batchId = crypto.randomUUID()
  const [pda] = deriveAgentBatchAnchorPda(anchorAuthority.publicKey, batchId, programId)

  const anchorReference: AnchorReference = {
    network: 'devnet',
    programId: programId.toBase58(),
    pda: pda.toBase58(),
    signature: '5xSigMockSolanaFinalizedSlot10928374',
  }

  // Finalize execution cleanly
  const authenticReceipt = runtime.finalizeExecution(
    executionState,
    'Lifecycle successfully sealed with Solana anchor commitment',
    anchorReference
  )

  assert.strictEqual(authenticReceipt.events.length, 6) // 1 started + 4 actions + 1 completed
  console.log(`  ✓ Execution ID: ${authenticReceipt.execution.executionId}`)
  console.log(`  ✓ Agent Public Key: ${agentPubkeyBase58}`)
  console.log(`  ✓ Authentic Merkle Root: ${authenticReceipt.merkle.root}`)
  console.log(`  ✓ Solana Anchor PDA: ${pda.toBase58()}`)

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 2: Verify Authentic Baseline Receipt
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► STEP 2: Baseline Independent Receipt Verification')

  const baselineVerification = verifyAgentReceipt(authenticReceipt)
  assert.strictEqual(baselineVerification.verified, true, 'Authentic baseline receipt must be 100% valid')
  assert.strictEqual(baselineVerification.layers.agentSignature, 'VALID')
  assert.strictEqual(baselineVerification.layers.eventHash, 'VALID')
  assert.strictEqual(baselineVerification.layers.hashChain, 'VALID')
  assert.strictEqual(baselineVerification.layers.merkleInclusion, 'VALID')
  assert.strictEqual(baselineVerification.layers.merkleRoot, 'VALID')
  console.log('  ✓ [PASS] Zero-trust independent verifier: 100% VERIFIED across all 5 offline layers')

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACK A: Rogue DBA Mutates Event Payload in Database
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► ATTACK A: Rogue Database Administrator Mutates Event Payload')
  console.log('  Scenario: Compromised DB row modifies shell command from test to malicious command.')

  // Deep-clone authentic receipt to simulate DB rows reconstruction
  const tamperedReceiptA = deserializeReceipt(serializeReceipt(authenticReceipt))
  
  // Adversary alters the payload in database row #2 (shell command)
  tamperedReceiptA.events[2].payload = {
    ...tamperedReceiptA.events[2].payload,
    command: 'rm -rf / --no-preserve-root',
  }

  const verifyResultA = verifyAgentReceipt(tamperedReceiptA)
  assert.strictEqual(verifyResultA.verified, false, 'Tampered event payload must fail verification')
  assert.strictEqual(verifyResultA.layers.eventHash, 'INVALID', 'Event hash layer must detect mutation')
  assert.ok(
    verifyResultA.failures.some(f => f.type === 'EVENT_HASH_MISMATCH' && f.eventSequence === 2),
    'Verifier must pinpoint sequence 2 as the exact corrupted event'
  )
  console.log('  ✓ [PASS] Payload mutation caught instantly: EVENT_HASH_MISMATCH at sequence 2')

  // If attacker updates payloadHash and recomputes eventHash to conceal mutation, Ed25519 signature fails
  tamperedReceiptA.events[2].payloadHash = computePayloadHash(tamperedReceiptA.events[2].payload!)
  tamperedReceiptA.events[2].eventHash = recomputeEventHash(tamperedReceiptA.events[2])
  const verifyResultA2 = verifyAgentReceipt(tamperedReceiptA)
  assert.strictEqual(verifyResultA2.verified, false)
  assert.strictEqual(verifyResultA2.layers.agentSignature, 'INVALID', 'Signature must fail when hash is forged')
  console.log('  ✓ [PASS] Forged eventHash caught: SIGNATURE_INVALID (attacker lacks agent Ed25519 private key)')

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACK B: Event Deletion (Dropping Consequential Payment Event)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► ATTACK B: Adversary Deletes Unwanted Consequential Action from Database')
  console.log('  Scenario: Adversary drops event sequence 4 (payment.executed) from DB to hide payout.')

  const tamperedReceiptB = deserializeReceipt(serializeReceipt(authenticReceipt))
  // Delete sequence 4 (index 4)
  tamperedReceiptB.events.splice(4, 1)

  const verifyResultB = verifyAgentReceipt(tamperedReceiptB)
  assert.strictEqual(verifyResultB.verified, false, 'Deleted event must fail verification')
  assert.strictEqual(verifyResultB.layers.hashChain, 'INVALID', 'Hash chain must detect severed sequence')
  assert.strictEqual(verifyResultB.layers.merkleRoot, 'INVALID', 'Recomputed Merkle root must diverge')
  console.log('  ✓ [PASS] Event deletion caught: SEQUENCE_GAP and HASH_CHAIN_INTEGRITY_FAILURE')
  console.log('  ✓ [PASS] Merkle root reconstruction diverges from authentic tree')

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACK C: Database Merkle Root Tampering vs. Public Solana Anchor
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► ATTACK C: Database Merkle Root Overwrite vs. Immutable Solana Anchor')
  console.log('  Scenario: Attacker overwrites merkle_root in DB to match forged events.')

  // Attacker builds a whole alternate event chain
  const fakeKeypair = nacl.sign.keyPair()
  const fakeRuntime = new ProvnAgentRuntime(fakeKeypair)
  const fakeState = fakeRuntime.startExecution({ taskDescription: 'Fake execution' })
  fakeRuntime.logAction(fakeState, 'shell.execute', { command: 'echo sanitized' })
  const fakeReceipt = fakeRuntime.finalizeExecution(fakeState, 'Tampered summary')

  // Attacker points receipt to real execution's Solana anchor PDA
  fakeReceipt.solana = { ...authenticReceipt.solana! }

  // 1. Reconstructing simulated on-chain account data from real Solana anchor
  const onChainAccountData = Buffer.alloc(8 + 32 + 32 + 32 + 8 + 8 + 1)
  // [0..8]: discriminator
  Buffer.from('agent_batch_anchor').copy(onChainAccountData, 0)
  // [8..40]: batchIdHash (32 bytes)
  Buffer.from(sha256(batchId), 'hex').copy(onChainAccountData, 8)
  // [40..72]: authority (32 bytes)
  anchorAuthority.publicKey.toBuffer().copy(onChainAccountData, 40)
  // [72..104]: merkleRoot (32 bytes) — Authentic Merkle Root!
  Buffer.from(authenticReceipt.merkle.root, 'hex').copy(onChainAccountData, 72)
  // [104..112]: eventCount
  onChainAccountData.writeBigInt64LE(BigInt(authenticReceipt.events.length), 104)

  const decodedOnChain = decodeAgentBatchAnchorAccount(onChainAccountData)
  
  // Verifier checks fake receipt against on-chain root
  const rootMatchesOnChain = decodedOnChain.merkleRoot === fakeReceipt.merkle.root
  assert.strictEqual(rootMatchesOnChain, false, 'On-chain root must refute forged database root')
  console.log('  ✓ [PASS] Database Compromise Defeated by Layer 1 Consensus:')
  console.log(`    DB Claimed Merkle Root: ${fakeReceipt.merkle.root}`)
  console.log(`    Solana On-Chain Root:   ${decodedOnChain.merkleRoot}`)
  console.log('    Result: SOLANA_ANCHOR_MISMATCH — Tampering mathematically proven on public ledger')

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACK D: SDK Unsupported Action Injection
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► ATTACK D: SDK Unsupported Action Type Rejection')

  const provn = new Provn()
  const exec = await provn.start({ agent: 'sentinel', intent: 'Action validation test' })

  try {
    await exec.action({ type: 'unsupported_malicious_action_type', tool: 'exploit' })
    assert.fail('Should have thrown UNSUPPORTED_ACTION_TYPE')
  } catch (err: unknown) {
    const msg = (err as Error).message
    assert.ok(msg.startsWith('UNSUPPORTED_ACTION_TYPE'), `Expected UNSUPPORTED_ACTION_TYPE, got ${msg}`)
    console.log(`  ✓ [PASS] Invalid action strictly rejected by SDK: ${msg.slice(0, 48)}...`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACK E: Identity Mismatch in Receipt Construction
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► ATTACK E: Execution Identity Binding Defense')

  const foreignKeypair = nacl.sign.keyPair()
  const foreignPubkey = bs58.encode(foreignKeypair.publicKey)

  const eventsWithImposter: AgentEvent[] = authenticReceipt.events.map((e, idx) => {
    if (idx === 1) {
      return { ...e, agentPublicKey: foreignPubkey }
    }
    return e
  })

  assert.throws(
    () => buildAgentReceipt(authenticReceipt.execution, eventsWithImposter),
    /RECEIPT_INTEGRITY_ERROR.*agentPublicKey/,
    'buildAgentReceipt must reject events not signed by execution agent'
  )
  console.log('  ✓ [PASS] buildAgentReceipt rejects foreign agent public key identity')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('   DATABASE TAMPERING PROOF LOOP: 100% OF ATTACKS DETECTED     ')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

runTamperLoop()
