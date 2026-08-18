import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalVisibilityMessage, decodeBase58, getVerifiedDomain } from '@/app/lib/canonicalMessage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')

export async function PATCH(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { logId, visibility, walletAddress, signature, timestamp, challenge } = body

    if (!logId || typeof logId !== 'number' || logId <= 0) {
      return NextResponse.json({ error: 'Invalid logId' }, { status: 400 })
    }
    if (visibility !== 'private' && visibility !== 'public') {
      return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
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

    const { data: challengeData, error: challengeError } = await supabase
      .from('signing_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress)
      .eq('challenge', challenge)
      .is('consumed_at', null)
      .gte('expires_at', new Date().toISOString())
      .select()
      .single()

    if (challengeError || !challengeData) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
    }

    const domain = getVerifiedDomain(req.headers.get('host'))
    const expectedMessageText = buildCanonicalVisibilityMessage({
      domain,
      walletAddress,
      logId,
      visibility,
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

    const { data: log, error: logError } = await supabase
      .from('logs')
      .select('wallet_address')
      .eq('id', logId)
      .single()

    if (logError || !log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    if (log.wallet_address !== walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('logs')
      .update({ visibility })
      .eq('id', logId)

    if (updateError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, logId, visibility }, { status: 200 })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
