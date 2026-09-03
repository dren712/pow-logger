/**
 * PROVN Agent Protocol — Core Type Definitions
 * Protocol Version: agent/1
 *
 * These types define the data model for the PROVN Verifiable Agent Action Infrastructure.
 * The agent protocol is strictly namespaced and isolated from the existing human builder proof types.
 *
 * TRUST MODEL SEPARATION:
 *   - Agent signature proves: "whoever controls this private key signed this event"
 *   - It does NOT prove: authorization, delegation, correctness, truthfulness, or safety
 *   - See docs/agent-protocol.md for formal threat model
 */

// ─────────────────────────────────────────────────────────────────────────────
// Protocol Constants
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_PROTOCOL_VERSION = 'agent/1' as const
export const AGENT_PROTOCOL_VERSION_NUMBER = 1 as const

/** Domain separation prefixes — prevent cross-protocol signature/hash ambiguity */
export const DOMAIN_SEPARATION = {
  EVENT: 'PROVN-AGENT-EVENT-V1',
  MERKLE_LEAF: 'PROVN-MERKLE-LEAF-V1',
  MERKLE_NODE: 'PROVN-MERKLE-NODE-V1',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

/** V1 event types — intentionally limited set */
export const AGENT_EVENT_TYPES = [
  'agent.started',
  'agent.completed',
  'agent.failed',
  'tool.request',
  'tool.response',
  'file.read',
  'file.write',
  'shell.execute',
  'git.operation',
  'deployment.request',
  'deployment.result',
] as const

export type AgentEventType = typeof AGENT_EVENT_TYPES[number]

// ─────────────────────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionStatus = 'running' | 'completed' | 'failed'

export interface AgentExecution {
  /** Cryptographically random UUID — not derived from timestamps */
  executionId: string
  /** Agent identity: Base58-encoded Ed25519 public key */
  agentPublicKey: string
  /** ISO-8601 timestamp when execution started */
  startedAt: string
  /** ISO-8601 timestamp when execution completed (null while running) */
  completedAt: string | null
  /** Current execution lifecycle status */
  status: ExecutionStatus
  /** Total number of committed events */
  eventCount: number
  /** eventHash of the final event in the chain */
  terminalEventHash: string | null
  /** Merkle root of the batched event hashes (null until batch is built) */
  merkleRoot: string | null
  /** Reference to the Solana anchor commitment (null until anchored) */
  anchorReference: AnchorReference | null
  /** Protocol version identifier */
  protocolVersion: typeof AGENT_PROTOCOL_VERSION
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Event
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentEvent {
  /** Unique event identifier (cryptographically random UUID) */
  eventId: string
  /** Parent execution identifier */
  executionId: string
  /** Monotonically increasing sequence number within the execution (0-indexed) */
  sequence: number
  /** Agent identity: Base58-encoded Ed25519 public key */
  agentPublicKey: string
  /** Categorized action type */
  eventType: AgentEventType
  /** ISO-8601 timestamp of the event */
  timestamp: string
  /** Optional parent event ID for hierarchical event relationships */
  parentEventId: string | null
  /** Hash of the immediately preceding event in the chain (null for sequence 0) */
  previousEventHash: string | null
  /** SHA-256 hex digest of the canonicalized payload commitment */
  payloadHash: string
  /** Optional non-sensitive payload commitment metadata */
  payload?: PayloadCommitment
  /** SHA-256 hex digest of the canonical event string */
  eventHash: string
  /** Base58-encoded Ed25519 detached signature over eventHash bytes */
  signature: string
  /** Protocol version identifier */
  protocolVersion: typeof AGENT_PROTOCOL_VERSION
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload Commitments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload commitments represent cryptographic digests of action metadata.
 * Raw sensitive content is NEVER stored — only hashes.
 *
 * SECURITY: The following must NEVER appear in payload commitments:
 *   - API keys, bearer tokens, passwords, private keys
 *   - Environment secrets (OPENAI_API_KEY, AWS_SECRET_ACCESS_KEY, etc.)
 *   - Database connection strings
 */
export interface PayloadCommitment {
  /** The event type this commitment describes */
  type: AgentEventType
  /** Arbitrary key-value metadata (hashed values, not raw secrets) */
  [key: string]: unknown
}

export interface FileReadPayload extends PayloadCommitment {
  type: 'file.read'
  path: string
  contentHash: string
  sizeBytes: number
}

export interface FileWritePayload extends PayloadCommitment {
  type: 'file.write'
  path: string
  contentHash: string
  previousContentHash: string | null
  sizeBytes: number
  operation: 'create' | 'modify' | 'delete'
}

export interface ShellExecutePayload extends PayloadCommitment {
  type: 'shell.execute'
  commandHash: string
  cwdHash: string
  exitCode: number
  stdoutHash: string
  stderrHash: string
}

export interface AgentStartedPayload extends PayloadCommitment {
  type: 'agent.started'
  taskDescription: string
  agentName?: string
}

export interface AgentCompletedPayload extends PayloadCommitment {
  type: 'agent.completed'
  summary: string
  eventCount: number
}

export interface AgentFailedPayload extends PayloadCommitment {
  type: 'agent.failed'
  error: string
  lastSuccessfulSequence: number
}

export interface ToolRequestPayload extends PayloadCommitment {
  type: 'tool.request'
  toolName: string
  inputHash: string
}

export interface ToolResponsePayload extends PayloadCommitment {
  type: 'tool.response'
  toolName: string
  outputHash: string
  success: boolean
}

export interface GitOperationPayload extends PayloadCommitment {
  type: 'git.operation'
  operation: 'commit' | 'push' | 'pull' | 'checkout' | 'merge'
  ref?: string
  commitHash?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Merkle
// ─────────────────────────────────────────────────────────────────────────────

export type MerkleProofDirection = 'left' | 'right'

export interface MerkleProofStep {
  hash: string
  direction: MerkleProofDirection
}

export interface MerkleInclusionProof {
  leafIndex: number
  leafHash: string
  proof: MerkleProofStep[]
  root: string
}

export interface MerkleTree {
  root: string
  leafCount: number
  leaves: string[]
  proofs: MerkleInclusionProof[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch
// ─────────────────────────────────────────────────────────────────────────────

export type BatchStatus = 'created' | 'anchoring' | 'anchored' | 'archived' | 'failed'

export interface AgentBatch {
  batchId: string
  protocolVersion: typeof AGENT_PROTOCOL_VERSION
  createdAt: string
  eventCount: number
  firstSequence: number
  lastSequence: number
  merkleRoot: string
  executionIds: string[]
  solanaAnchor: AnchorReference | null
  irysArchive: IrysArchiveReference | null
  status: BatchStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Anchor & Archive References
// ─────────────────────────────────────────────────────────────────────────────

export interface AnchorReference {
  network: 'mainnet-beta' | 'devnet' | 'localnet'
  signature: string | null
  pda: string
  programId: string
  slot?: number
}

export interface IrysArchiveReference {
  txId: string
  timestamp: string
  url: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Portable Receipt
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentReceipt {
  protocol: 'PROVN'
  version: typeof AGENT_PROTOCOL_VERSION
  generatedAt: string
  execution: AgentExecution
  events: AgentEvent[]
  batch: AgentBatch
  merkle: MerkleTree
  solana: AnchorReference | null
  irys: IrysArchiveReference | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

export type VerificationLayerStatus = 'VALID' | 'INVALID' | 'NOT_CHECKED'
export type AnchorLayerStatus = 'FOUND' | 'NOT_FOUND' | 'MISMATCH' | 'NOT_CHECKED'
export type ArchiveLayerStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'CONTENT_MISMATCH' | 'NOT_CHECKED'

export interface VerificationResult {
  /** Overall verification passed (true only if ALL checked layers pass) */
  verified: boolean
  /** Per-layer status */
  layers: {
    agentSignature: VerificationLayerStatus
    eventHash: VerificationLayerStatus
    hashChain: VerificationLayerStatus
    merkleInclusion: VerificationLayerStatus
    merkleRoot: VerificationLayerStatus
    solanaAnchor: AnchorLayerStatus
    irysArchive: ArchiveLayerStatus
  }
  /** Total events verified */
  eventsChecked: number
  /** Total events that passed all checked layers */
  eventsPassed: number
  /** Specific failure details (empty if verified) */
  failures: TamperFailure[]
  /** Timestamp of verification */
  verifiedAt: string
}

export type TamperFailureType =
  | 'EVENT_HASH_MISMATCH'
  | 'SIGNATURE_INVALID'
  | 'CHAIN_SEVERED'
  | 'SEQUENCE_GAP'
  | 'SEQUENCE_DUPLICATE'
  | 'MERKLE_INCLUSION_INVALID'
  | 'MERKLE_ROOT_MISMATCH'
  | 'SOLANA_ANCHOR_MISMATCH'
  | 'SOLANA_ANCHOR_NOT_FOUND'
  | 'IRYS_ARCHIVE_UNAVAILABLE'
  | 'EVENT_MISSING'
  | 'EVENT_INSERTED'

export interface TamperFailure {
  type: TamperFailureType
  eventSequence: number | null
  eventId: string | null
  message: string
  expected?: string
  computed?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy & Audit Engine
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AuditSeverity = 'INFO' | 'WARNING' | 'VIOLATION' | 'CRITICAL'
export type AuditComplianceStatus = 'COMPLIANT' | 'VIOLATION' | 'WARNING'

export type PolicyRuleType =
  | 'ALLOW_DENY_EVENT_TYPES'
  | 'FORBIDDEN_COMMAND_PATTERNS'
  | 'FILE_PATH_CONSTRAINTS'
  | 'FORBIDDEN_TOOLS'
  | 'NETWORK_TARGET_CONSTRAINTS'
  | 'EXECUTION_BOUNDS'
  | 'CUSTOM_RULE'

export interface AuditFinding {
  id: string
  ruleId: string
  ruleType: PolicyRuleType
  severity: AuditSeverity
  riskLevel: RiskLevel
  eventSequence: number
  eventId: string
  eventType: AgentEventType
  title: string
  message: string
  matchedPattern?: string
  remediation?: string
}

export interface ExecutionPolicy {
  policyId: string
  policyName: string
  description: string
  version: string
  /** If provided, ONLY these event types are permitted */
  allowedEventTypes?: AgentEventType[]
  /** Explicitly forbidden event types */
  deniedEventTypes?: AgentEventType[]
  /** Patterns forbidden for file read/write (e.g. .env, id_rsa, /etc/) */
  forbiddenFilePatterns?: string[]
  /** Patterns forbidden specifically for file.write operations */
  readOnlyFilePatterns?: string[]
  /** Command strings or regex patterns forbidden in shell.execute */
  forbiddenCommands?: string[]
  /** If provided, ONLY these tools are allowed in tool.request */
  allowedTools?: string[]
  /** Explicitly forbidden tool names (e.g. 'prod.database.*', 'aws.iam.*') */
  forbiddenTools?: string[]
  /** Maximum number of events allowed in an execution session before triggering a warning */
  maxEventCount?: number
}

export interface ExecutionAuditReport {
  policyId: string
  policyName: string
  evaluatedAt: string
  executionId: string
  compliance: AuditComplianceStatus
  overallRisk: RiskLevel
  riskScore: number // 0 to 100
  provenanceIntegrity: 'VALID' | 'INVALID' | 'UNVERIFIED'
  findings: AuditFinding[]
  summary: {
    totalEventsEvaluated: number
    violationsCount: number
    warningsCount: number
    infoCount: number
    highestSeverity: AuditSeverity
  }
}

