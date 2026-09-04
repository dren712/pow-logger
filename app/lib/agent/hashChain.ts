/**
 * PROVN Agent Protocol — Hash Chain Verification
 * Protocol Version: agent/1
 *
 * Enforces cryptographic hash-chain ordering and sequence integrity across events.
 *
 * CHAIN SEMANTICS:
 *   - Event 0: previousEventHash === null
 *   - Event N: previousEventHash === event[N-1].eventHash
 *   - Sequence numbers are monotonically increasing (0-indexed, gap-free)
 *   - The verifier recomputes all hashes independently — stored hashes are untrusted input
 *
 * DETECTION CAPABILITIES:
 *   - Payload tampering (event content modified after signing)
 *   - Event deletion (missing intermediate event breaks chain)
 *   - Event insertion (unauthorized event breaks chain linkage)
 *   - Event reordering (swapped events produce wrong previousEventHash)
 *   - Sequence gap or duplication
 */

import { recomputeEventHash, verifyEventSignature, computePayloadHash } from './agentEvents'
import type { AgentEvent, TamperFailure } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Chain Verification
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainVerificationResult {
  valid: boolean
  eventsChecked: number
  eventsPassed: number
  failures: TamperFailure[]
}

/**
 * Verifies the complete hash chain and signature integrity of an ordered event sequence.
 *
 * This function treats ALL stored data as untrusted input.
 * It independently:
 *   1. Validates monotonic sequence numbering (0, 1, 2, ...)
 *   2. Recomputes each event hash from the canonical string
 *   3. Verifies the Ed25519 signature over each recomputed event hash
 *   4. Validates the hash-chain linkage (event[N].previousEventHash === event[N-1].eventHash)
 *
 * @param events - Events sorted by sequence number (ascending)
 * @returns Verification result with precise failure diagnostics
 */
export function verifyHashChain(events: AgentEvent[]): ChainVerificationResult {
  const failures: TamperFailure[] = []
  let eventsPassed = 0

  if (events.length === 0) {
    return { valid: true, eventsChecked: 0, eventsPassed: 0, failures: [] }
  }

  // Sort by sequence to ensure correct ordering
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]
    let eventValid = true

    // ── 1. Sequence integrity ──────────────────────────────────────────
    const expectedSequence = i
    if (event.sequence !== expectedSequence) {
      // Determine if this is a gap or a duplicate
      if (i > 0 && event.sequence === sorted[i - 1].sequence) {
        failures.push({
          type: 'SEQUENCE_DUPLICATE',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `Duplicate sequence number ${event.sequence} detected`,
          expected: String(expectedSequence),
          computed: String(event.sequence),
        })
      } else {
        failures.push({
          type: 'SEQUENCE_GAP',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `Expected sequence ${expectedSequence}, found ${event.sequence}`,
          expected: String(expectedSequence),
          computed: String(event.sequence),
        })
      }
      eventValid = false
    }

    // ── 2. Event hash integrity (recompute from canonical string) ─────
    const recomputedHash = recomputeEventHash(event)
    if (recomputedHash !== event.eventHash) {
      failures.push({
        type: 'EVENT_HASH_MISMATCH',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Event hash mismatch at sequence ${event.sequence}: stored hash does not match recomputed canonical hash`,
        expected: event.eventHash,
        computed: recomputedHash,
      })
      eventValid = false
    }

    // ── 2a. Payload integrity: verify structured payload matches payloadHash ──
    if (event.payload) {
      const computedPayloadHash = computePayloadHash(event.payload)
      if (computedPayloadHash !== event.payloadHash) {
        failures.push({
          type: 'EVENT_HASH_MISMATCH',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `Payload hash mismatch at sequence ${event.sequence}: payload content does not match committed payloadHash`,
          expected: event.payloadHash,
          computed: computedPayloadHash,
        })
        eventValid = false
      }
    }

    // ── 3. Signature verification ────────────────────────────────────
    // Verify against the RECOMPUTED hash, not the stored hash.
    // If the hash was tampered, the signature check uses the recomputed hash
    // to determine if the original signing was valid.
    const sigValid = verifyEventSignature(
      recomputedHash,
      event.signature,
      event.agentPublicKey
    )
    if (!sigValid) {
      failures.push({
        type: 'SIGNATURE_INVALID',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Ed25519 signature verification failed at sequence ${event.sequence}`,
      })
      eventValid = false
    }

    // ── 4. Chain linkage ─────────────────────────────────────────────
    if (i === 0) {
      // First event must have null previousEventHash
      if (event.previousEventHash !== null) {
        failures.push({
          type: 'CHAIN_SEVERED',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `First event (sequence 0) must have null previousEventHash, found: ${event.previousEventHash}`,
          expected: 'null',
          computed: event.previousEventHash,
        })
        eventValid = false
      }
    } else {
      // Subsequent events must link to the previous event's hash
      const previousEvent = sorted[i - 1]
      const expectedPreviousHash = previousEvent.eventHash

      if (event.previousEventHash !== expectedPreviousHash) {
        failures.push({
          type: 'CHAIN_SEVERED',
          eventSequence: event.sequence,
          eventId: event.eventId,
          message: `Hash chain broken at sequence ${event.sequence}: previousEventHash does not match event[${i - 1}].eventHash`,
          expected: expectedPreviousHash,
          computed: event.previousEventHash ?? 'null',
        })
        eventValid = false
      }
    }

    if (eventValid) {
      eventsPassed++
    }
  }

  return {
    valid: failures.length === 0,
    eventsChecked: sorted.length,
    eventsPassed,
    failures,
  }
}

/**
 * Validates that events form a valid sequence without gaps or duplicates.
 * This is a lightweight check that does NOT verify hashes or signatures.
 */
export function validateSequenceIntegrity(events: AgentEvent[]): {
  valid: boolean
  failures: TamperFailure[]
} {
  const failures: TamperFailure[] = []
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)
  const seenSequences = new Set<number>()

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]

    if (seenSequences.has(event.sequence)) {
      failures.push({
        type: 'SEQUENCE_DUPLICATE',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Duplicate sequence number ${event.sequence}`,
      })
    }
    seenSequences.add(event.sequence)

    if (event.sequence !== i) {
      failures.push({
        type: 'SEQUENCE_GAP',
        eventSequence: event.sequence,
        eventId: event.eventId,
        message: `Expected sequence ${i}, found ${event.sequence}`,
        expected: String(i),
        computed: String(event.sequence),
      })
    }
  }

  return { valid: failures.length === 0, failures }
}
