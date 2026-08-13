/**
 * PROVN Canonical Domain Types
 */

export type ArchivalState = 'pending' | 'archived' | 'failed' | 'legacy_unverified'

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
  totalProofs: number
  verifiedProofs: number
  archivedProofs: number
  currentStreak: number
  longestStreak: number
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
