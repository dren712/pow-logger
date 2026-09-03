/**
 * @provn/agent-sdk — High-Level Developer Client
 *
 * Drop-in 3-line SDK to integrate zero-trust cryptographic provenance into
 * AI agents, autonomous coding tools, and CI/CD pipelines.
 *
 * Example:
 * ```typescript
 * import { ProvnAgent } from '@provn/agent-sdk'
 *
 * const provn = new ProvnAgent({ apiKey: process.env.PROVN_API_KEY })
 * const session = await provn.startSession({ taskDescription: 'Deploy production release' })
 *
 * await session.record('shell.execute', { command: 'git push', exitCode: 0 })
 * const receipt = await session.seal('Release completed')
 * console.log('Proof URL:', receipt.proofUrl)
 * ```
 */

import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { ProvnAgentRuntime, type ExecutionState } from './agentSdk'
import type { 
  AgentEventType, 
  PayloadCommitment, 
  AgentReceipt, 
  AgentEvent 
} from './types'

export interface ProvnClientConfig {
  /** Optional API key for project metering & billing */
  apiKey?: string
  /** PROVN API Gateway endpoint (defaults to current origin or https://api.provn.io) */
  gatewayUrl?: string
  /** Sovereign Ed25519 keypair. If omitted, an ephemeral keypair is generated automatically */
  keypair?: nacl.SignKeyPair
  /** Human-readable agent label (e.g. 'Claude 3.5 Sonnet', 'DevOps Bot') */
  agentName?: string
}

export interface StartSessionParams {
  taskDescription: string
  agentName?: string
  parentExecutionId?: string
}

export class ProvnAgentSession {
  public readonly executionId: string
  public readonly agentPublicKey: string
  private runtime: ProvnAgentRuntime
  private state: ExecutionState
  private gatewayUrl: string
  private apiKey?: string

  constructor(
    runtime: ProvnAgentRuntime,
    state: ExecutionState,
    gatewayUrl: string,
    apiKey?: string
  ) {
    this.runtime = runtime
    this.state = state
    this.gatewayUrl = gatewayUrl
    this.apiKey = apiKey
    this.executionId = state.execution.executionId
    this.agentPublicKey = state.execution.agentPublicKey
  }

  /**
   * Records and cryptographically signs an consequential agent action.
   * Streams the signed event to the PROVN Control Plane.
   */
  async record(eventType: AgentEventType, payload: PayloadCommitment): Promise<AgentEvent> {
    const signedEvent = this.runtime.logAction(this.state, eventType, payload)

    // Asynchronously push to gateway (non-blocking)
    if (this.gatewayUrl) {
      this.pushEventToGateway(signedEvent).catch(err => {
        console.warn(`[PROVN SDK] Background gateway sync warning:`, err.message)
      })
    }

    return signedEvent
  }

  /**
   * Finalizes the execution session, seals the batch Merkle root,
   * triggers asynchronous outbox anchoring, and returns the self-contained receipt.
   */
  async seal(summary?: string): Promise<AgentReceipt & { proofUrl: string }> {
    const receipt = this.runtime.finalizeExecution(this.state, summary)

    // Finalize in gateway
    if (this.gatewayUrl) {
      try {
        await fetch(`${this.gatewayUrl}/api/agent/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
          },
          body: JSON.stringify({
            executionId: receipt.execution.executionId,
            terminalEventHash: receipt.execution.terminalEventHash,
            batchId: receipt.batch.batchId,
            merkleRoot: receipt.merkle.root,
            eventCount: receipt.events.length,
            firstSequence: receipt.batch.firstSequence,
            lastSequence: receipt.batch.lastSequence
          })
        })
      } catch (err: unknown) {
        console.warn(`[PROVN SDK] Finalize gateway sync warning:`, (err as Error).message)
      }
    }

    const proofUrl = `${this.gatewayUrl || 'https://provn.io'}/agent-proof/${receipt.execution.executionId}`

    return {
      ...receipt,
      proofUrl
    }
  }

  private async pushEventToGateway(event: AgentEvent): Promise<void> {
    const res = await fetch(`${this.gatewayUrl}/api/agent/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({ event })
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Gateway returned HTTP ${res.status}`)
    }
  }
}

export class ProvnAgent {
  private keypair: nacl.SignKeyPair
  private runtime: ProvnAgentRuntime
  private gatewayUrl: string
  private apiKey?: string
  private defaultAgentName: string

  constructor(config: ProvnClientConfig = {}) {
    this.keypair = config.keypair || nacl.sign.keyPair()
    this.runtime = new ProvnAgentRuntime(this.keypair)
    this.gatewayUrl = config.gatewayUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    this.apiKey = config.apiKey
    this.defaultAgentName = config.agentName || 'autonomous-agent'
  }

  /**
   * The Agent's sovereign Ed25519 public key (Base58)
   */
  get publicKey(): string {
    return bs58.encode(this.keypair.publicKey)
  }

  /**
   * Starts a new verifiable execution session.
   */
  async startSession(params: StartSessionParams): Promise<ProvnAgentSession> {
    const state = this.runtime.startExecution({
      taskDescription: params.taskDescription,
      agentName: params.agentName || this.defaultAgentName
    })

    // Register execution with gateway
    if (this.gatewayUrl) {
      try {
        await fetch(`${this.gatewayUrl}/api/agent/execution`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
          },
          body: JSON.stringify({ execution: state.execution })
        })
      } catch (err: unknown) {
        console.warn(`[PROVN SDK] Session registration warning:`, (err as Error).message)
      }
    }

    return new ProvnAgentSession(this.runtime, state, this.gatewayUrl, this.apiKey)
  }
}
