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
    if (Array.isArray(parsed)) {
      const numArr = parsed.map((x) => Number(x)).filter((x) => !isNaN(x))
      if (numArr.length === 64) {
        return new Uint8Array(numArr)
      }
    }
  } catch {}

  // 2. Try comma-separated string format "123, 45, 67..."
  try {
    if (rawKey.includes(',')) {
      const numArr = rawKey.replace(/[\[\]]/g, '').split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x))
      if (numArr.length === 64) {
        return new Uint8Array(numArr)
      }
    }
  } catch {}

  // 3. Try Base58 format
  try {
    if (typeof rawKey === 'string' && !rawKey.startsWith('[')) {
      const decoded = decodeBase58(rawKey)
      if (decoded && decoded.length === 64) return decoded
    }
  } catch {}

  return rawKey
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

  // Safe CJS/ESM module resolution under Next.js serverless bundlers
  const irysUploadObj = (await import('@irys/upload')) as unknown as Record<string, unknown>
  const irysSolanaObj = (await import('@irys/upload-solana')) as unknown as Record<string, unknown>

  const UploaderFn = (irysUploadObj.Uploader || irysUploadObj.default || irysUploadObj) as (adapter: unknown) => { withWallet: (key: unknown) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }
  const SolanaFn = irysSolanaObj.Solana || irysSolanaObj.default || irysSolanaObj

  if (typeof UploaderFn !== 'function' || !SolanaFn) {
    const msg = 'Irys SDK module exports unresolved in serverless bundle'
    console.error('[PROVN Irys]', msg)
    return { success: false, error: msg }
  }

  const parsedKey = parseIrysPrivateKey(privateKey)

  // Try multiple key representations for Irys uploader
  const keyAttempts: (string | Uint8Array | number[])[] = [parsedKey]
  if (parsedKey instanceof Uint8Array) {
    keyAttempts.push(Array.from(parsedKey))
  }

  let lastError = 'Upload unconfirmed'

  for (const walletKey of keyAttempts) {
    try {
      const uploader = await UploaderFn(SolanaFn).withWallet(walletKey)

      const uploadReceipt = await uploader.upload(structuredEnvelope, { tags })
      if (uploadReceipt && uploadReceipt.id) {
        console.log(`[PROVN Irys] Successfully archived to Arweave ID: ${uploadReceipt.id}`)
        return { success: true, irysTxId: uploadReceipt.id }
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error('[PROVN Irys Key Attempt Failed]:', lastError)
    }
  }

  return { success: false, error: lastError }
}
