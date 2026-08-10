import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalSubmitMessage, validateAndNormalizeUrl, getVerifiedDomain } from '@/app/lib/canonicalMessage'
import { ArchivalState } from '@/app/lib/irys'

export const maxDuration = 30 // Allow up to 30s execution for Irys Arweave upload

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!serviceKey) {
  console.error('CRITICAL SERVER ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables!')
}

const supabaseKey = serviceKey || anonKey || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

import { checkRateLimit } from '@/app/lib/rateLimiter'
import { decodeBase58 } from '@/app/lib/canonicalMessage'
import { classifyLog } from '@/app/lib/classifier'
import { getBuilderLevel, checkNewMilestoneReached, calculateStreak } from '@/app/lib/milestones'

export async function POST(req: NextRequest) {
  try {
    // 0. Pre-verification Serverless Rate Limiting (IP & Wallet)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const ipLimit = checkRateLimit(clientIp, 'ip', 10, 900000)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: ipLimit.error }, { status: 429 })
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or malformed JSON body' }, { status: 400 })
    }

    const { content, walletAddress, timestamp, nonce, signature, evidenceUrl, githubUrl } = body

    if (walletAddress && typeof walletAddress === 'string') {
      const walletLimit = checkRateLimit(walletAddress, 'wallet', 10, 900000)
      if (!walletLimit.allowed) {
        return NextResponse.json({ error: walletLimit.error }, { status: 429 })
      }
    }

    // 1. Mandatory Input Sanitization & Boundaries
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Log content cannot be empty' }, { status: 400 })
    }

    if (content.trim().length > 280) {
      return NextResponse.json({ error: 'Log content exceeds maximum length of 280 characters' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid Base58 walletAddress is required' }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Cryptographic wallet signature is required' }, { status: 401 })
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'Timestamp is required' }, { status: 400 })
    }

    // 2. Strict Replay Attack Mitigation (15-min window limit)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
    }

    // 3. Evidence URL Validation & Normalization
    const cleanGithubUrl = validateAndNormalizeUrl(githubUrl as string | null, 'github')
    const cleanEvidenceUrl = validateAndNormalizeUrl(evidenceUrl as string | null, 'evidence')

    // Extract & strictly validate domain against injection attacks
    const reqHost = getVerifiedDomain(req.headers.get('host'))

    // 4. Cryptographic Ed25519 Signature Verification
    const expectedMessageText = buildCanonicalSubmitMessage({
      domain: reqHost,
      walletAddress,
      timestamp,
      nonce: typeof nonce === 'string' ? nonce : 'legacy',
      content: content.trim(),
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

    // 5. Atomic Daily Log Quota Check (via Postgres SECURITY DEFINER RPC)
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    let todayCount = 0
    const { data: rpcCount, error: rpcError } = await supabase
      .rpc('get_daily_log_count', {
        p_wallet: walletAddress,
        p_start_time: startOfDay.toISOString(),
      })

    if (!rpcError && typeof rpcCount === 'number') {
      todayCount = rpcCount
    } else {
      console.error('Database Quota RPC get_daily_log_count Warning/Error:', rpcError?.message)
      const { data: todayLogs, error: countError } = await supabase
        .from('logs')
        .select('id')
        .eq('wallet_address', walletAddress)
        .gte('created_at', startOfDay.toISOString())

      if (countError) {
        return NextResponse.json(
          { error: 'Database service unavailable while checking daily quota' },
          { status: 500 }
        )
      }
      todayCount = todayLogs ? todayLogs.length : 0
    }

    if (todayCount >= 3) {
      return NextResponse.json(
        { error: 'Daily log quota reached (3/3 logs submitted today). Come back tomorrow 🗿' },
        { status: 429 }
      )
    }

    // 6. Signature Replay Check
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
        { error: 'Signature already submitted. Duplicate or replayed payload rejected.' },
        { status: 409 }
      )
    }

    // 7. Classify Log Content
    const classification = classifyLog(content.trim())

    if (!serviceKey) {
      console.error('CRITICAL SERVER ERROR: SUPABASE_SERVICE_ROLE_KEY is missing!')
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 500 }
      )
    }

    // 8. Database Reservation (Store metadata & signature in Supabase)
    const insertRes = await supabase
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
        archival_state: 'pending' as ArchivalState,
      }])
      .select()

    if (insertRes.error || !insertRes.data || insertRes.data.length === 0) {
      console.error('Supabase insert error:', insertRes.error)
      return NextResponse.json({ error: `Failed to save log to database: ${insertRes.error?.message || 'Unknown database error'}` }, { status: 500 })
    }

    const savedLog = insertRes.data[0]

    // 9. Upload Envelope to Arweave via Irys Node #1 (After DB reservation)
    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: 1,
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
    const irysTxId = uploadRes.irysTxId || null
    const archivalState: ArchivalState = uploadRes.success && irysTxId ? 'archived' : 'pending'

    // Update log row with Arweave receipt if successful
    if (irysTxId) {
      await supabase
        .from('logs')
        .update({ irys_tx_id: irysTxId, archival_state: archivalState })
        .eq('id', savedLog.id)
    }

    // ─── Milestone Detection ─────────────────────────────────────────────
    const { data: allLogs } = await supabase
      .from('logs')
      .select('created_at')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })

    const createdAts = (allLogs || []).map((l: { created_at: string }) => l.created_at)
    const newStreak = calculateStreak(createdAts)
    const previousStreak = Math.max(0, newStreak - 1)

    const newMilestone = checkNewMilestoneReached(previousStreak, newStreak)
    const builderLevel = getBuilderLevel(createdAts.length)

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
      hasHeliusRpc: !!process.env.HELIUS_RPC_URL,
      gatewayUrl: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : null,
      // Milestone & Badge data
      streak: newStreak,
      builderLevel: {
        level: builderLevel.level,
        title: builderLevel.title,
        emoji: builderLevel.emoji,
        color: builderLevel.color,
      },
      newMilestone: newMilestone ? {
        days: newMilestone.days,
        title: newMilestone.title,
        emoji: newMilestone.emoji,
        description: newMilestone.description,
      } : null,
    })
  } catch (error: unknown) {
    console.error('Log submission API error:', error)
    const detail = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
