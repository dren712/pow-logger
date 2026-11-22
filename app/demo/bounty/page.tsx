'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EligibilityEvaluation } from '@/app/lib/types'
import { STANDARD_POLICY_PRESETS } from '@/app/lib/policyEngine'
import SiteNav from '@/app/components/SiteNav'

const SAMPLE_WALLET = 'AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p'

function formatValue(value: number | string | boolean | string[]) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function Mark({ passed }: { passed: boolean }) {
  const color = passed ? '#2ee59d' : '#f5c451'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      {passed ? (
        <path d="M7.5 12.5l3 3 6-6.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  )
}

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

  const requirements = [
    activePolicy.minVerifiedProofs && `At least ${activePolicy.minVerifiedProofs} verified proofs`,
    activePolicy.minRecentProofs && `At least ${activePolicy.minRecentProofs} verified proof in the last 30 days`,
    activePolicy.minStreak && `A daily building streak of at least ${activePolicy.minStreak} days`,
    activePolicy.requiredProtocols && `Protocol experience: ${activePolicy.requiredProtocols.join(', ')}`,
    activePolicy.requiredSkills && `Technical skills: ${activePolicy.requiredSkills.join(', ')}`,
    activePolicy.requireGithubSource && 'Public GitHub evidence attached (pull request or commit)',
    activePolicy.requireVerifiedGithubAttribution && 'Verified GitHub author attribution',
    activePolicy.requireArchivedProof && 'At least one proof permanently archived on Arweave',
  ].filter((r): r is string => Boolean(r))

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-8 lg:py-12">
        <header>
          <p className="pv-eyebrow">Integration demo</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">Policy eligibility check</h1>
          <p className="pv-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
            A reference example of how a bounty platform, DAO or grant committee could use the PROVN policy evaluation API to
            check a builder&rsquo;s wallet against a set of requirements. The policies and reward shown here are examples, not live programmes.
          </p>
        </header>

        <section className="pv-card p-5 sm:p-6" aria-labelledby="policy-heading">
          <h2 id="policy-heading" className="pv-h2">1. Choose an example policy</h2>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="group" aria-labelledby="policy-heading">
            {Object.entries(STANDARD_POLICY_PRESETS).map(([key, preset]) => {
              const isSelected = selectedPreset === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedPreset(key)
                    setEvaluation(null)
                  }}
                  className={`rounded-xl border p-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2ee59d] ${
                    isSelected ? 'border-[#2ee59d] bg-[rgba(46,229,157,0.06)]' : 'border-[#272e3a] bg-[#080a0e] hover:border-[#3a4352]'
                  }`}
                >
                  <span className="block text-[14px] font-semibold text-white">{preset.name}</span>
                  <span className="pv-muted mt-1 block text-[12px]">
                    Min {preset.minVerifiedProofs || 0} {preset.minVerifiedProofs === 1 ? "proof" : "proofs"}, {preset.minStreak || 0}-day streak
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-[#1c222c] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="pv-faint text-[12px]">Selected policy</p>
                <p className="mt-1 text-[16px] font-semibold text-white">{activePolicy.name}</p>
              </div>
              <div className="sm:text-right">
                <p className="pv-faint text-[12px]">Example reward</p>
                <p className="mt-1 text-[16px] font-semibold text-white">$2,500 USDC</p>
              </div>
            </div>
            <p className="pv-faint mt-4 text-[12px]">Requirements</p>
            {requirements.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2 text-[14px] text-[#c3cad6]">
                {requirements.map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#2ee59d]" aria-hidden="true" />
                    <span className="min-w-0 break-words">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pv-muted mt-2 text-[14px]">This policy has no requirements.</p>
            )}
          </div>
        </section>

        <section className="pv-card p-5 sm:p-6" aria-labelledby="evaluate-heading">
          <h2 id="evaluate-heading" className="pv-h2">2. Evaluate a wallet</h2>
          <form onSubmit={handleCheckEligibility} className="mt-4">
            <label htmlFor="wallet" className="pv-muted block text-[13px]">Solana wallet address</label>
            <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
              <input
                id="wallet"
                type="text"
                placeholder="Base58 address"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="pv-input pv-mono min-w-0 flex-1 !pl-3.5 !text-[13px]"
              />
              <button type="submit" disabled={loading} className="pv-btn">
                {loading ? 'Evaluating...' : 'Evaluate policy'}
              </button>
            </div>
            <p className="pv-muted mt-2.5 text-[13px]">
              No wallet to hand?{' '}
              <button
                type="button"
                onClick={() => handleUseSampleWallet(SAMPLE_WALLET)}
                className="rounded text-[#2ee59d] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2ee59d]"
              >
                Use the example wallet
              </button>
            </p>
          </form>

          <div className="mt-5" aria-live="polite">
            {loading && (
              <div className="flex flex-col gap-2.5" aria-label="Evaluating policy">
                <div className="pv-skeleton h-12" />
                <div className="pv-skeleton h-10" />
                <div className="pv-skeleton h-10" />
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-[rgba(255,123,123,0.4)] bg-[rgba(255,123,123,0.07)] px-4 py-3 text-[14px] text-[#ff9c9c]">
                <p className="font-semibold">The policy could not be evaluated</p>
                <p className="mt-1 break-words text-[13px] text-[#e3b5b5]">{error}</p>
              </div>
            )}

            {!loading && !error && !evaluation && (
              <p className="pv-faint rounded-xl border border-dashed border-[#272e3a] px-4 py-6 text-center text-[13px]">
                Enter a wallet address to see which requirements it meets.
              </p>
            )}

            {evaluation && (
              <div className="overflow-hidden rounded-xl border border-[#1c222c]">
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  style={{
                    background: evaluation.eligible ? 'rgba(46, 229, 157, 0.07)' : 'rgba(245, 196, 81, 0.07)',
                    color: evaluation.eligible ? '#2ee59d' : '#f5c451',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <Mark passed={evaluation.eligible} />
                    <div>
                      <p className="text-[15px] font-semibold">{evaluation.eligible ? 'Eligible' : 'Not eligible'}</p>
                      <p className="text-[13px] text-[#c3cad6]">
                        {evaluation.eligible ? 'This wallet meets every requirement of the policy.' : 'This wallet is missing one or more requirements.'}
                      </p>
                    </div>
                  </div>
                  <span className="pv-chip">
                    {evaluation.summary.passedCount} of {evaluation.summary.totalChecks} checks passed
                  </span>
                </div>

                <ul className="divide-y divide-[#1c222c] border-t border-[#1c222c]">
                  {evaluation.checks.map((check) => (
                    <li key={check.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                      <div className="flex min-w-0 gap-2.5">
                        <Mark passed={check.passed} />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-white">{check.label}</p>
                          <p className="sr-only">{check.passed ? 'Passed' : 'Not met'}</p>
                        </div>
                      </div>
                      <dl className="pv-muted grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pl-7 text-[12px] sm:max-w-[45%] sm:pl-0">
                        <dt className="pv-faint">Actual</dt>
                        <dd className="break-words text-[#c3cad6]">{formatValue(check.actual)}</dd>
                        <dt className="pv-faint">Required</dt>
                        <dd className="break-words text-[#c3cad6]">{formatValue(check.required)}</dd>
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="pv-muted flex flex-wrap items-center justify-between gap-2 border-t border-[#1c222c] px-4 py-3 text-[12px]">
                  <span>Evaluated at {new Date(evaluation.evaluatedAt).toLocaleTimeString()}</span>
                  <Link href={`/u/${evaluation.wallet}`} className="rounded text-[#2ee59d] hover:underline">
                    View builder passport
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
