import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { classifyLog } from '@/app/lib/classifier'
import { LogRecord } from '@/app/lib/irys'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory IP/Wallet rate limiting map: key -> timestamp array
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS_PER_HOUR = 10

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(key) || []

  // Filter out timestamps older than 1 hour
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)

  if (validTimestamps.length >= MAX_REQUESTS_PER_HOUR) {
    rateLimitMap.set(key, validTimestamps)
    return false
  }

  validTimestamps.push(now)
  rateLimitMap.set(key, validTimestamps)
  return true
}

const decodeBase58 = (str: string): Uint8Array => {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
}

export async function POST(req: NextRequest) {
  try {
    const { content, walletAddress, timestamp, signature } = await req.json()

    // 1. Input Validation
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required and must be non-empty string' }, { status: 400 })
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: 'Log entry exceeds maximum limit of 500 characters' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid Base58 wallet address is required' }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Cryptographic signature is required' }, { status: 400 })
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'ISO timestamp is required' }, { status: 400 })
    }

    // 2. Pre-verification Rate Limiting Check (IP / Wallet)
    const clientIp = req.headers.get('x-forwarded-for') || walletAddress
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 log submissions per hour allowed per IP/wallet.' },
        { status: 429 }
      )
    }

    // 3. Replay Attack Prevention (Check timestamp drift within 15 mins)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attack rejected.' }, { status: 401 })
    }

    // 4. Cryptographic Signature Verification
    const expectedMessageText = `provn-sol.vercel.app wants you to sign in with your Solana account:\n${walletAddress}\n\nTimestamp: ${timestamp}\nContent: ${content.trim()}`
    const messageBytes = new TextEncoder().encode(expectedMessageText)

    let signatureBytes: Uint8Array
    let publicKeyBytes: Uint8Array

    try {
      signatureBytes = decodeBase58(signature)
      publicKeyBytes = decodeBase58(walletAddress)
    } catch {
      return NextResponse.json({ error: 'Invalid Base58 encoding for signature or wallet address' }, { status: 400 })
    }

    const isSignatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Cryptographic signature verification failed. Unauthorized payload rejected.' },
        { status: 401 }
      )
    }

    // 5. Server-Side Daily Log Quota Check (Max 3 logs per 24 hours per wallet in DB)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: todayLogs, error: countError } = await supabase
      .from('logs')
      .select('id, created_at')
      .eq('wallet_address', walletAddress)
      .gte('created_at', startOfDay.toISOString())

    if (!countError && todayLogs && todayLogs.length >= 3) {
      return NextResponse.json(
        { error: 'Daily log quota reached (3/3 logs submitted today). Come back tomorrow 🗿' },
        { status: 429 }
      )
    }

    // 6. Replay Check via Signature Uniqueness in DB
    const { data: existingSig } = await supabase
      .from('logs')
      .select('id')
      .eq('signature', signature)
      .maybeSingle()

    if (existingSig) {
      return NextResponse.json(
        { error: 'Duplicate signature detected. Replay attempt rejected.' },
        { status: 401 }
      )
    }

    // 7. Classify Log Content
    const classification = classifyLog(content.trim())

    // 8. Initial Database Save (Supabase) with archival_state: 'pending'
    let dbData: LogRecord[] | null = null
    let dbError: { message: string } | null = null

    // Try full insert with classification & signature
    const fullRes = await supabase
      .from('logs')
      .insert([{
        content: content.trim(),
        wallet_address: walletAddress,
        signature,
        created_at: timestamp,
        skills: classification.skills,
        protocols: classification.protocols,
        category: classification.category,
        archival_state: 'pending',
      }])
      .select()

    dbData = fullRes.data as LogRecord[] | null
    dbError = fullRes.error

    // Fallback: If new columns do not exist in Supabase yet, retry with base schema
    if (dbError) {
      console.warn('Full insert failed, retrying base schema insert:', dbError.message)
      const baseRes = await supabase
        .from('logs')
        .insert([{
          content: content.trim(),
          wallet_address: walletAddress,
          created_at: timestamp,
        }])
        .select()
      dbData = baseRes.data as LogRecord[] | null
      dbError = baseRes.error
    }

    if (dbError || !dbData || dbData.length === 0) {
      console.error('Supabase insert error:', dbError)
      return NextResponse.json({ error: `Failed to save log to database: ${dbError?.message || 'Unknown error'}` }, { status: 500 })
    }

    const savedLog = dbData[0]
    let irysTxId: string | null = null
    let archivalState: 'pending' | 'archived' | 'failed' = 'pending'

    // 9. Permanent Storage Upload to Arweave (Irys)
    const privateKey = process.env.IRYS_PRIVATE_KEY
    if (privateKey) {
      try {
        const { Uploader } = await import('@irys/upload')
        const { Solana } = await import('@irys/upload-solana')

        let walletKey: string | Uint8Array = privateKey
        try {
          const parsedKey = JSON.parse(privateKey)
          if (Array.isArray(parsedKey)) {
            walletKey = new Uint8Array(parsedKey)
          }
        } catch {
          // Plain secret key string
        }

        const uploader = await (Uploader(Solana) as unknown as { withKey: (key: string | Uint8Array) => Promise<{ upload: (data: string, opts?: unknown) => Promise<{ id: string }> }> }).withKey(walletKey)

        const tags = [
          { name: 'App-Name', value: 'PROVN' },
          { name: 'Content-Type', value: 'text/plain' },
          { name: 'Builder-Address', value: walletAddress },
          { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
          { name: 'Timestamp', value: timestamp },
          { name: 'Category', value: classification.category },
        ]

        const uploadReceipt = await uploader.upload(content.trim(), { tags })

        if (uploadReceipt && uploadReceipt.id) {
          irysTxId = uploadReceipt.id
          archivalState = 'archived'
          console.log(`[Irys Gateway] Log ${savedLog.id} uploaded permanently to Arweave: https://gateway.irys.xyz/${irysTxId}`)
        } else {
          archivalState = 'failed'
        }
      } catch (irysErr) {
        console.error('Irys upload failed:', irysErr)
        archivalState = 'failed'
      }
    } else {
      archivalState = 'failed'
    }

    // Update database row with confirmed irys_tx_id and archival_state
    try {
      await supabase
        .from('logs')
        .update({
          irys_tx_id: irysTxId,
          archival_state: archivalState
        })
        .eq('id', savedLog.id)
    } catch {
      // Non-fatal DB update error
    }

    // 10. Mint Compressed NFT (cNFT) Proof Badge (only if Merkle Tree configured)
    let cnftAssetId: string | null = null
    const hasMerkleTree = !!process.env.SOLANA_MERKLE_TREE_PUBKEY
    if (hasMerkleTree && irysTxId) {
      try {
        const { mintProofCNFT } = await import('@/app/lib/cnft')
        const cnftResult = await mintProofCNFT(walletAddress, content, irysTxId)
        if (cnftResult.success && cnftResult.assetId) {
          cnftAssetId = cnftResult.assetId
        }
      } catch (cnftErr) {
        console.error('cNFT minting error (non-fatal):', cnftErr)
      }
    }

    return NextResponse.json({
      success: true,
      log: {
        ...savedLog,
        irys_tx_id: irysTxId,
        archival_state: archivalState,
      },
      classification,
      archivalState,
      irysTxId,
      cnftAssetId,
      hasMerkleTree,
      gatewayUrl: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : null,
    })
  } catch (error: unknown) {
    console.error('Log submission API error:', error)
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Internal server error'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
