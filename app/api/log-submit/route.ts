import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { buildCanonicalSubmitMessage, validateAndNormalizeUrl } from '@/app/lib/canonicalMessage'
import { ArchivalState } from '@/app/lib/irys'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const decodeBase58 = (str: string): Uint8Array => {
  const bs58Obj = bs58 as unknown as { decode?: (s: string) => Uint8Array; default?: { decode: (s: string) => Uint8Array } }
  const fn = bs58Obj.decode || bs58Obj.default?.decode
  if (!fn) throw new Error('Base58 decoder unavailable')
  return fn(str)
}

function classifyLog(content: string) {
  const contentLower = content.toLowerCase()

  const skillsMap: Record<string, string[]> = {
    Solana: ['solana', 'anchor', 'web3.js', 'spl-token', 'spl', 'program', 'pda', 'cpi'],
    TypeScript: ['typescript', 'ts', 'next.js', 'nextjs', 'react', 'node'],
    Rust: ['rust', 'cargo', 'anchor-lang'],
    Python: ['python', 'py', 'django', 'fastapi'],
    Design: ['css', 'tailwind', 'ui', 'ux', 'figma'],
  }

  const protocolsMap: Record<string, string[]> = {
    Anchor: ['anchor', 'anchor-lang'],
    Irys: ['irys', 'arweave', 'bundlr'],
    Metaplex: ['metaplex', 'token-metadata', 'cnft', 'bubblegum'],
    Pyth: ['pyth', 'oracle'],
    Jupiter: ['jupiter', 'jup', 'swap'],
  }

  const detectedSkills: string[] = []
  for (const [skill, keywords] of Object.entries(skillsMap)) {
    if (keywords.some((kw) => contentLower.includes(kw))) {
      detectedSkills.push(skill)
    }
  }

  const detectedProtocols: string[] = []
  for (const [proto, keywords] of Object.entries(protocolsMap)) {
    if (keywords.some((kw) => contentLower.includes(kw))) {
      detectedProtocols.push(proto)
    }
  }

  let category = 'Development'
  if (contentLower.includes('design') || contentLower.includes('ui') || contentLower.includes('css')) {
    category = 'Design'
  } else if (contentLower.includes('deploy') || contentLower.includes('vercel') || contentLower.includes('release')) {
    category = 'Deployment'
  } else if (contentLower.includes('test') || contentLower.includes('audit')) {
    category = 'Testing'
  } else if (contentLower.includes('doc') || contentLower.includes('readme')) {
    category = 'Documentation'
  }

  return {
    skills: detectedSkills,
    protocols: detectedProtocols,
    category,
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or malformed JSON body' }, { status: 400 })
    }

    const { content, walletAddress, timestamp, nonce, signature, evidenceUrl, githubUrl } = body

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

    // 2. Strict Replay Attack Mitigation (15-min window limit)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 900000) {
      return NextResponse.json({ error: 'Expired or invalid timestamp. Replay attempt rejected.' }, { status: 401 })
    }

    // 3. Evidence URL Validation & Normalization
    const cleanGithubUrl = validateAndNormalizeUrl(githubUrl as string | null, 'github')
    const cleanEvidenceUrl = validateAndNormalizeUrl(evidenceUrl as string | null, 'evidence')

    // 4. Cryptographic Ed25519 Signature Verification
    const expectedMessageText = buildCanonicalSubmitMessage({
      walletAddress,
      timestamp,
      nonce: typeof nonce === 'string' ? nonce : 'legacy',
      content: content.trim(),
      githubUrl: cleanGithubUrl,
      evidenceUrl: cleanEvidenceUrl,
    })

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

    // 5. Daily Log Quota Check
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    let todayCount = 0
    const { data: todayLogs, error: countError } = await supabase
      .from('logs')
      .select('id')
      .eq('wallet_address', walletAddress)
      .gte('created_at', startOfDay.toISOString())

    if (!countError && todayLogs) {
      todayCount = todayLogs.length
    }

    if (todayCount >= 3) {
      return NextResponse.json(
        { error: 'Daily log quota reached (3/3 logs submitted today). Come back tomorrow 🗿' },
        { status: 429 }
      )
    }

    // 6. Signature Replay Check
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

    // 7. Classify Log Content
    const classification = classifyLog(content.trim())

    // 8. Upload Envelope to Arweave via Irys Node #1 (Before DB Save)
    const structuredEnvelope = JSON.stringify({
      app: 'PROVN',
      version: 1,
      walletAddress,
      timestamp,
      content: content.trim(),
      signature,
      evidenceUrl: cleanEvidenceUrl,
      githubUrl: cleanGithubUrl,
      classification,
    }, null, 2)

    const tags = [
      { name: 'App-Name', value: 'PROVN' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Builder-Address', value: walletAddress },
      { name: 'Proof-Type', value: 'Ed25519-Signed-Log' },
      { name: 'Timestamp', value: timestamp },
      { name: 'Category', value: classification.category },
    ]

    if (cleanEvidenceUrl) tags.push({ name: 'Evidence-URL', value: cleanEvidenceUrl })
    if (cleanGithubUrl) tags.push({ name: 'GitHub-URL', value: cleanGithubUrl })

    const { uploadEnvelopeToIrys } = await import('@/app/lib/irysUploader')
    const uploadRes = await uploadEnvelopeToIrys(structuredEnvelope, tags)
    const irysTxId = uploadRes.irysTxId || null
    const archivalState: ArchivalState = uploadRes.success && irysTxId ? 'archived' : 'pending'

    // 9. Single Atomic Database Save (Supabase) WITH irys_tx_id INCLUDED ATOMICALLY!
    let insertRes = await supabase
      .from('logs')
      .insert([{
        content: content.trim(),
        wallet_address: walletAddress,
        signature,
        created_at: timestamp,
        skills: classification.skills,
        protocols: classification.protocols,
        category: classification.category,
        evidence_url: cleanEvidenceUrl,
        github_url: cleanGithubUrl,
        irys_tx_id: irysTxId,
        archival_state: archivalState,
      }])
      .select()

    // Fallback: If live DB schema does not have new columns yet, insert with basic schema + irys_tx_id
    if (insertRes.error) {
      console.warn('Full schema insert warning. Falling back to base schema:', insertRes.error.message)
      insertRes = await supabase
        .from('logs')
        .insert([{
          content: content.trim(),
          wallet_address: walletAddress,
          signature,
          created_at: timestamp,
          irys_tx_id: irysTxId,
          archival_state: archivalState,
        }])
        .select()
    }

    if (insertRes.error || !insertRes.data || insertRes.data.length === 0) {
      console.error('Supabase insert error:', insertRes.error)
      return NextResponse.json({ error: `Failed to save log to database: ${insertRes.error?.message || 'Unknown database error'}` }, { status: 500 })
    }

    const savedLog = insertRes.data[0]

    return NextResponse.json({
      success: true,
      log: {
        ...savedLog,
        evidence_url: cleanEvidenceUrl,
        github_url: cleanGithubUrl,
        irys_tx_id: irysTxId,
        archival_state: archivalState,
      },
      classification,
      archivalState,
      irysTxId,
      cnftAssetId: null,
      hasMerkleTree: !!process.env.SOLANA_MERKLE_TREE_PUBKEY,
      gatewayUrl: irysTxId ? `https://gateway.irys.xyz/${irysTxId}` : null,
    })
  } catch (error: unknown) {
    console.error('Log submission API error:', error)
    const detail = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
