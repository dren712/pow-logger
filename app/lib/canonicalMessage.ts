/**
 * PROVN Canonical Proof Message Builder (SIWS-Inspired)
 *
 * Cryptographically binds wallet address, content, evidence links (GitHub & Demo URLs),
 * timestamp, and unique nonce into a standardized, tamper-evident Solana signed proof message.
 * Follows Sign-In-With-Solana (SIWS) domain-binding and wallet authentication principles.
 */

import bs58 from 'bs58'
import nacl from 'tweetnacl'

export interface VerifiableLog {
  wallet_address: string
  signature?: string | null
  nonce?: string | null
  challenge?: string | null
  domain?: string | null
  created_at: string
  content: string
  github_url?: string | null
  evidence_url?: string | null
  protocol_version?: number
  challenge_id?: string | null
}
export function decodeBase58(str: string): Uint8Array {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
}

export const CURRENT_PROTOCOL_VERSION = 2

export interface CanonicalSubmitParamsV2 {
  domain?: string
  walletAddress: string
  timestamp: string
  challenge: string
  content: string
  githubUrl?: string | null
  evidenceUrl?: string | null
}

export interface CanonicalSubmitParams {
  domain?: string
  walletAddress: string
  timestamp: string
  nonce: string
  content: string
  githubUrl?: string | null
  evidenceUrl?: string | null
  version?: number
}

export interface CanonicalRetryParamsV2 {
  domain?: string
  walletAddress: string
  logId: number
  timestamp: string
  challenge: string
}

export interface CanonicalRetryParams {
  domain?: string
  walletAddress: string
  logId: number
  timestamp: string
  nonce: string
}

/**
 * Normalizes and validates URLs using native URL parsing.
 * Enforces HTTPS scheme and restricts GitHub URLs to github.com domain.
 */
export function validateAndNormalizeUrl(
  urlInput: string | null | undefined,
  type: 'github' | 'evidence'
): string | null {
  if (!urlInput || typeof urlInput !== 'string') return null
  const trimmed = urlInput.trim()
  if (!trimmed || trimmed.length > 300) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null

    if (type === 'github') {
      const hostname = parsed.hostname.toLowerCase()
      if (hostname !== 'github.com' && !hostname.endsWith('.github.com')) {
        return null
      }
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Resolves and validates the canonical domain for SIWS verification.
 * Prevents Host header injection by enforcing configured app domain or whitelisted patterns.
 */
export function getVerifiedDomain(reqHost: string | null): string {
  if (process.env.NEXT_PUBLIC_APP_DOMAIN) {
    return process.env.NEXT_PUBLIC_APP_DOMAIN.trim().toLowerCase().split(':')[0]
  }

  if (!reqHost || typeof reqHost !== 'string') {
    return 'provn-sol.vercel.app'
  }

  const cleanHost = reqHost.trim().toLowerCase().split(':')[0]

  const isVercel = cleanHost === 'provn-sol.vercel.app' || cleanHost.endsWith('.vercel.app')
  const isLocalhost = cleanHost === 'localhost' || cleanHost === '127.0.0.1'
  const isWhitelisted = process.env.ALLOWED_DOMAINS
    ? process.env.ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).includes(cleanHost)
    : false

  if (isVercel || isLocalhost || isWhitelisted) {
    return cleanHost
  }

  return 'provn-sol.vercel.app'
}

/**
 * Helper to check if a Supabase URL is configured with a real live project domain
 * rather than a placeholder string or missing env var.
 */
export function isConfiguredSupabaseUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().trim()
  return !lower.includes('placeholder') && !lower.includes('dummy-test') && lower.startsWith('http')
}

export function buildCanonicalSubmitMessageV2(params: CanonicalSubmitParamsV2): string {
  const domain = params.domain ? params.domain.trim().toLowerCase().split(':')[0] : 'provn-sol.vercel.app'
  const cleanContent = params.content.trim()
  const cleanGithubUrl = validateAndNormalizeUrl(params.githubUrl, 'github') || 'none'
  const cleanEvidenceUrl = validateAndNormalizeUrl(params.evidenceUrl, 'evidence') || 'none'

  return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}
Content: ${cleanContent}
GitHub URL: ${cleanGithubUrl}
Evidence URL: ${cleanEvidenceUrl}`
}

/**
 * Builds canonical proof message for initial log submission (SIWS-inspired format).
 * Cryptographically binds content AND normalized evidence URLs.
 */
export function buildCanonicalSubmitMessage(params: CanonicalSubmitParams): string {
  const domain = params.domain ? params.domain.trim().toLowerCase().split(':')[0] : 'provn-sol.vercel.app'
  const version = params.version || 1
  const cleanContent = params.content.trim()
  const cleanGithubUrl = validateAndNormalizeUrl(params.githubUrl, 'github') || 'none'
  const cleanEvidenceUrl = validateAndNormalizeUrl(params.evidenceUrl, 'evidence') || 'none'

  return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

SIWS Schema Version: ${version}
Nonce: ${params.nonce}
Timestamp: ${params.timestamp}
Content: ${cleanContent}
GitHub URL: ${cleanGithubUrl}
Evidence URL: ${cleanEvidenceUrl}`
}

export function buildCanonicalRetryMessageV2(params: CanonicalRetryParamsV2): string {
  const domain = params.domain || 'provn-sol.vercel.app'
  return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Retry Archival
Log ID: ${params.logId}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`
}

/**
 * Builds canonical SIWS prompt for authorized archival retry.
 * Cryptographically binds logId and action name to wallet.
 */
export function buildCanonicalRetryMessage(params: CanonicalRetryParams): string {
  const domain = params.domain || 'provn-sol.vercel.app'
  return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

Action: Retry Archival
Log ID: ${params.logId}
Nonce: ${params.nonce}
Timestamp: ${params.timestamp}`
}

export interface CanonicalArchiveParams {
  domain: string
  walletAddress: string
  logId: number
  challenge: string
  timestamp: string
}

export function buildCanonicalArchiveMessage(params: CanonicalArchiveParams): string {
  return `${params.domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Archive Evidence
Log ID: ${params.logId}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`
}

export interface CanonicalVisibilityParams {
  domain: string
  walletAddress: string
  logId: number
  visibility: string
  challenge: string
  timestamp: string
}

export function buildCanonicalVisibilityMessage(params: CanonicalVisibilityParams): string {
  return `${params.domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Set Visibility
Log ID: ${params.logId}
Visibility: ${params.visibility}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`
}

/**
 * The single canonical cryptographic verification function across the PROVN protocol.
 * Reconstructs the canonical SIWS-inspired proof message and executes TweetNaCl Ed25519
 * detached signature verification against the signer's public key.
 *
 * Strict Protocol Invariants:
 * 1. Exact Domain Sealing: Uses the exact persisted domain without loose fallback guessing.
 * 2. Strict Metadata Integrity: Non-empty URLs must be valid (GitHub on github.com, Evidence on HTTPS).
 * 3. Base58 Nonce Validation: Nonce must be valid Base58 without whitespace tampering.
 * 4. Guaranteed Invariant: Returns true IF AND ONLY IF the exact persisted record is cryptographically authentic.
 */
export function verifyLogCryptographically(
  log: VerifiableLog
): boolean {
  if (!log.wallet_address || !log.signature || !log.created_at || !log.content) {
    return false
  }

  const challengeStr = log.challenge || log.challenge_id || (log.protocol_version === 2 ? log.nonce : null)
  const isV2 = log.protocol_version === 2 || (log.protocol_version !== 1 && !log.nonce && !!challengeStr)

  if (isV2) {
    if (!challengeStr || typeof challengeStr !== 'string' || challengeStr.trim() === '') {
      return false
    }
  } else {
    // Strict Nonce Validation: Base58 string, 8-64 chars, no surrounding whitespace
    if (!log.nonce || typeof log.nonce !== 'string' || log.nonce.trim() !== log.nonce || log.nonce.length < 8 || log.nonce.length > 64) {
      return false
    }
    try {
      const nonceBytes = decodeBase58(log.nonce)
      if (nonceBytes.length === 0) return false
    } catch {
      return false
    }
  }

  // Strict URL Validation: Non-empty URLs must be valid and normalized (prevent silent collapse to 'none')
  if (log.github_url && typeof log.github_url === 'string' && log.github_url.trim().length > 0) {
    const normalizedGh = validateAndNormalizeUrl(log.github_url, 'github')
    if (!normalizedGh) return false
  }
  if (log.evidence_url && typeof log.evidence_url === 'string' && log.evidence_url.trim().length > 0) {
    const normalizedEv = validateAndNormalizeUrl(log.evidence_url, 'evidence')
    if (!normalizedEv) return false
  }

  try {
    const publicKeyBytes = decodeBase58(log.wallet_address)
    if (publicKeyBytes.length !== 32) return false

    const signatureBytes = decodeBase58(log.signature)
    if (signatureBytes.length !== 64) return false

    // Exact domain: strictly use the log's persisted domain
    const domain = log.domain || 'provn-sol.vercel.app'

    let canonicalMsg: string
    if (isV2) {
      canonicalMsg = buildCanonicalSubmitMessageV2({
        domain,
        walletAddress: log.wallet_address,
        content: log.content,
        timestamp: log.created_at,
        challenge: challengeStr!,
        githubUrl: log.github_url || undefined,
        evidenceUrl: log.evidence_url || undefined,
      })
    } else {
      canonicalMsg = buildCanonicalSubmitMessage({
        domain,
        walletAddress: log.wallet_address,
        content: log.content,
        timestamp: log.created_at,
        nonce: log.nonce!,
        githubUrl: log.github_url || undefined,
        evidenceUrl: log.evidence_url || undefined,
      })
    }
    const msgBytes = new TextEncoder().encode(canonicalMsg)
    return nacl.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes)
  } catch {
    return false
  }
}

