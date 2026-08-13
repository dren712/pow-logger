'use client'

import React, { useState } from 'react'
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
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#00ff88', letterSpacing: '-0.5px' }}>
              PROVN
            </span>
          </Link>
          <span style={{ color: 'var(--text-faint)', fontSize: '11px', fontWeight: 600 }}>
            Builder Evidence Protocol 🗿
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <nav style={{ display: 'flex', gap: '14px', fontSize: '12px', fontWeight: 500 }}>
            <Link href="/docs/api" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}>
              API Docs
            </Link>
            <Link href="/demo/bounty" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}>
              Policy Demo
            </Link>
            <Link href="/admin/evidence" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}>
              Evidence
            </Link>
            {connected && walletAddress && (
              <Link
                href={`/u/${walletAddress}`}
                style={{
                  color: '#00e5ff',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                My Passport ({walletShort}) ↗
              </Link>
            )}
          </nav>
          <WalletMultiButton />
        </div>
      </header>

      {/* Disconnected Hero (10-Second High-Trust Understanding) */}
      {!connected ? (
        <section
          style={{
            marginBottom: '36px',
            padding: '32px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h1
              style={{
                color: '#ffffff',
                fontSize: 'clamp(2rem, 5vw, 2.6rem)',
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                margin: '0 0 12px 0',
              }}
            >
              Your work. Your wallet. Your proof.
            </h1>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: '0 auto 24px auto',
                maxWidth: '520px',
              }}
            >
              Create cryptographically signed proof-of-work records on Solana. Sealed with Ed25519 signatures and permanently archived on Arweave.
            </p>

            {/* 4-Step Protocol Flow */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                marginBottom: '28px',
                textAlign: 'left',
              }}
            >
              <div className="terminal-card" style={{ padding: '12px' }}>
                <div style={{ color: '#00ff88', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>01 SIGN</div>
                <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>Wallet Attestation</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Detached Ed25519 signature</div>
              </div>
              <div className="terminal-card" style={{ padding: '12px' }}>
                <div style={{ color: '#00e5ff', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>02 VERIFY</div>
                <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>Zero-Trust Engine</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Exact domain & nonces</div>
              </div>
              <div className="terminal-card" style={{ padding: '12px' }}>
                <div style={{ color: '#ab9ff2', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>03 ARCHIVE</div>
                <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>Arweave L1</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Decentralized receipts</div>
              </div>
              <div className="terminal-card" style={{ padding: '12px' }}>
                <div style={{ color: '#ffb800', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>04 SHARE</div>
                <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>Proof Packet</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>For grants & bounties</div>
              </div>
            </div>

            {/* Passport Search / Inspector */}
            <form
              onSubmit={handleVerifySubmit}
              style={{
                display: 'flex',
                gap: '8px',
                maxWidth: '480px',
                margin: '0 auto',
              }}
            >
              <input
                type="text"
                placeholder="Inspect any builder passport (Solana address)..."
                value={verifyWalletInput}
                onChange={(e) => setVerifyWalletInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap', padding: '9px 14px' }}
              >
                Inspect →
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </>
  )
}
