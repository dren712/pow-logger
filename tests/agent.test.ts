/**
 * PROVN Agent Protocol — Comprehensive Security & Integrity Test Suite
 * Protocol Version: agent/1
 *
 * Tests all 14 required security invariants:
 *   1.  Deterministic canonicalization
 *   2.  SHA-256 domain separation
 *   3.  Valid & invalid Ed25519 event signatures
 *   4.  Hash-chain linkage & sequence monotonicity
 *   5.  Duplicate sequence conflict rejection
 *   6.  Merkle root reconstruction & odd-leaf promotion
 *   7.  Merkle inclusion proof verification & rejection on tampered proof path
 *   8.  Solana Batch Anchor PDA derivation & account decoding
 *   9.  Payload tampering detection (1-byte modification)
 *   10. Event deletion detection (missing intermediate event)
 *   11. Event insertion detection (injected unauthorized event)
 *   12. Event reordering detection (swapped events in chain)
 *   13. Signature impersonation detection
 *   14. End-to-end receipt portability and offline independent verification
 *
 * RUN: npx tsx tests/agent.test.ts
 */

import crypto from 'node:crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'

// ─── Core Agent Protocol Imports ─────────────────────────────────────────────

import {
  buildCanonicalEventString,
  computeEventHash,
  recomputeEventHash,
  computePayloadHash,
  signEventHash,
  verifyEventSignature,
  createSignedEvent,
  isValidEventType,
  generateId,
  sha256,
} from '../app/lib/agent/agentEvents'

import { verifyHashChain } from '../app/lib/agent/hashChain'

import {
  computeLeafHash,
  computeNodeHash,
  buildMerkleTree,
  verifyMerkleProof,
  recomputeMerkleRoot,
} from '../app/lib/agent/merkleBatch'

import {
  deriveAgentBatchAnchorPda,
  buildAnchorAgentBatchInstruction,
  buildAnchorReference,
} from '../app/lib/agent/solanaAgentAnchor'

import {
  deserializeReceipt,
  buildIrysEvidenceEnvelope,
} from '../app/lib/agent/agentReceipt'

import { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'

import {
  DOMAIN_SEPARATION,
  type AgentEvent,
  type AgentReceipt,
} from '../app/lib/agent/types'

import { PROVN_PROGRAM_ID } from '../app/lib/solanaAnchor'

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const TEST_KEYPAIR = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(42))
const TEST_PUBLIC_KEY = bs58.encode(TEST_KEYPAIR.publicKey)
const ATTACKER_KEYPAIR = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(99))
const ATTACKER_PUBLIC_KEY = bs58.encode(ATTACKER_KEYPAIR.publicKey)

let passed = 0
let failed = 0

function assertPass(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${label}`)
    passed++
  } else {
    console.log(`  ✗ [FAIL] ${label}`)
    failed++
  }
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN AGENT PROTOCOL — SECURITY & INTEGRITY TEST SUITE      ║')
console.log('║ Protocol Version: agent/1                                    ║')
console.log('╚═══════════════════════════════════════════════════════════════╝\n')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: Deterministic Canonicalization
// ═══════════════════════════════════════════════════════════════════════════════
console.log('► SUITE 1: Deterministic Canonicalization')

const execId = 'exec-test-001'
const canonical1 = buildCanonicalEventString({
  executionId: execId,
  sequence: 0,
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'agent.started',
  timestamp: '2026-09-02T00:00:00.000Z',
  parentEventId: null,
  previousEventHash: null,
  payloadHash: sha256('test-payload'),
})

const canonical2 = buildCanonicalEventString({
  executionId: execId,
  sequence: 0,
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'agent.started',
  timestamp: '2026-09-02T00:00:00.000Z',
  parentEventId: null,
  previousEventHash: null,
  payloadHash: sha256('test-payload'),
})

assertPass(canonical1 === canonical2, 'Same inputs produce identical canonical strings')
assertPass(canonical1.startsWith(DOMAIN_SEPARATION.EVENT), 'Canonical string starts with domain separation prefix')
assertPass(canonical1.includes(`execution:${execId}`), 'Canonical string contains execution ID')
assertPass(canonical1.includes('sequence:0'), 'Canonical string contains sequence number')
assertPass(canonical1.includes('previous_event_hash:none'), 'Null previous hash serializes as "none"')

const hash1 = computeEventHash(canonical1)
const hash2 = computeEventHash(canonical2)
assertPass(hash1 === hash2, 'Same canonical strings produce identical event hashes')
assertPass(hash1.length === 64, 'Event hash is 64-char hex (SHA-256)')

// Different payload → different hash
const canonical3 = buildCanonicalEventString({
  executionId: execId,
  sequence: 0,
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'agent.started',
  timestamp: '2026-09-02T00:00:00.000Z',
  parentEventId: null,
  previousEventHash: null,
  payloadHash: sha256('different-payload'),
})
const hash3 = computeEventHash(canonical3)
assertPass(hash1 !== hash3, 'Different payloads produce different event hashes')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: SHA-256 Domain Separation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 2: SHA-256 Domain Separation')

const eventHash = sha256('test-event-hash')

const leafHash = computeLeafHash(eventHash)
const nodeHash = computeNodeHash(leafHash, leafHash)

// Domain-separated hashes must differ from raw SHA-256
const rawLeafHash = crypto.createHash('sha256').update(eventHash).digest('hex')
assertPass(leafHash !== rawLeafHash, 'Leaf hash differs from raw SHA-256 of event hash (domain separation)')
assertPass(leafHash === crypto.createHash('sha256').update(`${DOMAIN_SEPARATION.MERKLE_LEAF}:${eventHash}`).digest('hex'), 'Leaf hash matches expected domain-separated computation')

const rawNodeHash = crypto.createHash('sha256').update(`${leafHash}${leafHash}`).digest('hex')
assertPass(nodeHash !== rawNodeHash, 'Node hash differs from raw SHA-256 of concatenated children (domain separation)')
assertPass(nodeHash === crypto.createHash('sha256').update(`${DOMAIN_SEPARATION.MERKLE_NODE}:${leafHash}${leafHash}`).digest('hex'), 'Node hash matches expected domain-separated computation')

// Cross-protocol separation: event hash must never be confused with leaf hash
assertPass(eventHash !== leafHash, 'Event hash and leaf hash are distinct (cross-layer separation)')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Ed25519 Event Signatures
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 3: Ed25519 Event Signatures')

const testEventHash = computeEventHash(canonical1)
const validSig = signEventHash(testEventHash, TEST_KEYPAIR.secretKey)

assertPass(typeof validSig === 'string' && validSig.length > 0, 'signEventHash returns non-empty Base58 string')
assertPass(verifyEventSignature(testEventHash, validSig, TEST_PUBLIC_KEY), 'Valid signature passes verification')

// Wrong public key
assertPass(!verifyEventSignature(testEventHash, validSig, ATTACKER_PUBLIC_KEY), 'Signature fails with wrong public key')

// Wrong event hash
const wrongHash = sha256('wrong-event-hash')
assertPass(!verifyEventSignature(wrongHash, validSig, TEST_PUBLIC_KEY), 'Signature fails with wrong event hash')

// Corrupted signature
const sigBytes = bs58.decode(validSig)
const corruptedSig = new Uint8Array(sigBytes)
corruptedSig[0] ^= 0xff
assertPass(!verifyEventSignature(testEventHash, bs58.encode(corruptedSig), TEST_PUBLIC_KEY), 'Corrupted signature fails verification')

// createSignedEvent produces valid signature
const signedEvent = createSignedEvent({
  eventId: generateId(),
  executionId: execId,
  sequence: 0,
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'agent.started',
  timestamp: '2026-09-02T00:00:00.000Z',
  previousEventHash: null,
  payload: { type: 'agent.started', taskDescription: 'Test task' },
}, TEST_KEYPAIR.secretKey)

assertPass(verifyEventSignature(signedEvent.eventHash, signedEvent.signature, signedEvent.agentPublicKey), 'createSignedEvent produces event with valid signature')
assertPass(recomputeEventHash(signedEvent) === signedEvent.eventHash, 'createSignedEvent produces event with consistent eventHash')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Hash Chain Linkage & Sequence Monotonicity
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 4: Hash Chain Linkage & Sequence Monotonicity')

// Build a valid chain of 4 events
function buildValidChain(kp: { secretKey: Uint8Array; publicKey: Uint8Array }, count: number): AgentEvent[] {
  const pubKey = bs58.encode(kp.publicKey)
  const events: AgentEvent[] = []
  let prevHash: string | null = null
  const execId = generateId()

  for (let i = 0; i < count; i++) {
    const event = createSignedEvent({
      eventId: generateId(),
      executionId: execId,
      sequence: i,
      agentPublicKey: pubKey,
      eventType: i === 0 ? 'agent.started' : (i === count - 1 ? 'agent.completed' : 'file.read'),
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      previousEventHash: prevHash,
      payload: i === 0
        ? { type: 'agent.started' as const, taskDescription: 'Test' }
        : (i === count - 1
          ? { type: 'agent.completed' as const, summary: 'Done', eventCount: count }
          : { type: 'file.read' as const, path: `/test/file${i}.txt`, contentHash: sha256(`content-${i}`), sizeBytes: 100 * i }),
    }, kp.secretKey)

    events.push(event)
    prevHash = event.eventHash
  }
  return events
}

const validChain = buildValidChain(TEST_KEYPAIR, 4)
const chainResult = verifyHashChain(validChain)

assertPass(chainResult.valid, 'Valid 4-event chain passes hash chain verification')
assertPass(chainResult.eventsChecked === 4, 'Verifier checked all 4 events')
assertPass(chainResult.eventsPassed === 4, 'All 4 events passed')
assertPass(chainResult.failures.length === 0, 'Zero failures in valid chain')

// Verify chain linkage explicitly
assertPass(validChain[0].previousEventHash === null, 'Event 0 has null previousEventHash')
assertPass(validChain[1].previousEventHash === validChain[0].eventHash, 'Event 1 links to Event 0')
assertPass(validChain[2].previousEventHash === validChain[1].eventHash, 'Event 2 links to Event 1')
assertPass(validChain[3].previousEventHash === validChain[2].eventHash, 'Event 3 links to Event 2')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: Duplicate Sequence Conflict Rejection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 5: Duplicate Sequence Conflict Rejection')

const dupChain = [...validChain]
// Create a duplicate event with the same sequence as event[2]
const dupEvent = createSignedEvent({
  eventId: generateId(),
  executionId: validChain[2].executionId,
  sequence: 2, // Duplicate!
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'shell.execute',
  timestamp: new Date().toISOString(),
  previousEventHash: validChain[1].eventHash,
  payload: { type: 'shell.execute', commandHash: sha256('ls'), cwdHash: sha256('/'), exitCode: 0, stdoutHash: sha256(''), stderrHash: sha256('') },
}, TEST_KEYPAIR.secretKey)
dupChain.push(dupEvent)

const dupResult = verifyHashChain(dupChain)
assertPass(!dupResult.valid, 'Chain with duplicate sequence number is rejected')
const hasDupFailure = dupResult.failures.some(f => f.type === 'SEQUENCE_DUPLICATE' || f.type === 'SEQUENCE_GAP')
assertPass(hasDupFailure, 'Failure includes sequence duplication or gap diagnostic')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6: Merkle Root Reconstruction & Odd-Leaf Promotion
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 6: Merkle Root Reconstruction & Odd-Leaf Promotion')

// Even number of leaves
const evenHashes = ['aaa', 'bbb', 'ccc', 'ddd'].map(sha256)
const evenTree = buildMerkleTree(evenHashes)
assertPass(evenTree.root.length === 64, 'Even-leaf tree produces valid 64-char hex root')
assertPass(evenTree.leafCount === 4, 'Even-leaf tree has 4 leaves')
assertPass(evenTree.proofs.length === 4, 'Even-leaf tree has 4 inclusion proofs')

// Odd number of leaves (3)
const oddHashes = ['xxx', 'yyy', 'zzz'].map(sha256)
const oddTree = buildMerkleTree(oddHashes)
assertPass(oddTree.root.length === 64, 'Odd-leaf tree produces valid 64-char hex root')
assertPass(oddTree.leafCount === 3, 'Odd-leaf tree has 3 leaves')

// Root reconstruction
const recomputedEvenRoot = recomputeMerkleRoot(evenHashes)
assertPass(recomputedEvenRoot === evenTree.root, 'Recomputed even-leaf root matches original')

const recomputedOddRoot = recomputeMerkleRoot(oddHashes)
assertPass(recomputedOddRoot === oddTree.root, 'Recomputed odd-leaf root matches original')

// Single leaf
const singleTree = buildMerkleTree([sha256('single')])
assertPass(singleTree.root === computeLeafHash(sha256('single')), 'Single-leaf tree root equals the leaf hash')
assertPass(singleTree.proofs[0].proof.length === 0, 'Single-leaf proof has no sibling steps')

// Determinism
const tree2 = buildMerkleTree(evenHashes)
assertPass(evenTree.root === tree2.root, 'Merkle tree construction is deterministic')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7: Merkle Inclusion Proof Verification
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 7: Merkle Inclusion Proof Verification & Tampered Proof Rejection')

// Valid proofs
for (let i = 0; i < evenTree.proofs.length; i++) {
  const valid = verifyMerkleProof(evenHashes[i], evenTree.proofs[i])
  assertPass(valid, `Even tree: inclusion proof valid for leaf ${i}`)
}

for (let i = 0; i < oddTree.proofs.length; i++) {
  const valid = verifyMerkleProof(oddHashes[i], oddTree.proofs[i])
  assertPass(valid, `Odd tree: inclusion proof valid for leaf ${i}`)
}

// Tampered event hash → proof fails
const tamperedHash = sha256('tampered-content')
const tamperedProofResult = verifyMerkleProof(tamperedHash, evenTree.proofs[0])
assertPass(!tamperedProofResult, 'Merkle proof fails when event hash is tampered')

// Tampered proof path → proof fails
const tamperedProof = { ...evenTree.proofs[1], proof: [...evenTree.proofs[1].proof] }
if (tamperedProof.proof.length > 0) {
  tamperedProof.proof[0] = { ...tamperedProof.proof[0], hash: sha256('fake-sibling') }
}
const tamperedPathResult = verifyMerkleProof(evenHashes[1], tamperedProof)
assertPass(!tamperedPathResult, 'Merkle proof fails when proof path is tampered')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8: Solana Batch Anchor PDA Derivation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 8: Solana Batch Anchor PDA Derivation & Account Decoding')

const testAuthority = new PublicKey(TEST_PUBLIC_KEY)
const testBatchId = 'batch-test-001'

const [pda1, bump1] = deriveAgentBatchAnchorPda(testAuthority, testBatchId)
const [pda1Repeat, bump1Repeat] = deriveAgentBatchAnchorPda(testAuthority, testBatchId)
assertPass(pda1.equals(pda1Repeat), 'PDA derivation is strictly deterministic')
assertPass(bump1 === bump1Repeat, 'Bump seed is deterministic')

// Different batch IDs → different PDAs
const [pda2] = deriveAgentBatchAnchorPda(testAuthority, 'batch-test-002')
assertPass(!pda1.equals(pda2), 'Different batch IDs produce non-colliding PDAs')

// Different authorities → different PDAs
const otherAuth = new PublicKey(ATTACKER_PUBLIC_KEY)
const [pdaOther] = deriveAgentBatchAnchorPda(otherAuth, testBatchId)
assertPass(!pda1.equals(pdaOther), 'Different authorities produce non-colliding PDAs')

// Build instruction
const merkleRootHex = crypto.createHash('sha256').update('test-merkle-root-hex').digest('hex')
const ix = buildAnchorAgentBatchInstruction({
  batchId: testBatchId,
  authority: testAuthority,
  merkleRoot: merkleRootHex,
  eventCount: 5,
  timestamp: '2026-09-02T00:00:00.000Z',
  protocolVersion: 1,
})
assertPass(ix.programId.equals(PROVN_PROGRAM_ID), 'Anchor instruction targets PROVN_PROGRAM_ID')
assertPass(ix.keys.length === 3, 'Anchor instruction has 3 accounts (pda, authority, system_program)')
assertPass(ix.keys[0].pubkey.equals(pda1), 'Account[0] is the derived AgentBatchAnchor PDA')
assertPass(ix.keys[0].isWritable === true, 'Account[0] (PDA) is writable')
assertPass(ix.keys[1].pubkey.equals(testAuthority), 'Account[1] is the authority')
assertPass(ix.keys[1].isSigner === true, 'Account[1] (authority) is signer')

// AnchorReference helper
const anchorRef = buildAnchorReference(testAuthority, testBatchId, 'devnet')
assertPass(anchorRef.pda === pda1.toBase58(), 'buildAnchorReference produces correct PDA')
assertPass(anchorRef.network === 'devnet', 'AnchorReference has correct network')
assertPass(anchorRef.programId === PROVN_PROGRAM_ID.toBase58(), 'AnchorReference has correct programId')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9: Payload Tampering Detection (1-byte modification)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 9: Payload Tampering Detection')

const tamperChain = buildValidChain(TEST_KEYPAIR, 4)

// Verify clean chain first
const cleanResult = verifyHashChain(tamperChain)
assertPass(cleanResult.valid, 'Original chain is valid before tampering')

// Tamper with event[2]'s payloadHash (simulate 1-byte modification)
const tamperedChain = tamperChain.map((e, i) => {
  if (i === 2) {
    const bytes = Buffer.from(e.payloadHash, 'hex')
    bytes[0] ^= 0x01 // Flip 1 bit
    return { ...e, payloadHash: bytes.toString('hex') }
  }
  return e
})

const tamperResult = verifyHashChain(tamperedChain)
assertPass(!tamperResult.valid, 'Chain fails after 1-byte payload tampering')
const hashMismatch = tamperResult.failures.find(f => f.type === 'EVENT_HASH_MISMATCH' && f.eventSequence === 2)
assertPass(hashMismatch !== undefined, 'Failure identifies exact event #2 as the tampered event')
assertPass(hashMismatch!.expected !== hashMismatch!.computed, 'Failure shows expected vs computed hash')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 10: Event Deletion Detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 10: Event Deletion Detection')

const deleteChain = buildValidChain(TEST_KEYPAIR, 5)

// Delete event[2] (middle of chain)
const withDeletion = [...deleteChain.slice(0, 2), ...deleteChain.slice(3)]

const deleteResult = verifyHashChain(withDeletion)
assertPass(!deleteResult.valid, 'Chain fails after event deletion')
const hasGap = deleteResult.failures.some(f => f.type === 'SEQUENCE_GAP')
const hasChainBreak = deleteResult.failures.some(f => f.type === 'CHAIN_SEVERED')
assertPass(hasGap || hasChainBreak, 'Deletion detected via sequence gap or chain break')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 11: Event Insertion Detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 11: Event Insertion Detection')

const insertChain = buildValidChain(TEST_KEYPAIR, 4)

// Insert an unauthorized event between [1] and [2]
const insertedEvent = createSignedEvent({
  eventId: generateId(),
  executionId: insertChain[0].executionId,
  sequence: 2, // Claims to be sequence 2
  agentPublicKey: TEST_PUBLIC_KEY,
  eventType: 'shell.execute',
  timestamp: new Date().toISOString(),
  previousEventHash: insertChain[1].eventHash, // Links to event[1]
  payload: { type: 'shell.execute', commandHash: sha256('malicious'), cwdHash: sha256('/'), exitCode: 0, stdoutHash: sha256(''), stderrHash: sha256('') },
}, TEST_KEYPAIR.secretKey)

const withInsertion = [
  insertChain[0],
  insertChain[1],
  insertedEvent,    // Inserted
  insertChain[2],   // Original event[2] now at wrong position
  insertChain[3],
]

const insertResult = verifyHashChain(withInsertion)
assertPass(!insertResult.valid, 'Chain fails after event insertion')
assertPass(insertResult.failures.length > 0, 'Insertion produces chain integrity failures')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 12: Event Reordering Detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 12: Event Reordering Detection')

const reorderChain = buildValidChain(TEST_KEYPAIR, 4)

// To detect reordering, we simulate an attacker who swaps event data
// between positions 1 and 2 in the database. The verifier sorts by
// sequence, so we swap the sequence numbers on the events themselves
// to simulate a database-level reorder. The hash chain will break
// because the previousEventHash links no longer match.
const reordered = reorderChain.map((e, i) => {
  if (i === 1) return { ...reorderChain[2], sequence: 1 }
  if (i === 2) return { ...reorderChain[1], sequence: 2 }
  return e
})

const reorderResult = verifyHashChain(reordered)
assertPass(!reorderResult.valid, 'Chain fails after event reordering')
const chainSevered = reorderResult.failures.some(f => f.type === 'CHAIN_SEVERED')
assertPass(chainSevered, 'Reordering detected as chain severance')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 13: Signature Impersonation Detection
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 13: Signature Impersonation Detection')

const impersonateChain = buildValidChain(TEST_KEYPAIR, 3)

// Attacker re-signs event[1] with their own key but keeps the original public key claim
const attackerSig = signEventHash(impersonateChain[1].eventHash, ATTACKER_KEYPAIR.secretKey)
const impersonatedChain = impersonateChain.map((e, i) => {
  if (i === 1) {
    return { ...e, signature: attackerSig } // Wrong signature, right public key
  }
  return e
})

const impersonateResult = verifyHashChain(impersonatedChain)
assertPass(!impersonateResult.valid, 'Chain fails when signature is replaced by attacker')
const sigFailed = impersonateResult.failures.some(f => f.type === 'SIGNATURE_INVALID' && f.eventSequence === 1)
assertPass(sigFailed, 'Impersonation detected at exact event sequence 1')

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 14: End-to-End Receipt Portability & Independent Verification
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n► SUITE 14: End-to-End Receipt Portability & Independent Verification')

// Full lifecycle test using ProvnAgentRuntime
const runtime = new ProvnAgentRuntime(TEST_KEYPAIR)
assertPass(runtime.getAgentPublicKey() === TEST_PUBLIC_KEY, 'Runtime agent public key matches')

const exec = runtime.startExecution({ taskDescription: 'Integration test task', agentName: 'test-agent' })
assertPass(exec.events.length === 1, 'startExecution logs agent.started event')
assertPass(exec.events[0].eventType === 'agent.started', 'First event is agent.started')

// Log real actions
runtime.logAction(exec, 'file.read', {
  type: 'file.read',
  path: '/test/config.json',
  contentHash: sha256('{"key": "value"}'),
  sizeBytes: 16,
})

runtime.logAction(exec, 'file.write', {
  type: 'file.write',
  path: '/test/output.txt',
  contentHash: sha256('output content'),
  previousContentHash: null,
  sizeBytes: 14,
  operation: 'create',
})

runtime.logAction(exec, 'shell.execute', {
  type: 'shell.execute',
  commandHash: sha256('echo "hello"'),
  cwdHash: sha256('/test'),
  exitCode: 0,
  stdoutHash: sha256('hello\n'),
  stderrHash: sha256(''),
})

assertPass(exec.events.length === 4, '4 events before finalization')

// Build Solana anchor reference
const anchorReference = buildAnchorReference(
  new PublicKey(TEST_PUBLIC_KEY),
  'batch-integration-test',
  'devnet'
)

// Finalize execution
const receipt = runtime.finalizeExecution(exec, 'Integration test completed', anchorReference)

assertPass(receipt.protocol === 'PROVN', 'Receipt protocol is PROVN')
assertPass(receipt.version === 'agent/1', 'Receipt version is agent/1')
assertPass(receipt.events.length === 5, 'Receipt contains 5 events (4 + agent.completed)')
assertPass(receipt.events[4].eventType === 'agent.completed', 'Last event is agent.completed')
assertPass(receipt.merkle.root.length === 64, 'Receipt has valid Merkle root')
assertPass(receipt.merkle.proofs.length === 5, 'Receipt has 5 Merkle inclusion proofs')
assertPass(receipt.execution.status === 'completed', 'Execution status is completed')
assertPass(receipt.solana !== null, 'Receipt has Solana anchor reference')

// ── Verification: PASS ──
const verifyResult = ProvnAgentRuntime.verifyReceipt(receipt)
assertPass(verifyResult.verified, 'Receipt verification PASSES')
assertPass(verifyResult.layers.agentSignature === 'VALID', 'Agent signature layer is VALID')
assertPass(verifyResult.layers.eventHash === 'VALID', 'Event hash layer is VALID')
assertPass(verifyResult.layers.hashChain === 'VALID', 'Hash chain layer is VALID')
assertPass(verifyResult.layers.merkleInclusion === 'VALID', 'Merkle inclusion layer is VALID')
assertPass(verifyResult.layers.merkleRoot === 'VALID', 'Merkle root layer is VALID')
assertPass(verifyResult.eventsChecked === 5, 'All 5 events checked')
assertPass(verifyResult.eventsPassed === 5, 'All 5 events passed')
assertPass(verifyResult.failures.length === 0, 'Zero failures')

// ── Serialization round-trip ──
const serialized = ProvnAgentRuntime.serializeReceipt(receipt)
const deserialized = deserializeReceipt(serialized)
const roundTripResult = ProvnAgentRuntime.verifyReceipt(deserialized)
assertPass(roundTripResult.verified, 'Receipt survives JSON serialization round-trip')

// ── Tamper AFTER receipt generation → FAIL ──
const tamperedReceipt: AgentReceipt = JSON.parse(serialized)
// Mutate event[2]'s payloadHash (simulating database tampering)
const originalPayloadHash = tamperedReceipt.events[2].payloadHash
const tamperedBytes = Buffer.from(originalPayloadHash, 'hex')
tamperedBytes[15] ^= 0xff
tamperedReceipt.events[2].payloadHash = tamperedBytes.toString('hex')

const tamperVerifyResult = ProvnAgentRuntime.verifyReceipt(tamperedReceipt)
assertPass(!tamperVerifyResult.verified, 'Tampered receipt verification FAILS')
assertPass(tamperVerifyResult.layers.eventHash === 'INVALID', 'Event hash layer detects tampering')
const tamperFailure = tamperVerifyResult.failures.find(f => f.type === 'EVENT_HASH_MISMATCH')
assertPass(tamperFailure !== undefined, 'Failure report identifies EVENT_HASH_MISMATCH')
assertPass(tamperFailure?.eventSequence === 2, 'Failure identifies exact tampered event at sequence 2')

// ── Human-readable report ──
const passReport = ProvnAgentRuntime.formatReport(receipt, verifyResult)
assertPass(passReport.includes('VERIFICATION PASSED'), 'Pass report contains VERIFICATION PASSED')

const failReport = ProvnAgentRuntime.formatReport(tamperedReceipt, tamperVerifyResult)
assertPass(failReport.includes('INTEGRITY FAILURE'), 'Fail report contains INTEGRITY FAILURE')
assertPass(failReport.includes('EVENT_HASH_MISMATCH'), 'Fail report contains EVENT_HASH_MISMATCH')

// ── Irys evidence envelope ──
const envelope = buildIrysEvidenceEnvelope(receipt)
assertPass((envelope as { protocol: string }).protocol === 'PROVN', 'Irys envelope has protocol PROVN')
assertPass((envelope as { merkleRoot: string }).merkleRoot === receipt.merkle.root, 'Irys envelope has correct Merkle root')

// ── Event type validation ──
assertPass(isValidEventType('agent.started'), 'agent.started is valid event type')
assertPass(isValidEventType('file.write'), 'file.write is valid event type')
assertPass(!isValidEventType('invalid.type'), 'invalid.type is rejected')

// ── Payload hash determinism ──
const payload1 = computePayloadHash({ type: 'file.read', path: '/test', contentHash: 'abc', sizeBytes: 100 })
const payload2 = computePayloadHash({ type: 'file.read', path: '/test', contentHash: 'abc', sizeBytes: 100 })
assertPass(payload1 === payload2, 'Identical payloads produce identical hashes')

const payload3 = computePayloadHash({ type: 'file.read', path: '/test', contentHash: 'xyz', sizeBytes: 100 })
assertPass(payload1 !== payload3, 'Different payloads produce different hashes')

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`   AGENT PROTOCOL SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
