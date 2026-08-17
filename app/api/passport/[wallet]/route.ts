import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'
import { PassportExport, ProofDetail } from '@/app/lib/types'
import { verifyLogCryptographically } from '@/app/lib/canonicalMessage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest, props: { params: Promise<{ wallet: string }> }) {
  try {
    const params = await props.params
    const wallet = params.wallet

    if (!wallet || typeof wallet !== 'string' || wallet.trim().length < 32 || wallet.trim().length > 44) {
      return NextResponse.json(
        { error: 'Invalid Solana wallet parameter (must be 32-44 base58 characters)' },
        { status: 400 }
      )
    }

    const logs = await fetchAllWalletLogs(supabase, wallet)

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { error: 'Builder Passport not found for this wallet address' },
        { status: 404 }
      )
    }

    const reputation = calculateReputation(wallet, logs)

    const proofDetails: ProofDetail[] = logs.map((l) => {
      const isValid = verifyLogCryptographically(l)
      const verificationState = isValid ? 'VERIFIED' : ((!l.nonce && (l as any).protocol_version !== 2) ? 'LEGACY' : 'UNVERIFIED')
      return {
        id: l.id,
        walletAddress: l.wallet_address,
        createdAt: l.created_at,
        content: l.content,
        githubUrl: l.github_url || null,
        evidenceUrl: l.evidence_url || null,
        signature: l.signature,
        nonce: l.nonce,
        domain: l.domain,
        skills: l.skills,
        protocols: l.protocols,
        category: l.category,
        irysTxId: l.irys_tx_id || null,
        archivalState: l.archival_state || 'not_requested',
        isCryptographicallyVerified: isValid,
        verificationState,
      }
    })

    const passportData: PassportExport = {
      protocol: 'PROVN',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      wallet,
      reputation,
      proofs: proofDetails,
      verificationUrl: `https://provn-sol.vercel.app/u/${wallet}`,
    }

    return NextResponse.json(passportData, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Passport API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
