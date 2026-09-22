'use client'

import React, { useState } from 'react'
import { classifyLog } from '@/app/lib/classifier'
import { buildCanonicalSubmitMessageV2 } from '@/app/lib/canonicalMessage'

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('shipped')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState(false)

  const charPercent = Math.min((log.length / maxChars) * 100, 100)
  const liveClassification = log.trim() ? classifyLog(log) : null

  const handleSelectTemplate = (tmpl: ProofTemplate) => {
    setSelectedTemplate(tmpl.id)
    if (!log.trim() && tmpl.defaultPrefix) {
      setLog(tmpl.defaultPrefix)
    }
  }

  const generatedCanonicalMessage = React.useMemo(() => {
    if (!walletAddress || !log.trim()) return ''
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://provn-sol.vercel.app'
    const cleanHost = currentOrigin.replace(/^https?:\/\//, '').split(':')[0]
    return buildCanonicalSubmitMessageV2({
      domain: cleanHost,
      walletAddress,
      timestamp: new Date().toISOString(),
      challenge: 'preview-challenge-nonce-000000',
      content: log.trim(),
      githubUrl: githubUrl.trim() || undefined,
      evidenceUrl: evidenceUrl.trim() || undefined,
    })
  }, [walletAddress, log, evidenceUrl, githubUrl])

  const handleReviewAndSign = () => {
    if (!log.trim() || !connected || isDailyLimitReached || log.length > maxChars) return
    setIsPreviewOpen(true)
  }

  const handleConfirmSign = () => {
    setIsPreviewOpen(false)
    onSubmitLog()
  }

  return (
    <section id="log-terminal" className="provn-card p-6 md:p-8 mb-10 relative">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#1e2533]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs font-semibold text-[#f0f4fc]">
            PROVN Work Logging Studio
          </span>
          <span className="text-[10px] font-mono text-[#8b9bb4] hidden sm:inline-block">
            SIWS Wallet Attestation
          </span>
        </div>
        <div className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
          Ready to Attest
        </div>
      </div>

      {/* Proof Templates Selector */}
      <div className="mb-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#8b9bb4] mb-2 font-medium">
          Select Contribution Archetype:
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {PROOF_TEMPLATES.map((tmpl) => {
            const isActive = selectedTemplate === tmpl.id
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tmpl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold'
                    : 'bg-[#141822] border border-[#212836] text-[#8b9bb4] hover:border-[#2f384a] hover:text-[#f0f4fc]'
                }`}
              >
                <span>{tmpl.icon}</span>
                <span>{tmpl.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Log Input Area */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2 text-xs font-mono text-[#8b9bb4]">
          <span>Contribution Evidence Details</span>
          <span className={log.length > maxChars ? 'text-rose-400 font-bold' : charPercent > 80 ? 'text-amber-400' : 'text-[#8b9bb4]'}>
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
          className="w-full bg-[#090b10] border border-[#212836] rounded-lg text-[#f0f4fc] p-3.5 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-[#57657d]"
        />

        {/* Live Auto-Classifier Tag Badge */}
        {liveClassification && (
          <div className="flex gap-2 flex-wrap mt-2.5 items-center">
            <span className="text-[10px] font-mono text-[#57657d] uppercase tracking-wider">Classification:</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
              {liveClassification.category}
            </span>
            {liveClassification.skills.map((s) => (
              <span
                key={s}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#141822] border border-[#212836] text-cyan-400"
              >
                {s}
              </span>
            ))}
            {liveClassification.protocols.map((p) => (
              <span
                key={p}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400"
              >
                ⚡ {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Optional Proof URLs Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-5">
        <div>
          <label className="block text-[11px] font-mono text-[#8b9bb4] mb-1.5">
            GitHub PR / Commit URL (Source Evidence)
          </label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo/pull/1"
            className="w-full bg-[#090b10] border border-[#212836] rounded-lg text-[#f0f4fc] px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-[#57657d]"
          />
          {connected && walletAddress && (
            <div className="mt-1.5 text-right">
              <a
                href={`/u/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-cyan-400 hover:underline"
              >
                Link GitHub in Profile →
              </a>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#8b9bb4] mb-1.5">
            Evidence / Demo URL (Optional HTTPS Link)
          </label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://my-app.vercel.app"
            className="w-full bg-[#090b10] border border-[#212836] rounded-lg text-[#f0f4fc] px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-[#57657d]"
          />
        </div>
      </div>

      {/* Status Bar */}
      {statusStep !== 'idle' && (
        <div
          className={`p-3 rounded-lg mb-4 text-xs font-mono flex items-center gap-2 ${
            statusStep === 'error'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              : statusStep === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
          }`}
        >
          {statusMsg}
        </div>
      )}

      {/* What does PROVN verify? */}
      <details className="mb-5 text-xs text-[#8b9bb4] border border-[#212836] rounded-lg p-3 bg-[#0a0d14]">
        <summary className="cursor-pointer text-cyan-400 font-mono font-medium outline-none">
          What does PROVN verify?
        </summary>
        <div className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-[#8b9bb4]">
          <p>
            <strong className="text-[#f0f4fc]">Cryptographic Signature:</strong> PROVN verifies that your connected Solana wallet signed this exact payload using Ed25519 cryptography.
          </p>
          <p>
            <strong className="text-[#f0f4fc]">Source Verification:</strong> If you provide a GitHub PR/Commit URL, PROVN verifies via the GitHub API that the PR or commit exists and attributes its author and state.
          </p>
        </div>
      </details>

      {/* Review & Preview Button */}
      <button
        onClick={handleReviewAndSign}
        disabled={loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars}
        className="btn-primary w-full py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? '⚡ Processing Cryptographic Signature...'
          : isDailyLimitReached
          ? '🔒 Daily Limit Reached (3/3 logs today)'
          : !connected
          ? '🔌 Connect Solana Wallet to Log Proof'
          : '🔍 Review & Preview Signature →'}
      </button>

      {/* Draft → Review → Sign Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="provn-card max-w-xl w-full p-6 bg-[#0e1117] border border-[#212836] rounded-xl shadow-2xl">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-[#1e2533]">
              <h3 className="text-base font-bold text-[#f0f4fc] font-mono">
                Review Cryptographic Signature Payload
              </h3>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-[#8b9bb4] hover:text-[#f0f4fc] text-lg font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8b9bb4] mb-3">
              The exact plaintext string below will be signed by your Solana wallet via Ed25519. It guarantees timestamp integrity and anti-replay protection.
            </p>

            <pre className="p-3.5 bg-[#08090d] border border-[#212836] rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 mb-4 whitespace-pre-wrap leading-relaxed">
              {generatedCanonicalMessage}
            </pre>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCanonicalMessage)
                  setCopyStatus(true)
                  setTimeout(() => setCopyStatus(false), 2000)
                }}
                className="btn-secondary text-xs"
              >
                {copyStatus ? '✓ Copied' : '📋 Copy Payload'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSign}
                  className="btn-primary text-xs"
                >
                  Sign with Wallet →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
