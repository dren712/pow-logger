'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BuilderReputation } from '@/app/lib/types'

export default function BountyDemoPage() {
  const [wallet, setWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [reputation, setReputation] = useState<BuilderReputation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheckEligibility = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet.trim()) return

    setLoading(true)
    setError(null)
    setReputation(null)

    try {
      const res = await fetch(`/api/passport/${wallet.trim()}`)
      if (!res.ok) {
        throw new Error('Builder Passport not found. Please log proofs first.')
      }
      const data = await res.json()
      setReputation(data.reputation)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Verification failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const isEligible = reputation ? reputation.currentStreak >= 7 && reputation.totalProofs >= 3 : false

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <div>
          <Link href="/" className="text-xs font-mono text-emerald-400 hover:underline mb-2 block">
            ← Back to PROVN Terminal
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <h1 className="text-2xl font-bold font-mono text-white">Ecosystem Bounty Integration Demo</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Simulated demonstration showing how Superteam Earn or Solana bounty platforms check PROVN reputation to programmatically verify developer eligibility.
          </p>
        </div>

        {/* Bounty Card */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                SIMULATED BOUNTY
              </span>
              <h2 className="text-base sm:text-lg font-bold font-mono text-white mt-2">
                Solana Developer Tooling & Security Infrastructure
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-emerald-400 font-mono font-bold text-lg">$2,500 USDC</div>
              <div className="text-[10px] text-gray-500 font-mono">Bounty Reward</div>
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-3">
            <div className="text-xs font-mono text-gray-400 font-bold mb-2">PROVN Gating Requirements:</div>
            <ul className="text-xs font-mono space-y-1 text-gray-300">
              <li>• Minimum 7-Day Verified Active Streak 🔥</li>
              <li>• Minimum 3 Verified Cryptographic Proofs ⚡</li>
              <li>• Attested Solana / Web3 Skills 🟣</li>
            </ul>
          </div>
        </div>

        {/* Verification Form */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold font-mono text-white">Check Your Eligibility</h3>
          <form onSubmit={handleCheckEligibility} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Enter Solana Wallet Address..."
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="flex-1 bg-[#08080c] border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Verify Eligibility'}
            </button>
          </form>

          {error && <div className="text-xs font-mono text-red-400 bg-red-950/40 p-3 rounded-lg">{error}</div>}

          {reputation && (
            <div
              className={`p-4 rounded-xl border font-mono text-xs space-y-3 ${
                isEligible
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-yellow-950/20 border-yellow-500/40 text-yellow-300'
              }`}
            >
              <div className="flex justify-between items-center font-bold">
                <span>Status: {isEligible ? '✅ ELIGIBLE TO SUBMIT' : '⚠️ REQUIREMENTS NOT MET'}</span>
                <span className="text-[10px] bg-black/40 px-2 py-1 rounded">
                  Streak: {reputation.currentStreak}d • Proofs: {reputation.totalProofs}
                </span>
              </div>
              <p className="text-[11px] text-gray-300">
                {isEligible
                  ? 'Your PROVN Builder Passport satisfies the programmatic reputation gate for this bounty.'
                  : `Requirement not satisfied. You need a 7-day streak (current: ${reputation.currentStreak}d) and 3 proofs (current: ${reputation.totalProofs}).`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
