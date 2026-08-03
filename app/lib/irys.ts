/**
 * Cryptographic Log Submission Client Helper
 *
 * Prompts the user's Solana wallet to sign a structured authentication message,
 * encodes the signature in Base58, and sends it to the verified /api/log-submit route.
 */

import bs58 from 'bs58'

export type ArchivalState = 'pending' | 'archived' | 'failed' | 'legacy_unverified'

export interface LogRecord {
  id: number
  wallet_address: string
  content: string
  category?: string
  skills?: string[]
  protocols?: string[]
  created_at: string
  irys_tx_id?: string | null
  archival_state?: ArchivalState
  signature?: string
  evidence_url?: string | null
  github_url?: string | null
  [key: string]: unknown
}

export interface SubmitLogResponse {
  success: boolean
  log: LogRecord
  archivalState?: ArchivalState
  irysTxId: string | null
  gatewayUrl: string | null
  cnftAssetId?: string | null
  hasMerkleTree?: boolean
}

const encodeBase58 = (bytes: Uint8Array): string => {
  const bs58Obj = bs58 as unknown as { encode?: (bytes: Uint8Array) => string; default?: { encode: (bytes: Uint8Array) => string } }
  const fn = bs58Obj.encode || bs58Obj.default?.encode
  if (!fn) throw new Error('Base58 encoder unavailable')
  return fn(bytes)
}

export async function submitVerifiedLog(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string,
  content: string,
  evidenceUrl?: string,
  githubUrl?: string
): Promise<SubmitLogResponse> {
  const timestamp = new Date().toISOString()
  const messageText = `provn-sol.vercel.app wants you to sign in with your Solana account:\n${walletAddress}\n\nTimestamp: ${timestamp}\nContent: ${content.trim()}`
  const messageBytes = new TextEncoder().encode(messageText)

  // 1. Request wallet signature from Phantom/Backpack/Solflare
  const rawSigResult: unknown = await signMessage(messageBytes)
  let rawSig = rawSigResult
  if (rawSig && typeof rawSig === 'object' && 'signature' in rawSig) {
    rawSig = (rawSig as { signature: unknown }).signature
  }
  const signatureBytes = rawSig instanceof Uint8Array ? rawSig : new Uint8Array(rawSig as ArrayBuffer)
  const signatureBase58 = encodeBase58(signatureBytes)

  // 2. Send payload to verified backend endpoint
  const response = await fetch('/api/log-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: content.trim(),
      walletAddress,
      timestamp,
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
