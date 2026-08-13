import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLogCryptographically } from '@/app/lib/canonicalMessage'
import { ProofDetail, WalletLog } from '@/app/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const proofId = parseInt(params.id, 10)

    if (isNaN(proofId) || proofId <= 0) {
      return NextResponse.json({ error: 'Valid positive integer proof ID is required' }, { status: 400 })
    }

    const { data: log, error } = await supabase
      .from('logs')
      .select('*')
      .eq('id', proofId)
      .single()

    if (error || !log) {
      return NextResponse.json({ error: 'Proof record not found' }, { status: 404 })
    }

    const rawLog = log as WalletLog
    const hostHeader = req.headers.get('host')
    const signatureValid = verifyLogCryptographically(rawLog, hostHeader)
    const canonicalMessageReconstructed = Boolean(rawLog.nonce && rawLog.wallet_address)
    const domainVerified = signatureValid

    const verificationState = signatureValid ? 'VERIFIED' : (!rawLog.nonce ? 'LEGACY' : 'UNVERIFIED')

    const proofDetail: ProofDetail = {
      id: rawLog.id,
      walletAddress: rawLog.wallet_address,
      createdAt: rawLog.created_at,
      content: rawLog.content,
      githubUrl: rawLog.github_url || null,
      evidenceUrl: rawLog.evidence_url || null,
      signature: rawLog.signature,
      nonce: rawLog.nonce,
      domain: rawLog.domain,
      skills: rawLog.skills,
      protocols: rawLog.protocols,
      category: rawLog.category,
      irysTxId: rawLog.irys_tx_id || null,
      archivalState: rawLog.archival_state || 'pending',
      isCryptographicallyVerified: signatureValid,
      verificationState,
      verificationDetails: {
        canonicalMessageReconstructed,
        signatureValid,
        domainVerified,
        timestampIso: rawLog.created_at,
      },
    }

    return NextResponse.json(proofDetail, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Proof API route error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
