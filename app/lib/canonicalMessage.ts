/**
 * PROVN Canonical SIWS (Sign-In-With-Solana) Message Builder
 *
 * Cryptographically binds wallet address, content, evidence links (GitHub & Demo URLs),
 * timestamp, and unique nonce into a standardized, tamper-evident SIWS message.
 */

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
 * Builds canonical SIWS prompt for initial log submission.
 * Cryptographically binds content AND normalized evidence URLs.
 */
export function buildCanonicalSubmitMessage(params: CanonicalSubmitParams): string {
  const domain = params.domain || 'provn-sol.vercel.app'
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
