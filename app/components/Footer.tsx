'use client'

import Link from 'next/link'

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
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '28px',
            marginBottom: '32px',
          }}
        >
          {/* Protocol Info */}
          <div>
            <div style={{ color: '#00ff88', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
              PROVN 🗿
            </div>
            <p style={{ margin: 0, lineHeight: '1.6', fontSize: '11px', color: '#666' }}>
              Proof-of-Work Logger for Solana builders. Permanently archived on Arweave via Irys Node #1.
            </p>
          </div>

          {/* Core Links */}
          <div>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
              Ecosystem
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <a
                href="https://github.com/dren712/pow-logger"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                GitHub Repository ↗
              </a>
              <a
                href="https://gateway.irys.xyz"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                Irys Gateway Explorer ↗
              </a>
              <a
                href="https://explorer.solana.com"
                rel="noopener noreferrer"
                style={{ color: '#00ff88', textDecoration: 'none' }}
              >
                Solana Explorer ↗
              </a>
              <Link
                href="/privacy"
                style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}
              >
                Privacy Policy 🔒
              </Link>
            </div>
          </div>

          {/* Developer Tools */}
          <div>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
              Developer Tools
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <Link
                href="/api/verify/AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p"
                style={{ color: '#00e5ff', textDecoration: 'none' }}
              >
                Verification API (/api/verify/[wallet])
              </Link>
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
                rel="noopener noreferrer"
                style={{ color: '#ffb800', textDecoration: 'none' }}
              >
                Superteam India ↗
              </a>
              <a
                href="https://solana.com"
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
          <div>© {new Date().getFullYear()} PROVN Protocol 🗿</div>
        </div>
      </div>
    </footer>
  )
}
