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

export default function HeroHeader({ connected, walletAddress }: HeroHeaderProps) {
  const [verifyWalletInput, setVerifyWalletInput] = useState('')
  const [stats, setStats] = useState<NetworkStats | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
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
    <>
      {/* Top Architectural Navigation Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between pb-6 mb-8 border-b border-[#1e2533] gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity no-underline">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
              P
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-[#f0f4fc]">PROVN</span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#8b9bb4] ml-2 px-1.5 py-0.5 rounded bg-[#161b24] border border-[#212836]">
                v2.1 · agent/1
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <nav className="flex items-center gap-2 text-xs font-mono">
            <Link
              href="/agent-proof"
              className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-colors font-medium"
            >
              ⚡ Agent Console
            </Link>
            <Link
              href="/docs/agent-sdk"
              className="px-3 py-1.5 rounded-md text-[#8b9bb4] hover:text-[#f0f4fc] hover:bg-[#161b24] transition-colors"
            >
              SDK & CLI
            </Link>
            <Link
              href="/docs/api"
              className="px-3 py-1.5 rounded-md text-[#8b9bb4] hover:text-[#f0f4fc] hover:bg-[#161b24] transition-colors"
            >
              API Reference
            </Link>
            <Link
              href="/demo/bounty"
              className="px-3 py-1.5 rounded-md text-[#8b9bb4] hover:text-[#f0f4fc] hover:bg-[#161b24] transition-colors hidden sm:inline-block"
            >
              Bounties
            </Link>
            {connected && walletAddress && (
              <Link
                href={`/u/${walletAddress}`}
                className="px-3 py-1.5 rounded-md text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 transition-colors font-medium"
              >
                Passport ({walletShort}) ↗
              </Link>
            )}
          </nav>

          <div className="flex items-center">
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {!connected ? (
        <section className="provn-card p-8 md:p-10 mb-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Cryptographic Trust Infrastructure
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#f0f4fc] leading-tight mb-4">
              Verifiable Provenance for Autonomous Software & AI Agents
            </h1>

            <p className="text-sm md:text-base text-[#8b9bb4] max-w-2xl mx-auto leading-relaxed mb-8">
              Seal consequential execution traces with Ed25519 signatures, hash chains, and Merkle trees anchored to Solana and preserved on Arweave.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
              <Link href="/agent-proof" className="btn-primary">
                Explore Agent Console →
              </Link>
              <Link href="/agent-proof/demo" className="btn-secondary">
                Simulate Tamper Intrusion
              </Link>
            </div>

            {/* Passport Search */}
            <form onSubmit={handleVerifySubmit} className="flex max-w-md mx-auto gap-2 mb-8">
              <input
                type="text"
                placeholder="Inspect any Solana wallet passport..."
                value={verifyWalletInput}
                onChange={(e) => setVerifyWalletInput(e.target.value)}
                className="flex-1 bg-[#090b10] border border-[#212836] text-[#f0f4fc] px-3.5 py-2 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-[#57657d]"
              />
              <button
                type="submit"
                disabled={!verifyWalletInput.trim()}
                className="btn-secondary text-xs px-3.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Inspect
              </button>
            </form>

            {/* Telemetry Ticker */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#1e2533] max-w-lg mx-auto">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold font-mono text-[#f0f4fc]">
                    {stats.totalBuilders}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8b9bb4] mt-0.5">
                    Verified Entities
                  </div>
                </div>
                <div className="text-center border-x border-[#1e2533]">
                  <div className="text-xl md:text-2xl font-bold font-mono text-emerald-400">
                    {stats.totalProofs}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8b9bb4] mt-0.5">
                    Cryptographic Proofs
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold font-mono text-cyan-400">
                    {stats.totalArchived}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8b9bb4] mt-0.5">
                    Arweave Archives
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="provn-card p-3.5 px-4 mb-8 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[#8b9bb4]">Connected Authority:</span>
            <code className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {walletShort}
            </code>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/u/${walletAddress}`}
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Open 3D Passport & Studio →
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
