/**
 * PROVN Agent Protocol — High-Level SDK Runtime
 * Protocol Version: agent/1
 *
 * Provides a clean, ergonomic API for agent developers to produce
 * cryptographically verifiable execution receipts.
 *
 * USAGE:
 * ```ts
 * import { ProvnAgentRuntime } from './agentSdk'
 *
 * const runtime = new ProvnAgentRuntime(agentKeypair)
 * const exec = runtime.startExecution({ taskDescription: 'Deploy service' })
 *
 * runtime.logAction(exec, 'file.read', { type: 'file.read', path: '/etc/config', contentHash: '...', sizeBytes: 1024 })
 * runtime.logAction(exec, 'shell.execute', { type: 'shell.execute', commandHash: '...', ... })
 *
 * const receipt = runtime.finalizeExecution(exec)
 * const result = runtime.verifyReceipt(receipt)
 * ```
 *
 * DESIGN:
 *   - The runtime manages execution state, event sequencing, and hash chain linking
 *   - The developer only needs to describe WHAT happened (event type + payload)
 *   - The runtime handles HOW it's cryptographically committed
 *   - All sensitive content should be pre-hashed before passing as payload
 */

import bs58 from 'bs58'
import {
  createSignedEvent,
  generateId,
  sha256,
} from './agentEvents'
import { buildAgentReceipt, serializeReceipt } from './agentReceipt'
import { verifyAgentReceipt, formatVerificationReport, type VerifyOptions } from './agentVerifier'
import {
  AGENT_PROTOCOL_VERSION,
  type AgentEvent,
  type AgentExecution,
  type AgentEventType,
  type PayloadCommitment,
  type AgentReceipt,
  type VerificationResult,
  type AnchorReference,
  type IrysArchiveReference,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Execution State
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionState {
  execution: AgentExecution
  events: AgentEvent[]
  nextSequence: number
  lastEventHash: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime
// ─────────────────────────────────────────────────────────────────────────────

export class ProvnAgentRuntime {
  private readonly secretKey: Uint8Array
  private readonly publicKey: Uint8Array
  private readonly publicKeyBase58: string
  private readonly executions: Map<string, ExecutionState> = new Map()

  /**
   * Creates a new agent runtime with the given Ed25519 keypair.
   *
   * @param keypair - nacl.sign.keyPair() result with publicKey and secretKey
   */
  constructor(keypair: { publicKey: Uint8Array; secretKey: Uint8Array }) {
    if (keypair.secretKey.length !== 64) {
      throw new Error('Agent secret key must be 64 bytes (Ed25519 seed + public key)')
    }
    if (keypair.publicKey.length !== 32) {
      throw new Error('Agent public key must be 32 bytes')
    }

    this.secretKey = keypair.secretKey
    this.publicKey = keypair.publicKey
    this.publicKeyBase58 = bs58.encode(keypair.publicKey)
  }

  /**
   * Returns the agent's Base58-encoded public key.
   */
  getAgentPublicKey(): string {
    return this.publicKeyBase58
  }

  /**
   * Starts a new execution session.
   *
   * @param taskMeta - Optional metadata about the task being executed
   * @returns The execution state (pass this to logAction and finalizeExecution)
   */
  startExecution(taskMeta?: { taskDescription?: string; agentName?: string }): ExecutionState {
    const executionId = generateId()
    const now = new Date().toISOString()

    const execution: AgentExecution = {
      executionId,
      agentPublicKey: this.publicKeyBase58,
      startedAt: now,
      completedAt: null,
      status: 'running',
      eventCount: 0,
      terminalEventHash: null,
      merkleRoot: null,
      anchorReference: null,
      protocolVersion: AGENT_PROTOCOL_VERSION,
    }

    const state: ExecutionState = {
      execution,
      events: [],
      nextSequence: 0,
      lastEventHash: null,
    }

    this.executions.set(executionId, state)

    // Automatically log agent.started event if task metadata is provided
    if (taskMeta) {
      this.logAction(state, 'agent.started', {
        type: 'agent.started',
        taskDescription: taskMeta.taskDescription ?? 'Execution started',
        agentName: taskMeta.agentName,
      })
    }

    return state
  }

  /**
   * Logs an action as a signed, chained event within an execution.
   *
   * @param state - The execution state (from startExecution)
   * @param eventType - The type of action
   * @param payload - The payload commitment (pre-hashed sensitive data)
   * @param parentEventId - Optional parent event for hierarchical relationships
   * @returns The created and signed AgentEvent
   */
  logAction(
    state: ExecutionState,
    eventType: AgentEventType,
    payload: PayloadCommitment,
    parentEventId?: string
  ): AgentEvent {
    if (state.execution.status !== 'running') {
      throw new Error(`Cannot log actions to a ${state.execution.status} execution`)
    }

    const event = createSignedEvent({
      eventId: generateId(),
      executionId: state.execution.executionId,
      sequence: state.nextSequence,
      agentPublicKey: this.publicKeyBase58,
      eventType,
      timestamp: new Date().toISOString(),
      parentEventId: parentEventId ?? null,
      previousEventHash: state.lastEventHash,
      payload,
    }, this.secretKey)

    state.events.push(event)
    state.lastEventHash = event.eventHash
    state.nextSequence++

    return event
  }

  /**
   * Finalizes an execution and produces a portable receipt.
   *
   * @param state - The execution state to finalize
   * @param summary - Optional summary of what the execution accomplished
   * @param anchorRef - Optional Solana anchor reference
   * @param irysRef - Optional Irys archive reference
   * @returns The portable PROVN Agent Receipt
   */
  finalizeExecution(
    state: ExecutionState,
    summary?: string,
    anchorRef?: AnchorReference | null,
    irysRef?: IrysArchiveReference | null
  ): AgentReceipt {
    if (state.execution.status !== 'running') {
      throw new Error(`Cannot finalize a ${state.execution.status} execution`)
    }

    // Log the agent.completed event
    this.logAction(state, 'agent.completed', {
      type: 'agent.completed',
      summary: summary ?? 'Execution completed',
      eventCount: state.events.length + 1, // +1 for the completed event itself
    })

    // Update execution metadata
    state.execution.status = 'completed'
    state.execution.completedAt = new Date().toISOString()

    // Build the receipt
    const receipt = buildAgentReceipt(
      state.execution,
      state.events,
      anchorRef ?? null,
      irysRef ?? null
    )

    return receipt
  }

  /**
   * Marks an execution as failed and produces a receipt.
   *
   * @param state - The execution state
   * @param error - Error description
   * @returns The portable PROVN Agent Receipt (with failed status)
   */
  failExecution(
    state: ExecutionState,
    error: string,
    anchorRef?: AnchorReference | null,
    irysRef?: IrysArchiveReference | null
  ): AgentReceipt {
    if (state.execution.status !== 'running') {
      throw new Error(`Cannot fail a ${state.execution.status} execution`)
    }

    // Log the agent.failed event
    this.logAction(state, 'agent.failed', {
      type: 'agent.failed',
      error,
      lastSuccessfulSequence: state.nextSequence - 2, // -2 because logAction increments first
    })

    state.execution.status = 'failed'
    state.execution.completedAt = new Date().toISOString()

    return buildAgentReceipt(
      state.execution,
      state.events,
      anchorRef ?? null,
      irysRef ?? null
    )
  }

  /**
   * Verifies a portable PROVN Agent Receipt independently.
   * Does NOT trust any stored data — recomputes all cryptographic properties.
   *
   * @param receipt - The receipt to verify
   * @param options - Optional verification flags
   * @returns Detailed verification result
   */
  static verifyReceipt(receipt: AgentReceipt, options?: VerifyOptions): VerificationResult {
    return verifyAgentReceipt(receipt, options)
  }

  /**
   * Generates a human-readable verification report.
   */
  static formatReport(receipt: AgentReceipt, result: VerificationResult): string {
    return formatVerificationReport(receipt, result)
  }

  /**
   * Serializes a receipt to JSON.
   */
  static serializeReceipt(receipt: AgentReceipt): string {
    return serializeReceipt(receipt)
  }

  // ── Convenience Helpers ──────────────────────────────────────────────

  /**
   * Computes SHA-256 hash of a string. Use to pre-hash sensitive content
   * before including in payload commitments.
   */
  static hash(input: string): string {
    return sha256(input)
  }

  /**
   * Generates a cryptographically random UUID.
   */
  static generateId(): string {
    return generateId()
  }
}
