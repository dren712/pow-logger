'use client'

import React, { useState } from 'react'
import ModalShell, { CheckIcon } from './modals-cards/ModalShell'
import { BuilderReputation, WalletLog } from '@/app/lib/types'

interface ExportPassportModalProps {
  wallet: string
  reputation: BuilderReputation
  logs: WalletLog[]
  onClose: () => void
}

type ExportTab = 'markdown' | 'json' | 'csv' | 'badge'

export default function ExportPassportModal({
  wallet,
  reputation,
  logs,
  onClose,
}: ExportPassportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('markdown')
  const [copiedState, setCopiedState] = useState<string | null>(null)

  const walletShort = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
  const verificationUrl = `https://provn-sol.vercel.app/u/${wallet}`
  const badgeUrl = `https://provn-sol.vercel.app/api/badge/${wallet}`

  // Helper for copy feedback
  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedState(label)
    setTimeout(() => setCopiedState(null), 2000)
  }

  // Client-side instant file download
  const downloadBlob = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 1. Markdown Dossier Generator
  const generateMarkdownDossier = () => {
    const earnedAchievements = reputation.achievements.filter((a) => a.earned)

    return `# PROVN Evidence Export: ${wallet}

> **Solana Builder Passport** • Cryptographically verified Ed25519 proof-of-work records permanently archived on Arweave.
> **Verification URL**: [${verificationUrl}](${verificationUrl})

---

## 🏆 Builder Overview
- **Signer Wallet**: \`${wallet}\`
- **Builder Rank**: ${reputation.builderLevel.emoji} **Level ${reputation.builderLevel.level} — ${reputation.builderLevel.title}**
- **Verified Proofs**: ${reputation.totalProofs} Logs (${reputation.archivalSuccessRate}% permanently stored on Arweave)
- **Active Streak**: 🔥 **${reputation.currentStreak} Days** (Longest: ${reputation.longestStreak} Days)
- **Top Skills**: ${reputation.skills.map((s) => `\`#${s.name}\` (${s.count})`).join(', ') || 'N/A'}
- **Protocols & Tools**: ${reputation.protocols.map((p) => `\`${p.name}\` (${p.count})`).join(', ') || 'N/A'}

---

## 🎖️ Earned Achievements (${earnedAchievements.length} Unlocked)
${
  earnedAchievements.length > 0
    ? earnedAchievements
        .map(
          (a) =>
            `- ${a.icon} **${a.name}** [${a.rarity.toUpperCase()}]: ${a.description}\n  *Criteria*: ${a.criteria}`
        )
        .join('\n')
    : '_No achievements unlocked yet._'
}

---

## 📜 Cryptographic Proof Log History (${logs.length} Total Records)

| Date (IST) | Work Output Description | Skills / Stack | Arweave TX / Evidence |
| :--- | :--- | :--- | :--- |
${logs
  .map((l) => {
    const dateStr = new Date(l.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
    const sanitizedContent = l.content.replace(/\|/g, '\\|').replace(/\n/g, ' ')
    const skillsStr = (l.skills || []).map((s) => `#${s}`).join(' ') || '-'
    const arweaveLink = l.irys_tx_id
      ? `[\`${l.irys_tx_id.slice(0, 8)}...\`](https://gateway.irys.xyz/${l.irys_tx_id})`
      : l.github_url
      ? `[GitHub PR](${l.github_url})`
      : 'Signature Verified'
    return `| ${dateStr} | ${sanitizedContent} | ${skillsStr} | ${arweaveLink} |`
  })
  .join('\n')}

---
*Exported from [PROVN Protocol](https://provn-sol.vercel.app) • Verifiable Proof-of-Work Layer on Solana*
`
  }

  // 2. Machine-Readable JSON Generator
  const generateJSON = () => {
    const payload = {
      protocol: 'PROVN',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      wallet,
      verificationUrl,
      reputation: {
        totalProofs: reputation.totalProofs,
        verifiedProofs: reputation.verifiedProofs,
        archivedProofs: reputation.archivedProofs,
        archivalSuccessRate: reputation.archivalSuccessRate,
        currentStreak: reputation.currentStreak,
        longestStreak: reputation.longestStreak,
        builderLevel: reputation.builderLevel,
        skills: reputation.skills,
        protocols: reputation.protocols,
        categories: reputation.categories,
      },
      achievements: reputation.achievements,
      proofLogs: logs.map((l) => ({
        id: l.id,
        createdAt: l.created_at,
        content: l.content,
        category: l.category,
        skills: l.skills || [],
        protocols: l.protocols || [],
        githubUrl: l.github_url || null,
        evidenceUrl: l.evidence_url || null,
        signature: l.signature || null,
        nonce: l.nonce || null,
        domain: l.domain || null,
        irysTxId: l.irys_tx_id || null,
        archivalState: l.archival_state || 'pending',
      })),
    }
    return JSON.stringify(payload, null, 2)
  }

  // 3. CSV Generator
  const generateCSV = () => {
    const headers = [
      'ID',
      'Created_At_UTC',
      'Content',
      'Category',
      'Skills',
      'Protocols',
      'GitHub_URL',
      'Evidence_URL',
      'Arweave_TX_ID',
      'Signature',
      'Nonce',
    ]

    const escapeCSV = (str?: string | null) => {
      if (!str) return '""'
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    }

    const rows = logs.map((l) => [
      l.id,
      escapeCSV(l.created_at),
      escapeCSV(l.content),
      escapeCSV(l.category || 'Development'),
      escapeCSV((l.skills || []).join('; ')),
      escapeCSV((l.protocols || []).join('; ')),
      escapeCSV(l.github_url),
      escapeCSV(l.evidence_url),
      escapeCSV(l.irys_tx_id),
      escapeCSV(l.signature),
      escapeCSV(l.nonce),
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }

  // 4. Badges Snippets
  const markdownBadge = `[![PROVN Verified Builder](${badgeUrl})](${verificationUrl})`
  const htmlBadge = `<a href="${verificationUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="PROVN Verified Builder ${walletShort}" /></a>`

  const markdownContent = generateMarkdownDossier()
  const jsonContent = generateJSON()
  const csvContent = generateCSV()

  const tabs: { id: ExportTab; label: string }[] = [
    { id: 'markdown', label: 'Markdown' },
    { id: 'json', label: 'JSON' },
    { id: 'csv', label: 'CSV' },
    { id: 'badge', label: 'README badge' },
  ]

  const fileExports: Record<
    Exclude<ExportTab, 'badge'>,
    { content: string; filename: string; mime: string; hint: string; meta: string; download: string; copy: string; copied: string }
  > = {
    markdown: {
      content: markdownContent,
      filename: `provn-dossier-${wallet.slice(0, 8)}.md`,
      mime: 'text/markdown',
      hint: 'A readable summary with the full proof history.',
      meta: `${logs.length} ${logs.length === 1 ? 'proof' : 'proofs'} included`,
      download: 'Download .md',
      copy: 'Copy Markdown',
      copied: 'Markdown copied',
    },
    json: {
      content: jsonContent,
      filename: `provn-passport-${wallet.slice(0, 8)}.json`,
      mime: 'application/json',
      hint: 'Machine-readable records, including each Ed25519 signature.',
      meta: `${logs.length} ${logs.length === 1 ? 'record' : 'records'}`,
      download: 'Download .json',
      copy: 'Copy JSON',
      copied: 'JSON copied',
    },
    csv: {
      content: csvContent,
      filename: `provn-proofs-${wallet.slice(0, 8)}.csv`,
      mime: 'text/csv',
      hint: 'One row per proof, for Excel or Google Sheets.',
      meta: `${logs.length} ${logs.length === 1 ? 'row' : 'rows'}`,
      download: 'Download .csv',
      copy: 'Copy CSV',
      copied: 'CSV copied',
    },
  }
  const active = activeTab === 'badge' ? null : fileExports[activeTab]

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const idx = tabs.findIndex((t) => t.id === activeTab)
    const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    setActiveTab(next.id)
    document.getElementById(`export-tab-${next.id}`)?.focus()
  }

  const copyButton = (text: string, key: string, label: string, done: string, small = false) => (
    <button
      type="button"
      onClick={() => triggerCopy(text, key)}
      className={`pv-btn-ghost${small ? ' pvm-btn-sm' : ''}${copiedState === key ? ' pvm-ok' : ''}`}
    >
      {copiedState === key ? (
        <>
          <CheckIcon /> {done}
        </>
      ) : (
        label
      )}
    </button>
  )

  return (
    <>
      <ModalShell
        title="Export passport"
        description="Take this wallet's proof history with you, for a README, a grant application or a hackathon submission."
        onClose={onClose}
        footer={
          <>
            <div className="pvm-footer-start">
              <button type="button" onClick={() => window.print()} className="pv-btn-ghost">
                Print or save as PDF
              </button>
            </div>
            {active && (
              <>
                {copyButton(active.content, activeTab, active.copy, active.copied)}
                <button
                  type="button"
                  onClick={() => downloadBlob(active.filename, active.content, active.mime)}
                  className="pv-btn"
                >
                  {active.download}
                </button>
              </>
            )}
          </>
        }
      >
        <div className="pvm-tabs" role="tablist" aria-label="Export format" onKeyDown={onTabKeyDown}>
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`export-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls="export-tabpanel"
              tabIndex={activeTab === t.id ? 0 : -1}
              className="pvm-tab"
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="export-tabpanel" role="tabpanel" aria-labelledby={`export-tab-${activeTab}`}>
          {active && (
            <>
              <div className="pvm-section-head">
                <span className="pv-muted" style={{ fontSize: '13px' }}>{active.hint}</span>
                <span className="pv-faint" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{active.meta}</span>
              </div>
              <pre
                className={`pvm-code${activeTab === 'markdown' ? ' pvm-code-wrap' : ''}`}
                tabIndex={0}
                aria-label={`${tabs.find((t) => t.id === activeTab)?.label} preview`}
              >
                {active.content}
              </pre>
            </>
          )}

          {activeTab === 'badge' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <div className="pvm-label" style={{ marginBottom: '8px' }}>Preview</div>
                <div className="pvm-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badgeUrl} alt={`PROVN Verified Builder ${walletShort}`} />
                </div>
              </div>

              <div>
                <div className="pvm-label" style={{ marginBottom: '8px' }}>Markdown, for a GitHub README</div>
                <div className="pvm-snippet">
                  <code>{markdownBadge}</code>
                  {copyButton(markdownBadge, 'md-badge', 'Copy', 'Copied', true)}
                </div>
              </div>

              <div>
                <div className="pvm-label" style={{ marginBottom: '8px' }}>HTML</div>
                <div className="pvm-snippet">
                  <code>{htmlBadge}</code>
                  {copyButton(htmlBadge, 'html-badge', 'Copy', 'Copied', true)}
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalShell>

      {/* =========================================================================
          PRINT-ONLY OFFICIAL PROVN BUILDER DOSSIER & CERTIFICATE
          ========================================================================= */}
      <div className="provn-print-dossier">
        {/* Certificate Header */}
        <div
          style={{
            borderBottom: '2px solid #000',
            paddingBottom: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: '18pt', margin: 0, letterSpacing: '-0.5px' }}>
              PROVN BUILDER PASSPORT
            </h1>
            <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>
              Cryptographically Verified Proof-of-Work Dossier • Solana & Arweave
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="PROVN Badge" style={{ height: '36px' }} />
        </div>

        {/* Builder Identity & Verification Coordinates */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '16px',
            marginBottom: '16px',
            background: '#f8f9fa',
            padding: '12px',
            borderRadius: '6px',
          }}
        >
          <div>
            <div style={{ fontSize: '8pt', textTransform: 'uppercase', color: '#666' }}>
              Signer Wallet Address
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '10pt',
                fontWeight: 'bold',
                wordBreak: 'break-all',
              }}
            >
              {wallet}
            </div>

            <div style={{ marginTop: '8px', fontSize: '8pt', textTransform: 'uppercase', color: '#666' }}>
              Public Verification Link
            </div>
            <div style={{ fontSize: '9pt', wordBreak: 'break-all', color: '#0044cc' }}>
              {verificationUrl}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8pt', textTransform: 'uppercase', color: '#666' }}>
              Builder Level / Rank
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
              {reputation.builderLevel.emoji} Level {reputation.builderLevel.level} —{' '}
              {reputation.builderLevel.title}
            </div>
            <div style={{ fontSize: '8pt', color: '#666', marginTop: '4px' }}>
              Exported: {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </div>
          </div>
        </div>

        {/* Reputation Overview Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', color: '#666' }}>TOTAL PROOFS</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>{reputation.totalProofs}</div>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', color: '#666' }}>ACTIVE STREAK</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>🔥 {reputation.currentStreak} Days</div>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', color: '#666' }}>LONGEST STREAK</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>{reputation.longestStreak} Days</div>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px' }}>
            <div style={{ fontSize: '8pt', color: '#666' }}>ARWEAVE ARCHIVAL</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>{reputation.archivalSuccessRate}%</div>
          </div>
        </div>

        {/* Top Skills & Ecosystem Stack */}
        <div style={{ marginBottom: '16px' }}>
          <h2
            style={{
              fontSize: '10pt',
              textTransform: 'uppercase',
              borderBottom: '1px solid #ccc',
              paddingBottom: '4px',
              margin: '0 0 6px 0',
            }}
          >
            Verified Skills & Protocols
          </h2>
          <div style={{ fontSize: '9pt', lineHeight: '1.5' }}>
            <strong>Skills:</strong>{' '}
            {reputation.skills.map((s) => `#${s.name} (${s.count})`).join(', ') || 'N/A'}
            <br />
            <strong>Protocols:</strong>{' '}
            {reputation.protocols.map((p) => `${p.name} (${p.count})`).join(', ') || 'N/A'}
          </div>
        </div>

        {/* Earned Achievements */}
        <div style={{ marginBottom: '16px' }}>
          <h2
            style={{
              fontSize: '10pt',
              textTransform: 'uppercase',
              borderBottom: '1px solid #ccc',
              paddingBottom: '4px',
              margin: '0 0 6px 0',
            }}
          >
            Earned Achievements ({reputation.achievements.filter((a) => a.earned).length} /{' '}
            {reputation.achievements.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '8.5pt' }}>
            {reputation.achievements
              .filter((a) => a.earned)
              .map((a) => (
                <div key={a.id} style={{ border: '1px solid #eee', padding: '5px 8px', borderRadius: '4px' }}>
                  <strong>
                    {a.icon} {a.name}
                  </strong>{' '}
                  [{a.rarity.toUpperCase()}]: {a.description}
                </div>
              ))}
          </div>
        </div>

        {/* Proof of Work History Table */}
        <div>
          <h2
            style={{
              fontSize: '10pt',
              textTransform: 'uppercase',
              borderBottom: '1px solid #ccc',
              paddingBottom: '4px',
              margin: '0 0 6px 0',
            }}
          >
            Cryptographic Proof History ({logs.length} Total Records)
          </h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Date (IST)</th>
                <th style={{ width: '50%' }}>Work Output Description</th>
                <th style={{ width: '15%' }}>Stack</th>
                <th style={{ width: '20%' }}>Verification</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    {new Date(l.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </td>
                  <td>{l.content}</td>
                  <td>{(l.skills || []).map((s) => `#${s}`).join(' ') || '-'}</td>
                  <td>
                    {l.irys_tx_id
                      ? `Arweave: ${l.irys_tx_id.slice(0, 8)}...`
                      : l.github_url
                      ? 'GitHub PR'
                      : 'Signature Verified'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Attestation Guarantee Footer */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '10px',
            borderTop: '1px solid #000',
            fontSize: '8pt',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>PROVN Protocol • Cryptographic Proof-of-Work on Solana</span>
          <span>Verified against Ed25519 signatures</span>
        </div>
      </div>
    </>
  )
}
