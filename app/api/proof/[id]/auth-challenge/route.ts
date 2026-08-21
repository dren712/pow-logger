import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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

    // Verify proof exists
    const { data: log, error: logError } = await supabase
      .from('logs')
      .select('id, wallet_address, visibility, is_public')
      .eq('id', proofId)
      .single()

    if (logError || !log) {
      return NextResponse.json({ error: 'Proof record not found' }, { status: 404 })
    }
    
    // Optional: Could reject if it's already public, but allowing it is fine for flexibility.

    // Generate cryptographic nonce
    const nonceBytes = crypto.randomBytes(16)
    const nonce = nonceBytes.toString('base64url')

    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000) // 5 minutes

    const { error: insertError } = await supabase
      .from('private_auth_challenges')
      .insert({
        proof_id: proofId,
        nonce,
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
