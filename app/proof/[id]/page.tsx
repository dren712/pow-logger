import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { reconstructCanonicalSubmitMessage, evaluateProofValidity } from '@/app/lib/canonicalMessage'
import { WalletLog } from '@/app/lib/types'
import { PublicKey } from '@solana/web3.js'
import { deriveProofAnchorPda } from '@/app/lib/solanaAnchor'
import SiteNav from '@/app/components/SiteNav'

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
    title: `PROVN Proof #${proofId} — Wallet-Signed Evidence Record`,
    description: `Inspect individual proof-of-work record #${proofId} with live Ed25519 signature verification on Solana.`,
  }
}

type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

const TONE: Record<Tone, { text: string; border: string; bg: string }> = {
  ok: { text: '#2ee59d', border: 'rgba(46, 229, 157, 0.35)', bg: 'rgba(46, 229, 157, 0.07)' },
  warn: { text: '#f5c451', border: 'rgba(245, 196, 81, 0.35)', bg: 'rgba(245, 196, 81, 0.07)' },
  bad: { text: '#ff7b7b', border: 'rgba(255, 123, 123, 0.4)', bg: 'rgba(255, 123, 123, 0.07)' },
  neutral: { text: '#9aa3b2', border: '#272e3a', bg: 'rgba(154, 163, 178, 0.06)' },
}

function StatusIcon({ tone, size = 16 }: { tone: Tone; size?: number }) {
  const color = TONE[tone].text
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      {tone === 'ok' && <path d="M7.5 12.5l3 3 6-6.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {tone === 'warn' && <path d="M12 7v6M12 16.5v.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
      {tone === 'bad' && <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
      {tone === 'neutral' && <path d="M8 12h8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  )
}

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONE[tone]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none"
      style={{ color: t.text, borderColor: t.border, background: t.bg }}
    >
      <StatusIcon tone={tone} size={13} />
      {children}
    </span>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-[#9fd8ff] hover:underline">
      {children}
    </a>
  )
}

function Message({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
        <p className="pv-eyebrow">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="pv-muted text-[15px]">{body}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/log" className="pv-btn">Open the proof logger</Link>
          <Link href="/" className="pv-btn-ghost">Go to home</Link>
        </div>
      </main>
    </div>
  )
}

export default async function ProofDetailPage({ params }: ProofPageProps) {
  const resolvedParams = await params
  const proofId = parseInt(resolvedParams.id, 10)

  if (isNaN(proofId) || proofId <= 0) {
    return (
      <Message
        eyebrow="Invalid link"
        title="This is not a valid proof ID"
        body="Proof links end in a positive number, for example /proof/12. Check the link you were given."
      />
    )
  }

  const { data: log } = await supabase
    .from('logs')
    .select('*')
    .eq('id', proofId)
    .single()

  if (!log) {
    return (
      <Message
        eyebrow="Proof not found"
        title={`Proof #${proofId} could not be found`}
        body="No proof record with this ID could be loaded. It may not exist, or the proof database may be unavailable right now."
      />
    )
  }

  const proof = log as WalletLog

  // Privacy boundary check
  const isPrivate = proof.visibility === 'private' || (proof as unknown as Record<string, unknown>).is_public === false
  if (isPrivate) {
    return (
      <Message
        eyebrow="Private record"
        title={`Proof #${proofId} is private`}
        body="This proof was submitted with private visibility and can only be viewed by the wallet that signed it."
      />
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

  const sourceVerified = proof.provenance_level === 'source_verified'
  const isArchived = Boolean(proof.irys_tx_id && !proof.irys_tx_id.startsWith('powl_'))
  const archiveUrl = isArchived ? `https://gateway.irys.xyz/${proof.irys_tx_id}` : null
  const archivalDone = proof.archival_state === 'receipt_obtained' || proof.archival_state === 'finalized'
  const hasPda = solanaAnchorPda !== 'N/A'
  const sourceMeta = (proof.source_metadata || {}) as { author?: string; state?: string; merged_at?: string }
  const mergeState =
    sourceMeta.state === 'closed' ? (sourceMeta.merged_at ? 'Merged' : 'Closed') : sourceMeta.state === 'open' ? 'Open' : sourceMeta.state || 'Committed'

  const overall: { tone: Tone; title: string; body: string } = isProtocolValid
    ? {
        tone: 'ok',
        title: 'Verified',
        body: 'The wallet signature, the server challenge and the submission receipt all check out for this record.',
      }
    : isSignatureValid
      ? {
          tone: 'warn',
          title: 'Signature valid, receipt pending',
          body: 'The wallet signature is valid. The record does not carry a full set of protocol checks yet (legacy format or pending server receipt).',
        }
      : {
          tone: 'bad',
          title: 'Not verified',
          body: 'The signature on this record could not be verified against the signer wallet. Do not rely on this claim.',
        }

  const checks: { name: string; tone: Tone; status: string; detail: React.ReactNode }[] = [
    {
      name: 'Wallet signature (Ed25519)',
      tone: isSignatureValid ? 'ok' : 'bad',
      status: isSignatureValid ? 'Verified' : 'Failed',
      detail: isSignatureValid ? (
        <>Signed by Solana wallet <span className="pv-mono text-[#c3cad6]">{walletShort}</span> over the canonical message shown below.</>
      ) : (
        <>The stored signature does not match wallet <span className="pv-mono text-[#c3cad6]">{walletShort}</span> and the canonical message.</>
      ),
    },
    {
      name: 'Server challenge and replay protection',
      tone: validityReport.challengeVerified ? 'ok' : 'warn',
      status: validityReport.challengeVerified ? 'Verified' : 'Pending',
      detail: 'A single-use, time-limited challenge issued by the PROVN server and bound to its active signing key.',
    },
    {
      name: 'Source attribution (GitHub)',
      tone: sourceVerified ? 'ok' : 'neutral',
      status: sourceVerified ? 'Source verified' : proof.github_url ? 'Linked' : 'Self-attested',
      detail: sourceVerified
        ? 'The linked pull request or commit was confirmed to exist through the GitHub API.'
        : proof.github_url
          ? 'A public repository URL is attached to the claim. It has not been checked against GitHub.'
          : 'No source link is attached. The claim rests on the signer’s word.',
    },
    {
      name: 'Solana on-chain commitment',
      tone: 'neutral',
      status: 'Address derived',
      detail: hasPda ? (
        <>
          Anchor address <span className="pv-mono text-[#c3cad6]">{solanaAnchorPda.slice(0, 8)}...{solanaAnchorPda.slice(-6)}</span> on program{' '}
          <span className="pv-mono text-[#c3cad6]">FZomvFyB...jmZx</span>. This page does not check whether the anchor has been written on-chain.
        </>
      ) : (
        'The anchor address could not be derived from the signer wallet.'
      ),
    },
    {
      name: 'Permanent archive (Irys / Arweave)',
      tone: proof.irys_tx_id ? 'ok' : 'warn',
      status: proof.irys_tx_id ? 'Archived' : 'Queued',
      detail: proof.irys_tx_id ? (
        <>Archived with transaction ID <span className="pv-mono break-all text-[#c3cad6]">{proof.irys_tx_id}</span>.</>
      ) : (
        'Archival is queued and retried automatically in the background.'
      ),
    },
  ]

  const details: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Signer wallet',
      value: <ExternalLink href={`https://explorer.solana.com/address/${proof.wallet_address}`}>{proof.wallet_address}</ExternalLink>,
    },
    ...(proof.signature ? [{ label: 'Signature', value: proof.signature as React.ReactNode }] : []),
    { label: 'Domain', value: proof.domain || 'provn-sol.vercel.app' },
    { label: 'Server challenge', value: proof.challenge || proof.nonce || 'N/A' },
    ...(proof.submission_receipt
      ? [{ label: 'Submission receipt', value: <>{proof.submission_receipt.slice(0, 24)}... <span className="text-[#2ee59d]">(verified)</span></> }]
      : []),
    {
      label: 'Anchor address',
      value: hasPda ? <ExternalLink href={`https://explorer.solana.com/address/${solanaAnchorPda}`}>{solanaAnchorPda}</ExternalLink> : 'N/A',
    },
    {
      label: 'Archival state',
      value: (
        <span style={{ color: archivalDone ? TONE.ok.text : TONE.warn.text }}>
          {(proof.archival_state || 'pending').replace(/_/g, ' ')}
        </span>
      ),
    },
  ]

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-8 lg:py-10">
        <Link href={`/u/${proof.wallet_address}`} className="pv-muted self-start text-[13px] hover:text-white">
          <span aria-hidden="true">&larr;</span> Builder passport <span className="pv-mono">({walletShort})</span>
        </Link>

        <header className="pv-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="min-w-0">
              <p className="pv-eyebrow">Proof record</p>
              <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-white">Proof #{proof.id}</h1>
              <p className="pv-muted mt-1.5 text-[13px]">
                Recorded on {new Date(proof.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </p>
            </div>
          </div>
          <div
            role="status"
            className="flex items-start gap-3 border-t px-6 py-4"
            style={{ borderColor: TONE[overall.tone].border, background: TONE[overall.tone].bg }}
          >
            <span className="mt-0.5"><StatusIcon tone={overall.tone} size={22} /></span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold" style={{ color: TONE[overall.tone].text }}>{overall.title}</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#c3cad6]">{overall.body}</p>
            </div>
          </div>
        </header>

        <section className="pv-card p-6" aria-labelledby="claim-heading">
          <h2 id="claim-heading" className="pv-h2">Signed work claim</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white">{proof.content}</p>

          {(proof.github_url || proof.evidence_url || archiveUrl) && (
            <dl className="mt-5 grid gap-3 border-t border-[#1c222c] pt-5 text-[13px] sm:grid-cols-2">
              {proof.github_url && (
                <div className="min-w-0">
                  <dt className="pv-faint text-[12px]">GitHub evidence ({sourceVerified ? 'source verified' : 'self-attested'})</dt>
                  <dd className="mt-1"><ExternalLink href={proof.github_url}>{proof.github_url}</ExternalLink></dd>
                </div>
              )}
              {proof.evidence_url && (
                <div className="min-w-0">
                  <dt className="pv-faint text-[12px]">Live demo or evidence URL</dt>
                  <dd className="mt-1"><ExternalLink href={proof.evidence_url}>{proof.evidence_url}</ExternalLink></dd>
                </div>
              )}
              {archiveUrl && (
                <div className="min-w-0">
                  <dt className="pv-faint text-[12px]">Permanent archive (Arweave via Irys)</dt>
                  <dd className="pv-mono mt-1 text-[12px]"><ExternalLink href={archiveUrl}>{proof.irys_tx_id}</ExternalLink></dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className="pv-card" aria-labelledby="checks-heading">
          <div className="px-6 pt-6">
            <h2 id="checks-heading" className="pv-h2">Verification checks</h2>
            <p className="pv-muted mt-1 text-[13px]">Five independent links between this claim, the signer and the public record.</p>
          </div>
          <ol className="mt-4 divide-y divide-[#1c222c] border-t border-[#1c222c]">
            {checks.map((c, i) => (
              <li key={c.name} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="flex min-w-0 gap-3">
                  <span className="pv-mono pv-faint mt-0.5 text-[12px]">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-white">{c.name}</p>
                    <p className="pv-muted mt-1 text-[13px] leading-relaxed">{c.detail}</p>
                  </div>
                </div>
                <div className="pl-6 sm:pl-0"><StatusPill tone={c.tone}>{c.status}</StatusPill></div>
              </li>
            ))}
          </ol>
        </section>

        {sourceVerified && proof.source_metadata && typeof proof.source_metadata === 'object' && (
          <section className="pv-card p-6" aria-labelledby="source-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="source-heading" className="pv-h2">Source verification result</h2>
              <StatusPill tone="ok">Source verified</StatusPill>
            </div>
            <p className="pv-muted mt-2 text-[13px] leading-relaxed">PROVN confirmed through the GitHub API that this source exists.</p>
            <p className="mt-3 rounded-lg border px-3 py-2 text-[13px] leading-relaxed" style={{ color: TONE.warn.text, borderColor: TONE.warn.border, background: TONE.warn.bg }}>
              This confirms the source exists. It does not prove that the wallet holder owns the GitHub account.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
              <div>
                <dt className="pv-faint text-[12px]">Source type</dt>
                <dd className="mt-1 text-white">{proof.evidence_type === 'github_pr' ? 'GitHub pull request' : 'GitHub commit'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="pv-faint text-[12px]">Author</dt>
                <dd className="mt-1 break-words text-white">{sourceMeta.author || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="pv-faint text-[12px]">State</dt>
                <dd className="mt-1" style={{ color: mergeState === 'Merged' ? '#c4a5ff' : mergeState === 'Closed' ? TONE.bad.text : TONE.ok.text }}>{mergeState}</dd>
              </div>
              <div>
                <dt className="pv-faint text-[12px]">Verified at</dt>
                <dd className="mt-1 text-white">{proof.source_verified_at ? new Date(proof.source_verified_at).toLocaleString() : 'N/A'}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="pv-card p-6" aria-labelledby="signature-heading">
          <h2 id="signature-heading" className="pv-h2">Signature and record details</h2>
          <dl className="mt-4 divide-y divide-[#1c222c] border-y border-[#1c222c] text-[13px]">
            {details.map((d) => (
              <div key={d.label} className="grid gap-1 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
                <dt className="pv-muted">{d.label}</dt>
                <dd className="pv-mono min-w-0 break-all text-[12px] leading-relaxed text-[#c3cad6]">{d.value}</dd>
              </div>
            ))}
          </dl>

          {reconstructedMessage && (
            <div className="mt-5">
              <h3 className="pv-faint text-[12px]">Canonical message that was signed</h3>
              <pre className="pv-mono mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-[#1c222c] bg-[#080a0e] p-4 text-[12px] leading-relaxed text-[#c3cad6]">
                {reconstructedMessage}
              </pre>
            </div>
          )}
        </section>

        <section className="pv-card p-6" aria-labelledby="verify-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="verify-heading" className="pv-h2">Verify it yourself</h2>
              <p className="pv-muted mt-1 text-[13px] leading-relaxed">
                Download the portable proof envelope and check it offline, without trusting the PROVN server or database.
              </p>
            </div>
            <a href={`/api/proof/${proof.id}/export?download=true`} download={`provn-proof-${proof.id}.json`} className="pv-btn no-print">
              Download proof envelope
            </a>
          </div>
          <p className="pv-faint mt-5 text-[12px]">Verify the downloaded file with the open-source PROVN CLI</p>
          <pre className="pv-mono mt-2 overflow-x-auto rounded-lg border border-[#1c222c] bg-[#080a0e] p-4 text-[12.5px] text-[#2ee59d]">
            npx provn verify ./provn-proof-{proof.id}.json
          </pre>
          <p className="pv-faint mt-4 text-[12px]">Or fetch and verify the live record by ID</p>
          <pre className="pv-mono mt-2 overflow-x-auto rounded-lg border border-[#1c222c] bg-[#080a0e] p-4 text-[12.5px] text-[#c3cad6]">
            npx provn verify {proof.id}
          </pre>
        </section>
      </main>
    </div>
  )
}
