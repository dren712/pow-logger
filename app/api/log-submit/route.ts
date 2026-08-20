import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import {
  buildCanonicalSubmitMessage,
  buildCanonicalSubmitMessageV2,
  validateAndNormalizeUrl,
  decodeBase58,
  getVerifiedDomain
} from '@/app/lib/canonicalMessage'

export const maxDuration = 15 // Allow up to 15s execution for Irys Arweave upload

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!serviceKey) {
  console.error('CRITICAL SERVER ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables!')
}

const supabaseKey = serviceKey || anonKey || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

import { checkRateLimit } from '@/app/lib/rateLimiter'
import { classifyLog } from '@/app/lib/classifier'
import { verifyGithubSource } from '@/app/lib/githubVerifier'
import { checkNewMilestoneReached, fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'

export async function POST(req: NextRequest) {
  try {
    // 0. Pre-verification Serverless Rate Limiting (IP & Wallet)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const ipLimit = checkRateLimit(clientIp, 'ip', 10, 900000)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: ipLimit.error }, { status: 429 })
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or malformed JSON body' }, { status: 400 })
    }

    const content = typeof body.content === 'string' ? body.content : undefined
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : undefined
    const timestamp = typeof body.timestamp === 'string' ? body.timestamp : undefined
    const nonce = typeof body.nonce === 'string' ? body.nonce : undefined
    const challenge = typeof body.challenge === 'string' ? body.challenge : undefined
    const signature = typeof body.signature === 'string' ? body.signature : undefined
    const evidenceUrl = typeof body.evidenceUrl === 'string' ? body.evidenceUrl : undefined
    const githubUrl = typeof body.githubUrl === 'string' ? body.githubUrl : undefined
    const visibility = typeof body.visibility === 'string' ? body.visibility : undefined

    if (!challenge && !nonce) {
      return NextResponse.json({ error: 'Either challenge (v2) or nonce (v1) is required' }, { status: 400 })
    }

    if (visibility && visibility !== 'private' && visibility !== 'public') {
      return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
    }

    // 1. Mandatory Input Sanitization & Boundaries
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Log content cannot be empty' }, { status: 400 })
    }

    if (content.trim().length > 280) {
      return NextResponse.json({ error: 'Log content exceeds maximum length of 280 characters' }, { status: 400 })
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid Base58 walletAddress is required' }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Cryptographic wallet signature is required' }, { status: 401 })
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json({ error: 'Timestamp is required' }, { status: 400 })
    }

    if (!challenge && nonce !== undefined && nonce !== null) {
      if (typeof nonce !== 'string' || nonce.trim().length < 8 || nonce !== nonce.trim()) {
        return NextResponse.json({ error: 'Nonce must be a valid string of at least 8 characters with no leading or trailing whitespace' }, { status: 400 })
      }
      try {
        decodeBase58(nonce)
      } catch {
        return NextResponse.json({ error: 'Nonce must be a valid Base58 encoded string' }, { status: 400 })
      }
    } else if (challenge) {
      if (typeof challenge !== 'string' || challenge.trim().length === 0) {
        return NextResponse.json({ error: 'Challenge must be a valid string' }, { status: 400 })
      }
    }

    // 2. Strict Replay Attack Mitigation (15-min window limit)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
    }

    // 3. Evidence URL Validation & Normalization
    const cleanGithubUrl = validateAndNormalizeUrl(githubUrl as string | null, 'github')
    const cleanEvidenceUrl = validateAndNormalizeUrl(evidenceUrl as string | null, 'evidence')

    // Extract & strictly validate domain against injection attacks
    const reqHost = getVerifiedDomain(req.headers.get('host'))

    let consumedChallengeId: string | null = null

    if (challenge) {
      const { data: challengeRecord, error: challengeLookupError } = await supabase
        .from('signing_challenges')
        .select('id, expires_at, consumed_at')
        .eq('challenge', challenge)
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (challengeLookupError || !challengeRecord) {
        return NextResponse.json({ error: 'Invalid, missing, or unauthorized challenge for this wallet' }, { status: 401 })
      }
      if (challengeRecord.consumed_at) {
        return NextResponse.json({ error: 'Challenge already consumed' }, { status: 401 })
      }
      if (new Date(challengeRecord.expires_at).getTime() < now) {
        return NextResponse.json({ error: 'Challenge expired' }, { status: 401 })
      }
      consumedChallengeId = challengeRecord.id
    }

    // 4. Cryptographic Ed25519 Signature Verification
    let expectedMessageText: string
    if (challenge) {
      expectedMessageText = buildCanonicalSubmitMessageV2({
        domain: reqHost,
        walletAddress,
        timestamp,
        challenge,
        content: content.trim(),
        githubUrl: cleanGithubUrl,
        evidenceUrl: cleanEvidenceUrl,
      })
    } else {
      expectedMessageText = buildCanonicalSubmitMessage({
        domain: reqHost,
        walletAddress,
        timestamp,
        nonce: typeof nonce === 'string' ? nonce : 'legacy',
        content: content.trim(),
        githubUrl: cleanGithubUrl,
        evidenceUrl: cleanEvidenceUrl,
      })
    }

    const messageBytes = new TextEncoder().encode(expectedMessageText)

    let signatureBytes: Uint8Array
    let publicKeyBytes: Uint8Array

    try {
      signatureBytes = decodeBase58(signature)
      publicKeyBytes = decodeBase58(walletAddress)
    } catch {
      return NextResponse.json({ error: 'Invalid Base58 encoding for signature or wallet address' }, { status: 400 })
    }

    const isSignatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Cryptographic signature verification failed. Tampered or unauthorized payload rejected.' },
        { status: 401 }
      )
    }

    // 5. Signature Duplicate Lookup (Replay Defense Check)
    const { data: existingSig, error: sigCheckError } = await supabase
      .from('logs')
      .select('id')
      .eq('signature', signature)
      .maybeSingle()

    if (sigCheckError) {
      console.warn('Signature lookup warning:', sigCheckError.message)
    }

    if (existingSig) {
      return NextResponse.json(
        { error: 'Signature already submitted. Duplicate or replayed payload rejected.' },
        { status: 409 }
      )
    }

    // 6. Phase 2: Source-Aware Evidence Verification
    let evidenceType = 'self_attested'
    let provenanceLevel = 'self_attested'
    let sourceProvider: string | null = null
    let sourceMetadata: Record<string, unknown> | null = null
    let sourceVerificationStatus = 'not_verified'
    let sourceVerifiedAt: string | null = null

    if (cleanGithubUrl) {
      const verification = await verifyGithubSource(cleanGithubUrl, walletAddress)
      evidenceType = verification.evidenceType
      provenanceLevel = verification.provenanceLevel
      sourceVerificationStatus = verification.status
      if (verification.snapshot) {
        sourceProvider = verification.snapshot.provider
        sourceMetadata = verification.snapshot.raw
        sourceVerifiedAt = verification.snapshot.verifiedAt
      }
    } else if (cleanEvidenceUrl) {
      evidenceType = 'public_url'
      provenanceLevel = 'source_linked'
    }

    const classification = classifyLog(content.trim())

    // 7. Transactional Atomic Insertion, Quota Increment & Challenge Consumption
    const { data: savedLog, error: insertResError } = await supabase.rpc('atomic_insert_log', {
      p_content: content.trim(),
      p_wallet: walletAddress,
      p_signature: signature,
      p_created_at: timestamp,
      p_nonce: challenge || nonce || 'legacy',
      p_domain: reqHost,
      p_evidence_url: cleanEvidenceUrl,
      p_github_url: cleanGithubUrl,
      p_skills: classification.skills,
      p_protocols: classification.protocols,
      p_category: classification.category,
      p_archival_state: 'not_requested',
      p_visibility: visibility || 'private',
      p_protocol_version: challenge ? 2 : 1,
      p_challenge_id: consumedChallengeId,
      p_evidence_type: evidenceType,
      p_provenance_level: provenanceLevel,
      p_source_provider: sourceProvider,
      p_source_metadata: sourceMetadata,
      p_source_verification_status: sourceVerificationStatus,
      p_source_verified_at: sourceVerifiedAt,
      p_challenge: challenge || null
    })

    if (insertResError) {
      if (insertResError.message.includes('DAILY_QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: 'Daily log quota reached (3/3 logs submitted today). Come back tomorrow 🗿' },
          { status: 429 }
        )
      }
      if (insertResError.message.includes('CHALLENGE_INVALID_OR_CONSUMED')) {
        return NextResponse.json(
          { error: 'Challenge already consumed or expired during concurrent processing' },
          { status: 409 }
        )
      }
      console.error('Supabase atomic_insert_log error:', insertResError)
      return NextResponse.json({ error: 'Failed to save log to database' }, { status: 500 })
    }

    // ─── Milestone & Reputation Detection ──────────────────────────────────
    const allLogs = await fetchAllWalletLogs(supabase, walletAddress)
    const currentReputation = calculateReputation(walletAddress, allLogs)

    const previousLogs = (allLogs || []).filter((l: { id: number }) => l.id !== savedLog.id)
    const previousReputation = calculateReputation(walletAddress, previousLogs)

    const newMilestone = checkNewMilestoneReached(previousReputation.currentStreak, currentReputation.currentStreak)

    return NextResponse.json({
      success: true,
      log: {
        ...savedLog,
        evidence_url: cleanEvidenceUrl,
        github_url: cleanGithubUrl,
        irys_tx_id: null,
        archival_state: 'not_requested',
      },
      classification,
      archivalState: 'not_requested',
      irysTxId: null,
      gatewayUrl: null,
      // Milestone & Badge data derived strictly from deterministic reputation engine
      streak: currentReputation.currentStreak,
      builderLevel: {
        level: currentReputation.builderLevel.level,
        title: currentReputation.builderLevel.title,
        emoji: currentReputation.builderLevel.emoji,
        color: currentReputation.builderLevel.color,
      },
      newMilestone: newMilestone ? {
        days: newMilestone.days,
        title: newMilestone.title,
        emoji: newMilestone.emoji,
        description: newMilestone.description,
      } : null,
    })
  } catch (error: unknown) {
    console.error('Log submission API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
