import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { buildCanonicalSubmitMessage, verifyLogCryptographically } from '@/app/lib/canonicalMessage'
import { WalletLog } from '@/app/lib/types'

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
    title: `PROVN Proof #${proofId} — Cryptographically Verified Record`,
    description: `Inspect individual proof record #${proofId} with live Ed25519 signature verification on Solana.`,
  }
}

export default async function ProofDetailPage({ params }: ProofPageProps) {
  const resolvedParams = await params
  const proofId = parseInt(resolvedParams.id, 10)

  if (isNaN(proofId) || proofId <= 0) {
    return (
      <main style={{ maxWidth: '720px', margin: '80px auto', textAlign: 'center', color: 'var(--accent-danger)' }}>
        <h1>Invalid Proof ID</h1>
        <Link href="/" className="btn-secondary" style={{ marginTop: '16px' }}>← Back to Terminal</Link>
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
      <main style={{ maxWidth: '720px', margin: '80px auto', textAlign: 'center', color: 'var(--accent-danger)' }}>
        <h1>Proof #{proofId} Not Found</h1>
        <p style={{ color: 'var(--text-muted)' }}>No proof record exists with this identifier.</p>
        <Link href="/" className="btn-secondary" style={{ marginTop: '16px' }}>← Back to Terminal</Link>
      </main>
    )
  }

  const proof = log as WalletLog

  // Re-verify Ed25519 signature against canonical message
  const isSignatureValid = verifyLogCryptographically(proof)
  let reconstructedMessage = ''

  if (proof.nonce && proof.wallet_address) {
    const domain = proof.domain || 'provn-sol.vercel.app'
    reconstructedMessage = buildCanonicalSubmitMessage({
      domain,
      walletAddress: proof.wallet_address,
      timestamp: proof.created_at,
      nonce: proof.nonce,
      content: proof.content,
      githubUrl: proof.github_url || undefined,
      evidenceUrl: proof.evidence_url || undefined,
    })
  }

  const walletShort = `${proof.wallet_address.slice(0, 4)}...${proof.wallet_address.slice(-4)}`

  return (
    <main
      style={{
        width: 'min(800px, 94vw)',
        margin: '0 auto',
        padding: '32px 16px 80px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/u/${proof.wallet_address}`}
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
          }}
        >
          ← Back to Builder Passport ({walletShort})
        </Link>
      </div>

      {/* Proof Header Document Banner */}
      <div
        className="terminal-card"
        style={{
          padding: '24px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.4rem', margin: 0, fontWeight: 800 }}>
              Proof #{proof.id}
            </h1>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            Recorded at {new Date(proof.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </div>
        </div>

        <div>
          {isSignatureValid ? (
            <span
              style={{
                background: 'rgba(0, 255, 136, 0.08)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                color: '#00ff88',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              ✓ ED25519 SIGNATURE VALID
            </span>
          ) : (
            <span
              style={{
                background: 'rgba(255, 184, 0, 0.08)',
                border: '1px solid rgba(255, 184, 0, 0.3)',
                color: 'var(--accent-achievement)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              HISTORICAL / UNVERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Verification Breakdown Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>1. Claim</div>
          <div style={{ color: '#ffffff', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>Signed Statement</div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>2. Provenance</div>
          <div style={{ color: isSignatureValid ? '#00ff88' : 'var(--accent-achievement)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
            {isSignatureValid ? 'Ed25519 Verified ✓' : 'Historical Record'}
          </div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>3. Evidence</div>
          <div style={{ color: proof.github_url || proof.evidence_url ? '#ab9ff2' : 'var(--text-faint)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
            {proof.github_url ? 'GitHub Attached' : proof.evidence_url ? 'Demo Attached' : 'None Attached'}
          </div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>4. Storage</div>
          <div style={{ color: proof.archival_state === 'archived' ? '#00e5ff' : 'var(--accent-achievement)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
            {proof.archival_state === 'archived' ? 'Arweave Archived' : 'Database Stored'}
          </div>
        </div>
      </div>

      {/* Claim Statement Body */}
      <div className="terminal-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', fontWeight: 600 }}>
          Signed Work Claim
        </h2>
        <p
          style={{
            color: '#ffffff',
            fontSize: '15px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            margin: '0 0 20px 0',
          }}
        >
          {proof.content}
        </p>

        {/* Evidence Links Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {proof.github_url && (
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>GitHub Evidence</div>
              <a
                href={proof.github_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#ab9ff2', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}
              >
                {proof.github_url} ↗
              </a>
            </div>
          )}

          {proof.evidence_url && (
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Live Demo / Evidence</div>
              <a
                href={proof.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00e5ff', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}
              >
                {proof.evidence_url} ↗
              </a>
            </div>
          )}

          {proof.irys_tx_id && !proof.irys_tx_id.startsWith('powl_') && (
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Arweave Permanent TX</div>
              <a
                href={`https://gateway.irys.xyz/${proof.irys_tx_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#ffb800', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}
              >
                {proof.irys_tx_id} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Cryptographic Provenance Data */}
      <div className="terminal-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ color: '#00ff88', fontSize: '12px', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: 700 }}>
          Cryptographic Provenance Data
        </h3>

        <div style={{ display: 'grid', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: 'var(--text-faint)' }}>Signer Wallet:</span>
            <code style={{ color: '#ffb800', wordBreak: 'break-all', fontSize: '11px' }}>{proof.wallet_address}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: 'var(--text-faint)' }}>Domain Bound:</span>
            <span style={{ color: '#00e5ff', wordBreak: 'break-all' }}>{proof.domain || 'provn-sol.vercel.app'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: 'var(--text-faint)' }}>Anti-Replay Nonce:</span>
            <span style={{ color: '#ffffff', wordBreak: 'break-all' }}>{proof.nonce || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: 'var(--text-faint)' }}>Archival State:</span>
            <span style={{ color: proof.archival_state === 'archived' ? '#00ff88' : '#ffb800', fontWeight: 700 }}>
              {proof.archival_state?.toUpperCase() || 'PENDING'}
            </span>
          </div>
        </div>

        {reconstructedMessage && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
              Reconstructed Canonical SIWS Message:
            </div>
            <pre
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                padding: '12px',
                borderRadius: '6px',
                color: '#ab9ff2',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {reconstructedMessage}
            </pre>
          </div>
        )}
      </div>

      {/* Independent Verification CLI Section */}
      <div className="terminal-card" style={{ padding: '20px' }}>
        <h3 style={{ color: '#00e5ff', fontSize: '12px', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 700 }}>
          Independent Verification CLI
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0', lineHeight: '1.5' }}>
          PROVN is designed with zero-trust verification. Anyone can verify this proof offline with TweetNaCl Ed25519:
        </p>
        <pre
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#00ff88',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto',
            margin: 0,
          }}
        >
          {`npx provn verify ${proof.id}`}
        </pre>
      </div>
    </main>
  )
}
