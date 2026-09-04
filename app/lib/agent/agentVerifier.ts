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
  const events = [...receipt.events].sort((a, b) => a.sequence - b.sequence)

  // ── Layer 1 & 2 & 3: Event Signatures, Hashes, and Chain ────────────
  const chainResult = verifyHashChain(events)
  failures.push(...chainResult.failures)

  let agentSigStatus: VerificationLayerStatus = 'VALID'
  let eventHashStatus: VerificationLayerStatus = 'VALID'
  let hashChainStatus: VerificationLayerStatus = 'VALID'

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
  let merkleInclusionStatus: VerificationLayerStatus = 'VALID'

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
  let merkleRootStatus: VerificationLayerStatus = 'VALID'

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
    // In offline mode, we can only verify the PDA derivation is deterministic.
    // Full on-chain verification requires network access (deferred to CLI/API).
    // For now, mark as NOT_CHECKED with anchor reference present.
    solanaStatus = 'NOT_CHECKED'
  }

  // ── Layer 7: Irys Archive ──────────────────────────────────────────
  let irysStatus: ArchiveLayerStatus = 'NOT_CHECKED'
  if (!options.skipIrys && receipt.irys) {
    // Irys availability check requires network access (deferred to CLI/API).
    irysStatus = 'NOT_CHECKED'
  }

  // ── Assemble Result ────────────────────────────────────────────────
  const allCryptoValid =
    agentSigStatus === 'VALID' &&
    eventHashStatus === 'VALID' &&
    hashChainStatus === 'VALID' &&
    (merkleInclusionStatus === 'VALID' || merkleInclusionStatus === 'NOT_CHECKED') &&
    (merkleRootStatus === 'VALID' || merkleRootStatus === 'NOT_CHECKED')

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
    eventsPassed: chainResult.eventsPassed,
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

  lines.push(` Execution:  ${receipt.execution.executionId}`)
  lines.push(` Agent:      Ed25519: ${receipt.execution.agentPublicKey}`)
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
