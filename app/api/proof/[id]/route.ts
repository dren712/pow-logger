import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateProofValidity } from '@/app/lib/canonicalMessage'
import { ProofDetail, WalletLog } from '@/app/lib/types'
import { PROVN_ALLOWED_DOMAINS } from '@/app/lib/serverKeypair'

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

    // Privacy boundary enforcement: Private proofs cannot be queried publicly without authorization
    const isPrivate = rawLog.visibility === 'private' || (rawLog as unknown as Record<string, unknown>).is_public === false
    const authWallet = req.headers.get('x-wallet-address')

    if (isPrivate && (!authWallet || authWallet !== rawLog.wallet_address)) {
      return NextResponse.json(
        { error: 'This proof record is private and visible only to the author wallet' },
        { status: 403 }
      )
    }

    const validityReport = evaluateProofValidity(rawLog)
    const isSigValid = validityReport.signatureVerified
    const isProtoValid = validityReport.protocolVerified
    const isDomainValid = Boolean(rawLog.domain && PROVN_ALLOWED_DOMAINS.includes(rawLog.domain.trim().toLowerCase().split(':')[0]))
    const domainVerified = validityReport.challengeVerified && isDomainValid
    const canonicalMessageReconstructed = Boolean((rawLog.nonce || rawLog.protocol_version === 2) && rawLog.wallet_address)

    // Accurate verification state: do NOT collapse signature-only validity into full protocol validity
    let verificationState: ProofDetail['verificationState'] = 'UNVERIFIED'
    if (isProtoValid) {
      verificationState = 'VERIFIED'
    } else if (isSigValid) {
      verificationState = 'UNVERIFIED' // Signature valid but protocol bounds/receipt incomplete
    } else if (!rawLog.nonce && rawLog.protocol_version !== 2) {
      verificationState = 'LEGACY'
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
      archivalState: rawLog.archival_state || 'not_requested',
      submissionReceipt: rawLog.submission_receipt || null,
      serverObservedAt: validityReport.details.serverObservedAt || null,
      isCryptographicallyVerified: isSigValid,
      verificationState,
      signatureVerified: isSigValid,
      protocolVerified: isProtoValid,
      sourceVerified: validityReport.sourceVerified,
      archiveVerified: validityReport.archiveVerified,
      proofStatus: validityReport.proofStatus,
      validityReport,
      verificationDetails: {
        canonicalMessageReconstructed,
        signatureValid: isSigValid,
        domainVerified,
        timestampIso: new Date(rawLog.created_at).toISOString(),
      },
      evidenceType: rawLog.evidence_type,
      provenanceLevel: rawLog.provenance_level,
      sourceProvider: rawLog.source_provider,
      sourceVerificationStatus: rawLog.source_verification_status,
      sourceVerifiedAt: rawLog.source_verified_at,
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
