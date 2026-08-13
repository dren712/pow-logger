'use client'

import React, { useState } from 'react'
import { classifyLog } from '@/app/lib/classifier'
import { buildCanonicalSubmitMessage } from '@/app/lib/canonicalMessage'

export interface ProofTemplate {
  id: string
  label: string
  icon: string
  placeholder: string
  defaultPrefix: string
}

export const PROOF_TEMPLATES: ProofTemplate[] = [
  {
    id: 'shipped',
    label: 'Shipped Code',
    icon: '🚀',
    placeholder: 'Shipped WebSocket real-time subscription feed for Solana DEX terminal...',
    defaultPrefix: 'Shipped ',
  },
  {
    id: 'bugfix',
    label: 'Bug Fix',
    icon: '🐛',
    placeholder: 'Fixed signature replay edge case in Base58 nonce decoding pipeline...',
    defaultPrefix: 'Fixed ',
  },
  {
    id: 'rfc',
    label: 'Research / RFC',
    icon: '🔬',
    placeholder: 'Authored technical specification for Concurrent Merkle Tree off-chain indexing...',
    defaultPrefix: 'Research RFC: ',
  },
  {
    id: 'opensource',
    label: 'Open Source',
    icon: '🐙',
    placeholder: 'Contributed upstream pull request to @solana/web3.js improving Base58 parsing...',
    defaultPrefix: 'Open Source PR: ',
  },
  {
    id: 'release',
    label: 'Product Release',
    icon: '📦',
    placeholder: 'Released v1.2.0 production build with zero-latency export studio...',
    defaultPrefix: 'Released v',
  },
  {
    id: 'docs',
    label: 'Docs / Community',
    icon: '🤝',
    placeholder: 'Published technical developer guide for PROVN SDK policy verification...',
    defaultPrefix: 'Docs: ',
  },
  {
    id: 'hackathon',
    label: 'Hackathon Work',
    icon: '🏆',
    placeholder: 'Built decentralized evidence packet generator for Solana ecosystem hackathon...',
    defaultPrefix: 'Hackathon: ',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '⚡',
    placeholder: 'Describe your technical engineering contribution on Solana...',
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

  return (
    <section
      id="log-terminal"
      className="terminal-card"
      style={{
        padding: '22px',
        marginBottom: '36px',
      }}
    >
      <div className="corner-accent corner-top-left" />
      <div className="corner-accent corner-top-right" />

      {/* Terminal Title Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #161a24',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
          <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>PROVN_EVIDENCE_STUDIO_v1.0</span>
        </div>
        <div style={{ color: '#00ff88', fontSize: '11px' }}>[READY TO ATTEST]</div>
      </div>

      {/* Proof Templates Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select Contribution Type:
        </div>
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
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
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(0, 255, 136, 0.12)' : '#0a0d14',
                  border: isActive ? '1px solid rgba(0, 255, 136, 0.5)' : '1px solid #1c2230',
                  color: isActive ? '#00ff88' : '#888',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tmpl.icon}</span>
                <span>{tmpl.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Log Input Area */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
          <span>Describe your work output...</span>
          <span style={{ color: log.length > maxChars ? '#ff4444' : charPercent > 80 ? '#ffb800' : '#888' }}>
            {log.length}/{maxChars}
          </span>
        </div>
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder={
            PROOF_TEMPLATES.find((t) => t.id === selectedTemplate)?.placeholder ||
            'e.g. Built TweetNaCl SIWS verification logic, deployed RLS security migration, tested Arweave archival...'
          }
          rows={3}
          style={{
            width: '100%',
            background: '#060709',
            border: '1px solid #1c2230',
            borderRadius: '6px',
            color: '#00ff88',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Live Auto-Classifier Tag Badge */}
        {liveClassification && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#555' }}>CLASSIFIED:</span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.3)',
                color: '#00ff88',
                fontWeight: 700,
              }}
            >
              {liveClassification.category}
            </span>
            {liveClassification.skills.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#0d1117',
                  border: '1px solid #1c2230',
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
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(171, 159, 242, 0.1)',
                  border: '1px solid rgba(171, 159, 242, 0.3)',
                  color: '#ab9ff2',
                }}
              >
                ⚡ {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Optional Proof URLs Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', color: '#888', fontSize: '10px', marginBottom: '4px' }}>
            GitHub PR / Commit URL (Self-attested evidence)
          </label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo/pull/1"
            style={{
              width: '100%',
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              color: '#ab9ff2',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#888', fontSize: '10px', marginBottom: '4px' }}>
            Evidence / Demo URL (Optional HTTPS Link)
          </label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://my-app.vercel.app"
            style={{
              width: '100%',
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              color: '#00e5ff',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
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
                ? 'rgba(255, 68, 68, 0.1)'
                : statusStep === 'success'
                ? 'rgba(0, 255, 136, 0.1)'
                : 'rgba(0, 229, 255, 0.1)',
            border:
              statusStep === 'error'
                ? '1px solid rgba(255, 68, 68, 0.3)'
                : statusStep === 'success'
                ? '1px solid rgba(0, 255, 136, 0.3)'
                : '1px solid rgba(0, 229, 255, 0.3)',
            color:
              statusStep === 'error'
                ? '#ff4444'
                : statusStep === 'success'
                ? '#00ff88'
                : '#00e5ff',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* Review & Preview Button */}
      <button
        onClick={handleReviewAndSign}
        disabled={loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars}
        className="btn-primary"
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '13px',
          fontWeight: 800,
          opacity: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 0.5 : 1,
          cursor: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? '⚡ Processing SIWS Cryptographic Signature...'
          : isDailyLimitReached
          ? '🔒 Daily Limit Reached (3/3 logs today)'
          : !connected
          ? '🔌 Connect Solana Wallet to Log Proof'
          : '🔍 Review & Preview Signature →'}
      </button>

      {/* Draft → Review → Sign Modal */}
      {isPreviewOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#0c0e14',
              border: '1px solid #1f293d',
              borderRadius: '12px',
              maxWidth: '640px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              color: '#eee',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1c2230', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#00ff88' }}>Review Canonical Proof Statement</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Quality Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
              <div style={{ background: '#07080c', border: '1px solid #1c2230', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <div style={{ color: '#666' }}>SIGNER</div>
                <div style={{ color: '#00ff88', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Connected Wallet'}
                </div>
              </div>
              <div style={{ background: '#07080c', border: '1px solid #1c2230', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <div style={{ color: '#666' }}>ALGORITHM</div>
                <div style={{ color: '#00e5ff', fontWeight: 600 }}>Ed25519 Detached</div>
              </div>
              <div style={{ background: '#07080c', border: '1px solid #1c2230', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <div style={{ color: '#666' }}>STORAGE</div>
                <div style={{ color: '#ab9ff2', fontWeight: 600 }}>Arweave via Irys</div>
              </div>
            </div>

            {/* Canonical SIWS Message Box */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                Exact Message Payload for Wallet Signature:
              </div>
              <pre
                style={{
                  background: '#040507',
                  border: '1px solid #161b26',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#00ff88',
                  lineHeight: '1.45',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {previewMessage}
              </pre>
            </div>

            {/* Clear Disclaimer */}
            <div
              style={{
                background: 'rgba(255, 184, 0, 0.08)',
                border: '1px solid rgba(255, 184, 0, 0.3)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#ffb800',
                marginBottom: '20px',
                lineHeight: '1.4',
              }}
            >
              ℹ️ <strong>Attestation Guarantee:</strong> Your Solana wallet is signing this tamper-evident proof statement. Your wallet is <em>not</em> signing your source code.
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  background: '#161b26',
                  border: '1px solid #283144',
                  color: '#ccc',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                ← Edit Draft
              </button>
              <button
                type="button"
                onClick={handleConfirmSign}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🗿 Sign With Wallet & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
