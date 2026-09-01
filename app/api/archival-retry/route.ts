import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { getVerifiedDomain, buildCanonicalRetryMessageV2, decodeBase58 } from '@/app/lib/canonicalMessage'

export const maxDuration = 15 // Allow up to 15s execution for Irys Arweave upload

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

import { checkRateLimit } from '@/app/lib/rateLimiter'

export async function POST(req: NextRequest) {
  try {
    // 0. Pre-verification Rate Limiting (IP & Wallet)
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

    const { logId, walletAddress, timestamp, challenge, signature } = body

    // 1. Input Validation
    if (!logId || typeof logId !== 'number') {
      return NextResponse.json({ error: 'Valid numeric logId is required' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid Base58 walletAddress is required' }, { status: 400 })
    }

    // Optional Re-authorization Challenge (if signature is supplied by client)
    if (signature && typeof signature === 'string') {
      if (!challenge || typeof challenge !== 'string' || challenge.trim().length === 0) {
        return NextResponse.json({ error: 'Anti-replay server challenge (v2) is required when signing retry' }, { status: 400 })
      }
      if (!timestamp || typeof timestamp !== 'string') {
        return NextResponse.json({ error: 'Timestamp is required when signing retry' }, { status: 400 })
      }

      const requestTime = new Date(timestamp).getTime()
      const now = Date.now()
      if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
        return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
      }

      // Challenge Lookup & Atomic Consumption
      const { data: challengeRecord, error: challengeLookupError } = await supabase
        .from('signing_challenges')
        .select('id, expires_at, consumed_at')
        .eq('challenge', challenge)
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (challengeLookupError || !challengeRecord || challengeRecord.consumed_at || new Date(challengeRecord.expires_at).getTime() < now) {
        return NextResponse.json({ error: 'Invalid, expired, or consumed challenge' }, { status: 401 })
      }

      await supabase
        .from('signing_challenges')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', challengeRecord.id)

      const reqHost = getVerifiedDomain(req.headers.get('host'))
      const expectedRetryMessage = buildCanonicalRetryMessageV2({
        domain: reqHost,
        walletAddress,
        logId,
        timestamp,
        challenge,
      })

      const messageBytes = new TextEncoder().encode(expectedRetryMessage)
      const signatureBytes = decodeBase58(signature)
      const publicKeyBytes = decodeBase58(walletAddress)

      const isSignatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
      if (!isSignatureValid) {
        return NextResponse.json(
          { error: 'Unauthorized retry signature verification failed. Retry attempt rejected.' },
          { status: 401 }
        )
      }
    }

    // 4. Atomic Log Reservation & State Check
    const { data: reservedLog, error: reserveErr } = await supabase
      .from('logs')
      .update({ archival_state: 'processing' })
      .eq('id', logId)
      .eq('wallet_address', walletAddress)
      .in('archival_state', ['pending', 'not_requested', 'failed'])
      .select('*')
      .maybeSingle()

    if (reserveErr || !reservedLog) {
      // Check existing log status
      const { data: existingLog } = await supabase
        .from('logs')
        .select('*')
        .eq('id', logId)
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (!existingLog) {
        return NextResponse.json({ error: 'Log entry not found or wallet mismatch' }, { status: 404 })
      }

      if (existingLog.irys_tx_id && !existingLog.irys_tx_id.startsWith('powl_')) {
        return NextResponse.json({
          success: true,
          message: 'Log entry is already archived on Irys',
          irysTxId: existingLog.irys_tx_id,
          archivalState: 'receipt_obtained',
          gatewayUrl: `https://gateway.irys.xyz/${existingLog.irys_tx_id}`,
        })
      }

      return NextResponse.json({ error: 'Archival retry already in progress or ineligible' }, { status: 409 })
    }

    const logRow = reservedLog

    // Wallet Rate Limiting
    const walletLimit = checkRateLimit(walletAddress, 'wallet', 10, 900000)
    if (!walletLimit.allowed) {
      // Revert reservation on rate limit
      await supabase.from('logs').update({ archival_state: 'failed' }).eq('id', logId)
      return NextResponse.json({ error: walletLimit.error }, { status: 429 })
    }

    // 5. Execute Retry Upload to Irys
    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: logRow.protocol_version || 2,
      retryAttempt: true,
      proofId: logRow.id,
      walletAddress: logRow.wallet_address,
      timestamp: logRow.created_at,
      challenge: logRow.challenge || logRow.nonce,
      content: logRow.content.trim(),
      signature: logRow.signature,
      submissionReceipt: logRow.submission_receipt,
      evidenceUrl: logRow.evidence_url,
      githubUrl: logRow.github_url,
      category: logRow.category,
      evidenceType: logRow.evidence_type,
      provenanceLevel: logRow.provenance_level,
    }, null, 2)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Id', value: String(logRow.id) },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Proof' },
      { name: 'Timestamp', value: logRow.created_at },
      { name: 'Retry-Attempt', value: 'True' },
    ]

    if (logRow.category) tags.push({ name: 'Category', value: logRow.category })
    if (logRow.evidence_url) tags.push({ name: 'Evidence-URL', value: logRow.evidence_url })
    if (logRow.github_url) tags.push({ name: 'GitHub-URL', value: logRow.github_url })

    const { uploadEnvelopeToIrys } = await import('@/app/lib/irysUploader')
    const uploadRes = await uploadEnvelopeToIrys(structuredEnvelope, tags)

    if (!uploadRes.success || !uploadRes.irysTxId) {
      await supabase.from('logs').update({ archival_state: 'failed' }).eq('id', logId)
      const errDetail = uploadRes.error || 'Irys node upload unconfirmed'
      return NextResponse.json({ error: `Archival retry failed: ${errDetail}` }, { status: 502 })
    }
    const irysTxId = uploadRes.irysTxId
    const { error: updateErr } = await supabase
      .from('logs')
      .update({
        irys_tx_id: irysTxId,
        archival_state: 'receipt_obtained',
      })
      .eq('id', logId)

    if (updateErr) {
      console.error('Supabase retry update error:', updateErr.message)
    }

    return NextResponse.json({
      success: true,
      archivalState: 'receipt_obtained',
      irysTxId,
      gatewayUrl: `https://gateway.irys.xyz/${irysTxId}`,
    })
  } catch (error: unknown) {
    console.error('Archival retry API error:', error)
    const detail = error instanceof Error ? error.message : 'Failed to execute archival retry'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
