'use client'

import { useState, useEffect } from 'react'

export default function MobileWalletNotice() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    }
    checkMobile()
  }, [])

  if (!isMobile) return null

  const currentHost = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : 'https%3A%2F%2Fprovn-sol.vercel.app'

  return (
    <section
      className="terminal-card"
      style={{
        padding: '16px 20px',
        marginBottom: '24px',
        background: 'rgba(0, 229, 255, 0.05)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>📱</span>
        <strong style={{ color: '#00e5ff', fontSize: '13px' }}>Mobile Browser Detected</strong>
      </div>
      <p style={{ color: '#aaa', fontSize: '11px', margin: '0 0 12px 0', lineHeight: '1.5' }}>
        For seamless Ed25519 message signing, open PROVN inside your Solana wallet&apos;s in-app browser:
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <a
          href={`https://phantom.app/ul/browse/${currentHost}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            fontSize: '11px',
            padding: '6px 12px',
            borderColor: '#ab9ff2',
            color: '#ab9ff2',
            textDecoration: 'none',
          }}
        >
          👻 Phantom Mobile
        </a>
        <a
          href={`https://solflare.com/ul/v1/browse/${currentHost}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            fontSize: '11px',
            padding: '6px 12px',
            borderColor: '#ffb800',
            color: '#ffb800',
            textDecoration: 'none',
          }}
        >
          ☀️ Solflare Mobile
        </a>
        <a
          href={`https://backpack.app/ul/browse/${currentHost}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            fontSize: '11px',
            padding: '6px 12px',
            borderColor: '#00e5ff',
            color: '#00e5ff',
            textDecoration: 'none',
          }}
        >
          🎒 Backpack Mobile
        </a>
      </div>
    </section>
  )
}
