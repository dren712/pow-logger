/**
 * PROVN Agent Protocol — Canonical Event Builder, Hashing & Signing
 * Protocol Version: agent/1
 *
 * This module implements the deterministic canonical event representation,
 * SHA-256 hashing with domain separation, and Ed25519 event signing.
 *
 * CANONICALIZATION RULES:
 *   - Properties are serialized in a fixed, documented order
 *   - Values are UTF-8 encoded with no trailing whitespace
 *   - Null/absent values use the literal string "none"
 *   - Domain separation prefix "PROVN-AGENT-EVENT-V1" prevents cross-protocol ambiguity
 *   - The canonical string is NEVER JSON — it is a deterministic line-oriented format
 *
 * SECURITY: Never hash JSON.stringify(object) — property ordering is not guaranteed.
 */

import crypto from 'crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import {
  DOMAIN_SEPARATION,
  AGENT_PROTOCOL_VERSION,
  AGENT_EVENT_TYPES,
  type AgentEvent,
  type AgentEventType,
  type PayloadCommitment,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Payload Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the SHA-256 hex digest of a payload commitment.
 * Uses deterministic key-sorted JSON serialization to ensure
 * identical payloads always produce identical hashes.
 */
export function computePayloadHash(payload: PayloadCommitment): string {
  const sortedKeys = Object.keys(payload).sort()
  const canonical = sortedKeys.map(k => {
    const v = payload[k]
    if (v === null || v === undefined) return `${k}:none`
    if (typeof v === 'object') return `${k}:${JSON.stringify(v, Object.keys(v as object).sort())}`
    return `${k}:${String(v)}`
  }).join('\n')

  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')
}

/**
 * Computes SHA-256 hex digest of an arbitrary string.
 * Used for committing to file contents, command strings, stdout, etc.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex')
}

/**
 * Computes SHA-256 hex digest of binary data.
 */
export function sha256Bytes(input: Uint8Array): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Event Format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constructs the deterministic canonical string representation of an agent event.
 *
 * Format (line-oriented, fixed property order):
 * ```
 * PROVN-AGENT-EVENT-V1
 * execution:<executionId>
 * sequence:<sequence>
 * agent:<agentPublicKey>
 * event_type:<eventType>
 * timestamp:<timestamp>
 * parent_event:<parentEventId-or-none>
 * previous_event_hash:<hash-or-none>
 * payload_hash:<sha256>
 * ```
 *
 * This format is intentionally NOT JSON. It is a deterministic line-oriented
 * representation where property order is fixed by specification, not by
 * runtime serialization behavior.
 */
export function buildCanonicalEventString(params: {
  executionId: string
  sequence: number
  agentPublicKey: string
  eventType: AgentEventType
  timestamp: string
  parentEventId: string | null
  previousEventHash: string | null
  payloadHash: string
}): string {
  return [
    DOMAIN_SEPARATION.EVENT,
    `execution:${params.executionId}`,
    `sequence:${params.sequence}`,
    `agent:${params.agentPublicKey}`,
    `event_type:${params.eventType}`,
    `timestamp:${params.timestamp}`,
    `parent_event:${params.parentEventId ?? 'none'}`,
    `previous_event_hash:${params.previousEventHash ?? 'none'}`,
    `payload_hash:${params.payloadHash}`,
  ].join('\n')
}

/**
 * Computes the SHA-256 event hash from the canonical event string.
 * This is the hash that gets signed and linked into the hash chain.
 */
export function computeEventHash(canonicalString: string): string {
  return crypto.createHash('sha256').update(canonicalString, 'utf-8').digest('hex')
}

/**
 * Reconstructs the canonical string from an existing AgentEvent and
 * recomputes the event hash. Used by the verifier to independently
 * validate that the stored eventHash matches the event's content.
 */
export function recomputeEventHash(event: AgentEvent): string {
  const canonical = buildCanonicalEventString({
    executionId: event.executionId,
    sequence: event.sequence,
    agentPublicKey: event.agentPublicKey,
    eventType: event.eventType,
    timestamp: event.timestamp,
    parentEventId: event.parentEventId,
    previousEventHash: event.previousEventHash,
    payloadHash: event.payloadHash,
  })
  return computeEventHash(canonical)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ed25519 Signing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs the event hash bytes with Ed25519 using TweetNaCl.
 * Returns a Base58-encoded detached signature.
 *
 * The signature is over the raw 32-byte SHA-256 digest, not the hex string.
 */
export function signEventHash(eventHashHex: string, secretKey: Uint8Array): string {
  const hashBytes = Buffer.from(eventHashHex, 'hex')
  const signature = nacl.sign.detached(hashBytes, secretKey)
  return bs58.encode(signature)
}

/**
 * Verifies an Ed25519 detached signature over the event hash.
 *
 * @param eventHashHex - SHA-256 hex digest of the canonical event string
 * @param signatureBase58 - Base58-encoded 64-byte Ed25519 signature
 * @param publicKeyBase58 - Base58-encoded 32-byte Ed25519 public key
 * @returns true if the signature is cryptographically valid
 */
export function verifyEventSignature(
  eventHashHex: string,
  signatureBase58: string,
  publicKeyBase58: string
): boolean {
  try {
    const hashBytes = Buffer.from(eventHashHex, 'hex')
    const sigBytes = bs58.decode(signatureBase58)
    const pubBytes = bs58.decode(publicKeyBase58)

    if (sigBytes.length !== 64 || pubBytes.length !== 32) {
      return false
    }

    return nacl.sign.detached.verify(hashBytes, sigBytes, pubBytes)
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a complete, signed AgentEvent.
 *
 * This is the primary event construction function. It:
 * 1. Computes the payload hash from the commitment
 * 2. Builds the canonical event string
 * 3. Computes the event hash (SHA-256 of canonical string)
 * 4. Signs the event hash with the agent's Ed25519 private key
 *
 * @param params - Event parameters
 * @param secretKey - 64-byte Ed25519 secret key (seed + public key)
 * @returns Complete signed AgentEvent
 */
export function createSignedEvent(params: {
  eventId: string
  executionId: string
  sequence: number
  agentPublicKey: string
  eventType: AgentEventType
  timestamp: string
  parentEventId?: string | null
  previousEventHash: string | null
  payload: PayloadCommitment
}, secretKey: Uint8Array): AgentEvent {
  const payloadHash = computePayloadHash(params.payload)

  const canonicalString = buildCanonicalEventString({
    executionId: params.executionId,
    sequence: params.sequence,
    agentPublicKey: params.agentPublicKey,
    eventType: params.eventType,
    timestamp: params.timestamp,
    parentEventId: params.parentEventId ?? null,
    previousEventHash: params.previousEventHash,
    payloadHash,
  })

  const eventHash = computeEventHash(canonicalString)
  const signature = signEventHash(eventHash, secretKey)

  return {
    eventId: params.eventId,
    executionId: params.executionId,
    sequence: params.sequence,
    agentPublicKey: params.agentPublicKey,
    eventType: params.eventType,
    timestamp: params.timestamp,
    parentEventId: params.parentEventId ?? null,
    previousEventHash: params.previousEventHash,
    payloadHash,
    eventHash,
    signature,
    protocolVersion: AGENT_PROTOCOL_VERSION,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that an event type is a recognized V1 event type.
 */
export function isValidEventType(eventType: string): eventType is AgentEventType {
  return (AGENT_EVENT_TYPES as readonly string[]).includes(eventType)
}

/**
 * Generates a cryptographically random UUID v4.
 * Used for executionId and eventId generation.
 */
export function generateId(): string {
  return crypto.randomUUID()
}
