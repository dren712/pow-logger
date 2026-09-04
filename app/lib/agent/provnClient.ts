/**
 * @provn/agent-sdk — High-Level Developer Client
 *
 * Drop-in 3-line SDK to integrate zero-trust cryptographic provenance into
 * AI agents, autonomous coding tools, and CI/CD pipelines.
 *
 * Example:
 * ```typescript
 * import { Provn } from '@provn/agent-sdk'
 *
 * const provn = new Provn({ apiKey: process.env.PROVN_API_KEY })
 * const execution = await provn.start({ agent: 'deploy-bot', intent: 'Deploy release' })
 *
 * await execution.shell({ command: 'git push origin main', exitCode: 0 })
 * const receipt = await execution.complete('Release completed')
 * console.log('Proof URL:', receipt.proofUrl)
 * ```
 */

import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { ProvnAgentRuntime, type ExecutionState } from './agentSdk'
import { 
  AGENT_EVENT_TYPES,
  type AgentEventType, 
  type PayloadCommitment, 
  type AgentReceipt, 
  type AgentEvent 
} from './types'

export const DEFAULT_GATEWAY_URL =
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_PROVN_GATEWAY_URL || process.env.PROVN_GATEWAY_URL)) ||
  'https://provn-sol.vercel.app'

const FORBIDDEN_SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /private[_-]?key/i,
  /auth[_-]?token/i,
  /authorization/i,
  /bearer\s+[a-z0-9_\-\.]+/i,
  /cookie/i,
  /session[_-]?token/i,
  /access[_-]?token/i,
]

/**
 * Scans objects recursively for raw secret keys or tokens.
 * Helps prevent accidental leakage of enterprise credentials into public receipts.
 */
export function scanForSensitiveData(obj: unknown, path = ''): string | null {
  if (!obj) return null

  if (typeof obj === 'string') {
    for (const pattern of FORBIDDEN_SENSITIVE_PATTERNS) {
      if (pattern.test(obj) && obj.length > 20) {
        return `Potentially sensitive token or key matching ${pattern.source} detected at "${path}"`
      }
    }
    return null
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const detected = scanForSensitiveData(obj[i], `${path}[${i}]`)
      if (detected) return detected
    }
    return null
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>
    for (const key of Object.keys(record)) {
      for (const pattern of FORBIDDEN_SENSITIVE_PATTERNS) {
        if (pattern.test(key)) {
          return `Sensitive field name "${key}" detected at "${path ? `${path}.${key}` : key}". PROVN strictly discourages raw secret ingestion; commit SHA-256 hashes instead or pass allowRawSecrets: true.`
        }
      }
      const detected = scanForSensitiveData(record[key], path ? `${path}.${key}` : key)
      if (detected) return detected
    }
  }

  return null
}

export interface ProvnClientConfig {
  /** Optional API key for project metering & billing */
  apiKey?: string
  /** PROVN API Gateway endpoint (defaults to current origin in browser or https://provn-sol.vercel.app in Node) */
  gatewayUrl?: string
  /** Sovereign Ed25519 keypair. If omitted, an ephemeral keypair is generated automatically */
  keypair?: nacl.SignKeyPair
  /** Human-readable agent label (e.g. 'Claude 3.5 Sonnet', 'DevOps Bot') */
  agentName?: string
  /** Allow raw secret-like keys without throwing SENSITIVE_DATA_DETECTED (default: false) */
  allowRawSecrets?: boolean
}

export interface StartSessionParams {
  taskDescription: string
  agentName?: string
  parentExecutionId?: string
  metadata?: Record<string, unknown>
}

export class ProvnAgentSession {
  public readonly executionId: string
  public readonly agentPublicKey: string
  public readonly allowRawSecrets: boolean
  private runtime: ProvnAgentRuntime
  private state: ExecutionState
  private gatewayUrl: string
  private apiKey?: string

  constructor(
    runtime: ProvnAgentRuntime,
    state: ExecutionState,
    gatewayUrl: string,
    apiKey?: string,
    allowRawSecrets = false
  ) {
    this.runtime = runtime
    this.state = state
    this.gatewayUrl = gatewayUrl
    this.apiKey = apiKey
    this.executionId = state.execution.executionId
    this.agentPublicKey = state.execution.agentPublicKey
    this.allowRawSecrets = allowRawSecrets
  }

  /**
   * Records and cryptographically signs a consequential agent action.
   * Streams the signed event to the PROVN Control Plane.
   */
  async record(eventType: AgentEventType, payload: PayloadCommitment): Promise<AgentEvent> {
    if (!this.allowRawSecrets) {
      const sensitiveIssue = scanForSensitiveData(payload)
      if (sensitiveIssue) {
        throw new Error(`SENSITIVE_DATA_DETECTED: ${sensitiveIssue}`)
      }
    }

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

    const proofUrl = `${this.gatewayUrl || 'https://provn-sol.vercel.app'}/agent-proof/${receipt.execution.executionId}`

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
  public readonly allowRawSecrets: boolean
  private keypair: nacl.SignKeyPair
  private runtime: ProvnAgentRuntime
  private gatewayUrl: string
  private apiKey?: string
  private defaultAgentName: string

  constructor(config: ProvnClientConfig = {}) {
    this.keypair = config.keypair || nacl.sign.keyPair()
    this.runtime = new ProvnAgentRuntime(this.keypair)
    this.gatewayUrl =
      config.gatewayUrl !== undefined
        ? config.gatewayUrl
        : (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : DEFAULT_GATEWAY_URL)
    this.apiKey = config.apiKey
    this.defaultAgentName = config.agentName || 'autonomous-agent'
    this.allowRawSecrets = config.allowRawSecrets ?? false
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
      agentName: params.agentName || this.defaultAgentName,
      parentExecutionId: params.parentExecutionId,
      metadata: params.metadata,
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

    return new ProvnAgentSession(
      this.runtime,
      state,
      this.gatewayUrl,
      this.apiKey,
      this.allowRawSecrets
    )
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
  /** Action type (e.g. 'tool_call', 'tool.request', 'file.write', 'shell.execute') */
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
    let mappedType: AgentEventType | undefined

    if (rawType === 'tool_call' || rawType === 'tool.request' || rawType === 'tool' || rawType === 'tool.invoke') {
      mappedType = 'tool.request'
    } else if (rawType === 'tool_response' || rawType === 'tool.response') {
      mappedType = 'tool.response'
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
    } else if (rawType === 'deployment.result') {
      mappedType = 'deployment.result'
    } else if (rawType === 'payment' || rawType === 'payment.executed') {
      mappedType = 'payment.executed'
    } else if (rawType === 'payment.intent') {
      mappedType = 'payment.intent'
    } else if (rawType === 'contract' || rawType === 'contract.interaction') {
      mappedType = 'contract.interaction'
    } else if (rawType === 'outcome' || rawType === 'outcome.attestation') {
      mappedType = 'outcome.attestation'
    } else if ((AGENT_EVENT_TYPES as readonly string[]).includes(rawType)) {
      mappedType = rawType as AgentEventType
    }

    if (!mappedType) {
      throw new Error(
        `UNSUPPORTED_ACTION_TYPE: "${params.type}" is not a valid agent action type. Supported types: ${AGENT_EVENT_TYPES.join(', ')}`
      )
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
   * Explicit typed helper: Records a tool invocation request.
   */
  async toolRequest(params: {
    tool: string
    input?: unknown
    inputCommitment?: string
    target?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'tool.request',
      tool: params.tool,
      target: params.target,
      input: params.input,
      metadata: {
        ...(params.inputCommitment ? { inputCommitment: params.inputCommitment } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a tool invocation result/response.
   */
  async toolResponse(params: {
    tool: string
    output?: unknown
    outputCommitment?: string
    durationMs?: number
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'tool.response',
      tool: params.tool,
      output: params.output,
      metadata: {
        ...(params.outputCommitment ? { outputCommitment: params.outputCommitment } : {}),
        ...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a filesystem read operation.
   */
  async fileRead(params: {
    path: string
    sizeBytes?: number
    contentHash?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'file.read',
      target: params.path,
      metadata: {
        path: params.path,
        ...(params.sizeBytes !== undefined ? { sizeBytes: params.sizeBytes } : {}),
        ...(params.contentHash ? { contentHash: params.contentHash } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a filesystem write or mutation operation.
   */
  async fileWrite(params: {
    path: string
    sizeBytes?: number
    contentHash?: string
    diffHash?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'file.write',
      target: params.path,
      metadata: {
        path: params.path,
        ...(params.sizeBytes !== undefined ? { sizeBytes: params.sizeBytes } : {}),
        ...(params.contentHash ? { contentHash: params.contentHash } : {}),
        ...(params.diffHash ? { diffHash: params.diffHash } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a shell command execution.
   */
  async shell(params: {
    command: string
    exitCode?: number
    stdoutHash?: string
    stderrHash?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'shell.execute',
      target: params.command,
      metadata: {
        command: params.command,
        ...(params.exitCode !== undefined ? { exitCode: params.exitCode } : {}),
        ...(params.stdoutHash ? { stdoutHash: params.stdoutHash } : {}),
        ...(params.stderrHash ? { stderrHash: params.stderrHash } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a git version control operation.
   */
  async git(params: {
    operation: string
    commitHash?: string
    branch?: string
    diffHash?: string
    message?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'git.operation',
      target: params.operation,
      metadata: {
        operation: params.operation,
        ...(params.commitHash ? { commitHash: params.commitHash } : {}),
        ...(params.branch ? { branch: params.branch } : {}),
        ...(params.diffHash ? { diffHash: params.diffHash } : {}),
        ...(params.message ? { message: params.message } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records an intent to transfer value.
   */
  async paymentIntent(params: {
    recipient: string
    amount: string | number
    mint?: string
    chain?: string
    memo?: string
    input?: unknown
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    const inputData = params.input !== undefined ? params.input : {
      recipient: params.recipient,
      amount: params.amount,
      ...(params.mint ? { mint: params.mint } : {}),
      ...(params.chain ? { chain: params.chain } : {}),
      ...(params.memo ? { memo: params.memo } : {}),
    }
    return this.action({
      type: 'payment.intent',
      target: params.recipient,
      input: inputData,
      metadata: {
        recipient: params.recipient,
        amount: String(params.amount),
        ...(params.mint ? { mint: params.mint } : {}),
        ...(params.chain ? { chain: params.chain } : {}),
        ...(params.memo ? { memo: params.memo } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records an executed value transfer.
   */
  async paymentExecuted(params: {
    recipient: string
    amount: string | number
    txSignature: string
    mint?: string
    chain?: string
    input?: unknown
    output?: unknown
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    const inputData = params.input !== undefined ? params.input : {
      recipient: params.recipient,
      amount: params.amount,
      ...(params.mint ? { mint: params.mint } : {}),
      ...(params.chain ? { chain: params.chain } : {}),
    }
    return this.action({
      type: 'payment.executed',
      target: params.recipient,
      input: inputData,
      output: params.output,
      metadata: {
        recipient: params.recipient,
        amount: String(params.amount),
        txSignature: params.txSignature,
        ...(params.mint ? { mint: params.mint } : {}),
        ...(params.chain ? { chain: params.chain } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a smart contract interaction.
   */
  async contractInteraction(params: {
    programId: string
    instruction: string
    accounts?: string[]
    txSignature?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'contract.interaction',
      target: params.programId,
      metadata: {
        programId: params.programId,
        instruction: params.instruction,
        ...(params.accounts ? { accounts: params.accounts } : {}),
        ...(params.txSignature ? { txSignature: params.txSignature } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a deployment request.
   */
  async deploymentRequest(params: {
    environment: string
    target?: string
    releaseVersion?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'deployment.request',
      target: params.environment,
      metadata: {
        environment: params.environment,
        ...(params.target ? { target: params.target } : {}),
        ...(params.releaseVersion ? { releaseVersion: params.releaseVersion } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Explicit typed helper: Records a deployment execution result.
   */
  async deploymentResult(params: {
    environment: string
    status: 'success' | 'failure'
    deploymentUrl?: string
    metadata?: Record<string, unknown>
  }): Promise<AgentEvent> {
    return this.action({
      type: 'deployment.result',
      target: params.environment,
      metadata: {
        environment: params.environment,
        status: params.status,
        ...(params.deploymentUrl ? { deploymentUrl: params.deploymentUrl } : {}),
        ...(params.metadata || {}),
      },
    })
  }

  /**
   * Records the final observed external outcome of the execution as an `outcome.attestation` event.
   * Decoupled from lifecycle sealing so `agent.completed` remains uniquely emitted at execution completion.
   */
  async outcome(params: AgentOutcomeParams): Promise<AgentEvent> {
    const payload: PayloadCommitment = {
      type: 'outcome.attestation',
      status: params.status,
      ...(params.result !== undefined ? { result: params.result } : {}),
      ...(params.txSignature ? { txSignature: params.txSignature } : {}),
      ...(params.prUrl ? { prUrl: params.prUrl } : {}),
      ...(params.summary ? { summary: params.summary } : {}),
      ...(params.metadata || {}),
    }

    return this.session.record('outcome.attestation', payload)
  }

  /**
   * Seals the execution, commits the Merkle root to the control plane,
   * triggers asynchronous Solana & Irys outbox anchoring, and returns the portable receipt.
   * Emits the definitive `agent.completed` event.
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
 * await execution.toolRequest({ tool: 'github.create_pr', target: 'repo/123' })
 * await execution.outcome({ status: 'success', prUrl: 'https://github.com/org/repo/pull/1' })
 * const receipt = await execution.complete('Bug resolved and verified')
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
      metadata: params.metadata,
    })
    return new ProvnExecution(session, params)
  }
}
