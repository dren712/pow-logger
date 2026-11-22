'use client'

import React, { useEffect, useId, useState } from 'react'
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [githubUrlError, setGithubUrlError] = useState('')
  const uid = useId()

  useEffect(() => {
    if (!isPreviewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPreviewOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPreviewOpen])

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
  const previewMessage = buildCanonicalSubmitMessageV2({
    domain: previewDomain,
    walletAddress: walletAddress || 'YOUR_SOLANA_WALLET_PUBLIC_KEY',
    timestamp: new Date().toISOString(),
    challenge: '[server-issued challenge]',
    content: log.trim() || 'Your work claim description will appear here.',
    githubUrl: githubUrl.trim() || undefined,
    evidenceUrl: evidenceUrl.trim() || undefined,
  })

  const handleReviewAndSign = () => {
    if (!log.trim() || !connected || isDailyLimitReached) return
    
    if (githubUrl.trim()) {
      try {
        const u = new URL(githubUrl.trim())
        if (!u.hostname.includes('github.com')) {
          setGithubUrlError('Enter a github.com pull request or commit URL.')
          return
        }
      } catch {
        setGithubUrlError('That is not a valid URL. It should start with https://github.com/')
        return
      }
    }

    setGithubUrlError('')
    setIsPreviewOpen(true)
  }

  const handleConfirmSign = () => {
    setIsPreviewOpen(false)
    onSubmitLog()
  }

  const overLimit = log.length > maxChars
  const blocked = loading || !log.trim() || !connected || isDailyLimitReached || overLimit
  const activeTemplate = PROOF_TEMPLATES.find((t) => t.id === selectedTemplate)

  return (
    <section id="log-terminal" className="pv-card scroll-mt-20" aria-labelledby={`${uid}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#1c222c] px-5 py-4 sm:px-6">
        <h2 id={`${uid}-title`} className="pv-h2">New proof</h2>
        <p className="pv-faint text-[12px]">Draft, review the exact message, then sign.</p>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6">
        {/* Contribution type */}
        <div role="group" aria-labelledby={`${uid}-type`}>
          <div id={`${uid}-type`} className="mb-2 text-[13px] font-medium text-[#c3cad6]">
            Type of work
          </div>
          <div className="flex flex-wrap gap-2">
            {PROOF_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                aria-pressed={selectedTemplate === tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className="lg-type"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Work description */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor={`${uid}-log`} className="text-[13px] font-medium text-[#c3cad6]">
              What did you do?
            </label>
            <span
              className={`pv-mono text-[12px] ${overLimit ? 'text-[#f0736a]' : charPercent > 80 ? 'text-[#f5c451]' : 'pv-faint'}`}
              aria-live="polite"
            >
              {log.length}/{maxChars}
            </span>
          </div>
          <textarea
            id={`${uid}-log`}
            value={log}
            onChange={(e) => setLog(e.target.value)}
            placeholder={
              activeTemplate?.placeholder ||
              'e.g. Built TweetNaCl SIWS verification logic, deployed RLS security migration, tested Arweave archival...'
            }
            rows={4}
            aria-invalid={overLimit}
            aria-describedby={`${uid}-log-help`}
            className="pv-input lg-field"
          />
          <p id={`${uid}-log-help`} className={`mt-2 text-[12px] ${overLimit ? 'text-[#f0736a]' : 'pv-faint'}`}>
            {overLimit
              ? `Shorten this by ${log.length - maxChars} characters to continue.`
              : 'One or two sentences. This text is signed exactly as written.'}
          </p>

          {liveClassification && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="pv-faint mr-1 text-[12px]">Detected</span>
              <span className="pv-chip !border-[rgba(46,229,157,0.35)] !text-[#2ee59d]">{liveClassification.category}</span>
              {liveClassification.skills.map((s) => (
                <span key={s} className="pv-chip">{s}</span>
              ))}
              {liveClassification.protocols.map((p) => (
                <span key={p} className="pv-chip">{p}</span>
              ))}
            </div>
          )}
        </div>

        {/* Optional evidence links */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${uid}-github`} className="mb-2 block text-[13px] font-medium text-[#c3cad6]">
              GitHub PR or commit URL <span className="pv-faint font-normal">(optional)</span>
            </label>
            <input
              id={`${uid}-github`}
              type="url"
              inputMode="url"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value)
                if (githubUrlError) setGithubUrlError('')
              }}
              placeholder="https://github.com/org/repo/pull/1"
              aria-invalid={Boolean(githubUrlError)}
              aria-describedby={`${uid}-github-help`}
              className="pv-input lg-field pv-mono !text-[13px]"
            />
            <p id={`${uid}-github-help`} role={githubUrlError ? 'alert' : undefined} className={`mt-2 text-[12px] leading-relaxed ${githubUrlError ? 'text-[#f0736a]' : 'pv-faint'}`}>
              {githubUrlError || 'Checked against the GitHub API when you submit.'}
              {!githubUrlError && connected && walletAddress && (
                <>
                  {' '}
                  <a href={`/u/${walletAddress}`} target="_blank" rel="noreferrer" className="pv-link underline underline-offset-2 !text-[#8a93a3] hover:!text-[#2ee59d]">
                    Link your GitHub account on your profile
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="min-w-0">
            <label htmlFor={`${uid}-evidence`} className="mb-2 block text-[13px] font-medium text-[#c3cad6]">
              Demo or evidence URL <span className="pv-faint font-normal">(optional)</span>
            </label>
            <input
              id={`${uid}-evidence`}
              type="url"
              inputMode="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://my-app.vercel.app"
              aria-describedby={`${uid}-evidence-help`}
              className="pv-input lg-field pv-mono !text-[13px]"
            />
            <p id={`${uid}-evidence-help`} className="pv-faint mt-2 text-[12px]">Any HTTPS link that shows the work.</p>
          </div>
        </div>

        <details className="group rounded-[10px] border border-[#1c222c] bg-[#11151c] px-4 py-3 text-[13px]">
          <summary className="cursor-pointer rounded font-medium text-[#c3cad6] hover:text-white">
            What does PROVN verify?
          </summary>
          <div className="pv-muted mt-3 flex flex-col gap-2 leading-relaxed">
            <p>
              <span className="text-[#c3cad6]">Signature.</span> PROVN verifies that your connected Solana wallet signed
              this exact payload.
            </p>
            <p>
              <span className="text-[#c3cad6]">Source.</span> If you provide a GitHub PR or commit URL, PROVN checks via
              the GitHub API that it exists, and records its state (for example merged or open) and its author.
            </p>
            <p className="pv-faint">
              PROVN verifies that the source exists. It does not prove you own the GitHub account unless you link it on
              your profile.
            </p>
          </div>
        </details>

        {statusStep !== 'idle' && (
          <div
            role={statusStep === 'error' ? 'alert' : 'status'}
            className={`lg-note ${statusStep === 'error' ? 'lg-note-error' : statusStep === 'success' ? 'lg-note-success' : ''}`}
          >
            {statusMsg}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#1c222c] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className={`text-[13px] ${isDailyLimitReached ? 'text-[#f5c451]' : 'pv-muted'}`}>
          {!connected
            ? 'Connect a wallet to sign and submit.'
            : isDailyLimitReached
            ? 'Daily limit reached (3 of 3 today). Come back tomorrow.'
            : 'Nothing is signed until you confirm in the next step.'}
        </p>
        <button
          type="button"
          onClick={handleReviewAndSign}
          disabled={blocked}
          className={`pv-btn w-full sm:w-auto ${blocked && !loading ? 'lg-blocked' : ''}`}
        >
          {loading ? 'Waiting for signature…' : 'Review and sign'}
        </button>
      </div>

      {/* Draft → Review → Sign dialog */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPreviewOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-review-title`}
            className="pv-card flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-b-none shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:rounded-b-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#1c222c] px-5 py-4 sm:px-6">
              <div>
                <h3 id={`${uid}-review-title`} className="text-[17px] font-semibold tracking-[-0.02em] text-white">
                  Review before you sign
                </h3>
                <p className="pv-muted mt-1 text-[13px]">Your wallet will ask you to sign the message below.</p>
              </div>
              <button
                type="button"
                aria-label="Close review"
                onClick={() => setIsPreviewOpen(false)}
                className="lg-action -mr-2 !h-9 !w-9 shrink-0 justify-center !p-0 text-[18px] leading-none"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  ['Signer', walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Connected wallet', true],
                  ['Algorithm', 'Ed25519 detached', false],
                  ['Storage', 'Arweave via Irys', false],
                ].map(([label, value, mono]) => (
                  <div key={label as string} className="flex items-baseline justify-between gap-3 rounded-[10px] border border-[#1c222c] bg-[#11151c] px-3 py-2.5 sm:block">
                    <dt className="pv-muted text-[12px]">{label}</dt>
                    <dd className={`text-[13px] font-medium text-white sm:mt-1 ${mono ? 'pv-mono' : ''}`}>{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <div className="mb-2 text-[13px] font-medium text-[#c3cad6]">Message to sign</div>
                <pre className="lg-pre" tabIndex={0} aria-label="Message to sign">{previewMessage}</pre>
              </div>

              <p className="lg-note">
                Your wallet signs this proof statement only. It does not sign your source code and does not send a
                transaction.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#1c222c] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={() => setIsPreviewOpen(false)} className="pv-btn-ghost">
                Back to edit
              </button>
              <button type="button" onClick={handleConfirmSign} className="pv-btn" autoFocus>
                Sign and publish
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
