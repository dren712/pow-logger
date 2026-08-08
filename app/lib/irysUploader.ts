import { Keypair } from '@solana/web3.js'
import { decodeBase58 } from './canonicalMessage'

let cachedUploaderFn: ((adapter: unknown) => { withWallet: (key: unknown) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }) | null = null
let cachedSolanaFn: unknown = null

async function getIrysModules() {
  if (cachedUploaderFn && cachedSolanaFn) {
    return { UploaderFn: cachedUploaderFn, SolanaFn: cachedSolanaFn }
  }
  const irysUploadObj = (await import('@irys/upload')) as unknown as Record<string, unknown>
  const irysSolanaObj = (await import('@irys/upload-solana')) as unknown as Record<string, unknown>

  cachedUploaderFn = (irysUploadObj.Uploader || irysUploadObj.default || irysUploadObj) as (adapter: unknown) => { withWallet: (key: unknown) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }
  cachedSolanaFn = irysSolanaObj.Solana || irysSolanaObj.default || irysSolanaObj
  return { UploaderFn: cachedUploaderFn, SolanaFn: cachedSolanaFn }
}

/**
 * Deterministically parses a Solana secret key from environment variable string.
 * Supports standard JSON Array (64-byte secret key / 32-byte seed) or Base58 encoded string.
 */
export function parseIrysPrivateKey(privateKeyEnv: string): Uint8Array {
  let cleaned = privateKeyEnv.trim()
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  cleaned = cleaned.replace(/\\n/g, '').trim()

  // 1. JSON Array format [123, 45, ...]
  if (cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        const bytes = new Uint8Array(parsed.map(Number))
        if (bytes.length === 64) return bytes
        if (bytes.length === 32) return Keypair.fromSeed(bytes).secretKey
        throw new Error(`Invalid JSON key length (${bytes.length} bytes). Expected 64-byte secret key or 32-byte seed.`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON format'
      throw new Error(`Failed to parse IRYS_PRIVATE_KEY as JSON array: ${msg}`)
    }
  }

  // 2. Base58 encoded string format
  try {
    const decoded = decodeBase58(cleaned)
    if (decoded.length === 64) return decoded
    if (decoded.length === 32) return Keypair.fromSeed(decoded).secretKey
    throw new Error(`Invalid Base58 key length (${decoded.length} bytes). Expected 64 or 32 bytes.`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid Base58 format'
    throw new Error(`Failed to parse IRYS_PRIVATE_KEY as Base58 string: ${msg}`)
  }
}

export interface IrysUploadResult {
  success: boolean
  irysTxId?: string
  error?: string
}

export async function uploadEnvelopeToIrys(
  structuredEnvelope: string,
  tags: { name: string; value: string }[]
): Promise<IrysUploadResult> {
  const privateKey = process.env.IRYS_PRIVATE_KEY
  if (!privateKey) {
    const msg = 'IRYS_PRIVATE_KEY is not configured in Vercel Environment Variables'
    console.warn('[PROVN Irys]', msg)
    return { success: false, error: msg }
  }

  let parsedKey: Uint8Array
  try {
    parsedKey = parseIrysPrivateKey(privateKey)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid key'
    console.error('[PROVN Irys Key Parse Error]', msg)
    return { success: false, error: msg }
  }

  const { UploaderFn, SolanaFn } = await getIrysModules()

  if (typeof UploaderFn !== 'function' || !SolanaFn) {
    const msg = 'Irys SDK module exports unresolved in serverless bundle'
    console.error('[PROVN Irys]', msg)
    return { success: false, error: msg }
  }

  try {
    const uploader = await UploaderFn(SolanaFn).withWallet(parsedKey)
    const uploadReceipt = await uploader.upload(structuredEnvelope, { tags })

    if (uploadReceipt && uploadReceipt.id) {
      console.log(`[PROVN Irys] Successfully archived to Arweave ID: ${uploadReceipt.id}`)
      return { success: true, irysTxId: uploadReceipt.id }
    }
    return { success: false, error: 'Upload returned empty receipt ID' }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[PROVN Irys Upload Failed]:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
