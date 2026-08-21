import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { checkRateLimit } from '@/app/lib/rateLimiter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const proofId = parseInt(params.id, 10)

    if (isNaN(proofId) || proofId <= 0) {
      return NextResponse.json({ error: 'Valid positive integer proof ID is required' }, { status: 400 })
    }

    // Rate limit check: In-memory first-line UX protection (10 requests per 15 min per IP)
    const ipAddress = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const rl = checkRateLimit(`auth_chal_${ipAddress}`, 'ip', 10, 900000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded for challenge requests' }, { status: 429 })
    }

    // Verify proof exists
    const { data: log, error: logError } = await supabase
      .from('logs')
      .select('id, wallet_address, visibility, is_public')
      .eq('id', proofId)
      .single()

    if (logError || !log) {
      return NextResponse.json({ error: 'Proof record not found' }, { status: 404 })
    }

    // Security policy: Auth challenges are strictly for private proofs
    const isPrivate = log.visibility === 'private' || (log as unknown as Record<string, unknown>).is_public === false
    if (!isPrivate) {
      return NextResponse.json(
        { error: 'Auth challenges are strictly issued for private proofs. Public proofs do not require authorization.' },
        { status: 400 }
      )
    }

    // Lazy cleanup: prune stale challenges older than 1 hour
    await supabase
      .from('private_auth_challenges')
      .delete()
      .lt('expires_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    // Database-level rate limiting: max 10 active/pending challenges per proof per 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count: proofChalCount } = await supabase
      .from('private_auth_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('proof_id', proofId)
      .gte('issued_at', fifteenMinsAgo)

    if (proofChalCount !== null && proofChalCount >= 10) {
      return NextResponse.json({ error: 'Too many pending auth challenges for this proof ID' }, { status: 429 })
    }

    // Generate cryptographic 128-bit nonce
    const nonceBytes = crypto.randomBytes(16)
    const nonce = nonceBytes.toString('base64url')

    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000) // 5 minutes

    const { error: insertError } = await supabase
      .from('private_auth_challenges')
      .insert({
        proof_id: proofId,
        wallet_address: log.wallet_address,
        nonce,
        ip_address: ipAddress,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('Failed to insert private auth challenge:', insertError)
      return NextResponse.json({ error: 'Failed to generate auth challenge' }, { status: 500 })
    }

    return NextResponse.json(
      {
        proofId,
        nonce,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('Auth challenge route error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

