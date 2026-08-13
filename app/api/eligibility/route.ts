import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'
import { evaluateEligibility, STANDARD_POLICY_PRESETS } from '@/app/lib/policyEngine'
import { EvidencePolicy } from '@/app/lib/types'
import { decodeBase58 } from '@/app/lib/canonicalMessage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = body.wallet

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 })
    }

    try {
      const pk = decodeBase58(wallet.trim())
      if (pk.length !== 32) throw new Error('Invalid key length')
    } catch {
      return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 })
    }

    const cleanWallet = wallet.trim()
    const rawLogs = await fetchAllWalletLogs(supabase, cleanWallet)
    const reputation = calculateReputation(cleanWallet, rawLogs || [])

    let policy: EvidencePolicy = body.policy || {}
    if (body.policyPreset && STANDARD_POLICY_PRESETS[body.policyPreset]) {
      policy = {
        ...STANDARD_POLICY_PRESETS[body.policyPreset],
        ...policy,
      }
    } else if (Object.keys(policy).length === 0) {
      policy = STANDARD_POLICY_PRESETS.SUPERTEAM_BOUNTY
    }

    const evaluation = evaluateEligibility(reputation, policy)

    return NextResponse.json(evaluation, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=120',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Eligibility API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
