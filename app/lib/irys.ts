/**
 * Cryptographic Log Submission Client Helper
 *
 * Prompts the user's Solana wallet to sign a structured authentication message,
 * encodes the signature in Base58, and sends it to the verified /api/log-submit route.
 */

import bs58 from 'bs58'

export interface SubmitLogResponse {
  success: boolean
  log: any
  irysTxId: string | null
  gatewayUrl: string | null
  cnftAssetId?: string | null
  hasMerkleTree?: boolean
}

/**
 * Submit a cryptographically verified log to the backend.
 *
 * @param signMessage - The signMessage function from useWallet()
 * @param walletAddress - Base58 public key of the connected wallet
 * @param content - Log text entry
 */
const encodeBase58 = (bytes: Uint8Array): string => {
  const fn = (bs58 as any).encode || (bs58 as any).default?.encode
  return fn(bytes)
}

export async function submitVerifiedLog(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string,
  content: string
): Promise<SubmitLogResponse> {
  const timestamp = new Date().toISOString()
  const messageText = `pow-logger.vercel.app wants you to sign in with your Solana account:\n${walletAddress}\n\nTimestamp: ${timestamp}\nContent: ${content.trim()}`
  const messageBytes = new TextEncoder().encode(messageText)

  // 1. Request wallet signature from Phantom/Backpack/Solflare
  let rawSig: any = await signMessage(messageBytes)
  if (rawSig && typeof rawSig === 'object' && 'signature' in rawSig) {
    rawSig = rawSig.signature
  }
  const signatureBytes = rawSig instanceof Uint8Array ? rawSig : new Uint8Array(rawSig)
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

