/**
 * PROVN Canonical Domain Types
 */

export type ArchivalState = 'not_requested' | 'pending' | 'receipt_obtained' | 'finalized' | 'failed' | 'legacy_unverified'

export type LogVerificationState = 'VERIFIED' | 'LEGACY' | 'UNVERIFIED'

export type EvidenceType = 'self_attested' | 'github_pr' | 'github_commit' | 'github_release' | 'public_url'
export type ProvenanceLevel = 'self_attested' | 'source_linked' | 'source_verified' | 'partner_attested'
export type SourceVerificationStatus = 'not_verified' | 'verified' | 'failed' | 'unavailable'

export interface WalletLog {
  id: number
  wallet_address: string
  created_at: string
  content: string
  signature?: string
  nonce?: string
  domain?: string
  evidence_url?: string | null
  github_url?: string | null
  skills?: string[]
  protocols?: string[]
  category?: string
  irys_tx_id?: string | null
  archival_state?: ArchivalState
  
  // Phase 2: Source-Aware Evidence
  evidence_type?: EvidenceType
  provenance_level?: ProvenanceLevel
  source_provider?: string | null
  source_metadata?: Record<string, unknown> | null
  source_verification_status?: SourceVerificationStatus
  source_verified_at?: string | null
  
  [key: string]: unknown
}

export type LogRecord = WalletLog

export interface Achievement {
  id: string
  name: string
  description: string
  criteria: string
  icon: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  earned: boolean
  earnedAt?: string
  mintable?: boolean
}

export interface AchievementEligibility {
  eligible: boolean
  achievementId: string
  achievementName: string
  reason: string
  earnedAt?: string
}

export interface BuilderReputation {
  wallet: string
  totalRecords: number
  totalProofs: number // Invariant: Equals verifiedProofs
  verifiedProofs: number
  legacyRecords: number
  unverifiedRecords: number
  archivedProofs: number // Invariant: Equals archivedVerifiedProofs
  archivedVerifiedProofs: number
  recentVerifiedProofs: number // Proofs created in the last 30 days
  proofsWithGithubEvidence: number
  proofsWithOtherEvidence: number
  currentStreak: number
  longestStreak: number
  sourceVerifiedProofs: number
  builderLevel: {
    level: number
    title: string
    emoji: string
    color: string
  }
  skills: { name: string; count: number }[]
  protocols: { name: string; count: number }[]
  categories: { name: string; count: number }[]
  milestones: string[]
  achievements: Achievement[]
  archivalSuccessRate: number
  firstProofAt?: string
  latestProofAt?: string
  activeDaysCount: number
}

export interface ProofDetail {
  id: number
  walletAddress: string
  createdAt: string
  content: string
  githubUrl?: string | null
  evidenceUrl?: string | null
  signature?: string
  nonce?: string
  domain?: string
  skills?: string[]
  protocols?: string[]
  category?: string
  irysTxId?: string | null
  archivalState: ArchivalState
  isCryptographicallyVerified: boolean
  verificationState: LogVerificationState
  verificationDetails?: {
    canonicalMessageReconstructed: boolean
    signatureValid: boolean
    domainVerified: boolean
    timestampIso: string
  }
}

export interface PassportExport {
  protocol: 'PROVN'
  version: '1.0'
  exportedAt: string
  wallet: string
  reputation: BuilderReputation
  proofs: ProofDetail[]
  verificationUrl: string
}

export interface ProofPacket {
  protocol: 'PROVN'
  version: '1.0'
  generatedAt: string
  wallet: string
  walletShort: string
  reputationSummary: {
    verifiedProofs: number
    recentVerifiedProofs: number
    currentStreak: number
    builderLevel: string
    topSkills: string[]
    topProtocols: string[]
  }
  proofs: ProofDetail[]
  verificationUrl: string
  verificationInstructions: string
}

export interface EvidencePolicy {
  name?: string
  minVerifiedProofs?: number
  minSourceVerifiedProofs?: number
  minRecentProofs?: number
  minStreak?: number
  requiredProtocols?: string[]
  requiredSkills?: string[]
  requireGithubEvidence?: boolean
  requireArchivedProof?: boolean
}

export interface PolicyCheckResult {
  id: string
  label: string
  required: number | string | boolean | string[]
  actual: number | string | boolean | string[]
  passed: boolean
  description?: string
}

export interface EligibilityEvaluation {
  eligible: boolean
  wallet: string
  policyName: string
  evaluatedAt: string
  checks: PolicyCheckResult[]
  summary: {
    passedCount: number
    totalChecks: number
  }
  protocolVersion: string
}
