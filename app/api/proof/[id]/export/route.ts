import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  evaluateProofValidity,
  reconstructCanonicalSubmitMessage,
  computeCanonicalProofHash,
  decodeBase58,
  verifyPrivateProofAuth,
  getCanonicalDomainAndUri,
} from '@/app/lib/canonicalMessage'
import { WalletLog } from '@/app/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const proofId = parseInt(id, 10)

  if (isNaN(proofId) || proofId <= 0) {
    return NextResponse.json({ error: 'Invalid proof ID' }, { status: 400 })
  }

  const { data: log, error } = await supabase
    .from('logs')
    .select('*')
    .eq('id', proofId)
    .single()

  if (error || !log) {
    return NextResponse.json({ error: `Proof #${proofId} not found` }, { status: 404 })
  }

  const isPrivate = (log as unknown as Record<string, unknown>).visibility === 'private' || (log as unknown as Record<string, unknown>).is_public === false
  if (isPrivate) {
    const authHeader = request.headers.get('authorization')
    const { domain: expectedDomain, uri: expectedUri } = getCanonicalDomainAndUri(
      request.headers.get('host'),
      `/api/proof/${proofId}/export`
    )
    const isAuthorized = await verifyPrivateProofAuth(supabase, authHeader, expectedDomain, expectedUri, proofId, log.wallet_address)
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'This proof record is private and requires a valid wallet signature authorization header to export' },
        { status: 403 }
      )
    }
  }

  const proof = log as WalletLog
  const validity = evaluateProofValidity(proof)
  const canonicalMsg = reconstructCanonicalSubmitMessage(proof)
  const canonicalHash = canonicalMsg ? computeCanonicalProofHash(canonicalMsg) : null

  // Extract receipt KIDs if present
  let challengeKid: string | null = null
  let submissionKid: string | null = null
  let signedPayloadHash: string | null = null
  let serverObservedAt: string | null = null

  if (proof.challenge && proof.challenge.includes('.')) {
    try {
      const parts = proof.challenge.split('.')
      const chalObj = JSON.parse(new TextDecoder().decode(decodeBase58(parts[0])))
      challengeKid = chalObj.kid || null
    } catch { }
  }

  if (proof.submission_receipt && proof.submission_receipt.includes('.')) {
    try {
      const parts = proof.submission_receipt.split('.')
      const subObj = JSON.parse(new TextDecoder().decode(decodeBase58(parts[0])))
      submissionKid = subObj.kid || null
      signedPayloadHash = subObj.signed_payload_hash || null
      serverObservedAt = subObj.observed_at || null
    } catch { }
  }

  const portableEnvelope = {
    $schema: 'https://provn-sol.vercel.app/schemas/provn-proof-v2.json',
    protocol: 'PROVN',
    version: proof.protocol_version || (proof.nonce && !proof.challenge ? 1 : 2),
    proof_id: proof.id,
    created_at: proof.created_at,
    claim: {
      wallet: proof.wallet_address,
      content: proof.content,
      timestamp: proof.created_at,
      domain: proof.domain || (proof.protocol_version === 1 ? 'provn-sol.vercel.app' : null),
      github_url: proof.github_url || null,
      evidence_url: proof.evidence_url || null,
    },
    signature: {
      algorithm: 'Ed25519',
      value: proof.signature,
      reconstructed_canonical_message: canonicalMsg,
      canonical_payload_hash: canonicalHash,
    },
    server_attestations: {
      challenge: proof.challenge || proof.nonce || null,
      challenge_kid: challengeKid,
      submission_receipt: proof.submission_receipt || null,
      submission_kid: submissionKid,
      signed_payload_hash: signedPayloadHash,
      observed_at: serverObservedAt,
    },
    provenance: {
      level: proof.provenance_level || 'self_attested',
      source_metadata: proof.source_metadata || null,
      archival_state: proof.archival_state || 'not_requested',
      irys_tx_id: proof.irys_tx_id || null,
    },
    server_generated_diagnostic: validity,
    verification_guide: {
      offline_cli_command: `npx provn verify proof-${proof.id}.json`,
      online_cli_command: `npx provn verify ${proof.id}`,
      online_verification_url: `https://provn-sol.vercel.app/proof/${proof.id}`,
      trust_manifest: 'https://provn-sol.vercel.app/.well-known/provn-keys.json',
    },
  }

  const isDownload = request.nextUrl.searchParams.get('download') === 'true'

  return NextResponse.json(portableEnvelope, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': isPrivate ? 'private, no-store, no-cache, must-revalidate' : 'public, max-age=60, s-maxage=300',
      ...(isDownload
        ? {
            'Content-Disposition': `attachment; filename="provn-proof-${proof.id}.json"`,
          }
        : {}),
    },
  })
}
