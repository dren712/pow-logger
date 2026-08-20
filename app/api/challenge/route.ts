import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeBase58 } from '@/app/lib/canonicalMessage'
import crypto from 'crypto'

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

    const { walletAddress } = body

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    try {
      const decoded = decodeBase58(walletAddress)
      if (decoded.length !== 32) {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    // Lazy cleanup: only delete challenges older than 1 hour (not just expired)
    await supabase
      .from('signing_challenges')
      .delete()
      .lt('expires_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'

    // Rate limit checks (10 per wallet / 15m, 30 per IP / 15m)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count: walletCount, error: countError } = await supabase
      .from('signing_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)
      .gte('issued_at', fifteenMinsAgo)

    if (countError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (walletCount !== null && walletCount >= 10) {
      return NextResponse.json({ error: 'Rate limit exceeded for wallet address' }, { status: 429 })
    }

    const { count: ipCount, error: ipCountError } = await supabase
      .from('signing_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .gte('issued_at', fifteenMinsAgo)

    if (!ipCountError && ipCount !== null && ipCount >= 30) {
      return NextResponse.json({ error: 'Rate limit exceeded for IP address' }, { status: 429 })
    }

    // Generate challenge
    const challenge = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('signing_challenges')
      .insert({
        wallet_address: walletAddress,
        challenge,
        expires_at: expiresAt,
        ip_address: ipAddress
      })

    if (insertError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ challenge, expiresAt }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
