'use client'

import { useState } from 'react'
import WalletMultiButton from './WalletButton'

interface HeroHeaderProps {
  connected: boolean
  walletAddress?: string
}

export default function HeroHeader({ connected, walletAddress }: HeroHeaderProps) {
  const [verifyWalletInput, setVerifyWalletInput] = useState('')

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyWalletInput.trim()) {
      window.location.href = `/u/${verifyWalletInput.trim()}`
    }
  }

  return (
    <>
      {/* Header Navigation Bar */}
      <header
        className="header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid #161a24',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ color: '#00ff88', margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              PROVN
            </h1>
            <span
              style={{
                fontSize: '20px',
                background: 'rgba(0,255,136,0.1)',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(0,255,136,0.2)',
              }}
            >
              🗿
            </span>
          </div>
          <p style={{ color: '#666', margin: '6px 0 0 0', fontSize: '12px', letterSpacing: '0.2px' }}>
            PROVN — Proof-of-Work Logger • Decentralized Builder Reputation Foundry
          </p>
        </div>
        <WalletMultiButton />
      </header>

      {/* Hero Presentation Card */}
      <section className="glass-card hero-glow" style={{ marginBottom: '32px', textAlign: 'center', padding: '28px 20px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 255, 136, 0.08)',
            border: '1px solid rgba(0, 255, 136, 0.25)',
            padding: '4px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            color: '#00ff88',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          <span className="animate-blink" style={{ color: '#00ff88' }}>
            ●
          </span>{' '}
          SOLANA & IRYS PERMANENT PROOF FOUNDRY
        </div>
        <h2 style={{ color: '#00ff88', fontSize: '2.2rem', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-0.8px' }}>
          Your work, cryptographically verified &amp; permanently archived.
        </h2>
        <p style={{ color: '#aaa', fontSize: '14px', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
          Cryptographically signed logs, auto-classified skills, and verifiable reputation trail.
        </p>

        <div
          className="hero-buttons"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center' }}
        >
          <button
            onClick={() => {
              document.getElementById('log-terminal')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="btn-primary"
          >
            Launch Terminal →
          </button>

          {connected && walletAddress && (
            <a
              href={`/u/${walletAddress}`}
              className="btn-primary"
              style={{
                borderColor: '#00e5ff',
                color: '#00e5ff',
              }}
            >
              View My Profile →
            </a>
          )}

          <form onSubmit={handleVerifySubmit} className="verify-form" style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              className="verify-input"
              placeholder="Verify Any Wallet..."
              value={verifyWalletInput}
              onChange={(e) => setVerifyWalletInput(e.target.value)}
              style={{
                background: '#060709',
                border: '1px solid #1c2230',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                width: '180px',
              }}
            />
            <button
              type="submit"
              disabled={!verifyWalletInput.trim()}
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                opacity: verifyWalletInput.trim() ? 1 : 0.5,
                cursor: verifyWalletInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Verify
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
