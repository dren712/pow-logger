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

/**
 * Ergonomic parameter types for frictionless developer onboarding
 */
export interface StartExecutionParams {
  /** Optional agent identifier/label (e.g. 'coding-agent-01', 'treasury-bot') */
  agent?: string
  /** High-level goal or task prompt the agent was assigned to accomplish */
  intent: string
  /** Arbitrary context/metadata to commit with the execution */
  metadata?: Record<string, unknown>
  /** Parent execution ID for hierarchical multi-agent delegations */
  parentExecutionId?: string
}

export interface AgentActionParams {
  /** Action type (e.g. 'tool_call', 'tool.invoke', 'file.write', 'shell.execute') */
  type: string
  /** Specific tool name if applicable (e.g. 'github.create_pull_request') */
  tool?: string
  /** Target resource or URI (e.g. 'repo/owner/name', '/src/index.ts') */
  target?: string
  /** Invocation arguments or inputs */
  input?: unknown
  /** Tool execution result or output */
  output?: unknown
  /** Optional extra metadata */
  metadata?: Record<string, unknown>
}

export interface AgentOutcomeParams {
  /** High-level status of the outcome */
  status: 'success' | 'failure' | 'partial' | string
  /** Structured result data */
  result?: unknown
  /** On-chain transaction signature if value or smart contract was touched */
  txSignature?: string
  /** Pull request or Git commit URL if code was changed */
  prUrl?: string
  /** Summary explanation */
  summary?: string
  /** Optional extra metadata */
  metadata?: Record<string, unknown>
}

/**
 * High-level execution handle representing an active agent session.
 */
export class ProvnExecution {
  public readonly executionId: string
  public readonly agentPublicKey: string
  public readonly intent: string
  private session: ProvnAgentSession

  constructor(session: ProvnAgentSession, params: StartExecutionParams) {
    this.session = session
    this.executionId = session.executionId
    this.agentPublicKey = session.agentPublicKey
    this.intent = params.intent
  }

  /**
   * Records and cryptographically commits a consequential action taken by the agent.
   */
  async action(params: AgentActionParams): Promise<AgentEvent> {
    const rawType = params.type.toLowerCase().trim()
    let mappedType: AgentEventType = 'tool.request'

    if (rawType === 'tool_call' || rawType === 'tool.request' || rawType === 'tool' || rawType === 'tool.invoke') {
      mappedType = 'tool.request'
    } else if (rawType === 'file_read' || rawType === 'file.read') {
      mappedType = 'file.read'
    } else if (rawType === 'file_write' || rawType === 'file.write') {
      mappedType = 'file.write'
    } else if (rawType === 'shell_exec' || rawType === 'shell.execute' || rawType === 'shell') {
      mappedType = 'shell.execute'
    } else if (rawType === 'git' || rawType === 'git.operation') {
      mappedType = 'git.operation'
    } else if (rawType === 'deployment' || rawType === 'deployment.request') {
      mappedType = 'deployment.request'
    } else if (rawType === 'payment' || rawType === 'payment.executed') {
      mappedType = 'payment.executed'
    } else if (rawType === 'outcome' || rawType === 'outcome.attestation') {
      mappedType = 'outcome.attestation'
    }

    const payload: PayloadCommitment = {
      type: mappedType,
      ...(params.tool ? { tool: params.tool } : {}),
      ...(params.target ? { target: params.target } : {}),
      ...(params.input !== undefined ? { input: params.input } : {}),
      ...(params.output !== undefined ? { output: params.output } : {}),
      ...(params.metadata || {}),
    }

    return this.session.record(mappedType, payload)
  }

  /**
   * Records the final observed external outcome of the execution.
   */
  async outcome(params: AgentOutcomeParams): Promise<AgentEvent> {
    const payload: PayloadCommitment = {
      type: 'agent.completed',
      status: params.status,
      ...(params.result !== undefined ? { result: params.result } : {}),
      ...(params.txSignature ? { txSignature: params.txSignature } : {}),
      ...(params.prUrl ? { prUrl: params.prUrl } : {}),
      ...(params.summary ? { summary: params.summary } : {}),
      ...(params.metadata || {}),
    }

    return this.session.record('agent.completed', payload)
  }

  /**
   * Seals the execution, commits the Merkle root to the control plane,
   * triggers asynchronous Solana & Irys outbox anchoring, and returns the portable receipt.
   */
  async complete(summary?: string): Promise<AgentReceipt & { proofUrl: string }> {
    return this.session.seal(summary || `Execution completed: ${this.intent}`)
  }
}

/**
 * Top-level PROVN client interface for autonomous software.
 * 
 * Usage:
 * ```typescript
 * const provn = new Provn({ apiKey: process.env.PROVN_KEY })
 * const execution = await provn.start({ agent: 'my-agent', intent: 'Fix database bug' })
 * await execution.action({ type: 'tool_call', tool: 'github.create_pr', target: 'repo/123' })
 * await execution.outcome({ status: 'success', prUrl: 'https://github.com/org/repo/pull/1' })
 * const receipt = await execution.complete()
 * ```
 */
export class Provn {
  private agentClient: ProvnAgent

  constructor(config: ProvnClientConfig = {}) {
    this.agentClient = new ProvnAgent(config)
  }

  get publicKey(): string {
    return this.agentClient.publicKey
  }

  /**
   * Starts a new verifiable execution with the specified agent identity and task intent.
   */
  async start(params: StartExecutionParams): Promise<ProvnExecution> {
    const session = await this.agentClient.startSession({
      taskDescription: params.intent,
      agentName: params.agent,
      parentExecutionId: params.parentExecutionId,
    })
    return new ProvnExecution(session, params)
  }
}

