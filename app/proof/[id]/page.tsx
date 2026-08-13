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
    title: `PROVN Proof #${proofId} — Cryptographically Verified`,
    description: `Inspect individual proof-of-work record #${proofId} with live Ed25519 signature verification on Solana.`,
  }
}

export default async function ProofDetailPage({ params }: ProofPageProps) {
  const resolvedParams = await params
  const proofId = parseInt(resolvedParams.id, 10)

  if (isNaN(proofId) || proofId <= 0) {
    return (
      <main style={{ maxWidth: '720px', margin: '80px auto', textAlign: 'center', color: '#ff4444', fontFamily: 'monospace' }}>
        <h1>Invalid Proof ID</h1>
        <Link href="/" style={{ color: '#00ff88' }}>← Back to Terminal</Link>
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
      <main style={{ maxWidth: '720px', margin: '80px auto', textAlign: 'center', color: '#ff4444', fontFamily: 'monospace' }}>
        <h1>Proof #{proofId} Not Found</h1>
        <p style={{ color: '#888' }}>No proof record exists with this identifier.</p>
        <Link href="/" style={{ color: '#00ff88' }}>← Back to Terminal</Link>
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
        width: 'min(760px, 94vw)',
        margin: '0 auto',
        padding: '32px 16px 80px 16px',
        fontFamily: 'var(--font-geist-mono), monospace',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/u/${proof.wallet_address}`}
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Back to Builder Passport ({walletShort})
        </Link>
      </div>

      {/* Header */}
      <div
        className="glass-card"
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
            <span style={{ fontSize: '20px' }}>🗿</span>
            <h1 style={{ color: '#00ff88', fontSize: '1.4rem', margin: 0, fontWeight: 800 }}>
              Proof #{proof.id}
            </h1>
          </div>
          <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
            Recorded on {new Date(proof.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </div>
        </div>

        <div>
          {isSignatureValid ? (
            <span
              style={{
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid #00ff88',
                color: '#00ff88',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              ✓ ED25519 SIGNATURE VALID
            </span>
          ) : (
            <span
              style={{
                background: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid #ff4444',
                color: '#ff4444',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              ⚠ UNVERIFIED / LEGACY
            </span>
          )}
        </div>
      </div>

      {/* Verification Layer Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>1. Claim</div>
          <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>Builder Statement</div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>2. Provenance</div>
          <div style={{ color: isSignatureValid ? '#00ff88' : '#ff4444', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
            {isSignatureValid ? 'Ed25519 Verified ✓' : 'Unsigned / Legacy'}
          </div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>3. Evidence</div>
          <div style={{ color: proof.github_url || proof.evidence_url ? '#ab9ff2' : '#666', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
            {proof.github_url ? 'GitHub Link Attached' : proof.evidence_url ? 'Demo Link Attached' : 'None Attached'}
          </div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>4. Storage</div>
          <div style={{ color: proof.archival_state === 'archived' ? '#27c93f' : '#ffb800', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
            {proof.archival_state === 'archived' ? 'Arweave Confirmed' : 'Database Stored'}
          </div>
        </div>
      </div>

      {/* Proof Content Card */}
      <div className="terminal-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
          Signed Work Claim
        </h2>
        <p
          style={{
            color: '#fff',
            fontSize: '14px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            margin: '0 0 20px 0',
          }}
        >
          {proof.content}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {proof.github_url && (
            <div style={{ background: '#060709', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1a2030' }}>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>GitHub Evidence (Self-Attested)</div>
              <a
                href={proof.github_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#ab9ff2', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {proof.github_url} ↗
              </a>
            </div>
          )}

          {proof.evidence_url && (
            <div style={{ background: '#060709', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1a2030' }}>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Live Demo / Evidence URL</div>
              <a
                href={proof.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00e5ff', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {proof.evidence_url} ↗
              </a>
            </div>
          )}

          {proof.irys_tx_id && !proof.irys_tx_id.startsWith('powl_') && (
            <div style={{ background: '#060709', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1a2030' }}>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Arweave L1 Permanent Storage</div>
              <a
                href={`https://gateway.irys.xyz/${proof.irys_tx_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#27c93f', fontSize: '11px', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {proof.irys_tx_id} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Cryptographic Provenance Inspector */}
      <div className="terminal-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ color: '#00ff88', fontSize: '12px', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
          🔍 Cryptographic Provenance Inspector
        </h3>

        <div style={{ display: 'grid', gap: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141824', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#666' }}>Signer Wallet:</span>
            <code style={{ color: '#ffb800', wordBreak: 'break-all', fontSize: '10px' }}>{proof.wallet_address}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141824', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#666' }}>Domain Bound:</span>
            <span style={{ color: '#00e5ff', wordBreak: 'break-all' }}>{proof.domain || 'provn-sol.vercel.app'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141824', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#666' }}>Anti-Replay Nonce:</span>
            <span style={{ color: '#aaa', wordBreak: 'break-all' }}>{proof.nonce || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141824', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#666' }}>Archival State:</span>
            <span style={{ color: proof.archival_state === 'archived' ? '#00ff88' : '#ffb800' }}>
              {proof.archival_state?.toUpperCase() || 'PENDING'}
            </span>
          </div>
        </div>

        {reconstructedMessage && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Reconstructed Canonical SIWS Message:
            </div>
            <pre
              style={{
                background: '#060709',
                border: '1px solid #161c28',
                padding: '12px',
                borderRadius: '6px',
                color: '#ab9ff2',
                fontSize: '10px',
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

      {/* Independent Verification Instructions */}
      <div className="terminal-card" style={{ padding: '20px' }}>
        <h3 style={{ color: '#00e5ff', fontSize: '12px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
          💻 Independent Verification CLI
        </h3>
        <p style={{ color: '#888', fontSize: '11px', margin: '0 0 12px 0', lineHeight: '1.4' }}>
          You do not need to trust the PROVN web server. You can independently verify this proof using our open-source CLI:
        </p>
        <pre
          style={{
            background: '#060709',
            border: '1px solid #161c28',
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#00ff88',
            fontSize: '11px',
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
