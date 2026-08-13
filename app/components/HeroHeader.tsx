'use client'

import { useState } from 'react'
import Link from 'next/link'
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

  const walletShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : ''

  return (
    <>
      {/* Header Navigation Bar */}
      <header
        className="header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid #161a24',
        }}
      >
        <div>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ color: '#00ff88', margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              PROVN
            </h1>
            <span style={{ fontSize: '18px' }}>🗿</span>
          </Link>
          <p style={{ color: '#667', margin: '4px 0 0 0', fontSize: '11px', letterSpacing: '0.2px' }}>
            Solana Proof-of-Work Protocol • Permanent Arweave Archival
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <nav style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-geist-mono), monospace' }}>
            <Link href="/docs/api" style={{ color: '#889', textDecoration: 'none', transition: 'color 0.15s' }}>
              API Docs
            </Link>
            <Link href="/demo/bounty" style={{ color: '#889', textDecoration: 'none', transition: 'color 0.15s' }}>
              Bounties
            </Link>
            <Link href="/admin/evidence" style={{ color: '#889', textDecoration: 'none', transition: 'color 0.15s' }}>
              Evidence
            </Link>
            {connected && walletAddress && (
              <Link
                href={`/u/${walletAddress}`}
                style={{
                  color: '#00e5ff',
                  textDecoration: 'none',
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(0, 229, 255, 0.4)',
                }}
              >
                My Passport ({walletShort}) ↗
              </Link>
            )}
          </nav>
          <WalletMultiButton />
        </div>
      </header>

      {/* Clean Intro Banner */}
      {!connected ? (
        <section
          className="glass-card"
          style={{
            marginBottom: '28px',
            padding: '24px 20px',
            borderRadius: '12px',
          }}
        >
          <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ color: '#f0f4fc', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              Cryptographic Proof-of-Work on Solana
            </h2>
            <p style={{ color: '#889', fontSize: '13px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              Sign daily engineering logs with your Ed25519 wallet. Immutable timestamped proofs, auto-classified skills, and permanent Arweave storage.
            </p>

            <form
              onSubmit={handleVerifySubmit}
              style={{
                display: 'flex',
                gap: '8px',
                maxWidth: '440px',
                margin: '0 auto',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <input
                type="text"
                placeholder="Inspect any Solana wallet passport..."
                value={verifyWalletInput}
                onChange={(e) => setVerifyWalletInput(e.target.value)}
                style={{
                  background: '#060709',
                  border: '1px solid #1c2230',
                  color: '#00ff88',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  flex: '1',
                  minWidth: '220px',
                  outline: 'none',
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
                Inspect Passport →
              </button>
            </form>
          </div>
        </section>
      ) : (
        <div
          style={{
            background: 'rgba(0, 255, 136, 0.04)',
            border: '1px solid rgba(0, 255, 136, 0.15)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ff88' }}>●</span>
            <span style={{ color: '#aaa' }}>Connected:</span>
            <code style={{ color: '#00ff88' }}>{walletShort}</code>
          </div>
          <Link
            href={`/u/${walletAddress}`}
            style={{
              color: '#00e5ff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '11px',
            }}
          >
            Open 3D Metallic Passport & Studio →
          </Link>
        </div>
      )}
    </>
  )
}
