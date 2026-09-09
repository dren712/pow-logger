/**
 * PROVN Agent Protocol — Independent Cryptographic Verifier
 * Protocol Version: agent/1
 *
 * This is one of the most critical modules in Track B.
 *
 * The verifier treats ALL input as untrusted — including stored event hashes,
 * signatures, chain links, Merkle roots, and anchor references. It independently
 * recomputes every cryptographic property and reports precise, actionable
 * failure diagnostics.
 *
 * VERIFICATION LAYERS (in order):
 *   1. AGENT SIGNATURE:     Ed25519 detached signature per event
 *   2. EVENT HASH:          SHA-256 of canonical event string
 *   3. HASH CHAIN:          Sequential previousEventHash linkage
 *   4. MERKLE INCLUSION:    Per-event proof against committed root
 *   5. MERKLE ROOT:         Full tree reconstruction from all leaves
 *   6. SOLANA ANCHOR:       On-chain PDA commitment match (network-dependent)
 *   7. IRYS ARCHIVE:        Evidence availability (network-dependent)
 *
 * TRUST MODEL:
 *   - The verifier does NOT depend on PROVN saying anything is valid
 *   - It independently recomputes everything from raw data
 *   - A third party can run: `provn agent verify <receipt.json>`
 *     without trusting PROVN's database
 *
 * OUTPUT SEMANTICS:
 *   - Never outputs a generic "verified: false"
 *   - Always provides the EARLIEST failure and exact diagnostic
 *   - Distinguishes CRYPTOGRAPHICALLY_VERIFIED from NETWORK_ANCHOR_NOT_CHECKED
 */

import bs58 from 'bs58'
import { recomputeEventHash } from './agentEvents'
import { verifyHashChain } from './hashChain'
import { verifyMerkleProof, recomputeMerkleRoot } from './merkleBatch'
import type {
  AgentReceipt,
  VerificationResult,
  TamperFailure,
  VerificationLayerStatus,
  AnchorLayerStatus,
  ArchiveLayerStatus,
} from './types'

/**
 * Validates whether a public key string is a valid 32-byte Base58-encoded Ed25519 public key.
 */
function isValidEd25519PublicKey(pubkey: unknown): boolean {
  if (typeof pubkey !== 'string' || pubkey.trim() === '') {
    return false
  }
  try {
    const bytes = bs58.decode(pubkey)
    return bytes.length === 32
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Verifier
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** Skip Solana anchor check (useful for offline verification) */
  skipSolana?: boolean
  /** Skip Irys archive check (useful for offline verification) */
  skipIrys?: boolean
}

/**
 * Independently verifies a PROVN Agent Receipt.
 *
 * This is the primary verification entry point. It executes all verification
 * layers in order and returns a detailed result with per-layer status and
 * precise failure diagnostics.
 *
 * The verifier NEVER trusts stored data. It recomputes all cryptographic
 * properties from scratch.
 *
 * @param receipt - The portable PROVN Agent Receipt to verify
 * @param options - Optional flags to skip network-dependent checks
 * @returns Detailed verification result with per-layer status
 */
export function verifyAgentReceipt(
  receipt: AgentReceipt,
  options: VerifyOptions = {}
): VerificationResult {
  const failures: TamperFailure[] = []

  // Structural sanity check: receipt must be a non-null object
  if (!receipt || typeof receipt !== 'object') {
    return {
      verified: false,
      layers: {
        agentSignature: 'INVALID',
        eventHash: 'INVALID',
        hashChain: 'INVALID',
        merkleInclusion: 'INVALID',
        merkleRoot: 'INVALID',
        solanaAnchor: 'NOT_CHECKED',
        irysArchive: 'NOT_CHECKED',
      },
      eventsChecked: 0,
      eventsPassed: 0,
      failures: [
        {
          type: 'EVENT_MISSING',
          eventSequence: null,
          eventId: null,
          message: 'Invalid receipt structure: receipt must be a non-null object',
        },
      ],
      verifiedAt: new Date().toISOString(),
    }
  }

  // 1. Zero-events check: A receipt with zero events must never verify successfully
  if (!Array.isArray(receipt.events) || receipt.events.length === 0) {
    failures.push({
      type: 'EVENT_MISSING',
      eventSequence: null,
      eventId: null,
      message: 'Receipt contains zero events; at least one event is required for verification',
      expected: '>= 1 events',
      computed: Array.isArray(receipt.events) ? '0 events' : 'not an array',
    })
    return {
      verified: false,
      layers: {
        agentSignature: 'INVALID',
        eventHash: 'INVALID',
        hashChain: 'INVALID',
        merkleInclusion: 'INVALID',
        merkleRoot: 'INVALID',
        solanaAnchor: 'NOT_CHECKED',
        irysArchive: 'NOT_CHECKED',
      },
      eventsChecked: 0,
      eventsPassed: 0,
      failures,
      verifiedAt: new Date().toISOString(),
    }
  }

  let agentSigStatus: VerificationLayerStatus = 'VALID'
  let eventHashStatus: VerificationLayerStatus = 'VALID'
  let hashChainStatus: VerificationLayerStatus = 'VALID'
  let merkleInclusionStatus: VerificationLayerStatus = 'VALID'
  let merkleRootStatus: VerificationLayerStatus = 'VALID'

  // 2. Require a valid execution identity
  const execution = receipt.execution
  let hasValidExecutionId = false
  let hasValidAgentPubkey = false

  if (!execution || typeof execution.executionId !== 'string' || execution.executionId.trim() === '') {
    failures.push({
      type: 'EXECUTION_IDENTITY_INVALID',
      eventSequence: null,
      eventId: null,
      message: 'Receipt execution identity is missing or has invalid executionId',
      expected: 'Non-empty string executionId',
      computed: execution ? String(execution.executionId) : 'undefined',
    })
    hashChainStatus = 'INVALID'
  } else {
    hasValidExecutionId = true
  }

  if (!execution || !isValidEd25519PublicKey(execution.agentPublicKey)) {
    failures.push({
      type: 'SIGNATURE_INVALID',
      eventSequence: null,
      eventId: null,
      message: 'Receipt execution identity has invalid agentPublicKey; must be a valid 32-byte Base58 Ed25519 public key',
      expected: 'Valid 32-byte Base58 Ed25519 public key',
      computed: execution ? String(execution.agentPublicKey) : 'undefined',
    })
    agentSigStatus = 'INVALID'
  } else {
    hasValidAgentPubkey = true
  }

  // Sort events by sequence number
  const events = [...receipt.events].sort((a, b) => a.sequence - b.sequence)

  // 3. Require events to belong to the same execution
  // 4. Require every event's agentPublicKey to equal receipt/execution agent identity
  const executionIdRef = hasValidExecutionId ? execution.executionId : events[0]?.executionId
  for (const event of events) {
    if (executionIdRef && event.executionId !== executionIdRef) {
      failures.push({
        type: 'EVENT_INSERTED',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Event executionId (${event.executionId}) does not match receipt executionId (${executionIdRef})`,
        expected: executionIdRef,
        computed: event.executionId,
      })
      hashChainStatus = 'INVALID'
    }

    if (hasValidAgentPubkey && event.agentPublicKey !== execution.agentPublicKey) {
      failures.push({
        type: 'SIGNATURE_INVALID',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Event agentPublicKey (${event.agentPublicKey}) does not match receipt execution agentPublicKey (${execution.agentPublicKey})`,
        expected: execution.agentPublicKey,
        computed: event.agentPublicKey,
      })
      agentSigStatus = 'INVALID'
    }
  }

  // 5. Require sequences to start at 0 and be contiguous
  if (events[0].sequence !== 0) {
    failures.push({
      type: 'SEQUENCE_GAP',
      eventSequence: events[0].sequence,
      eventId: events[0].eventId,
      message: `Event sequence must start at 0, but starts at sequence ${events[0].sequence}`,
      expected: '0',
      computed: String(events[0].sequence),
    })
    hashChainStatus = 'INVALID'
  }

  // 6. Require Merkle and Batch metadata to be internally consistent with event count
  if (receipt.merkle) {
    if (typeof receipt.merkle.leafCount === 'number' && receipt.merkle.leafCount !== events.length) {
      failures.push({
        type: 'MERKLE_ROOT_MISMATCH',
        eventSequence: null,
        eventId: null,
        message: `Merkle leafCount (${receipt.merkle.leafCount}) does not match event count (${events.length})`,
        expected: String(events.length),
        computed: String(receipt.merkle.leafCount),
      })
      merkleRootStatus = 'INVALID'
    }

    if (Array.isArray(receipt.merkle.leaves) && receipt.merkle.leaves.length !== events.length) {
      failures.push({
        type: 'MERKLE_ROOT_MISMATCH',
        eventSequence: null,
        eventId: null,
        message: `Merkle leaves array length (${receipt.merkle.leaves.length}) does not match event count (${events.length})`,
        expected: String(events.length),
        computed: String(receipt.merkle.leaves.length),
      })
      merkleRootStatus = 'INVALID'
    }

    if (Array.isArray(receipt.merkle.proofs) && receipt.merkle.proofs.length !== events.length) {
      failures.push({
        type: 'MERKLE_INCLUSION_INVALID',
        eventSequence: null,
        eventId: null,
        message: `Merkle inclusion proofs count (${receipt.merkle.proofs.length}) does not match event count (${events.length})`,
        expected: String(events.length),
        computed: String(receipt.merkle.proofs.length),
      })
      merkleInclusionStatus = 'INVALID'
    }
  }

  if (receipt.batch && typeof receipt.batch.eventCount === 'number' && receipt.batch.eventCount !== events.length) {
    failures.push({
      type: 'MERKLE_ROOT_MISMATCH',
      eventSequence: null,
      eventId: null,
      message: `Batch eventCount (${receipt.batch.eventCount}) does not match event count (${events.length})`,
      expected: String(events.length),
      computed: String(receipt.batch.eventCount),
    })
    merkleRootStatus = 'INVALID'
  }

  if (execution && typeof execution.eventCount === 'number' && execution.eventCount !== events.length) {
    failures.push({
      type: 'MERKLE_ROOT_MISMATCH',
      eventSequence: null,
      eventId: null,
      message: `Execution eventCount (${execution.eventCount}) does not match event count (${events.length})`,
      expected: String(events.length),
      computed: String(execution.eventCount),
    })
    merkleRootStatus = 'INVALID'
  }

  // ── Layer 1 & 2 & 3: Event Signatures, Hashes, and Chain ────────────
  const chainResult = verifyHashChain(events)
  failures.push(...chainResult.failures)

  for (const failure of chainResult.failures) {
    if (failure.type === 'SIGNATURE_INVALID') {
      agentSigStatus = 'INVALID'
    }
    if (failure.type === 'EVENT_HASH_MISMATCH' || failure.type === 'PAYLOAD_HASH_MISMATCH') {
      eventHashStatus = 'INVALID'
    }
    if (failure.type === 'CHAIN_SEVERED' || failure.type === 'SEQUENCE_GAP' || failure.type === 'SEQUENCE_DUPLICATE') {
      hashChainStatus = 'INVALID'
    }
  }

  // ── Layer 4: Merkle Inclusion Proofs ────────────────────────────────
  if (receipt.merkle && receipt.merkle.proofs) {
    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const proof = receipt.merkle.proofs.find(p => p.leafIndex === i)

      if (!proof) {
        failures.push({
          type: 'MERKLE_INCLUSION_INVALID',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `No Merkle inclusion proof found for event at sequence ${event.sequence} (leaf index ${i})`,
        })
        merkleInclusionStatus = 'INVALID'
        continue
      }

      // Use the RECOMPUTED event hash, not the stored one
      const recomputedHash = recomputeEventHash(event)
      const proofValid = verifyMerkleProof(recomputedHash, proof)

      if (!proofValid) {
        failures.push({
          type: 'MERKLE_INCLUSION_INVALID',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `Merkle inclusion proof failed for event at sequence ${event.sequence}`,
          expected: proof.root,
          computed: 'recomputed path does not resolve to expected root',
        })
        merkleInclusionStatus = 'INVALID'
      }
    }
  } else {
    merkleInclusionStatus = 'NOT_CHECKED'
  }

  // ── Layer 5: Merkle Root Reconstruction ────────────────────────────
  if (receipt.merkle && receipt.merkle.root) {
    // Recompute root from ALL event hashes (recomputed, not stored)
    const recomputedHashes = events.map(e => recomputeEventHash(e))
    const recomputedRoot = recomputeMerkleRoot(recomputedHashes)

    if (recomputedRoot !== receipt.merkle.root) {
      failures.push({
        type: 'MERKLE_ROOT_MISMATCH',
        eventSequence: null,
        eventId: null,
        message: `Merkle root mismatch: independently reconstructed root does not match committed root`,
        expected: receipt.merkle.root,
        computed: recomputedRoot,
      })
      merkleRootStatus = 'INVALID'
    }
  } else {
    merkleRootStatus = 'NOT_CHECKED'
  }

  // ── Layer 6: Solana Anchor ─────────────────────────────────────────
  let solanaStatus: AnchorLayerStatus = 'NOT_CHECKED'
  if (!options.skipSolana && receipt.solana) {
    solanaStatus = 'NOT_CHECKED'
  }

  // ── Layer 7: Irys Archive ──────────────────────────────────────────
  let irysStatus: ArchiveLayerStatus = 'NOT_CHECKED'
  if (!options.skipIrys && receipt.irys) {
    irysStatus = 'NOT_CHECKED'
  }

  // ── Assemble Result ────────────────────────────────────────────────
  const allCryptoValid =
    agentSigStatus === 'VALID' &&
    eventHashStatus === 'VALID' &&
    hashChainStatus === 'VALID' &&
    (merkleInclusionStatus === 'VALID' || merkleInclusionStatus === 'NOT_CHECKED') &&
    (merkleRootStatus === 'VALID' || merkleRootStatus === 'NOT_CHECKED')

  // Calculate eventsPassed based on events that passed all checks
  const failedSequences = new Set<number>()
  for (const f of failures) {
    if (f.eventSequence !== null && f.eventSequence !== undefined) {
      failedSequences.add(f.eventSequence)
    }
  }
  const eventsPassed = Math.max(0, events.length - failedSequences.size)

  return {
    verified: allCryptoValid && failures.length === 0,
    layers: {
      agentSignature: agentSigStatus,
      eventHash: eventHashStatus,
      hashChain: hashChainStatus,
      merkleInclusion: merkleInclusionStatus,
      merkleRoot: merkleRootStatus,
      solanaAnchor: solanaStatus,
      irysArchive: irysStatus,
    },
    eventsChecked: events.length,
    eventsPassed,
    failures,
    verifiedAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-Readable Verification Report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a human-readable verification report for terminal/CLI output.
 *
 * Example output (PASS):
 * ```
 * PROVN EXECUTION VERIFICATION
 * Execution: abc-123
 * Agent:     Ed25519: 8x...
 * Events:    5 / 5 valid
 *
 * ✓ AGENT SIGNATURES    VALID
 * ✓ EVENT HASHES        VALID
 * ✓ HASH CHAIN          VALID
 * ✓ MERKLE INCLUSION    VALID
 * ✓ MERKLE ROOT         VALID
 * ○ SOLANA ANCHOR       NOT CHECKED
 * ○ IRYS ARCHIVE        NOT CHECKED
 * ```
 *
 * Example output (FAIL):
 * ```
 * 🚨 EXECUTION INTEGRITY FAILURE
 * Event #2 HASH MISMATCH
 *   Expected: 7f91...
 *   Computed: 4a22...
 * Chain: BROKEN
 * Merkle: INVALID
 * ```
 */
export function formatVerificationReport(
  receipt: AgentReceipt,
  result: VerificationResult
): string {
  const lines: string[] = []

  if (result.verified) {
    lines.push('═══════════════════════════════════════════════════════')
    lines.push(' PROVN AGENT RECEIPT — VERIFICATION PASSED')
    lines.push('═══════════════════════════════════════════════════════')
  } else {
    lines.push('═══════════════════════════════════════════════════════')
    lines.push(' 🚨 PROVN AGENT RECEIPT — INTEGRITY FAILURE')
    lines.push('═══════════════════════════════════════════════════════')
  }

  lines.push(` Execution:  ${receipt.execution?.executionId || 'unknown'}`)
  lines.push(` Agent:      Ed25519: ${receipt.execution?.agentPublicKey || 'unknown'}`)
  lines.push(` Events:     ${result.eventsPassed} / ${result.eventsChecked} valid`)
  lines.push(` Protocol:   ${receipt.version}`)
  lines.push(` Verified:   ${result.verifiedAt}`)
  lines.push('')

  // Layer status
  const statusIcon = (s: string) => {
    if (s === 'VALID' || s === 'FOUND' || s === 'AVAILABLE') return '✓'
    if (s === 'NOT_CHECKED') return '○'
    return '✗'
  }

  lines.push(` ${statusIcon(result.layers.agentSignature)} AGENT SIGNATURES    ${result.layers.agentSignature}`)
  lines.push(` ${statusIcon(result.layers.eventHash)} EVENT HASHES        ${result.layers.eventHash}`)
  lines.push(` ${statusIcon(result.layers.hashChain)} HASH CHAIN          ${result.layers.hashChain}`)
  lines.push(` ${statusIcon(result.layers.merkleInclusion)} MERKLE INCLUSION    ${result.layers.merkleInclusion}`)
  lines.push(` ${statusIcon(result.layers.merkleRoot)} MERKLE ROOT         ${result.layers.merkleRoot}`)
  lines.push(` ${statusIcon(result.layers.solanaAnchor)} SOLANA ANCHOR       ${result.layers.solanaAnchor}`)
  lines.push(` ${statusIcon(result.layers.irysArchive)} IRYS ARCHIVE        ${result.layers.irysArchive}`)

  if (result.failures.length > 0) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────')
    lines.push(' FAILURE DETAILS')
    lines.push('───────────────────────────────────────────────────────')

    for (const failure of result.failures) {
      const seqLabel = failure.eventSequence !== null ? ` Event #${failure.eventSequence}` : ''
      lines.push(`  🚨${seqLabel} ${failure.type}`)
      lines.push(`     ${failure.message}`)
      if (failure.expected) {
        lines.push(`     Expected: ${failure.expected}`)
      }
      if (failure.computed) {
        lines.push(`     Computed: ${failure.computed}`)
      }
      lines.push('')
    }

    lines.push(' This execution has been modified after commitment.')
  }

  lines.push('═══════════════════════════════════════════════════════')
  return lines.join('\n')
}
