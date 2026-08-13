import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalSubmitMessage, decodeBase58, getVerifiedDomain } from '@/app/lib/canonicalMessage'
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
    let signatureValid = false
    let canonicalMessageReconstructed = false
    let domainVerified = false

    if (rawLog.signature && rawLog.nonce && rawLog.wallet_address) {
      try {
        const publicKeyBytes = decodeBase58(rawLog.wallet_address)
        const sigBytes = decodeBase58(rawLog.signature)
        const reqHost = getVerifiedDomain(req.headers.get('host'))

        const candidateDomains = Array.from(
          new Set([rawLog.domain, reqHost, 'provn-sol.vercel.app', 'localhost'].filter(Boolean))
        ) as string[]

        for (const d of candidateDomains) {
          const canonicalMsg = buildCanonicalSubmitMessage({
            domain: d,
            walletAddress: rawLog.wallet_address,
            timestamp: rawLog.created_at,
            nonce: rawLog.nonce,
            content: rawLog.content,
            githubUrl: rawLog.github_url || undefined,
            evidenceUrl: rawLog.evidence_url || undefined,
          })
          canonicalMessageReconstructed = true

          const msgBytes = new TextEncoder().encode(canonicalMsg)
          if (nacl.sign.detached.verify(msgBytes, sigBytes, publicKeyBytes)) {
            signatureValid = true
            domainVerified = true
            break
          }
        }
      } catch (err) {
        console.error('Signature verification error on proof query:', err)
      }
    }

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
