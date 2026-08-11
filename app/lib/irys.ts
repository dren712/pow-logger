/**
 * Cryptographic Log Submission Client Helper
 *
 * Prompts the user's Solana wallet to sign canonical proof messages (SIWS-inspired),
 * encodes signatures in Base58, and communicates with verified API routes.
 */

import bs58 from 'bs58'
import {
  buildCanonicalSubmitMessage,
  buildCanonicalRetryMessage,
  getVerifiedDomain,
} from './canonicalMessage'
import { ArchivalState, LogRecord } from './types'

export type { ArchivalState, LogRecord }

export interface SubmitLogResponse {
  success: boolean
  log: LogRecord
  archivalState?: ArchivalState
  irysTxId: string | null
  gatewayUrl: string | null
  cnftAssetId?: string | null
  hasMerkleTree?: boolean
  hasHeliusRpc?: boolean
  streak?: number
  builderLevel?: {
    level: number
    title: string
    emoji: string
    color: string
  }
  newMilestone?: {
    days: number
    title: string
    emoji: string
    description: string
  } | null
}

export interface RetryArchivalResponse {
  success: boolean
  archivalState: ArchivalState
  irysTxId: string
  gatewayUrl: string
}

const encodeBase58 = (bytes: Uint8Array): string => {
  const bs58Obj = bs58 as unknown as { encode?: (bytes: Uint8Array) => string; default?: { encode: (bytes: Uint8Array) => string } }
  const fn = bs58Obj.encode || bs58Obj.default?.encode
  if (!fn) throw new Error('Base58 encoder unavailable')
  return fn(bytes)
}

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return encodeBase58(bytes)
  }
  throw new Error('Secure random generator (crypto.getRandomValues) unavailable.')
}

export async function submitVerifiedLog(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string,
  content: string,
  evidenceUrl?: string,
  githubUrl?: string
): Promise<SubmitLogResponse> {
  const timestamp = new Date().toISOString()
  const nonce = generateNonce()

  // 1. Build canonical SIWS message cryptographically binding content AND evidence URLs
  const clientDomain = typeof window !== 'undefined' && window.location?.host
    ? getVerifiedDomain(window.location.host)
    : 'provn-sol.vercel.app'
  const messageText = buildCanonicalSubmitMessage({
    domain: clientDomain,
    walletAddress,
    timestamp,
    nonce,
    content,
    evidenceUrl,
    githubUrl,
  })

  const messageBytes = new TextEncoder().encode(messageText)

  // 2. Request wallet signature from Phantom/Backpack/Solflare
  const rawSigResult: unknown = await signMessage(messageBytes)
  let rawSig = rawSigResult
  if (rawSig && typeof rawSig === 'object' && 'signature' in rawSig) {
    rawSig = (rawSig as { signature: unknown }).signature
  }
  const signatureBytes = rawSig instanceof Uint8Array ? rawSig : new Uint8Array(rawSig as ArrayBuffer)
  const signatureBase58 = encodeBase58(signatureBytes)

  // 3. Send payload to verified backend endpoint
  const response = await fetch('/api/log-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: content.trim(),
      walletAddress,
      timestamp,
      nonce,
      signature: signatureBase58,
      evidenceUrl: evidenceUrl?.trim() || null,
      githubUrl: githubUrl?.trim() || null,
    }),
  })

  if (!response.ok) {
    let errorMsg = `Server error (HTTP ${response.status})`
    try {
      const text = await response.text()
      try {
        const json = JSON.parse(text)
        if (json.error) errorMsg = json.error
      } catch {
        if (text) errorMsg = text.slice(0, 150)
      }
    } catch {
      // fallback
    }
    throw new Error(errorMsg)
  }

  return await response.json()
}

export async function requestAuthorizedArchivalRetry(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string,
  logId: number
): Promise<RetryArchivalResponse> {
  const timestamp = new Date().toISOString()
  const nonce = generateNonce()

  // 1. Build canonical retry message
  const messageText = buildCanonicalRetryMessage({
    walletAddress,
    logId,
    timestamp,
    nonce,
  })

  const messageBytes = new TextEncoder().encode(messageText)

  // 2. Request wallet signature
  const rawSigResult: unknown = await signMessage(messageBytes)
  let rawSig = rawSigResult
  if (rawSig && typeof rawSig === 'object' && 'signature' in rawSig) {
    rawSig = (rawSig as { signature: unknown }).signature
  }
  const signatureBytes = rawSig instanceof Uint8Array ? rawSig : new Uint8Array(rawSig as ArrayBuffer)
  const signatureBase58 = encodeBase58(signatureBytes)

  // 3. Call secure retry endpoint
  const response = await fetch('/api/archival-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logId,
      walletAddress,
      timestamp,
      nonce,
      signature: signatureBase58,
    }),
  })

  if (!response.ok) {
    let errorMsg = `Retry error (HTTP ${response.status})`
    try {
      const json = await response.json()
      if (json.error) errorMsg = json.error
    } catch {}
    throw new Error(errorMsg)
  }

  return await response.json()
}
