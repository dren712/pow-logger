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
