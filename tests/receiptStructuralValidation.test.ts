/**
 * PROVN Agent Protocol — Receipt Structural Validation Test Suite
 *
 * Verifies that `verifyAgentReceipt()` strictly enforces structural invariants:
 * 1. A receipt with zero events must NEVER verify successfully (EVENT_MISSING).
 * 2. Missing or invalid execution identity is rejected (EXECUTION_IDENTITY_INVALID / SIGNATURE_INVALID).
 * 3. Events must belong to the same execution (mixed execution IDs rejected with EVENT_INSERTED).
 * 4. Every event's agentPublicKey must equal the execution agent identity (mixed agent identities rejected with SIGNATURE_INVALID).
 * 5. Sequences must start at 0 and be contiguous (SEQUENCE_GAP).
 * 6. Merkle and Batch metadata must be internally consistent with the event count (MERKLE_ROOT_MISMATCH / MERKLE_INCLUSION_INVALID).
 * 7. Verification never throws unhandled generic exceptions on malformed receipts.
 *
 * RUN: npx tsx tests/receiptStructuralValidation.test.ts
 */

import assert from 'node:assert'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'
import { verifyAgentReceipt, formatVerificationReport } from '../app/lib/agent/agentVerifier'
import { sha256 } from '../app/lib/agent/agentEvents'
import type { AgentReceipt, AgentEvent } from '../app/lib/agent/types'

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN TRACK B: RECEIPT STRUCTURAL VALIDATION TEST SUITE       ║')
console.log('╚═══════════════════════════════════════════════════════════════╝\n')

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

/**
 * Creates a valid, cryptographically self-consistent base receipt with 3 events:
 * - Event 0: agent.started
 * - Event 1: file.read
 * - Event 2: agent.completed
 */
function createValidBaseReceipt(): {
  receipt: AgentReceipt
  agentKeypair: nacl.SignKeyPair
  agentPubkey: string
} {
  const agentKeypair = nacl.sign.keyPair()
  const agentPubkey = bs58.encode(agentKeypair.publicKey)
  const runtime = new ProvnAgentRuntime(agentKeypair)

  const executionState = runtime.startExecution({
    taskDescription: 'Structural Invariant Test Execution',
    agentName: 'structural-sentinel-agent',
  })

  runtime.logAction(executionState, 'file.read', {
    path: 'package.json',
    sizeBytes: 512,
    contentHash: sha256('{"name": "pow-logger"}'),
  })

  const receipt = runtime.finalizeExecution(
    executionState,
    'Structural Execution Finalized',
    null // offline verification (no solana anchor required)
  )

  return { receipt, agentKeypair, agentPubkey }
}

async function runStructuralValidationTests() {
  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Zero-Event Receipts Must Never Verify Successfully
  // ───────────────────────────────────────────────────────────────────────────
  console.log('► SUITE 1: Zero-Event Receipts Rejected')

  {
    const { receipt } = createValidBaseReceipt()
    // Mutate receipt to have zero events
    receipt.events = []

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Zero-event receipt strictly fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'EVENT_MISSING'),
      'Failure diagnostic contains EVENT_MISSING'
    )
    assertPass(result.eventsChecked === 0, 'eventsChecked is 0')
    assertPass(result.eventsPassed === 0, 'eventsPassed is 0')

    // Ensure formatReport does not throw on empty receipt
    const report = formatVerificationReport(receipt, result)
    assertPass(
      report.includes('INTEGRITY FAILURE'),
      'formatVerificationReport safely formats zero-event receipt failure'
    )
  }

  {
    // Receipt with events set to null / undefined
    const { receipt } = createValidBaseReceipt()
    ;(receipt as unknown as Record<string, unknown>).events = null

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Null events receipt strictly fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'EVENT_MISSING'),
      'Failure diagnostic contains EVENT_MISSING for null events'
    )
  }

  {
    // Non-object receipt
    const result = verifyAgentReceipt(null as unknown as AgentReceipt)
    assertPass(result.verified === false, 'Null receipt strictly fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'EVENT_MISSING'),
      'Failure diagnostic contains EVENT_MISSING for null receipt'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Execution Identity Validation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 2: Execution Identity Validation')

  {
    const { receipt } = createValidBaseReceipt()
    // Mutate executionId to empty string
    receipt.execution.executionId = ''

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Empty executionId fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'EXECUTION_IDENTITY_INVALID'),
      'Failure diagnostic contains EXECUTION_IDENTITY_INVALID'
    )
  }

  {
    const { receipt } = createValidBaseReceipt()
    // Mutate agentPublicKey to invalid base58 string
    receipt.execution.agentPublicKey = 'invalid-not-base58-key!@#'

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Malformed agentPublicKey fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'SIGNATURE_INVALID'),
      'Failure diagnostic contains SIGNATURE_INVALID for invalid execution pubkey'
    )
  }

  {
    const { receipt } = createValidBaseReceipt()
    // Mutate agentPublicKey to valid base58 but wrong length (16 bytes instead of 32)
    receipt.execution.agentPublicKey = bs58.encode(new Uint8Array(16).fill(1))

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Short agentPublicKey (16 bytes) fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'SIGNATURE_INVALID'),
      'Failure diagnostic contains SIGNATURE_INVALID for short pubkey'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Mixed Execution IDs Across Events Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 3: Mixed Execution IDs Rejected')

  {
    const { receipt } = createValidBaseReceipt()
    assertPass(receipt.events.length >= 2, 'Receipt has multiple events')

    // Attacker injects event sequence 1 from a foreign execution
    const foreignExecutionId = 'foreign-exec-9999-aaaa-bbbb-cccccccccccc'
    receipt.events[1] = {
      ...receipt.events[1],
      executionId: foreignExecutionId,
    }

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Mixed executionId across events fails verification')
    assertPass(
      result.failures.some(
        (f) => f.type === 'EVENT_INSERTED' && f.eventSequence === 1
      ),
      'Failure diagnostic identifies EVENT_INSERTED at sequence 1'
    )
    assertPass(
      result.layers.hashChain === 'INVALID',
      'hashChain layer status is marked INVALID on mixed execution IDs'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Mixed Agent Identities Across Events Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 4: Mixed Agent Identities Rejected')

  {
    const { receipt } = createValidBaseReceipt()
    const attackerKeypair = nacl.sign.keyPair()
    const attackerPubkey = bs58.encode(attackerKeypair.publicKey)

    // Attacker injects foreign agent identity into event sequence 1
    receipt.events[1] = {
      ...receipt.events[1],
      agentPublicKey: attackerPubkey,
    }

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Mixed agent identity across events fails verification')
    assertPass(
      result.failures.some(
        (f) => f.type === 'SIGNATURE_INVALID' && f.eventSequence === 1
      ),
      'Failure diagnostic identifies SIGNATURE_INVALID at sequence 1'
    )
    assertPass(
      result.layers.agentSignature === 'INVALID',
      'agentSignature layer status is marked INVALID on identity mismatch'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Non-Zero Starting Sequence or Sequence Gaps Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 5: Sequence Monotonicity & Zero-Start Enforcement')

  {
    const { receipt } = createValidBaseReceipt()
    // Offset all sequence numbers by +1 (starts at 1 instead of 0)
    receipt.events = receipt.events.map((e) => ({
      ...e,
      sequence: e.sequence + 1,
    }))

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Non-zero start sequence (1) fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'SEQUENCE_GAP'),
      'Failure diagnostic records SEQUENCE_GAP when sequence starts > 0'
    )
  }

  {
    const { receipt } = createValidBaseReceipt()
    // Create a gap: [0, 2, 3] instead of [0, 1, 2]
    receipt.events[1].sequence = 2
    receipt.events[2].sequence = 3

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Sequence gap [0, 2, 3] fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'SEQUENCE_GAP'),
      'Failure diagnostic records SEQUENCE_GAP'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: Inconsistent Event Counts & Merkle Metadata Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 6: Inconsistent Event Counts & Merkle Metadata')

  {
    // Inconsistent Merkle leafCount
    const { receipt } = createValidBaseReceipt()
    receipt.merkle.leafCount = receipt.events.length + 1

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Inconsistent merkle.leafCount fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'MERKLE_ROOT_MISMATCH'),
      'Failure diagnostic records MERKLE_ROOT_MISMATCH for leafCount mismatch'
    )
  }

  {
    // Inconsistent Merkle inclusion proofs length
    const { receipt } = createValidBaseReceipt()
    // Drop one inclusion proof
    receipt.merkle.proofs = receipt.merkle.proofs.slice(0, 1)

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Inconsistent merkle.proofs length fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'MERKLE_INCLUSION_INVALID'),
      'Failure diagnostic records MERKLE_INCLUSION_INVALID'
    )
  }

  {
    // Inconsistent Batch eventCount
    const { receipt } = createValidBaseReceipt()
    receipt.batch.eventCount = receipt.events.length + 5

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Inconsistent batch.eventCount fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'MERKLE_ROOT_MISMATCH'),
      'Failure diagnostic records MERKLE_ROOT_MISMATCH for batch eventCount mismatch'
    )
  }

  {
    // Inconsistent Execution eventCount
    const { receipt } = createValidBaseReceipt()
    receipt.execution.eventCount = receipt.events.length + 2

    const result = verifyAgentReceipt(receipt)
    assertPass(result.verified === false, 'Inconsistent execution.eventCount fails verification')
    assertPass(
      result.failures.some((f) => f.type === 'MERKLE_ROOT_MISMATCH'),
      'Failure diagnostic records MERKLE_ROOT_MISMATCH for execution eventCount mismatch'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 7: Authentic Receipt Passes Cleanly
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 7: Authentic Baseline Receipt Conformance')

  {
    const { receipt } = createValidBaseReceipt()
    const result = verifyAgentReceipt(receipt)

    assertPass(result.verified === true, 'Authentic baseline receipt is 100% verified')
    assertPass(result.failures.length === 0, 'Zero failures reported')
    assertPass(result.eventsChecked === receipt.events.length, 'eventsChecked matches event count')
    assertPass(result.eventsPassed === receipt.events.length, 'eventsPassed matches event count')
    assertPass(result.layers.agentSignature === 'VALID', 'agentSignature is VALID')
    assertPass(result.layers.eventHash === 'VALID', 'eventHash is VALID')
    assertPass(result.layers.hashChain === 'VALID', 'hashChain is VALID')
    assertPass(result.layers.merkleInclusion === 'VALID', 'merkleInclusion is VALID')
    assertPass(result.layers.merkleRoot === 'VALID', 'merkleRoot is VALID')
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`   STRUCTURAL VALIDATION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runStructuralValidationTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
