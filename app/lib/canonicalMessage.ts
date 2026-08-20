/**
 * PROVN Canonical Proof Message Builder (SIWS-Inspired)
 *
 * Cryptographically binds wallet address, content, evidence links (GitHub & Demo URLs),
 * timestamp, and unique nonce into a standardized, tamper-evident Solana signed proof message.
 * Follows Sign-In-With-Solana (SIWS) domain-binding and wallet authentication principles.
 */

import bs58 from 'bs58'
import nacl from 'tweetnacl'
import crypto from 'crypto'
import { ProofStatusLayers, ProofValidityReport } from './types'
import { verifyServerReceipt, PROVN_ALLOWED_DOMAINS } from './serverKeypair'

export interface VerifiableLog {
  id?: number | string | null
  wallet_address: string
  signature?: string | null
  nonce?: string | null
  challenge?: string | null
  submission_receipt?: string | null
  domain?: string | null
  created_at: string
  content: string
  github_url?: string | null
  evidence_url?: string | null
  protocol_version?: number
  challenge_id?: string | null
  provenance_level?: string | null
  source_verification_status?: string | null
  archival_state?: string | null
  irys_tx_id?: string | null
  [key: string]: unknown
}
export function decodeBase58(str: string): Uint8Array {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
}

export function encodeBase58(bytes: Uint8Array): string {
  const bs58Obj = bs58 as unknown as { encode?: (b: Uint8Array) => string; default?: { encode: (b: Uint8Array) => string } }
  const fn = bs58Obj.encode || bs58Obj.default?.encode
  if (!fn) throw new Error('Base58 encoder unavailable')
  return fn(bytes)
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

  if (PROVN_ALLOWED_DOMAINS.includes(cleanHost)) {
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

export interface CanonicalIdentityLinkParams {
  domain: string
  walletAddress: string
  challenge: string
  timestamp: string
  action?: 'Link' | 'Relink' | 'Unlink'
}

export function buildCanonicalIdentityLinkMessage(params: CanonicalIdentityLinkParams): string {
  const actionName = params.action || 'Link'
  return `${params.domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: ${actionName} GitHub Identity
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`
}

export function computeCanonicalProofHash(canonicalMsg: string): string {
  return crypto.createHash('sha256').update(new TextEncoder().encode(canonicalMsg)).digest('hex')
}

export function reconstructCanonicalSubmitMessage(log: VerifiableLog): string | null {
  if (!log.wallet_address || !log.created_at || !log.content) {
    return null
  }

  const challengeStr = log.challenge || (log.protocol_version === 2 ? log.nonce : null)
  const isV2 = log.protocol_version === 2 || (log.protocol_version !== 1 && !log.nonce && !!challengeStr)

  if (isV2 && (!challengeStr || typeof challengeStr !== 'string' || challengeStr.trim() === '')) {
    return null
  }
  if (!isV2 && (!log.nonce || typeof log.nonce !== 'string')) {
    return null
  }

  // Strict URL Validation: Non-empty URLs must be valid and normalized (prevent silent collapse to 'none')
  if (log.github_url && typeof log.github_url === 'string' && log.github_url.trim().length > 0) {
    const normalizedGh = validateAndNormalizeUrl(log.github_url, 'github')
    if (!normalizedGh) return null
  }
  if (log.evidence_url && typeof log.evidence_url === 'string' && log.evidence_url.trim().length > 0) {
    const normalizedEv = validateAndNormalizeUrl(log.evidence_url, 'evidence')
    if (!normalizedEv) return null
  }

  // Strict Domain: For Protocol V2, domain is mandatory and must not silently fallback
  if (isV2 && (!log.domain || typeof log.domain !== 'string' || log.domain.trim() === '')) {
    return null
  }
  const domain = isV2 ? log.domain! : (log.domain || 'provn-sol.vercel.app')

  // Postgres / Supabase transforms "2026-08-17T18:01:50.481Z" into "...+00:00" and may trim trailing ms zeroes.
  // We MUST restore the exact string the client signed (which is standard JS .toISOString() format).
  let fixedTimestamp = log.created_at
  if (fixedTimestamp.endsWith('+00:00')) {
    fixedTimestamp = fixedTimestamp.replace('+00:00', 'Z')
    const msMatch = fixedTimestamp.match(/\.(\d+)Z$/)
    if (msMatch) {
      let ms = msMatch[1]
      while (ms.length < 3) ms += '0'
      fixedTimestamp = fixedTimestamp.replace(/\.\d+Z$/, `.${ms}Z`)
    }
  }

  if (isV2) {
    return buildCanonicalSubmitMessageV2({
      domain,
      walletAddress: log.wallet_address,
      content: log.content,
      timestamp: fixedTimestamp,
      challenge: challengeStr!,
      githubUrl: log.github_url || undefined,
      evidenceUrl: log.evidence_url || undefined,
    })
  } else {
    return buildCanonicalSubmitMessage({
      domain,
      walletAddress: log.wallet_address,
      content: log.content,
      timestamp: fixedTimestamp,
      nonce: log.nonce!,
      githubUrl: log.github_url || undefined,
      evidenceUrl: log.evidence_url || undefined,
    })
  }
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
 * 4. Guaranteed Invariant: Returns true iff the persisted cryptographic fields reconstruct a message matching the supplied wallet signature.
 */
export function verifyLogCryptographically(
  log: VerifiableLog
): boolean {
  if (!log.wallet_address || !log.signature || !log.created_at || !log.content) {
    return false
  }

  const isV2 = log.protocol_version === 2 || (log.protocol_version !== 1 && !log.nonce && !!log.challenge)

  if (!isV2) {
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

  try {
    const publicKeyBytes = decodeBase58(log.wallet_address)
    if (publicKeyBytes.length !== 32) return false

    const signatureBytes = decodeBase58(log.signature)
    if (signatureBytes.length !== 64) return false

    const canonicalMsg = reconstructCanonicalSubmitMessage(log)
    if (!canonicalMsg) return false

    const msgBytes = new TextEncoder().encode(canonicalMsg)
    return nacl.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes)
  } catch {
    return false
  }
}

/**
 * Evaluates the full 4-layer verification state of a PROVN proof record:
 * 1. Signature Layer: Ed25519 cryptographic detached signature check against wallet public key.
 * 2. Protocol Layer: Server-issued challenge binding, domain normalization, and ISO timestamp bounds.
 * 3. Source Layer: Graduated evidence provenance (self_attested -> source_verified).
 * 4. Archive Layer: Permanent Arweave L1 data receipt verification via Irys.
 */
export function evaluateProofValidity(log: VerifiableLog): ProofValidityReport {
  const isSigValid = verifyLogCryptographically(log)

  const protocolVersion = log.protocol_version || (log.nonce && !log.challenge ? 1 : 2)
  const domain = log.domain || 'provn-sol.vercel.app'
  const isDomainValid = PROVN_ALLOWED_DOMAINS.includes(domain)

  let challengeValid = false
  let timestampValid = false

  if (protocolVersion === 2) {
    const challengeStr = log.challenge || log.nonce
    if (typeof challengeStr === 'string') {
      const parts = challengeStr.split('.')
      if (parts.length === 2) {
        try {
          const payloadBytes = decodeBase58(parts[0])
          const sigBytes = decodeBase58(parts[1])
          const payload = JSON.parse(new TextDecoder().decode(payloadBytes))
          const challengeKid = typeof payload.kid === 'string' && payload.kid.trim() !== '' ? payload.kid : null
          
          if (challengeKid && verifyServerReceipt(payloadBytes, sigBytes, challengeKid, payload.iat || payload.exp)) {
            if (payload.wallet === log.wallet_address && payload.iss === 'PROVN') {
              challengeValid = true
              
              const iat = payload.iat ? new Date(payload.iat).getTime() : (new Date(payload.exp).getTime() - 5 * 60 * 1000)
              const exp = new Date(payload.exp).getTime()
              const d = new Date(log.created_at).getTime()
              
              // Timestamp is strictly bounded by challenge validity window
              if (!isNaN(d) && d >= iat && d <= exp) {
                timestampValid = true
              }
            }
          }
        } catch { }
      }
    }
  } else {
    // V1 legacy
    challengeValid = typeof log.nonce === 'string' && log.nonce.trim().length >= 8
    try {
      const d = new Date(log.created_at)
      timestampValid = !isNaN(d.getTime())
    } catch { }
  }

  const challengeVerified = isDomainValid && challengeValid && timestampValid

  // Source Validity Layer
  const provLevel = (log.provenance_level || 'self_attested').toLowerCase()
  let sourceStatus: ProofStatusLayers['source'] = 'SELF_ATTESTED'
  let isSourceVerified = false
  const sourceVerificationMode = 'LOCAL_METADATA'

  if (provLevel === 'source_verified') {
    // In local mode, we trust the DB claim for status, but it is NOT independently cryptographically verified
    sourceStatus = 'CLAIMED'
    isSourceVerified = false
  } else if (provLevel === 'author_attributed' || provLevel === 'identity_linked') {
    sourceStatus = 'ATTRIBUTED'
  } else if (provLevel === 'source_exists') {
    sourceStatus = 'EXISTS'
  } else if (provLevel === 'source_linked' || log.evidence_url) {
    sourceStatus = 'LINKED'
  } else {
    sourceStatus = 'SELF_ATTESTED'
  }

  // Archive Validity Layer
  const archState = (log.archival_state || 'not_requested').toLowerCase()
  let archiveStatus: ProofStatusLayers['archive'] = 'NOT_REQUESTED'
  let isArchiveVerified = false
  const archiveVerificationMode = 'LOCAL_METADATA'

  if (archState === 'finalized' || archState === 'receipt_obtained') {
    if (log.irys_tx_id && !log.irys_tx_id.startsWith('powl_')) {
      archiveStatus = 'CLAIMED'
      // In local mode, we don't query Irys, so it's not cryptographically independently verified
      isArchiveVerified = false
    } else {
      archiveStatus = 'RECEIPT_OBTAINED'
      isArchiveVerified = false
    }
  } else if (archState === 'pending') {
    archiveStatus = 'PENDING'
  } else if (archState === 'failed') {
    archiveStatus = 'FAILED'
  } else {
    archiveStatus = 'NOT_REQUESTED'
  }

  // Submission Receipt Verification (if present)
  let submissionReceiptValid: boolean | undefined = undefined
  let signedPayloadHashValid: boolean | undefined = undefined
  let serverObservedAt: string | null = null

  if (log.submission_receipt && typeof log.submission_receipt === 'string') {
    const subParts = log.submission_receipt.split('.')
    if (subParts.length === 2) {
      try {
        const subPayloadBytes = decodeBase58(subParts[0])
        const subSigBytes = decodeBase58(subParts[1])
        const subPayload = JSON.parse(new TextDecoder().decode(subPayloadBytes))
        const kid = typeof subPayload.kid === 'string' && subPayload.kid.trim() !== '' ? subPayload.kid : null

        if (kid && verifyServerReceipt(subPayloadBytes, subSigBytes, kid, subPayload.observed_at)) {
          const canonicalMsg = reconstructCanonicalSubmitMessage(log)
          const canonicalHash = canonicalMsg ? computeCanonicalProofHash(canonicalMsg) : null
          
          signedPayloadHashValid = Boolean(canonicalHash && subPayload.signed_payload_hash === canonicalHash)

          const challengeMatches = subPayload.challenge_id === (log.challenge || log.nonce)
          const walletMatches = subPayload.wallet === log.wallet_address
          const proofIdMatches = !log.id || String(subPayload.proof_id) === String(log.id)
          const typeAndIssMatches = subPayload.type === 'PROVN_SUBMISSION_RECEIPT' && subPayload.iss === 'PROVN'
          const versionMatches = subPayload.version === 1 && (!subPayload.protocol_version || subPayload.protocol_version === protocolVersion)

          if (typeAndIssMatches && versionMatches && walletMatches && proofIdMatches && challengeMatches && signedPayloadHashValid) {
            submissionReceiptValid = true
            serverObservedAt = subPayload.observed_at || null
          } else {
            submissionReceiptValid = false
          }
        } else {
          submissionReceiptValid = false
        }
      } catch {
        submissionReceiptValid = false
      }
    } else {
      submissionReceiptValid = false
    }
  }

  const submissionReceiptVerified = Boolean(submissionReceiptValid)
  const isV2 = protocolVersion === 2
  const isProtocolValid = isSigValid && challengeVerified && (isV2 ? submissionReceiptVerified : true)

  return {
    signatureVerified: isSigValid,
    protocolVerified: isProtocolValid,
    challengeVerified,
    submissionReceiptVerified,
    sourceVerified: isSourceVerified,
    archiveVerified: isArchiveVerified,
    sourceVerificationMode,
    archiveVerificationMode,
    proofStatus: {
      signature: isSigValid ? 'VERIFIED' : 'FAILED',
      protocol: isProtocolValid ? 'VERIFIED' : (isSigValid ? 'UNVERIFIED' : 'FAILED'),
      source: sourceStatus,
      archive: archiveStatus,
    },
    details: {
      protocolVersion,
      signatureAlgorithm: 'Ed25519',
      domainVerified: isDomainValid,
      timestampBound: timestampValid,
      challengeValid,
      challengeVerified,
      submissionReceiptValid,
      submissionReceiptVerified,
      signedPayloadHashValid,
      serverObservedAt,
      provenanceLevel: provLevel,
      archivalState: archState,
      irysReceipt: (log.irys_tx_id && !log.irys_tx_id.startsWith('powl_')) ? log.irys_tx_id : null,
    },
  }
}


