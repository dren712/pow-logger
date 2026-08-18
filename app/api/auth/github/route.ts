import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getVerifiedDomain, buildCanonicalIdentityLinkMessage, decodeBase58 } from '@/app/lib/canonicalMessage'
import nacl from 'tweetnacl'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { walletAddress, challenge, signature, timestamp, action = 'Link' } = body

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
    }
    if (!challenge || typeof challenge !== 'string') {
      return NextResponse.json({ error: 'challenge is required' }, { status: 400 })
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'signature is required' }, { status: 400 })
    }
    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'timestamp is required' }, { status: 400 })
    }
    if (action !== 'Link' && action !== 'Relink') {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    // 1. Verify Timestamp freshness (+/- 15 minutes)
    const txDate = new Date(timestamp)
    const now = new Date()
    const diffMins = Math.abs(now.getTime() - txDate.getTime()) / (1000 * 60)
    if (diffMins > 15) {
      return NextResponse.json({ error: 'Signature expired (timestamp must be within 15 minutes)' }, { status: 400 })
    }

    // 2. Verify Challenge existence
    const { data: challengeRecord } = await supabase
      .from('signing_challenges')
      .select('challenge, expires_at')
      .eq('challenge', challenge)
      .eq('wallet_address', walletAddress)
      .single()

    if (!challengeRecord) {
      return NextResponse.json({ error: 'Invalid or missing challenge for this wallet' }, { status: 400 })
    }
    if (new Date(challengeRecord.expires_at) < now) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 })
    }

    // 3. Verify Cryptographic Signature
    const domain = getVerifiedDomain(req.headers.get('host'))
    const canonicalMsg = buildCanonicalIdentityLinkMessage({
      domain,
      walletAddress,
      challenge,
      timestamp,
      action
    })

    try {
      const publicKeyBytes = decodeBase58(walletAddress)
      const signatureBytes = decodeBase58(signature)
      const msgBytes = new TextEncoder().encode(canonicalMsg)
      
      const isValid = nacl.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Cryptographic verification error' }, { status: 401 })
    }

    // 4. Delete the used challenge
    await supabase.from('signing_challenges').delete().eq('challenge', challenge)

    // 5. Generate secure OAuth state
    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) {
      console.error('GITHUB_CLIENT_ID is not configured')
      return NextResponse.json({ error: 'OAuth configuration error' }, { status: 500 })
    }

    // Insert state into DB with 10-minute expiry
    const stateExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
    const { data: stateRecord, error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        wallet_address: walletAddress,
        expires_at: stateExpiresAt,
        action
      })
      .select('state_id')
      .single()

    if (stateError || !stateRecord) {
      console.error('Failed to create OAuth state:', stateError)
      return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 })
    }

    const state = stateRecord.state_id

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
    githubAuthUrl.searchParams.append('client_id', clientId)
    githubAuthUrl.searchParams.append('state', state)
    githubAuthUrl.searchParams.append('scope', 'read:user')

    return NextResponse.json({ url: githubAuthUrl.toString() }, { status: 200 })
  } catch (err: unknown) {
    console.error('OAuth Init Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
