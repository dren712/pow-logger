/**
 * PROVN Agent Protocol — Portable Receipt Builder
 * Protocol Version: agent/1
 *
 * Constructs portable PROVN Agent Receipts that contain all the information
 * an independent verifier needs to validate an execution's integrity:
 *
 *   - Execution metadata
 *   - Complete signed event list
 *   - Hash chain (implicit in event ordering and previousEventHash fields)
 *   - Merkle tree with per-event inclusion proofs
 *   - Solana anchor reference
 *   - Irys archive reference
 *
 * The receipt is designed to be fully self-contained. A verifier can validate
 * the cryptographic integrity of the receipt WITHOUT contacting the PROVN
 * web application or database.
 *
 * PORTABILITY:
 *   - JSON serializable
 *   - No dependencies on PROVN infrastructure for core crypto verification
 *   - Solana and Irys checks require network access but are clearly separated
 */

import { buildMerkleTree } from './merkleBatch'
import {
  AGENT_PROTOCOL_VERSION,
  type AgentEvent,
  type AgentExecution,
  type AgentBatch,
  type AgentReceipt,
  type AnchorReference,
  type IrysArchiveReference,
} from './types'
import { generateId } from './agentEvents'

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a portable PROVN Agent Receipt from a completed execution.
 *
 * This function:
 * 1. Sorts events by sequence number
 * 2. Builds the Merkle tree from event hashes
 * 3. Constructs the batch object
 * 4. Assembles the complete receipt with all verification layers
 *
 * @param execution - The completed execution metadata
 * @param events - All events belonging to the execution (in any order)
 * @param anchorRef - Optional Solana anchor reference (null if not yet anchored)
 * @param irysRef - Optional Irys archive reference (null if not yet archived)
 * @returns Complete portable AgentReceipt
 */
export function buildAgentReceipt(
  execution: AgentExecution,
  events: AgentEvent[],
  anchorRef: AnchorReference | null = null,
  irysRef: IrysArchiveReference | null = null
): AgentReceipt {
  if (events.length === 0) {
    throw new Error('Cannot build receipt from empty event list')
  }

  // Sort events by sequence for deterministic Merkle tree construction
  const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence)

  // Defensive integrity assertions: verify execution, identity binding, and sequence continuity
  for (let i = 0; i < sortedEvents.length; i++) {
    const e = sortedEvents[i]
    if (e.executionId !== execution.executionId) {
      throw new Error(
        `RECEIPT_INTEGRITY_ERROR: Event ${e.eventId} executionId (${e.executionId}) does not match execution (${execution.executionId})`
      )
    }
    if (e.agentPublicKey !== execution.agentPublicKey) {
      throw new Error(
        `RECEIPT_INTEGRITY_ERROR: Event ${e.eventId} agentPublicKey (${e.agentPublicKey}) does not match execution (${execution.agentPublicKey})`
      )
    }
    if (e.sequence !== i) {
      throw new Error(
        `RECEIPT_INTEGRITY_ERROR: Non-contiguous sequence: expected ${i}, found ${e.sequence}`
      )
    }
  }

  // Build Merkle tree from event hashes (in sequence order)
  const eventHashes = sortedEvents.map(e => e.eventHash)
  const merkleTree = buildMerkleTree(eventHashes)

  // Construct batch
  const batch: AgentBatch = {
    batchId: generateId(),
    protocolVersion: AGENT_PROTOCOL_VERSION,
    createdAt: new Date().toISOString(),
    eventCount: sortedEvents.length,
    firstSequence: sortedEvents[0].sequence,
    lastSequence: sortedEvents[sortedEvents.length - 1].sequence,
    merkleRoot: merkleTree.root,
    executionIds: [execution.executionId],
    solanaAnchor: anchorRef,
    irysArchive: irysRef,
    status: anchorRef ? (irysRef ? 'archived' : 'anchored') : 'created',
  }

  // Update execution with terminal state
  const finalExecution: AgentExecution = {
    ...execution,
    eventCount: sortedEvents.length,
    terminalEventHash: sortedEvents[sortedEvents.length - 1].eventHash,
    merkleRoot: merkleTree.root,
    anchorReference: anchorRef,
  }

  return {
    protocol: 'PROVN',
    version: AGENT_PROTOCOL_VERSION,
    generatedAt: new Date().toISOString(),
    execution: finalExecution,
    events: sortedEvents,
    batch,
    merkle: merkleTree,
    solana: anchorRef,
    irys: irysRef,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes a receipt to a portable JSON string.
 * Uses 2-space indentation for readability.
 */
export function serializeReceipt(receipt: AgentReceipt): string {
  return JSON.stringify(receipt, null, 2)
}

/**
 * Deserializes a receipt from a JSON string.
 * Performs basic structural validation.
 *
 * @throws Error if the JSON is invalid or missing required fields
 */
export function deserializeReceipt(json: string): AgentReceipt {
  const parsed = JSON.parse(json)

  if (parsed.protocol !== 'PROVN') {
    throw new Error(`Invalid receipt protocol: expected "PROVN", got "${parsed.protocol}"`)
  }

  if (parsed.version !== AGENT_PROTOCOL_VERSION) {
    throw new Error(`Unsupported receipt version: expected "${AGENT_PROTOCOL_VERSION}", got "${parsed.version}"`)
  }

  if (!parsed.execution || !parsed.events || !parsed.batch || !parsed.merkle) {
    throw new Error('Receipt is missing required fields: execution, events, batch, or merkle')
  }

  if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new Error('Receipt must contain at least one event')
  }

  return parsed as AgentReceipt
}

// ─────────────────────────────────────────────────────────────────────────────
// Irys Evidence Envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constructs the Irys/Arweave evidence envelope for permanent archival.
 *
 * This envelope contains all the cryptographic evidence needed for
 * independent verification without database access. It is stored
 * permanently on Arweave via Irys.
 *
 * SECURITY: No secrets, API keys, or private key material are included.
 */
export function buildIrysEvidenceEnvelope(receipt: AgentReceipt): object {
  return {
    protocol: 'PROVN',
    version: AGENT_PROTOCOL_VERSION,
    batchId: receipt.batch.batchId,
    merkleRoot: receipt.merkle.root,
    executionId: receipt.execution.executionId,
    agentPublicKey: receipt.execution.agentPublicKey,
    eventCount: receipt.events.length,
    events: receipt.events.map(e => ({
      eventId: e.eventId,
      sequence: e.sequence,
      eventType: e.eventType,
      timestamp: e.timestamp,
      payloadHash: e.payloadHash,
      eventHash: e.eventHash,
      previousEventHash: e.previousEventHash,
      signature: e.signature,
    })),
    createdAt: receipt.batch.createdAt,
    solanaAnchor: receipt.solana ? {
      network: receipt.solana.network,
      signature: receipt.solana.signature,
      pda: receipt.solana.pda,
      programId: receipt.solana.programId,
    } : null,
  }
}
