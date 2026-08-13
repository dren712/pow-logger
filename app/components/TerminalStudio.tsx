'use client'

import React, { useState } from 'react'
import { classifyLog } from '@/app/lib/classifier'
import { buildCanonicalSubmitMessage } from '@/app/lib/canonicalMessage'

export interface ProofTemplate {
  id: string
  label: string
  icon: string
  desc: string
  placeholder: string
  defaultPrefix: string
}

export const PROOF_TEMPLATES: ProofTemplate[] = [
  {
    id: 'shipped',
    label: 'Shipped Code',
    icon: '🚀',
    desc: 'Feature implementation or subsystem',
    placeholder: 'Shipped WebSocket real-time subscription feed for Solana DEX terminal...',
    defaultPrefix: 'Shipped ',
  },
  {
    id: 'bugfix',
    label: 'Bug Fix',
    icon: '🐛',
    desc: 'Issue patch or vulnerability resolution',
    placeholder: 'Fixed signature replay edge case in Base58 nonce decoding pipeline...',
    defaultPrefix: 'Fixed ',
  },
  {
    id: 'rfc',
    label: 'Research / RFC',
    icon: '🔬',
    desc: 'Technical specification or design doc',
    placeholder: 'Authored technical specification for Concurrent Merkle Tree off-chain indexing...',
    defaultPrefix: 'Research RFC: ',
  },
  {
    id: 'opensource',
    label: 'Open Source',
    icon: '🐙',
    desc: 'Upstream pull request or library',
    placeholder: 'Contributed upstream pull request to @solana/web3.js improving Base58 parsing...',
    defaultPrefix: 'Open Source PR: ',
  },
  {
    id: 'release',
    label: 'Product Release',
    icon: '📦',
    desc: 'Version delivery or production tag',
    placeholder: 'Released v1.2.0 production build with zero-latency export studio...',
    defaultPrefix: 'Released v',
  },
  {
    id: 'docs',
    label: 'Documentation',
    icon: '🤝',
    desc: 'Developer guide or API docs',
    placeholder: 'Published technical developer guide for PROVN SDK policy verification...',
    defaultPrefix: 'Docs: ',
  },
  {
    id: 'hackathon',
    label: 'Hackathon Work',
    icon: '🏆',
    desc: 'Project submission or hackathon demo',
    placeholder: 'Built decentralized evidence packet generator for Solana hackathon...',
    defaultPrefix: 'Hackathon: ',
  },
  {
    id: 'custom',
    label: 'Custom Claim',
    icon: '⚡',
    desc: 'Freeform engineering attestation',
    placeholder: 'Describe what you built or fixed in 1–2 clear sentences...',
    defaultPrefix: '',
  },
]

interface TerminalStudioProps {
  log: string
  setLog: (val: string) => void
  evidenceUrl: string
  setEvidenceUrl: (val: string) => void
  githubUrl: string
  setGithubUrl: (val: string) => void
  loading: boolean
  connected: boolean
  walletAddress?: string
  isDailyLimitReached: boolean
  statusStep: 'idle' | 'saving' | 'storing' | 'success' | 'error'
  statusMsg: string
  onSubmitLog: () => void
  maxChars: number
}

export default function TerminalStudio({
  log,
  setLog,
  evidenceUrl,
  setEvidenceUrl,
  githubUrl,
  setGithubUrl,
  loading,
  connected,
  walletAddress,
  isDailyLimitReached,
  statusStep,
  statusMsg,
  onSubmitLog,
  maxChars,
}: TerminalStudioProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [showRawPayload, setShowRawPayload] = useState(false)
  const [showEvidenceHelper, setShowEvidenceHelper] = useState(false)

  const liveClassification = log.trim() ? classifyLog(log.trim()) : null
  const charPercent = Math.min(100, Math.round((log.length / maxChars) * 100))

  const handleSelectTemplate = (template: ProofTemplate) => {
    setSelectedTemplate(template.id)
    if (!log.trim() && template.defaultPrefix) {
      setLog(template.defaultPrefix)
    }
  }

  // Canonical Message Preview Construction
  const previewDomain = typeof window !== 'undefined' && window.location?.host ? window.location.host : 'provn-sol.vercel.app'
  const previewMessage = buildCanonicalSubmitMessage({
    domain: previewDomain,
    walletAddress: walletAddress || 'YOUR_SOLANA_WALLET_PUBLIC_KEY',
    timestamp: new Date().toISOString(),
    nonce: 'PREVIEW_BASE58_NONCE_7x9...',
    content: log.trim() || 'Your work claim description will appear here.',
    githubUrl: githubUrl.trim() || undefined,
    evidenceUrl: evidenceUrl.trim() || undefined,
  })

  const handleReviewAndSign = () => {
    if (!log.trim() || !connected || isDailyLimitReached) return
    setIsPreviewOpen(true)
  }

  const handleConfirmSign = () => {
    setIsPreviewOpen(false)
    onSubmitLog()
  }

  const walletShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : ''

  return (
    <section
      id="create-proof"
      className="terminal-card"
      style={{
        padding: '24px 22px',
        marginBottom: '36px',
      }}
    >
      <div className="corner-accent corner-top-left" />
      <div className="corner-accent corner-top-right" />
      <div className="corner-accent corner-bottom-left" />
      <div className="corner-accent corner-bottom-right" />

      {/* Terminal Title Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              PROVN / EVIDENCE TERMINAL
            </h2>
            <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              Create cryptographic proof record
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: connected ? '#00ff88' : 'var(--text-faint)', fontWeight: 600 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? '#00ff88' : '#555' }} />
          <span>{connected ? '[READY TO ATTEST]' : '[WALLET REQUIRED]'}</span>
        </div>
      </div>

      {/* Contribution Category Cards Selector */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          What did you build?
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
          }}
        >
          {PROOF_TEMPLATES.map((tmpl) => {
            const isActive = selectedTemplate === tmpl.id
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tmpl)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(0, 255, 136, 0.08)' : 'var(--bg-base)',
                  border: isActive ? '1px solid #00ff88' : '1px solid var(--border-subtle)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>{tmpl.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isActive ? '#00ff88' : 'var(--text-main)' }}>
                    {tmpl.label}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', lineHeight: 1.3 }}>
                  {tmpl.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Claim Text Input */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            Describe the contribution
          </label>
          <span style={{ fontSize: '11px', color: log.length > maxChars ? 'var(--accent-danger)' : charPercent > 80 ? 'var(--accent-achievement)' : 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {log.length} / {maxChars}
          </span>
        </div>
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder={
            PROOF_TEMPLATES.find((t) => t.id === selectedTemplate)?.placeholder ||
            'Describe what you built or fixed in 1–2 clear sentences...'
          }
          rows={3}
          style={{
            width: '100%',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '12px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
        />

        {/* Live Detected Heuristic Tags */}
        {liveClassification && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Detected from description:</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(0,255,136,0.08)',
                border: '1px solid rgba(0,255,136,0.25)',
                color: '#00ff88',
                fontWeight: 600,
              }}
            >
              {liveClassification.category}
            </span>
            {liveClassification.skills.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  color: '#00e5ff',
                }}
              >
                {s}
              </span>
            ))}
            {liveClassification.protocols.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(171, 159, 242, 0.08)',
                  border: '1px solid rgba(171, 159, 242, 0.25)',
                  color: '#ab9ff2',
                }}
              >
                ⚡ {p}
              </span>
            ))}
            <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontStyle: 'italic', marginLeft: 'auto' }}>
              Heuristic tags · not independently verified
            </span>
          </div>
        )}
      </div>

      {/* Supporting Evidence Inputs */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Supporting Evidence (Optional)
          </div>
          <button
            type="button"
            onClick={() => setShowEvidenceHelper(!showEvidenceHelper)}
            style={{ background: 'none', border: 'none', color: '#00e5ff', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showEvidenceHelper ? 'Hide explanation' : 'Why add evidence?'}
          </button>
        </div>

        {showEvidenceHelper && (
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '10px 12px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.45 }}>
            💡 <strong>Evidence Coverage:</strong> Attaching public GitHub PRs, commits, or demo URLs binds them into your canonical signed envelope. DAOs and grant committees filter for evidence-backed records.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-faint)', fontSize: '11px', marginBottom: '4px' }}>
              GitHub PR / Commit URL
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/org/repo/pull/1"
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#ab9ff2',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-faint)', fontSize: '11px', marginBottom: '4px' }}>
              Live Demo / Evidence Link
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://my-app.vercel.app"
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#00e5ff',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {statusStep !== 'idle' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            background:
              statusStep === 'error'
                ? 'rgba(255, 68, 68, 0.08)'
                : statusStep === 'success'
                ? 'rgba(0, 255, 136, 0.08)'
                : 'rgba(0, 229, 255, 0.08)',
            border:
              statusStep === 'error'
                ? '1px solid rgba(255, 68, 68, 0.3)'
                : statusStep === 'success'
                ? '1px solid rgba(0, 255, 136, 0.3)'
                : '1px solid rgba(0, 229, 255, 0.3)',
            color:
              statusStep === 'error'
                ? 'var(--accent-danger)'
                : statusStep === 'success'
                ? '#00ff88'
                : '#00e5ff',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* Quota & Attestation Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '8px' }}>
        <div style={{ fontSize: '11px', color: isDailyLimitReached ? 'var(--accent-danger)' : 'var(--text-faint)' }}>
          {isDailyLimitReached ? '🔒 Daily quota reached (3/3 today)' : '3 proofs per day quota · Free tier'}
        </div>

        <button
          onClick={handleReviewAndSign}
          disabled={loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars}
          className="btn-primary"
          style={{
            padding: '10px 22px',
            fontSize: '13px',
            fontWeight: 700,
            opacity: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 0.5 : 1,
            cursor: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? '⚡ Awaiting Wallet Signature...'
            : isDailyLimitReached
            ? 'Daily Quota Reached'
            : !connected
            ? 'Connect Wallet to Sign'
            : 'Review & Sign Proof →'}
        </button>
      </div>

      {/* Two-Layer Review → Sign Experience Modal */}
      {isPreviewOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="terminal-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {/* Step Ceremony Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-faint)' }}>01 CLAIM</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#00ff88' }}>02 SIGN</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-faint)' }}>03 VERIFY</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                Review Proof Statement
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                You are about to sign this statement using your connected Solana wallet.
              </p>
            </div>

            {/* Layer 1: Human-Readable Summary */}
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
                Claim Statement
              </div>
              <div style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.5, marginBottom: '12px', fontWeight: 500 }}>
                &ldquo;{log.trim()}&rdquo;
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '11px' }}>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Signer: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#00ff88' }}>{walletShort || 'Connected Wallet'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Domain: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#00e5ff' }}>{previewDomain}</span>
                </div>
                {githubUrl.trim() && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-faint)' }}>GitHub: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#ab9ff2', wordBreak: 'break-all' }}>{githubUrl.trim()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Layer 2: Expandable Raw Canonical Message */}
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowRawPayload(!showRawPayload)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00e5ff',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{showRawPayload ? '▾ Hide' : '▸ View'} canonical protocol payload (SIWS)</span>
              </button>

              {showRawPayload && (
                <pre
                  style={{
                    marginTop: '8px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '10px',
                    color: '#00ff88',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.45',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {previewMessage}
                </pre>
              )}
            </div>

            {/* Clear Attestation Disclaimer */}
            <div
              style={{
                background: 'rgba(255, 184, 0, 0.06)',
                border: '1px solid rgba(255, 184, 0, 0.2)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--accent-achievement)',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              ℹ️ <strong>Protocol Guarantee:</strong> Your Solana wallet is signing this tamper-evident proof statement. Your wallet is <em>not</em> signing your source code.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="btn-secondary"
              >
                ← Edit Draft
              </button>
              <button
                type="button"
                onClick={handleConfirmSign}
                className="btn-primary"
              >
                Sign with Solana Wallet →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
