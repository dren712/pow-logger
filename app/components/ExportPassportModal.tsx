'use client'

import React, { useState } from 'react'
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

    return `# PROVN Verified Builder Dossier: ${wallet}

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
      : 'SIWS Verified'
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="terminal-card"
        style={{
          width: 'min(680px, 95vw)',
          maxHeight: '90vh',
          background: '#090b10',
          border: '1px solid #1c2438',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            borderBottom: '1px solid #141824',
            paddingBottom: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📥</span>
              <h2
                style={{
                  color: '#00ff88',
                  margin: 0,
                  fontSize: '16px',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  fontWeight: 800,
                }}
              >
                Export PROVN Builder Passport
              </h2>
            </div>
            <p style={{ color: '#889', fontSize: '11px', margin: '4px 0 0 0' }}>
              Portable, machine-readable proof-of-work dossiers for GitHub, grants, and hackathon submissions.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#667',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '16px',
            overflowX: 'auto',
            borderBottom: '1px solid #141824',
            paddingBottom: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('markdown')}
            style={{
              background: activeTab === 'markdown' ? 'rgba(0, 255, 136, 0.15)' : '#0d111a',
              border: activeTab === 'markdown' ? '1px solid #00ff88' : '1px solid #1a2030',
              color: activeTab === 'markdown' ? '#00ff88' : '#aaa',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            📄 Markdown Dossier
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              background: activeTab === 'json' ? 'rgba(0, 229, 255, 0.15)' : '#0d111a',
              border: activeTab === 'json' ? '1px solid #00e5ff' : '1px solid #1a2030',
              color: activeTab === 'json' ? '#00e5ff' : '#aaa',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            📦 Verifiable JSON
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            style={{
              background: activeTab === 'csv' ? 'rgba(255, 184, 0, 0.15)' : '#0d111a',
              border: activeTab === 'csv' ? '1px solid #ffb800' : '1px solid #1a2030',
              color: activeTab === 'csv' ? '#ffb800' : '#aaa',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            📊 CSV Spreadsheet
          </button>
          <button
            onClick={() => setActiveTab('badge')}
            style={{
              background: activeTab === 'badge' ? 'rgba(171, 159, 242, 0.15)' : '#0d111a',
              border: activeTab === 'badge' ? '1px solid #ab9ff2' : '1px solid #1a2030',
              color: activeTab === 'badge' ? '#ab9ff2' : '#aaa',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            🛡️ GitHub Embed
          </button>
        </div>

        {/* Tab Content Display */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
          {activeTab === 'markdown' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888' }}>
                  Formatted markdown with cryptographic proof history:
                </span>
                <span style={{ fontSize: '10px', color: '#00ff88' }}>{logs.length} Proofs included</span>
              </div>
              <pre
                style={{
                  background: '#060709',
                  border: '1px solid #141824',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '11px',
                  color: '#ccc',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  margin: 0,
                }}
              >
                {markdownContent}
              </pre>
            </div>
          )}

          {activeTab === 'json' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888' }}>
                  Machine-readable JSON schema with Ed25519 signatures:
                </span>
                <span style={{ fontSize: '10px', color: '#00e5ff' }}>REST Compatible</span>
              </div>
              <pre
                style={{
                  background: '#060709',
                  border: '1px solid #141824',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '10px',
                  color: '#00e5ff',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  margin: 0,
                }}
              >
                {jsonContent}
              </pre>
            </div>
          )}

          {activeTab === 'csv' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888' }}>
                  Spreadsheet CSV with timestamps, skills, and Arweave TX IDs:
                </span>
                <span style={{ fontSize: '10px', color: '#ffb800' }}>Excel / Sheets ready</span>
              </div>
              <pre
                style={{
                  background: '#060709',
                  border: '1px solid #141824',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '10px',
                  color: '#ffb800',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  margin: 0,
                }}
              >
                {csvContent}
              </pre>
            </div>
          )}

          {activeTab === 'badge' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                  Live GitHub README Embed Preview:
                </div>
                <div
                  style={{
                    background: '#060709',
                    border: '1px solid #141824',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeUrl}
                    alt={`PROVN Verified Builder ${walletShort}`}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
                  Markdown Snippet (for GitHub README.md):
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    background: '#060709',
                    border: '1px solid #141824',
                    borderRadius: '6px',
                    padding: '8px 12px',
                  }}
                >
                  <code style={{ fontSize: '10px', color: '#ab9ff2', flex: 1, wordBreak: 'break-all' }}>
                    {markdownBadge}
                  </code>
                  <button
                    onClick={() => triggerCopy(markdownBadge, 'md-badge')}
                    className="btn-primary"
                    style={{ padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}
                  >
                    {copiedState === 'md-badge' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
                  HTML Embed Tag:
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    background: '#060709',
                    border: '1px solid #141824',
                    borderRadius: '6px',
                    padding: '8px 12px',
                  }}
                >
                  <code style={{ fontSize: '10px', color: '#00e5ff', flex: 1, wordBreak: 'break-all' }}>
                    {htmlBadge}
                  </code>
                  <button
                    onClick={() => triggerCopy(htmlBadge, 'html-badge')}
                    className="btn-primary"
                    style={{ padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}
                  >
                    {copiedState === 'html-badge' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderTop: '1px solid #141824',
            paddingTop: '14px',
            flexWrap: 'wrap',
          }}
        >
          {activeTab === 'markdown' && (
            <>
              <button
                onClick={() =>
                  downloadBlob(
                    `provn-dossier-${wallet.slice(0, 8)}.md`,
                    markdownContent,
                    'text/markdown'
                  )
                }
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '12px' }}
              >
                💾 Download .MD Dossier
              </button>
              <button
                onClick={() => triggerCopy(markdownContent, 'markdown')}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '12px',
                  background: '#0d111a',
                  border: '1px solid #1a2030',
                  color: copiedState === 'markdown' ? '#00ff88' : '#00e5ff',
                }}
              >
                {copiedState === 'markdown' ? '✓ Markdown Copied' : '📋 Copy Markdown'}
              </button>
            </>
          )}

          {activeTab === 'json' && (
            <>
              <button
                onClick={() =>
                  downloadBlob(
                    `provn-passport-${wallet.slice(0, 8)}.json`,
                    jsonContent,
                    'application/json'
                  )
                }
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '12px' }}
              >
                💾 Download .JSON Passport
              </button>
              <button
                onClick={() => triggerCopy(jsonContent, 'json')}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '12px',
                  background: '#0d111a',
                  border: '1px solid #1a2030',
                  color: copiedState === 'json' ? '#00ff88' : '#00e5ff',
                }}
              >
                {copiedState === 'json' ? '✓ JSON Copied' : '📋 Copy JSON'}
              </button>
            </>
          )}

          {activeTab === 'csv' && (
            <>
              <button
                onClick={() =>
                  downloadBlob(
                    `provn-proofs-${wallet.slice(0, 8)}.csv`,
                    csvContent,
                    'text/csv'
                  )
                }
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '12px' }}
              >
                💾 Download .CSV Spreadsheet
              </button>
              <button
                onClick={() => triggerCopy(csvContent, 'csv')}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '12px',
                  background: '#0d111a',
                  border: '1px solid #1a2030',
                  color: copiedState === 'csv' ? '#00ff88' : '#ffb800',
                }}
              >
                {copiedState === 'csv' ? '✓ CSV Copied' : '📋 Copy CSV'}
              </button>
            </>
          )}

          <button
            onClick={() => window.print()}
            className="btn-primary"
            style={{
              padding: '10px 16px',
              fontSize: '12px',
              background: '#0d111a',
              border: '1px solid #1a2030',
              color: '#ffb800',
            }}
          >
            🖨️ Print / PDF
          </button>
        </div>
      </div>
    </div>
  )
}
