import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalRetryMessage, decodeBase58 } from '@/app/lib/canonicalMessage'

export const maxDuration = 30 // Allow up to 30s execution for Irys Arweave upload

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

    const { logId, walletAddress, timestamp, nonce, signature } = body

    if (walletAddress && typeof walletAddress === 'string') {
      const walletLimit = checkRateLimit(walletAddress, 'wallet', 10, 900000)
      if (!walletLimit.allowed) {
        return NextResponse.json({ error: walletLimit.error }, { status: 429 })
      }
    }

    // 1. Input Validation
    if (!logId || typeof logId !== 'number') {
      return NextResponse.json({ error: 'Valid numeric logId is required' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid Base58 walletAddress is required' }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Authorized wallet signature is required for archival retry' }, { status: 401 })
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'Timestamp is required' }, { status: 400 })
    }

    // 2. Replay Check (15-min timestamp window)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
    }

    // 3. Cryptographic Wallet Signature Verification for Retry
    const expectedRetryMessage = buildCanonicalRetryMessage({
      walletAddress,
      logId,
      timestamp,
      nonce: typeof nonce === 'string' ? nonce : 'legacy',
    })

    const messageBytes = new TextEncoder().encode(expectedRetryMessage)

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
        { error: 'Unauthorized retry signature verification failed. Retry attempt rejected.' },
        { status: 401 }
      )
    }

    // 4. Fetch log record from database & verify ownership
    const { data: logRow, error: fetchErr } = await supabase
      .from('logs')
      .select('*')
      .eq('id', logId)
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    if (fetchErr || !logRow) {
      return NextResponse.json({ error: 'Log entry not found or wallet mismatch' }, { status: 404 })
    }

    if (logRow.irys_tx_id && !logRow.irys_tx_id.startsWith('powl_')) {
      if (logRow.archival_state !== 'archived') {
        await supabase
          .from('logs')
          .update({ archival_state: 'archived' })
          .eq('id', logId)
      }
      return NextResponse.json({
        success: true,
        message: 'Log entry is already archived on Irys',
        irysTxId: logRow.irys_tx_id,
        archivalState: 'archived',
        gatewayUrl: `https://gateway.irys.xyz/${logRow.irys_tx_id}`,
      })
    }

    // 5. Execute Retry Upload to Irys Node #1
    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: 1,
      retryAttempt: true,
      logId: logRow.id,
      walletAddress,
      timestamp: logRow.created_at,
      nonce: typeof nonce === 'string' ? nonce : 'legacy',
      content: logRow.content.trim(),
      signature: logRow.signature,
      evidenceUrl: logRow.evidence_url,
      githubUrl: logRow.github_url,
      canonicalRetryMessage: expectedRetryMessage,
    }, null, 2)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
      { name: 'Timestamp', value: logRow.created_at },
      { name: 'Retry-Attempt', value: 'True' },
    ]

    if (logRow.category) tags.push({ name: 'Category', value: logRow.category })
    if (logRow.evidence_url) tags.push({ name: 'Evidence-URL', value: logRow.evidence_url })
    if (logRow.github_url) tags.push({ name: 'GitHub-URL', value: logRow.github_url })

    const { uploadEnvelopeToIrys } = await import('@/app/lib/irysUploader')
    const uploadRes = await uploadEnvelopeToIrys(structuredEnvelope, tags)

    if (!uploadRes.success || !uploadRes.irysTxId) {
      const errDetail = uploadRes.error || 'Irys node upload unconfirmed'
      return NextResponse.json({ error: `Archival retry failed: ${errDetail}` }, { status: 502 })
    }
    const irysTxId = uploadRes.irysTxId
    const { error: updateErr } = await supabase
      .from('logs')
      .update({
        irys_tx_id: irysTxId,
        archival_state: 'archived',
      })
      .eq('id', logId)

    if (updateErr) {
      console.error('Supabase retry update error:', updateErr.message)
    }

    return NextResponse.json({
      success: true,
      archivalState: 'archived',
      irysTxId,
      gatewayUrl: `https://gateway.irys.xyz/${irysTxId}`,
    })
  } catch (error: unknown) {
    console.error('Archival retry API error:', error)
    const detail = error instanceof Error ? error.message : 'Failed to execute archival retry'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
