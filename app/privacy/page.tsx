import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PoWL Protocol 🗿',
  description: 'Privacy Policy and data governance specs for PoWL Proof-of-Work Logger.',
}

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        padding: '48px 20px 100px 20px',
        fontFamily: 'var(--font-geist-mono), monospace',
        color: '#e0e0e0',
      }}
    >
      <div style={{ marginBottom: '32px' }}>
        <a
          href="/"
          className="btn-primary"
          style={{
            fontSize: '12px',
            padding: '6px 14px',
            display: 'inline-flex',
            marginBottom: '20px',
          }}
        >
          ← Back to PoWL Terminal
        </a>

        <h1 style={{ color: '#00ff88', fontSize: '2.2rem', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-0.8px' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
          Last Updated: August 1, 2026 • PoWL Protocol (Version 1.0)
        </p>
      </div>

      <div className="glass-card" style={{ padding: '32px', display: 'grid', gap: '24px', lineHeight: '1.7', fontSize: '13.5px' }}>
        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>1. Overview</h2>
          <p style={{ color: '#ccc', margin: 0 }}>
            PoWL (&quot;Proof-of-Work Logger&quot;) is a decentralized builder reputation protocol built on Solana and Arweave. We respect your privacy and are committed to maintaining zero covert tracking, zero user profiling, and zero third-party data monetization.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>2. Data We Process &amp; Store</h2>
          <ul style={{ color: '#ccc', paddingLeft: '20px', margin: 0, display: 'grid', gap: '8px' }}>
            <li>
              <strong style={{ color: '#ffb800' }}>Public Wallet Addresses:</strong> When you connect your wallet (Phantom, Backpack, Solflare), your public Base58 address is processed to authenticate log submissions and render your 365-day contribution heatmap.
            </li>
            <li>
              <strong style={{ color: '#ffb800' }}>Work Logs &amp; Cryptographic Signatures:</strong> Text entries submitted via PoWL are signed offline using Ed25519 Sign-In With Solana (SIWS) signatures. Verified logs are archived permanently on Arweave via Irys Node #1 and indexed in Supabase (PostgreSQL).
            </li>
            <li>
              <strong style={{ color: '#ffb800' }}>No Private Keys:</strong> Your private keys never leave your browser. All authentication takes place via offline Ed25519 message signing in your wallet.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>3. Decentralized Immutability Notice</h2>
          <p style={{ color: '#ccc', margin: 0 }}>
            PoWL archives verified log entries on Arweave, a decentralized permanent blockweave storage network. Once a log is published to Arweave, it becomes permanent and immutable. Please do not submit confidential information, API keys, or personally identifiable info (PII) in your daily log entries.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>4. Third-Party Infrastructure</h2>
          <p style={{ color: '#ccc', margin: '0 0 10px 0' }}>
            PoWL utilizes trusted infrastructure providers:
          </p>
          <ul style={{ color: '#ccc', paddingLeft: '20px', margin: 0, display: 'grid', gap: '6px' }}>
            <li><strong>Solana Network:</strong> Public RPC endpoints (Helius / Solana Labs).</li>
            <li><strong>Irys &amp; Arweave:</strong> Permanent decentralized storage gateway (`gateway.irys.xyz`).</li>
            <li><strong>Supabase:</strong> Database query indexing hosted on Supabase (PostgreSQL with RLS).</li>
            <li><strong>Vercel:</strong> Static site hosting and serverless API execution with strict security headers.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>5. Cookies &amp; Tracking</h2>
          <p style={{ color: '#ccc', margin: 0 }}>
            PoWL does not use tracking cookies, analytics scripts, advertising pixels, or invasive surveillance tools.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: 800, marginTop: 0 }}>6. Contact &amp; Security Inquiries</h2>
          <p style={{ color: '#ccc', margin: 0 }}>
            For privacy queries or security disclosures, reach out directly to <strong>darshangaikwad712@gmail.com</strong> or via GitHub <a href="https://github.com/dren712" target="_blank" rel="noopener noreferrer" style={{ color: '#00ff88' }}>@dren712</a>.
          </p>
        </section>
      </div>
    </main>
  )
}
