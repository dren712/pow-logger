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
    <main
      style={{
        width: 'min(840px, 94vw)',
        margin: '0 auto',
        padding: '32px 16px 100px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <Link href="/" className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>
          ← Back to Terminal
        </Link>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>
            Ecosystem Policy & Verification Engine
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, margin: '6px 0 0 0' }}>
          Demonstrates how Superteam Earn, DAOs, and grant evaluators programmatically gate developer submissions using PROVN proof verification.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="terminal-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
          Select Evaluation Policy Preset:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
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
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: isSelected ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-base)',
                  border: isSelected ? '1px solid #00ff88' : '1px solid var(--border-subtle)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ color: isSelected ? '#00ff88' : 'var(--text-main)', fontSize: '12px', fontWeight: 700 }}>
                  {preset.name}
                </div>
                <div style={{ color: 'var(--text-faint)', fontSize: '11px', marginTop: '4px' }}>
                  Min {preset.minVerifiedProofs || 0} proofs • {preset.minStreak || 0}d streak
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Policy Requirements */}
      <div className="terminal-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', background: 'rgba(0, 229, 255, 0.1)', color: '#00e5ff', border: '1px solid rgba(0, 229, 255, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              POLICY CONTRACT: {activePolicy.name}
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '8px 0 0 0' }}>
              Programmatic Verification Rules
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>$2,500 USDC</div>
            <div style={{ color: 'var(--text-faint)', fontSize: '10px' }}>Example Bounty Allocation</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
            Policy Requirements:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
            {activePolicy.minVerifiedProofs && (
              <div>• Min {activePolicy.minVerifiedProofs} Verified Proofs</div>
            )}
            {activePolicy.minRecentProofs && (
              <div>• Min {activePolicy.minRecentProofs} Proof in last 30d</div>
            )}
            {activePolicy.minStreak && (
              <div>• Min {activePolicy.minStreak}-Day Building Streak</div>
            )}
            {activePolicy.requiredProtocols && (
              <div>• Required Protocol: {activePolicy.requiredProtocols.join(', ')}</div>
            )}
            {activePolicy.requireGithubEvidence && (
              <div>• Public GitHub Evidence Attached</div>
            )}
            {activePolicy.requireArchivedProof && (
              <div>• Confirmed Arweave Storage</div>
            )}
          </div>
        </div>
      </div>

      {/* Verification Evaluator Form */}
      <div className="terminal-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Evaluate Builder Wallet
          </h3>
          <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-faint)' }}>
            <span>Try sample:</span>
            <button
              type="button"
              onClick={() => handleUseSampleWallet('AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p')}
              style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Sample Builder
            </button>
          </div>
        </div>

        <form onSubmit={handleCheckEligibility} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Enter Solana Wallet Address (Base58)..."
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            style={{
              flex: 1,
              minWidth: '260px',
              background: 'var(--bg-base)',
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
            disabled={loading}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap', padding: '9px 16px' }}
          >
            {loading ? 'Evaluating...' : 'Evaluate Policy →'}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: 'rgba(255, 68, 68, 0.08)', border: '1px solid rgba(255, 68, 68, 0.3)', color: 'var(--accent-danger)', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {evaluation && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '8px',
              background: evaluation.eligible ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 184, 0, 0.04)',
              border: evaluation.eligible ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(255, 184, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ color: evaluation.eligible ? '#00ff88' : '#ffb800', fontWeight: 800, fontSize: '13px' }}>
                {evaluation.eligible ? '✓ ELIGIBLE (POLICY SATISFIED)' : '❌ INELIGIBLE (CRITERIA NOT MET)'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                Passed {evaluation.summary.passedCount} / {evaluation.summary.totalChecks} Checks
              </div>
            </div>

            {/* Checks Breakdown */}
            <div style={{ display: 'grid', gap: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginBottom: '12px' }}>
              {evaluation.checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-base)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{check.passed ? '✓' : '✗'}</span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{check.label}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                    Actual: {JSON.stringify(check.actual)} · Required: {JSON.stringify(check.required)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-faint)' }}>
              <span>Evaluated at {new Date(evaluation.evaluatedAt).toLocaleTimeString()}</span>
              <Link href={`/u/${evaluation.wallet}`} style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}>
                View Builder Passport →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
