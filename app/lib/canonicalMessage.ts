/**
 * PROVN Canonical SIWS (Sign-In-With-Solana) Message Builder
 *
 * Cryptographically binds wallet address, content, evidence links (GitHub & Demo URLs),
 * timestamp, and unique nonce into a standardized, tamper-evident SIWS message.
 */

import bs58 from 'bs58'

/**
 * Shared Base58 decoder helper with CJS/ESM interop safety.
 */
export function decodeBase58(str: string): Uint8Array {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
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

/**
 * Builds canonical SIWS prompt for initial log submission.
 * Cryptographically binds content AND normalized evidence URLs.
 */
export function buildCanonicalSubmitMessage(params: CanonicalSubmitParams): string {
  const defaultDomain = typeof window !== 'undefined' && window.location?.host ? getVerifiedDomain(window.location.host) : 'provn-sol.vercel.app'
  const domain = getVerifiedDomain(params.domain || defaultDomain)
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
