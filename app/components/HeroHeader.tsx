'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WalletMultiButton from './WalletButton'

interface NetworkStats {
  totalBuilders: number
  totalProofs: number
  totalArchived: number
}

interface HeroHeaderProps {
  connected: boolean
  walletAddress?: string
}

const RELATED = [
  { href: '/agent-proof', label: 'PROVN Verify' },
  { href: '/docs/agent-sdk', label: 'Agent SDK' },
  { href: '/docs/api', label: 'API docs' },
  { href: '/demo/bounty', label: 'Bounty demo' },
  { href: '/admin/evidence', label: 'Evidence' },
]

export default function HeroHeader({ connected, walletAddress }: HeroHeaderProps) {
  const [verifyWalletInput, setVerifyWalletInput] = useState('')
  const [stats, setStats] = useState<NetworkStats | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.totalBuilders === 'number') setStats(data)
      })
      .catch(console.error)
  }, [])

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyWalletInput.trim()) {
      window.location.href = `/u/${verifyWalletInput.trim()}`
    }
  }

  const walletShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : ''

  return (
    <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col items-start gap-4">
        <p className="pv-eyebrow">Proof logger · Solana</p>
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[38px]">
          Log a signed proof of your work
        </h1>
        <p className="pv-muted max-w-xl text-[15px] leading-relaxed">
          Describe what you shipped and sign it with your Solana wallet. The signature ties the statement to your
          wallet and a timestamp, so anyone can check who wrote it and that it was not changed. Records can also be
          archived to Arweave.
        </p>

        {connected && walletAddress ? (
          <div className="flex w-full flex-wrap items-center gap-3">
            <WalletMultiButton />
            <Link href={`/u/${walletAddress}`} className="pv-btn-ghost !h-10 !py-0" aria-label={`View passport for wallet ${walletShort}`}>
              View my passport
            </Link>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
            <WalletMultiButton />
            <span className="pv-faint text-[13px]">Signing a message is free. No transaction is sent.</span>
          </div>
        )}

        <nav aria-label="Related tools" className="pv-muted flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[13px]">
          {RELATED.map((l) => (
            <Link key={l.href} href={l.href} className="pv-link !text-[#8a93a3] hover:!text-[#2ee59d]">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <aside className="pv-card p-5">
        <form onSubmit={handleVerifySubmit} className="flex flex-col gap-2">
          <label htmlFor="lookup-wallet" className="pv-h2">
            Look up a wallet
          </label>
          <p className="pv-muted text-[13px] leading-relaxed">Open the public passport for any Solana address.</p>
          <div className="mt-1 flex gap-2">
            <input
              id="lookup-wallet"
              type="text"
              placeholder="Wallet address"
              value={verifyWalletInput}
              onChange={(e) => setVerifyWalletInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pv-input lg-field pv-mono min-w-0 flex-1 !py-2 !text-[13px]"
            />
            <button type="submit" disabled={!verifyWalletInput.trim()} className="pv-btn-ghost lg-lookup shrink-0 !py-2 disabled:cursor-not-allowed disabled:opacity-50">
              Open
            </button>
          </div>
        </form>

        {stats && (
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[#1c222c] pt-4">
            {[
              [stats.totalBuilders, 'wallets'],
              [stats.totalProofs, 'proofs'],
              [stats.totalArchived, 'archived'],
            ].map(([value, label]) => (
              <div key={label} className="min-w-0">
                <dd className="truncate text-[18px] font-semibold leading-none text-white">{value}</dd>
                <dt className="pv-muted mt-1.5 text-[12px]">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </header>
  )
}
