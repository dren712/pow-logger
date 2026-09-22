import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { reconstructCanonicalSubmitMessage, evaluateProofValidity } from '@/app/lib/canonicalMessage'
import { WalletLog } from '@/app/lib/types'
import { PublicKey } from '@solana/web3.js'
import { deriveProofAnchorPda } from '@/app/lib/solanaAnchor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ProofPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProofPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const proofId = resolvedParams.id
  return {
    title: `PROVN Proof #${proofId} — Cryptographic Evidence Record`,
    description: `Inspect individual proof-of-work record #${proofId} with live Ed25519 signature verification on Solana.`,
  }
}

export default async function ProofDetailPage({ params }: ProofPageProps) {
  const resolvedParams = await params
  const proofId = parseInt(resolvedParams.id, 10)

  if (isNaN(proofId) || proofId <= 0) {
    return (
      <main className="max-w-2xl mx-auto my-20 p-6 text-center rounded-2xl bg-[#0e1117] border border-rose-500/20 text-rose-400 font-mono">
        <h1 className="text-xl font-bold mb-2">Invalid Proof Identifier</h1>
        <p className="text-sm text-zinc-500 mb-6">The requested proof ID must be a positive integer.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition">
          ← Return to Terminal
        </Link>
      </main>
    )
  }

  const { data: log } = await supabase
    .from('logs')
    .select('*')
    .eq('id', proofId)
    .single()

  if (!log) {
    return (
      <main className="max-w-2xl mx-auto my-20 p-6 text-center rounded-2xl bg-[#0e1117] border border-zinc-800 text-zinc-300 font-mono">
        <h1 className="text-xl font-bold mb-2 text-rose-400">Proof #{proofId} Not Found</h1>
        <p className="text-sm text-zinc-500 mb-6">No cryptographic proof record exists with this identifier in the active registry.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition">
          ← Return to Terminal
        </Link>
      </main>
    )
  }

  const proof = log as WalletLog

  // Privacy boundary check
  const isPrivate = proof.visibility === 'private' || (proof as unknown as Record<string, unknown>).is_public === false
  if (isPrivate) {
    return (
      <main className="max-w-2xl mx-auto my-20 p-6 text-center rounded-2xl bg-[#0e1117] border border-amber-500/30 text-amber-400 font-mono">
        <h1 className="text-xl font-bold mb-2">🔒 Private Proof Record</h1>
        <p className="text-sm text-zinc-400 mb-6">Proof #{proofId} was committed with private visibility and is accessible solely to the signing wallet holder.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition">
          ← Return to Terminal
        </Link>
      </main>
    )
  }

  // Authoritative 5-layer protocol evaluation
  const validityReport = evaluateProofValidity(proof)
  const isSignatureValid = validityReport.signatureVerified
  const isProtocolValid = validityReport.protocolVerified

  // Derive on-chain Solana PDA
  let solanaAnchorPda = 'N/A'
  try {
    const pubkey = new PublicKey(proof.wallet_address)
    const [pda] = deriveProofAnchorPda(pubkey, proof.id)
    solanaAnchorPda = pda.toBase58()
  } catch {}

  // Unified canonical message reconstruction
  const reconstructedMessage = reconstructCanonicalSubmitMessage(proof) || ''
  const walletShort = `${proof.wallet_address.slice(0, 4)}...${proof.wallet_address.slice(-4)}`

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 font-mono text-zinc-200">
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/u/${proof.wallet_address}`}
          className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          <span>←</span> Back to Builder Passport ({walletShort})
        </Link>
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533] mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl">🗿</span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Proof #{proof.id}
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Recorded on {new Date(proof.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
          </p>
        </div>

        <div>
          {isProtocolValid ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <span>✓</span> PROTOCOL VERIFIED
            </span>
          ) : isSignatureValid ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <span>✓</span> SIGNATURE VALID (V1)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
              <span>⚠</span> UNVERIFIED / INVALID
            </span>
          )}
        </div>
      </div>

      {/* 5-Link Cryptographic Provenance Chain */}
      <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533] mb-6">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-cyan-400 tracking-wider uppercase">
          <span>⛓️</span> 5-Link Cryptographic Provenance Chain
        </div>

        <div className="space-y-3">
          {/* Link 1: Solana Wallet Signature */}
          <div className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-100">[1] Solana Wallet Identity (Ed25519)</span>
              <span className={`text-[10px] font-bold ${isSignatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isSignatureValid ? '✓ VERIFIED' : '✗ FAILED'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Authoritatively signed by Solana wallet <code className="text-amber-300 font-mono">{walletShort}</code> over canonical SIWS envelope.
            </p>
          </div>

          {/* Link 2: Protocol Epoch Challenge */}
          <div className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-100">[2] Protocol Epoch Challenge & Anti-Replay</span>
              <span className={`text-[10px] font-bold ${validityReport.challengeVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                {validityReport.challengeVerified ? '✓ VERIFIED' : 'PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Single-use 15-minute observation epoch window bound to active protocol authority key.
            </p>
          </div>

          {/* Link 3: GitHub Identity Attribution */}
          <div className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-100">[3] GitHub / Source Attribution</span>
              <span className={`text-[10px] font-bold ${proof.provenance_level === 'source_verified' ? 'text-emerald-400' : proof.github_url ? 'text-cyan-400' : 'text-zinc-500'}`}>
                {proof.provenance_level === 'source_verified' ? '✓ SOURCE VERIFIED' : proof.github_url ? 'LINKED' : 'SELF-ATTESTED'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {proof.provenance_level === 'source_verified'
                ? 'Cryptographically bound via SIWS OAuth to repository commit author.'
                : proof.github_url
                ? 'Public repository URL referenced by builder.'
                : 'Self-attested builder action without linked repo.'}
            </p>
          </div>

          {/* Link 4: Solana On-Chain Anchor PDA */}
          <div className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-100">[4] Solana On-Chain Commitment (PDA)</span>
              <span className="text-[10px] font-bold text-cyan-400">ANCHORABLE (PDA Ready)</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Deterministic PDA: <code className="text-cyan-300 font-mono">{solanaAnchorPda.length > 16 ? `${solanaAnchorPda.slice(0, 8)}...${solanaAnchorPda.slice(-6)}` : solanaAnchorPda}</code>
            </p>
          </div>

          {/* Link 5: Irys Arweave Permanent Storage */}
          <div className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-100">[5] Irys / Arweave Decentralized Archival</span>
              <span className={`text-[10px] font-bold ${proof.irys_tx_id ? 'text-emerald-400' : 'text-amber-400'}`}>
                {proof.irys_tx_id ? '✓ CONFIRMED (ARWEAVE L1)' : 'AUTOMATIC QUEUE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {proof.irys_tx_id
                ? `Permanently archived with Arweave Tx ID: ${proof.irys_tx_id}`
                : 'Automatic background archival queued with retry engine.'}
            </p>
          </div>
        </div>
      </div>

      {/* Source Verification Details Section */}
      {proof.provenance_level === 'source_verified' && proof.source_metadata && typeof proof.source_metadata === 'object' && (
        <div className="p-6 rounded-2xl bg-[#0e1117] border border-emerald-500/30 mb-6">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-400 tracking-wider uppercase">
            <span>✓</span> Source Verification API Result
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            PROVN verified via the GitHub API that this source exists.
            <span className="block text-amber-400/90 mt-1">Note: PROVN verifies the source commit/PR exists on GitHub, and binds it to the signing wallet.</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500">Source Type</div>
              <div className="text-zinc-200 font-semibold mt-1">{proof.evidence_type === 'github_pr' ? 'Pull Request' : 'Commit'}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500">Author Handle</div>
              <div className="text-zinc-200 font-semibold mt-1">{(proof.source_metadata as { author?: string })?.author || 'Unknown'}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500">Merge State</div>
              <div className="text-emerald-400 font-semibold mt-1">
                {(proof.source_metadata as { state?: string, merged_at?: string })?.state === 'closed'
                  ? ((proof.source_metadata as { merged_at?: string })?.merged_at ? 'Merged' : 'Closed')
                  : ((proof.source_metadata as { state?: string })?.state === 'open' ? 'Open' : (proof.source_metadata as { state?: string })?.state || 'Committed')}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500">Verified At</div>
              <div className="text-zinc-200 font-semibold mt-1">
                {proof.source_verified_at ? new Date(proof.source_verified_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof Content Card */}
      <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533] mb-6">
        <div className="text-xs uppercase text-zinc-400 font-bold tracking-wider mb-3">
          Signed Work Claim
        </div>
        <p className="text-sm sm:text-base text-zinc-100 leading-relaxed whitespace-pre-wrap mb-6 font-mono">
          {proof.content}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {proof.github_url && (
            <div className="p-3 rounded-xl bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500 mb-1">GitHub Evidence</div>
              <a
                href={proof.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 break-all transition"
              >
                {proof.github_url} ↗
              </a>
            </div>
          )}

          {proof.evidence_url && (
            <div className="p-3 rounded-xl bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500 mb-1">Evidence URL</div>
              <a
                href={proof.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 break-all transition"
              >
                {proof.evidence_url} ↗
              </a>
            </div>
          )}

          {proof.irys_tx_id && !proof.irys_tx_id.startsWith('powl_') && (
            <div className="p-3 rounded-xl bg-[#080a0f] border border-[#141824]">
              <div className="text-[10px] uppercase text-zinc-500 mb-1">Arweave L1 Permanent Storage</div>
              <a
                href={`https://gateway.irys.xyz/${proof.irys_tx_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 break-all transition"
              >
                {proof.irys_tx_id} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Cryptographic Provenance Inspector */}
      <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533] mb-6">
        <div className="text-xs uppercase text-emerald-400 font-bold tracking-wider mb-4 flex items-center gap-2">
          <span>🔍</span> Cryptographic Provenance Inspector
        </div>

        <div className="divide-y divide-[#141824] text-xs">
          <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-zinc-500">Signer Wallet:</span>
            <code className="text-amber-300 font-mono text-[11px] break-all">{proof.wallet_address}</code>
          </div>
          <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-zinc-500">Domain Bound:</span>
            <span className="text-cyan-400 font-mono text-[11px]">{proof.domain || 'provn-sol.vercel.app'}</span>
          </div>
          <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-zinc-500">Epoch Challenge Nonce:</span>
            <code className="text-zinc-400 font-mono text-[11px] break-all">{proof.challenge || proof.nonce || 'N/A'}</code>
          </div>
          {proof.submission_receipt && (
            <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-500">Submission Receipt:</span>
              <span className="text-emerald-400 font-mono text-[11px]">{proof.submission_receipt.slice(0, 24)}... (Verified ✓)</span>
            </div>
          )}
          <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-zinc-500">Archival State:</span>
            <span className={`font-semibold ${proof.archival_state === 'receipt_obtained' || proof.archival_state === 'finalized' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {proof.archival_state?.toUpperCase() || 'PENDING'}
            </span>
          </div>
        </div>

        {reconstructedMessage && (
          <div className="mt-5 pt-4 border-t border-[#141824]">
            <div className="text-[10px] uppercase text-zinc-500 font-bold mb-2">
              Reconstructed Canonical SIWS Message Envelope
            </div>
            <pre className="p-3.5 rounded-xl bg-[#080a0f] border border-[#141824] text-indigo-300 text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {reconstructedMessage}
            </pre>
          </div>
        )}
      </div>

      {/* Independent Verification & Export Section */}
      <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm uppercase font-bold text-cyan-400 tracking-wider">
              💻 Independent Verification & Portable Envelope
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Verify this proof offline without trusting the PROVN web server or database.
            </p>
          </div>
          <a
            href={`/api/proof/${proof.id}/export?download=true`}
            download={`provn-proof-${proof.id}.json`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 active:scale-[0.98] transition"
          >
            📥 Download Proof Envelope (.json)
          </a>
        </div>

        <div className="p-4 rounded-xl bg-[#080a0f] border border-[#141824] text-xs">
          <p className="text-zinc-400 mb-2">Verify offline using the standalone open-source PROVN CLI:</p>
          <pre className="p-2.5 rounded-lg bg-[#0e1117] border border-[#1e2533] text-emerald-400 text-xs overflow-x-auto mb-2 font-mono">
            npx provn verify ./provn-proof-{proof.id}.json
          </pre>
          <div className="text-[11px] text-zinc-500">
            Or query and independently verify live: <code className="text-amber-300 font-mono">npx provn verify {proof.id}</code>
          </div>
        </div>
      </div>
    </main>
  )
}
