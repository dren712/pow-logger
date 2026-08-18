'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EligibilityEvaluation } from '@/app/lib/types'
import { STANDARD_POLICY_PRESETS } from '@/app/lib/policyEngine'

export default function BountyDemoPage() {
  const [wallet, setWallet] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('SUPERTEAM_BOUNTY')
  const [loading, setLoading] = useState(false)
  const [evaluation, setEvaluation] = useState<EligibilityEvaluation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activePolicy = STANDARD_POLICY_PRESETS[selectedPreset] || STANDARD_POLICY_PRESETS.SUPERTEAM_BOUNTY

  const handleCheckEligibility = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet.trim()) return

    setLoading(true)
    setError(null)
    setEvaluation(null)

    try {
      const res = await fetch('/api/eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.trim(),
          policy: activePolicy,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to evaluate eligibility')
      }

      const evalData: EligibilityEvaluation = await res.json()
      setEvaluation(evalData)
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

  const handleUseSampleWallet = (sampleAddr: string) => {
    setWallet(sampleAddr)
  }

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
            <h1 className="text-2xl font-bold font-mono text-white">Ecosystem Policy & Bounty Integration Demo</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Interactive reference implementation showing how Superteam Earn, DAOs, or grant committees use the PROVN Policy Evaluation API to programmatically gate developer submissions.
          </p>
        </div>

        {/* Policy Preset Selector */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-3">
          <div className="text-xs font-mono text-gray-400 font-bold uppercase tracking-wider">
            Select Evaluation Policy Preset:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(STANDARD_POLICY_PRESETS).map(([key, preset]) => {
              const isSelected = selectedPreset === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(key)
                    setEvaluation(null)
                  }}
                  className={`p-3 rounded-xl border text-left font-mono transition ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500 text-white'
                      : 'bg-[#0a0d14] border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-400">{preset.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Min {preset.minVerifiedProofs || 0} proofs • {preset.minStreak || 0}d streak
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Policy Card */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                EVALUATION POLICY: {activePolicy.name}
              </span>
              <h2 className="text-base sm:text-lg font-bold font-mono text-white mt-2">
                Policy Evaluation Example (Unofficial)
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-emerald-400 font-mono font-bold text-lg">$2,500 USDC</div>
              <div className="text-[10px] text-gray-500 font-mono">Bounty Reward / Allocation</div>
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-3">
            <div className="text-xs font-mono text-gray-400 font-bold mb-2">Declared Policy Requirements:</div>
            <ul className="text-xs font-mono space-y-1 text-gray-300">
              {activePolicy.minVerifiedProofs && (
                <li>• Minimum {activePolicy.minVerifiedProofs} Verified Cryptographic Proofs ⚡</li>
              )}
              {activePolicy.minRecentProofs && (
                <li>• Minimum {activePolicy.minRecentProofs} Verified Proof in the last 30 days 📊</li>
              )}
              {activePolicy.minStreak && (
                <li>• Minimum {activePolicy.minStreak}-Day Daily Building Streak 🔥</li>
              )}
              {activePolicy.requiredProtocols && (
                <li>• Required Protocol Experience: {activePolicy.requiredProtocols.join(', ')} 🌐</li>
              )}
              {activePolicy.requiredSkills && (
                <li>• Required Technical Skills: {activePolicy.requiredSkills.join(', ')} 🛠️</li>
              )}
              {activePolicy.requireGithubSource && (
                <li>• Public GitHub Evidence Attached (PR / Commit) 🐙</li>
              )}
              {activePolicy.requireVerifiedGithubAttribution && (
                <li>• Verified GitHub Author Attribution 🛡️</li>
              )}
              {activePolicy.requireArchivedProof && (
                <li>• Confirmed Arweave L1 Permanent Provenance 📦</li>
              )}
            </ul>
          </div>
        </div>

        {/* Verification Form */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold font-mono text-white">Evaluate Solana Wallet</h3>
            <div className="flex gap-2 text-[11px] font-mono text-gray-500">
              <span>Try sample:</span>
              <button
                type="button"
                onClick={() => handleUseSampleWallet('AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p')}
                className="text-emerald-400 hover:underline"
              >
                Sample Builder
              </button>
            </div>
          </div>

          <form onSubmit={handleCheckEligibility} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Enter Solana Wallet Address (Base58)..."
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="flex-1 bg-[#08080c] border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Evaluating Policy...' : 'Evaluate Policy →'}
            </button>
          </form>

          {error && <div className="text-xs font-mono text-red-400 bg-red-950/40 p-3 rounded-lg">{error}</div>}

          {evaluation && (
            <div
              className={`p-4 rounded-xl border font-mono text-xs space-y-4 ${
                evaluation.eligible
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-yellow-950/20 border-yellow-500/40 text-yellow-300'
              }`}
            >
              <div className="flex justify-between items-center font-bold">
                <span>
                  Status: {evaluation.eligible ? '✅ ELIGIBLE (POLICY SATISFIED)' : '❌ INELIGIBLE (REQUIREMENTS MISSING)'}
                </span>
                <span className="text-[10px] bg-black/40 px-2 py-1 rounded">
                  Passed {evaluation.summary.passedCount} / {evaluation.summary.totalChecks} Checks
                </span>
              </div>

              {/* Individual Checks Breakdown */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                {evaluation.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex justify-between items-start text-[11px] bg-black/30 p-2 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span>{check.passed ? '✅' : '❌'}</span>
                      <span className="text-white font-medium">{check.label}</span>
                    </div>
                    <div className="text-right text-[10px] text-gray-400">
                      <div>Actual: {JSON.stringify(check.actual)}</div>
                      <div>Required: {JSON.stringify(check.required)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-800 flex justify-between items-center">
                <span>Evaluated at {new Date(evaluation.evaluatedAt).toLocaleTimeString()}</span>
                <Link
                  href={`/u/${evaluation.wallet}`}
                  className="text-emerald-400 hover:underline"
                >
                  View Full Builder Passport →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
