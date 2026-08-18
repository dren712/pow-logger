import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalArchiveMessage, decodeBase58, getVerifiedDomain } from '@/app/lib/canonicalMessage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { logId, walletAddress, signature, timestamp, challenge } = body

    if (!logId || typeof logId !== 'number') {
      return NextResponse.json({ error: 'Invalid logId' }, { status: 400 })
    }
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid walletAddress' }, { status: 400 })
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 })
    }
    if (!challenge || typeof challenge !== 'string') {
      return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 })
    }

    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
    }

    // Verify signing challenge existence and validity (without consuming yet)
    const { data: challengeRecord, error: challengeLookupError } = await supabase
      .from('signing_challenges')
      .select('id, expires_at, consumed_at')
      .eq('wallet_address', walletAddress)
      .eq('challenge', challenge)
      .maybeSingle()

    if (challengeLookupError || !challengeRecord) {
      return NextResponse.json({ error: 'Invalid or missing challenge for this wallet' }, { status: 401 })
    }

    if (challengeRecord.consumed_at) {
      return NextResponse.json({ error: 'Challenge already consumed' }, { status: 401 })
    }

    if (new Date(challengeRecord.expires_at).getTime() < now) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 401 })
    }

    const domain = getVerifiedDomain(req.headers.get('host'))
    const expectedMessageText = buildCanonicalArchiveMessage({
      domain,
      walletAddress,
      logId,
      challenge,
      timestamp
    })

    const messageBytes = new TextEncoder().encode(expectedMessageText)
    
    let signatureBytes: Uint8Array
    let publicKeyBytes: Uint8Array

    try {
      signatureBytes = decodeBase58(signature)
      publicKeyBytes = decodeBase58(walletAddress)
    } catch {
      return NextResponse.json({ error: 'Invalid Base58 encoding' }, { status: 400 })
    }

    const isSignatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Post-Verification Atomic Challenge Consumption (Race-safe single use)
    const { data: challengeData, error: challengeError } = await supabase
      .from('signing_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress)
      .eq('challenge', challenge)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle()

    if (challengeError || !challengeData) {
      return NextResponse.json({ error: 'Challenge already consumed or expired during processing' }, { status: 409 })
    }

    // Fetch log
    const { data: log, error: logError } = await supabase
      .from('logs')
      .select('*')
      .eq('id', logId)
      .single()

    if (logError || !log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.wallet_address !== walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (log.archival_state === 'receipt_obtained' || log.archival_state === 'finalized') {
      return NextResponse.json({ 
        success: true, 
        archivalState: log.archival_state, 
        irysTxId: log.irys_tx_id, 
        gatewayUrl: log.irys_tx_id ? `https://gateway.irys.xyz/${log.irys_tx_id}` : null,
        warning: 'This evidence has already been archived.'
      }, { status: 200 })
    }

    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: 2,
      action: 'archive',
      domain,
      walletAddress,
      timestamp,
      challenge,
      logId,
      signature,
      content: log.content,
      createdAt: log.created_at,
      logSignature: log.signature,
      evidenceUrl: log.evidence_url,
      githubUrl: log.github_url,
      category: log.category,
      evidenceType: log.evidence_type,
      provenanceLevel: log.provenance_level,
      sourceProvider: log.source_provider,
      sourceMetadata: log.source_metadata,
      sourceVerificationStatus: log.source_verification_status,
      sourceVerifiedAt: log.source_verified_at,
      skills: log.skills,
      protocols: log.protocols,
      visibility: log.visibility,
      protocolVersion: log.protocol_version
    }, null, 2)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Archive' }
    ]

    const { uploadEnvelopeToIrys } = await import('@/app/lib/irysUploader')
    const uploadRes = await uploadEnvelopeToIrys(structuredEnvelope, tags)
    const irysTxId = uploadRes.irysTxId || null
    
    if (!irysTxId || !uploadRes.success) {
      return NextResponse.json({ error: 'Failed to upload to Arweave' }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('logs')
      .update({ irys_tx_id: irysTxId, archival_state: 'receipt_obtained' })
      .eq('id', logId)

    if (updateError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      archivalState: 'receipt_obtained',
      irysTxId,
      gatewayUrl: `https://gateway.irys.xyz/${irysTxId}`,
      warning: 'Archival receipt obtained. Finality depends on Arweave network confirmation. This action cannot be undone.'
    }, { status: 200 })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
