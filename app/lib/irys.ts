/**
 * Cryptographic Log Submission Client Helper
 *
 * Prompts the user's Solana wallet to sign canonical proof messages (SIWS-inspired),
 * encodes signatures in Base58, and communicates with verified API routes.
 */

import bs58 from 'bs58'
import {
  buildCanonicalSubmitMessageV2,
  buildCanonicalRetryMessageV2,
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

function encodeBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes)
}

/**
 * Step 1: Request an anti-replay cryptographic signing challenge from the server
 */
export async function requestChallenge(walletAddress: string): Promise<string> {
  const response = await fetch('/api/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  })

  if (!response.ok) {
    let errorMsg = `Failed to get challenge (${response.status})`
    try {
      const data = await response.json()
      if (data.error) errorMsg = data.error
    } catch {
      // fallback
    }
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data.challenge
}

export async function submitVerifiedLog(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string,
  content: string,
  evidenceUrl?: string,
  githubUrl?: string
): Promise<SubmitLogResponse> {
  const timestamp = new Date().toISOString()
  const challenge = await requestChallenge(walletAddress)

  // 1. Build canonical proof message cryptographically binding content AND evidence URLs
  const clientDomain = getVerifiedDomain(typeof window !== 'undefined' && window.location?.host ? window.location.host : null)
  const messageText = buildCanonicalSubmitMessageV2({
    domain: clientDomain,
    walletAddress,
    timestamp,
    challenge,
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
      challenge,
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
  const challenge = await requestChallenge(walletAddress)

  // 1. Build canonical retry message
  const clientDomain = getVerifiedDomain(typeof window !== 'undefined' && window.location?.host ? window.location.host : null)
  const messageText = buildCanonicalRetryMessageV2({
    domain: clientDomain,
    walletAddress,
    logId,
    timestamp,
    challenge,
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
      challenge,
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

/**
 * Automatic / Signature-Free Archival Retry Helper
 * Re-triggers Irys archival for an existing validated proof without prompting a new wallet signature.
 */
export async function requestArchivalRetry(
  walletAddress: string,
  logId: number
): Promise<RetryArchivalResponse> {
  const response = await fetch('/api/archival-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logId,
      walletAddress,
    }),
  })

  if (!response.ok) {
    let errorMsg = `Archival retry error (HTTP ${response.status})`
    try {
      const json = await response.json()
      if (json.error) errorMsg = json.error
    } catch {}
    throw new Error(errorMsg)
  }

  return await response.json()
}
