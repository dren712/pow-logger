'use client'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid #161a24',
        background: '#060709',
        padding: '40px 20px 32px 20px',
        marginTop: '60px',
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: '12px',
        color: '#888',
      }}
    >
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ color: '#00ff88', fontWeight: 800, fontSize: '16px' }}>PoWL</span>
              <span style={{ fontSize: '14px' }}>🗿</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#666', lineHeight: '1.5' }}>
              Decentralized Builder Reputation Foundry on Solana.
            </p>
          </div>

          {/* Resources */}
          <div>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
              Resources
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <a
                href="https://github.com/dren712/pow-logger"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                GitHub Repository ↗
              </a>
              <a
                href="https://gateway.irys.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                Irys Gateway Explorer ↗
              </a>
              <a
                href="https://explorer.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                Solana Explorer ↗
              </a>
              <a
                href="/privacy"
                style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}
              >
                Privacy Policy 🔒
              </a>
            </div>
          </div>

          {/* Developer Tools */}
          <div>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
              Developer Tools
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <a
                href="/api/verify/demo"
                target="_blank"
                style={{ color: '#00e5ff', textDecoration: 'none' }}
              >
                Verification API (/api/verify/[wallet])
              </a>
              <span style={{ color: '#555' }}>Ed25519 Anti-Spoofing</span>
            </div>
          </div>

          {/* Community */}
          <div>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
              Community
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <a
                href="https://india.superteam.fun"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#ffb800', textDecoration: 'none' }}
              >
                Superteam India ↗
              </a>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#ffb800', textDecoration: 'none' }}
              >
                Solana Foundation ↗
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: '1px solid #121620',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '11px',
            color: '#555',
          }}
        >
          <div>Built on Solana · Stored on Arweave · For Web3 Builders</div>
          <div>© {new Date().getFullYear()} PoWL Protocol</div>
        </div>
      </div>
    </footer>
  )
}
