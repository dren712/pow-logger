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
    title: `PROVN Proof #${proofId} — Wallet-Signed Evidence Record`,
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
          <div style={{ color: proof.provenance_level === 'source_verified' ? '#00ff88' : proof.provenance_level === 'source_linked' ? '#00e5ff' : '#aaa', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
            {proof.provenance_level === 'source_verified' ? 'Source API Verified' : proof.provenance_level === 'source_linked' ? 'Source URL Linked' : 'Self-Attested'}
          </div>
        </div>
        <div className="terminal-card" style={{ padding: '12px 14px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>4. Storage</div>
          <div style={{ color: (proof.archival_state === 'receipt_obtained' || proof.archival_state === 'finalized') ? '#27c93f' : '#ffb800', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
            {(proof.archival_state === 'receipt_obtained' || proof.archival_state === 'finalized') ? 'Arweave Confirmed' : 'Database Stored'}
          </div>
        </div>
      </div>

      {/* Source Verification Details Section */}
      {proof.provenance_level === 'source_verified' && proof.source_metadata && typeof proof.source_metadata === 'object' && (
        <div className="terminal-card" style={{ padding: '24px', marginBottom: '20px', borderLeft: '3px solid #00ff88' }}>
          <h2 style={{ color: '#00ff88', fontSize: '12px', textTransform: 'uppercase', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span> Source Verification API Result
          </h2>
          <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '16px', lineHeight: '1.5' }}>
            PROVN verified via the GitHub API that this source exists.<br />
            <span style={{ color: '#ffb800' }}>Warning: PROVN verifies the source exists, but does not definitively prove this wallet holder owns the GitHub account.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Source Type</div>
              <div style={{ color: '#fff', fontSize: '12px', marginTop: '4px' }}>{proof.evidence_type === 'github_pr' ? 'GitHub Pull Request' : 'GitHub Commit'}</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Author Handle</div>
              <div style={{ color: '#fff', fontSize: '12px', marginTop: '4px' }}>{(proof.source_metadata as { author?: string })?.author || 'Unknown'}</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Merge State</div>
              <div style={{ color: (proof.source_metadata as { state?: string, merged_at?: string })?.state === 'closed' ? ((proof.source_metadata as { merged_at?: string })?.merged_at ? '#ab9ff2' : '#ff4444') : '#27c93f', fontSize: '12px', marginTop: '4px' }}>
                {(proof.source_metadata as { state?: string, merged_at?: string })?.state === 'closed' ? ((proof.source_metadata as { merged_at?: string })?.merged_at ? 'Merged' : 'Closed') : ((proof.source_metadata as { state?: string })?.state === 'open' ? 'Open' : (proof.source_metadata as { state?: string })?.state || 'Committed')}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Verified At</div>
              <div style={{ color: '#fff', fontSize: '12px', marginTop: '4px' }}>
                {proof.source_verified_at ? new Date(proof.source_verified_at).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>
                GitHub Evidence ({proof.provenance_level === 'source_verified' ? 'Source-Verified' : 'Self-Attested'})
              </div>
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
            <span style={{ color: (proof.archival_state === 'receipt_obtained' || proof.archival_state === 'finalized') ? '#00ff88' : '#ffb800' }}>
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

      {/* Independent Verification & Export Section */}
      <div className="terminal-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ color: '#00e5ff', fontSize: '13px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
              💻 Independent Verification & Portable Envelope
            </h3>
            <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
              Verify this proof offline without trusting the PROVN web server or database.
            </p>
          </div>
          <a
            href={`/api/proof/${proof.id}/export?download=true`}
            download={`provn-proof-${proof.id}.json`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid #00e5ff',
              color: '#00e5ff',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            📥 Download Proof Envelope (.json)
          </a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '16px' }}>
          <div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
              1. Verify via Standalone CLI:
            </div>
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
          <div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
              2. Offline Verification via Downloaded File:
            </div>
            <pre
              style={{
                background: '#060709',
                border: '1px solid #161c28',
                padding: '10px 14px',
                borderRadius: '6px',
                color: '#00e5ff',
                fontSize: '11px',
                overflowX: 'auto',
                margin: 0,
              }}
            >
              {`npx provn verify provn-proof-${proof.id}.json`}
            </pre>
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #161c28', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
          <span style={{ color: '#666' }}>
            Trust Anchors & Key Manifest:
          </span>
          <a
            href="/.well-known/provn-keys.json"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#ab9ff2', textDecoration: 'none' }}
          >
            /.well-known/provn-keys.json ↗
          </a>
        </div>
      </div>
    </main>
  )
}
