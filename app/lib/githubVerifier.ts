import { EvidenceType, ProvenanceLevel, SourceVerificationStatus } from './types'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export interface ParsedGithubUrl {
  owner: string
  repo: string
  type: 'pull' | 'commit'
  identifier: string // PR number or commit SHA
}

export interface SourceSnapshot {
  provider: string
  sourceType: EvidenceType
  sourceUrl: string
  author: string | null
  state: string | null
  mergeStatus: string | null
  sourceTimestamp: string | null
  verifiedAt: string
  raw: Record<string, unknown>
}

export interface VerificationResult {
  status: SourceVerificationStatus
  provenanceLevel: ProvenanceLevel
  evidenceType: EvidenceType
  snapshot: SourceSnapshot | null
  error?: string
}

/**
 * Parses a GitHub PR or Commit URL into components.
 * Returns null if the URL is not a recognized GitHub format.
 */
export function parseGithubUrl(url: string): ParsedGithubUrl | null {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== 'github.com' && parsedUrl.hostname !== 'www.github.com') {
      return null
    }

    // Path parts: ['', 'owner', 'repo', 'pull'|'commit', 'identifier']
    const parts = parsedUrl.pathname.split('/').filter(Boolean)
    if (parts.length < 4) return null

    const owner = parts[0]
    const repo = parts[1]
    const type = parts[2]
    const identifier = parts[3]

    if (type === 'pull' || type === 'pulls') {
      // Must be numeric
      if (!/^\d+$/.test(identifier)) return null
      return { owner, repo, type: 'pull', identifier }
    } else if (type === 'commit' || type === 'commits') {
      // Basic sha validation (usually 40 chars, sometimes abbreviated)
      if (!/^[a-fA-F0-9]{7,40}$/.test(identifier)) return null
      return { owner, repo, type: 'commit', identifier }
    }

    return null
  } catch (_e) {
    return null
  }
}

/**
 * Verifies a GitHub URL by fetching its metadata from the GitHub REST API.
 */
export async function verifyGithubSource(url: string, walletAddress?: string): Promise<VerificationResult> {
  const parsed = parseGithubUrl(url)
  
  if (!parsed) {
    // If it's not a recognized GitHub URL but was submitted as evidence
    return {
      status: 'not_verified',
      provenanceLevel: 'self_attested',
      evidenceType: 'public_url',
      snapshot: null,
      error: 'Not a recognized GitHub PR or Commit URL',
    }
  }

  const evidenceType: EvidenceType = parsed.type === 'pull' ? 'github_pr' : 'github_commit'
  const apiUrl = parsed.type === 'pull'
    ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.identifier}`
    : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${parsed.identifier}`

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PROVN-Evidence-Verifier',
  }

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
  }

  try {
    const res = await fetch(apiUrl, { headers })

    if (!res.ok) {
      if (res.status === 404) {
        return {
          status: 'failed',
          provenanceLevel: 'source_linked', // User linked it, but we can't verify it
          evidenceType,
          snapshot: null,
          error: 'Repository not found or is private.',
        }
      }
      if (res.status === 403) {
        return {
          status: 'unavailable',
          provenanceLevel: 'source_linked',
          evidenceType,
          snapshot: null,
          error: 'GitHub API rate limit exceeded or access forbidden.',
        }
      }
      return {
        status: 'failed',
        provenanceLevel: 'source_linked',
        evidenceType,
        snapshot: null,
        error: `GitHub API error: ${res.statusText}`,
      }
    }

    const data = await res.json()
    const now = new Date().toISOString()

    let snapshot: SourceSnapshot

    if (parsed.type === 'pull') {
      snapshot = {
        provider: 'github',
        sourceType: 'github_pr',
        sourceUrl: data.html_url || url,
        author: data.user?.login || null,
        state: data.state || null, // 'open', 'closed'
        mergeStatus: data.merged ? 'merged' : 'unmerged',
        sourceTimestamp: data.created_at || null,
        verifiedAt: now,
        raw: {
          id: data.id,
          number: data.number,
          title: data.title,
          created_at: data.created_at,
          merged_at: data.merged_at,
          state: data.state,
          author: data.user?.login,
          repo: `${parsed.owner}/${parsed.repo}`,
        }
      }
    } else {
      snapshot = {
        provider: 'github',
        sourceType: 'github_commit',
        sourceUrl: data.html_url || url,
        author: data.author?.login || data.commit?.author?.name || null,
        state: 'committed',
        mergeStatus: null,
        sourceTimestamp: data.commit?.author?.date || null,
        verifiedAt: now,
        raw: {
          sha: data.sha,
          message: data.commit?.message,
          author: data.author?.login || data.commit?.author?.name,
          date: data.commit?.author?.date,
          verified: data.commit?.verification?.verified,
          repo: `${parsed.owner}/${parsed.repo}`,
        }
      }
    }

    let finalStatus: SourceVerificationStatus = 'verified_source_exists'
    let finalProvenance: ProvenanceLevel = 'source_linked'

    // If walletAddress is provided, check if it's cryptographically linked to the GitHub author
    if (walletAddress && snapshot.author) {
      const { data: identity } = await supabase
        .from('wallet_identities')
        .select('github_username')
        .eq('wallet_address', walletAddress)
        .single()

      if (identity && identity.github_username.toLowerCase() === snapshot.author.toLowerCase()) {
        finalStatus = 'verified'
        finalProvenance = 'source_verified'
      }
    }

    return {
      status: finalStatus,
      provenanceLevel: finalProvenance,
      evidenceType,
      snapshot,
    }

  } catch (error: unknown) {
    return {
      status: 'unavailable',
      provenanceLevel: 'source_linked',
      evidenceType,
      snapshot: null,
      error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
