import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { classifyLog } from '@/app/lib/classifier'
import { ArchivalState } from '@/app/lib/irys'
import { buildCanonicalSubmitMessage, validateAndNormalizeUrl } from '@/app/lib/canonicalMessage'

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
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or malformed JSON payload' }, { status: 400 })
    }

    const { content, walletAddress, timestamp, nonce, signature, evidenceUrl, githubUrl } = body

    // 1. Input Validation
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required and must be non-empty string' }, { status: 400 })
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: 'Log entry exceeds maximum limit of 500 characters' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json({ error: 'Valid Base58 Solana wallet address is required (32-44 chars)' }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Cryptographic signature is required' }, { status: 400 })
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'ISO timestamp is required' }, { status: 400 })
    }

    // URL Normalization & Validation
    const cleanGithubUrl = validateAndNormalizeUrl(typeof githubUrl === 'string' ? githubUrl : null, 'github')
    const cleanEvidenceUrl = validateAndNormalizeUrl(typeof evidenceUrl === 'string' ? evidenceUrl : null, 'evidence')

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

    // 4. Reconstruct Canonical SIWS Message & Cryptographic Signature Verification
    const expectedMessageText = buildCanonicalSubmitMessage({
      walletAddress,
      timestamp,
      nonce: typeof nonce === 'string' ? nonce : 'legacy',
      content,
      githubUrl: cleanGithubUrl,
      evidenceUrl: cleanEvidenceUrl,
    })

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
        { error: 'Cryptographic signature verification failed. Tampered or unauthorized payload rejected.' },
        { status: 401 }
      )
    }

    // 5. Server-Side Daily Log Quota Check via Atomic RPC / Query
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    let todayCount = 0
    const { data: rpcCount, error: rpcError } = await supabase
      .rpc('get_daily_log_count', {
        p_wallet: walletAddress,
        p_start_time: startOfDay.toISOString()
      })

    if (!rpcError && typeof rpcCount === 'number') {
      todayCount = rpcCount
    } else {
      const { data: todayLogs, error: countError } = await supabase
        .from('logs')
        .select('id')
        .eq('wallet_address', walletAddress)
        .gte('created_at', startOfDay.toISOString())

      if (!countError && todayLogs) {
        todayCount = todayLogs.length
      }
    }

    if (todayCount >= 3) {
      return NextResponse.json(
        { error: 'Daily log quota reached (3/3 logs submitted today). Come back tomorrow 🗿' },
        { status: 429 }
      )
    }

    // 6. Replay Check via Signature Uniqueness in DB
    const { data: existingSig, error: sigCheckError } = await supabase
      .from('logs')
      .select('id')
      .eq('signature', signature)
      .maybeSingle()

    if (sigCheckError) {
      console.warn('Signature lookup warning:', sigCheckError.message)
    }

    if (existingSig) {
      return NextResponse.json(
        { error: 'Duplicate signature detected. Replay attempt rejected.' },
        { status: 401 }
      )
    }

    // 7. Classify Log Content
    const classification = classifyLog(content.trim())

    // 8. Database Save (Supabase)
    let insertRes = await supabase
      .from('logs')
      .insert([{
        content: content.trim(),
        wallet_address: walletAddress,
        signature,
        created_at: timestamp,
        skills: classification.skills,
        protocols: classification.protocols,
        category: classification.category,
        evidence_url: cleanEvidenceUrl,
        github_url: cleanGithubUrl,
        archival_state: 'pending',
      }])
      .select()

    // Fallback: If live DB schema does not have new columns yet, save with basic schema
    if (insertRes.error) {
      console.warn('Full schema insert warning. Falling back to basic schema:', insertRes.error.message)
      insertRes = await supabase
        .from('logs')
        .insert([{
          content: content.trim(),
          wallet_address: walletAddress,
          created_at: timestamp,
        }])
        .select()
    }

    if (insertRes.error || !insertRes.data || insertRes.data.length === 0) {
      console.error('Supabase insert error:', insertRes.error)
      return NextResponse.json({ error: `Failed to save log to database: ${insertRes.error?.message || 'Unknown database error'}` }, { status: 500 })
    }

    const savedLog = insertRes.data[0]
    let irysTxId: string | null = null
    let archivalState: ArchivalState = 'pending'

    // 9. Permanent Storage Upload of Envelope to Arweave (Irys Node #1)
    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: 1,
      logId: savedLog.id,
      walletAddress,
      timestamp,
      content: content.trim(),
      signature,
      evidenceUrl: cleanEvidenceUrl,
      githubUrl: cleanGithubUrl,
      classification,
    }, null, 2)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
      { name: 'Timestamp', value: timestamp },
      { name: 'Category', value: classification.category },
    ]

    if (cleanEvidenceUrl) tags.push({ name: 'Evidence-URL', value: cleanEvidenceUrl })
    if (cleanGithubUrl) tags.push({ name: 'GitHub-URL', value: cleanGithubUrl })

    const { uploadEnvelopeToIrys } = await import('@/app/lib/irysUploader')
    const uploadRes = await uploadEnvelopeToIrys(structuredEnvelope, tags)
    irysTxId = uploadRes.irysTxId || null
    archivalState = uploadRes.success && irysTxId ? 'archived' : 'pending'

    // Update DB row with confirmed irys_tx_id and archival_state
    if (irysTxId) {
      let updateRes = await supabase
        .from('logs')
        .update({
          irys_tx_id: irysTxId,
          archival_state: archivalState
        })
        .eq('id', savedLog.id)

      if (updateRes.error) {
        // Fallback update if archival_state column is missing on live DB
        updateRes = await supabase
          .from('logs')
          .update({
            irys_tx_id: irysTxId,
          })
          .eq('id', savedLog.id)
      }
    }

    return NextResponse.json({
      success: true,
      log: {
        ...savedLog,
        evidence_url: cleanEvidenceUrl,
        github_url: cleanGithubUrl,
        irys_tx_id: irysTxId,
        archival_state: archivalState,
      },
      classification,
      archivalState,
      irysTxId,
      cnftAssetId: null,
      hasMerkleTree: !!process.env.SOLANA_MERKLE_TREE_PUBKEY,
      gatewayUrl: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : null,
    })
  } catch (error: unknown) {
    console.error('Log submission API error:', error)
    const detail = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
