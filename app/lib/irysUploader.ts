import bs58 from 'bs58'

const decodeBase58 = (str: string): Uint8Array => {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
}

export function parseIrysPrivateKey(privateKey: string): Uint8Array | string {
  let rawKey = privateKey.trim()
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) rawKey = rawKey.slice(1, -1)
  rawKey = rawKey.replace(/\\n/g, '').trim()

  // 1. Try JSON array format [123, 45, ...]
  try {
    const parsed = JSON.parse(rawKey)
    if (Array.isArray(parsed)) return new Uint8Array(parsed)
  } catch {}

  // 2. Try Base58 format
  try {
    if (typeof rawKey === 'string' && !rawKey.startsWith('[')) {
      const decoded = decodeBase58(rawKey)
      if (decoded && decoded.length > 0) return decoded
    }
  } catch {}

  return rawKey
}

export async function uploadEnvelopeToIrys(
  structuredEnvelope: string,
  tags: { name: string; value: string }[]
): Promise<string | null> {
  const privateKey = process.env.IRYS_PRIVATE_KEY
  if (!privateKey) {
    console.warn('[PROVN Irys] IRYS_PRIVATE_KEY is not configured in server environment variables.')
    return null
  }

  try {
    const walletKey = parseIrysPrivateKey(privateKey)
    const { Uploader } = await import('@irys/upload')
    const { Solana } = await import('@irys/upload-solana')

    const uploader = await (Uploader(Solana) as unknown as { withWallet: (key: string | Uint8Array) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }).withWallet(walletKey)

    const uploadReceipt = await uploader.upload(structuredEnvelope, { tags })
    if (uploadReceipt && uploadReceipt.id) {
      console.log(`[PROVN Irys] Successfully archived to Arweave ID: ${uploadReceipt.id}`)
      return uploadReceipt.id
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[PROVN Irys Upload Failed]:', errMsg)
  }

  return null
}
