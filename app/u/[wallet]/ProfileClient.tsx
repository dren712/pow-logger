'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import ContributionHeatmap from '@/app/components/ContributionHeatmap'
import NFTBadgeModal from '@/app/components/NFTBadgeModal'
import BuilderBadge from '@/app/components/BuilderBadge'
import PassportCard from '@/app/components/cards/PassportCard'
import AchievementCard from '@/app/components/cards/AchievementCard'
import CardCustomizerModal from '@/app/components/cards/CardCustomizerModal'
import { CARD_THEMES, CardTheme, getCardTheme } from '@/app/lib/cardThemes'
import { Achievement, WalletLog } from '@/app/lib/types'
import { computeBadgeSummary } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'
import { generateNFTBadgeSVG } from '@/app/lib/badgeGenerator'

export type LogItem = WalletLog

interface ProfileClientProps {
  wallet: string
  initialLogs: LogItem[]
}

export default function ProfileClient({ wallet, initialLogs }: ProfileClientProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSvg, setSelectedSvg] = useState<string | null>(null)
  const [modalTitle, setModalTitle] = useState('PROVN Builder Reputation Badge 🗿')
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isQROpen, setIsQROpen] = useState(false)
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [inspectedAchievement, setInspectedAchievement] = useState<Achievement | null>(null)
  const [activeTheme, setActiveTheme] = useState<CardTheme>(CARD_THEMES.steel)
  const [copied, setCopied] = useState(false)
  const [exportCopied, setExportCopied] = useState(false)

  // Initialize theme from URL if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const themeParam = params.get('theme')
      if (themeParam) {
        setActiveTheme(getCardTheme(themeParam))
      }
    }
  }, [])

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedSkill, setSelectedSkill] = useState<string>('ALL')
  const [selectedProtocol, setSelectedProtocol] = useState<string>('ALL')

  // Calculate deterministic reputation & achievements
  const reputation = calculateReputation(wallet, logs)
  const badgeSummary = computeBadgeSummary(logs.length, reputation.currentStreak, reputation.longestStreak, logs)

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/verify/${wallet}`)
      if (res.ok) {
        const data = await res.json()
        if (data.logs) {
          startTransition(() => {
            setLogs(data.logs)
          })
        }
      }
    } catch (err) {
      console.error('Failed to refresh builder logs:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Copy Profile Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter Logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === '' ||
      log.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.category && log.category.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCat = selectedCategory === 'ALL' || log.category === selectedCategory
    const matchesSkill = selectedSkill === 'ALL' || (log.skills && log.skills.includes(selectedSkill))
    const matchesProtocol =
      selectedProtocol === 'ALL' || (log.protocols && log.protocols.includes(selectedProtocol))

    return matchesSearch && matchesCat && matchesSkill && matchesProtocol
  })

  const walletShort = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
  const verificationUrl = `https://provn-sol.vercel.app/u/${wallet}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    verificationUrl
  )}&bgcolor=060709&color=00ff88`

  // Markdown Export representation
  const markdownExport = `# PROVN Builder Passport: ${wallet}
- **Status**: Verified Solana Builder
- **Builder Level**: ${reputation.builderLevel.emoji} Level ${reputation.builderLevel.level} — ${reputation.builderLevel.title}
- **Total Proofs**: ${reputation.totalProofs}
- **Active Streak**: ${reputation.currentStreak} Days (Longest: ${reputation.longestStreak} Days)
- **Archival Rate**: ${reputation.archivalSuccessRate}% on Arweave
- **Top Skills**: ${reputation.skills.map((s) => s.name).join(', ') || 'N/A'}
- **Protocols**: ${reputation.protocols.map((p) => p.name).join(', ') || 'N/A'}

## Earned Achievements
${reputation.achievements
  .filter((a) => a.earned)
  .map((a) => `- ${a.icon} **${a.name}**: ${a.description}`)
  .join('\n')}

Verify cryptographically at: ${verificationUrl}
`

  return (
    <main
      style={{
        width: 'min(820px, 94vw)',
        margin: '0 auto',
        padding: '32px 16px 100px 16px',
        fontFamily: 'var(--font-geist-mono), monospace',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <Link
          href="/"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Back to Terminal
        </Link>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: `1px solid ${activeTheme.borderTone}`,
              color: activeTheme.accentTone,
            }}
          >
            🎨 Metal Studio ({activeTheme.name})
          </button>
          <button
            onClick={() => {
              const svg = generateNFTBadgeSVG(wallet, reputation.currentStreak)
              setSelectedSvg(svg)
              setModalTitle('PROVN Builder Reputation Badge 🗿')
            }}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #1e2638',
              color: '#ab9ff2',
            }}
          >
            🛡️ Badge
          </button>
          <button
            onClick={() => setIsQROpen(true)}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #1e2638',
              color: '#00ff88',
            }}
          >
            📱 QR Code
          </button>
          <button
            onClick={() => setIsExportOpen(true)}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #1e2638',
              color: '#00e5ff',
            }}
          >
            📥 Export Passport
          </button>
          <button
            onClick={handleCopyLink}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #1e2638',
              color: copied ? '#00ff88' : '#aaa',
            }}
          >
            {copied ? '✓ Copied' : '🔗 Share'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isPending}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #1e2638',
            }}
          >
            {isRefreshing ? '↻ Syncing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Honest Provenance Banner */}
      <div
        style={{
          background: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '24px',
          fontSize: '11px',
          color: '#88a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <strong style={{ color: '#00e5ff' }}>🛡️ Cryptographic Provenance Guarantee:</strong> PROVN
          verifies that this Solana wallet cryptographically signed each proof log using Ed25519.
          Immutable work history & provenance layer.
        </div>
        <span
          style={{
            background: 'rgba(0, 255, 136, 0.1)',
            color: '#00ff88',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          SIWS VALIDATED
        </span>
      </div>

      {/* Metallic Builder Passport Hero Card */}
      <div style={{ marginBottom: '32px' }}>
        <PassportCard
          reputation={reputation}
          theme={activeTheme}
          onCustomizeClick={() => setIsCustomizerOpen(true)}
          showControls={true}
        />
      </div>

      {/* Core Reputation Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Builder Level</div>
          <div style={{ color: reputation.builderLevel.color, fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>
            {reputation.builderLevel.emoji} LVL {reputation.builderLevel.level}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>{reputation.builderLevel.title}</div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Active Streak</div>
          <div style={{ color: '#ffb800', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            🔥 {reputation.currentStreak} Days
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
            Longest: {reputation.longestStreak}d
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Verified Proofs</div>
          <div style={{ color: '#00ff88', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            ⚡ {reputation.totalProofs}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>100% Wallet Signed</div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Arweave Archival</div>
          <div style={{ color: '#00e5ff', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            📦 {reputation.archivalSuccessRate}%
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
            {reputation.archivedProofs} Archived TXs
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div style={{ marginBottom: '24px' }}>
        <ContributionHeatmap logs={logs} />
      </div>

      {/* Builder Badge & Level Progression Component */}
      <div style={{ marginBottom: '24px' }}>
        <BuilderBadge badge={badgeSummary} />
      </div>

      {/* Off-Chain Proven Achievements Grid */}
      <div
        className="terminal-card"
        style={{
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ color: '#00ff88', fontSize: '14px', margin: 0, fontWeight: 800 }}>
              🏆 Proven Builder Achievements
            </h2>
            <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
              Off-chain deterministic milestones verified from your Ed25519 work log history.
            </div>
          </div>
          <span
            style={{
              fontSize: '10px',
              color: '#889',
              background: '#0d111a',
              border: '1px solid #1a2030',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            {reputation.achievements.filter((a) => a.earned).length} / {reputation.achievements.length} Unlocked
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {reputation.achievements.map((ach) => (
            <AchievementCard
              key={ach.id}
              achievement={ach}
              reputation={reputation}
              customTheme={activeTheme}
              onClick={() => setInspectedAchievement(ach)}
            />
          ))}
        </div>
      </div>

      {/* Skills & Protocol Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="terminal-card" style={{ padding: '16px' }}>
          <h3 style={{ color: '#00ff88', fontSize: '12px', margin: '0 0 12px 0', fontWeight: 700 }}>
            ⚡ Verified Skills Frequency
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reputation.skills.length > 0 ? (
              reputation.skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSelectedSkill(selectedSkill === s.name ? 'ALL' : s.name)}
                  style={{
                    background: selectedSkill === s.name ? 'rgba(0, 255, 136, 0.15)' : '#0d111a',
                    border: selectedSkill === s.name ? '1px solid #00ff88' : '1px solid #1a2030',
                    color: selectedSkill === s.name ? '#00ff88' : '#ab9ff2',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  #{s.name} <strong style={{ color: '#00ff88' }}>({s.count})</strong>
                </button>
              ))
            ) : (
              <span style={{ color: '#555', fontSize: '11px' }}>No skills classified yet</span>
            )}
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '16px' }}>
          <h3 style={{ color: '#00e5ff', fontSize: '12px', margin: '0 0 12px 0', fontWeight: 700 }}>
            🌐 Protocols & Ecosystem Stack
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reputation.protocols.length > 0 ? (
              reputation.protocols.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedProtocol(selectedProtocol === p.name ? 'ALL' : p.name)}
                  style={{
                    background: selectedProtocol === p.name ? 'rgba(0, 229, 255, 0.15)' : '#0d111a',
                    border: selectedProtocol === p.name ? '1px solid #00e5ff' : '1px solid #1a2030',
                    color: selectedProtocol === p.name ? '#00e5ff' : '#00e5ff',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ⚡ {p.name} <strong style={{ color: '#ffb800' }}>({p.count})</strong>
                </button>
              ))
            ) : (
              <span style={{ color: '#555', fontSize: '11px' }}>No protocols classified yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="glass-card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <input
          type="text"
          placeholder="Search proof logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: '#060709',
            border: '1px solid #1c2230',
            borderRadius: '6px',
            color: '#00ff88',
            padding: '8px 12px',
            fontSize: '12px',
            fontFamily: 'inherit',
            flex: '1',
            minWidth: '200px',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              color: '#aaa',
              padding: '8px 10px',
              fontSize: '11px',
              fontFamily: 'inherit',
            }}
          >
            <option value="ALL">All Categories</option>
            {reputation.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Proof Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#aaa', fontSize: '13px', margin: 0, fontWeight: 700 }}>
            Verifiable Proof Timeline ({filteredLogs.length})
          </h2>
          <span style={{ color: '#555', fontSize: '11px' }}>Sorted chronologically (newest first)</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: '32px',
              textAlign: 'center',
              color: '#666',
              fontSize: '12px',
            }}
          >
            No proofs match your active filters.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="terminal-card"
              style={{
                padding: '16px',
                borderLeft: '3px solid #00ff88',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link
                    href={`/proof/${log.id}`}
                    style={{
                      color: '#00ff88',
                      fontSize: '12px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    Proof #{log.id} ↗
                  </Link>
                  {log.category && (
                    <span
                      style={{
                        background: '#0d111a',
                        border: '1px solid #1a2030',
                        color: '#889',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {log.category}
                    </span>
                  )}
                </div>

                <div style={{ color: '#555', fontSize: '11px' }}>
                  {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </div>
              </div>

              <p
                style={{
                  color: '#ddd',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  margin: '0 0 12px 0',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {log.content}
              </p>

              {/* Evidence & Links */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px' }}>
                {log.github_url && (
                  <a
                    href={log.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#ab9ff2', textDecoration: 'none' }}
                  >
                    🐙 GitHub Evidence ↗
                  </a>
                )}
                {log.evidence_url && (
                  <a
                    href={log.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#00e5ff', textDecoration: 'none' }}
                  >
                    🔗 Live Demo / Evidence ↗
                  </a>
                )}
                {log.irys_tx_id && (
                  <a
                    href={`https://gateway.irys.xyz/${log.irys_tx_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#ffb800', textDecoration: 'none' }}
                  >
                    📦 Arweave TX ↗
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export Modal */}
      {isExportOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={() => setIsExportOpen(false)}
        >
          <div
            className="terminal-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '24px',
              background: '#0a0d14',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: '#00ff88', margin: 0, fontSize: '15px' }}>
                📥 Export PROVN Builder Passport
              </h3>
              <button
                onClick={() => setIsExportOpen(false)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#888', fontSize: '11px', lineHeight: '1.5', marginBottom: '16px' }}>
              Download or copy your portable cryptographic proof-of-work record in machine-readable JSON
              or Markdown.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <a
                href={`/api/passport/${wallet}`}
                download={`provn-passport-${wallet.slice(0, 8)}.json`}
                className="btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  textDecoration: 'none',
                  textAlign: 'center',
                  flex: 1,
                }}
              >
                💾 Download JSON
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(markdownExport)
                  setExportCopied(true)
                  setTimeout(() => setExportCopied(false), 2000)
                }}
                className="btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: '#0d111a',
                  border: '1px solid #1a2030',
                  color: exportCopied ? '#00ff88' : '#00e5ff',
                  flex: 1,
                }}
              >
                {exportCopied ? '✓ Markdown Copied' : '📋 Copy Markdown'}
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: '#0d111a',
                  border: '1px solid #1a2030',
                  color: '#ffb800',
                  flex: 1,
                }}
              >
                🖨️ Print / PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQROpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={() => setIsQROpen(false)}
        >
          <div
            className="terminal-card"
            style={{
              maxWidth: '360px',
              width: '100%',
              padding: '24px',
              background: '#0a0d14',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: '#00ff88', margin: 0, fontSize: '14px' }}>📱 Mobile Verification QR</h3>
              <button
                onClick={() => setIsQROpen(false)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#060709',
                border: '1px solid #1c2230',
                padding: '16px',
                borderRadius: '12px',
                display: 'inline-block',
                marginBottom: '16px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`QR code for ${wallet}`}
                width={200}
                height={200}
                style={{ display: 'block', borderRadius: '8px' }}
              />
            </div>

            <p style={{ color: '#888', fontSize: '11px', margin: '0 0 12px 0' }}>
              Scan to verify builder identity on mobile or in-person hackathons.
            </p>
            <code style={{ color: '#ffb800', fontSize: '10px' }}>{walletShort}</code>
          </div>
        </div>
      )}

      {/* Metallic Card Customizer Studio Modal */}
      {isCustomizerOpen && (
        <CardCustomizerModal
          reputation={reputation}
          currentTheme={activeTheme}
          onThemeSelect={(theme) => setActiveTheme(theme)}
          onClose={() => setIsCustomizerOpen(false)}
        />
      )}

      {/* Achievement Detail Inspector Modal */}
      {inspectedAchievement && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 160,
            padding: '16px',
          }}
          onClick={() => setInspectedAchievement(null)}
        >
          <div
            className="terminal-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: '#090b10',
              border: '1px solid #1c2438',
              borderRadius: '16px',
              padding: '24px',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{inspectedAchievement.icon}</span>
                <div>
                  <h3 style={{ color: '#00ff88', margin: 0, fontSize: '15px', fontFamily: 'var(--font-geist-mono), monospace' }}>
                    {inspectedAchievement.name}
                  </h3>
                  <span style={{ fontSize: '9px', color: '#889' }}>
                    {inspectedAchievement.rarity.toUpperCase()} PROVN CREDENTIAL
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectedAchievement(null)}
                style={{ background: 'none', border: 'none', color: '#667', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#ccc', fontSize: '12px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              {inspectedAchievement.description}
            </p>

            <div
              style={{
                background: '#06070a',
                border: '1px solid #141824',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '11px',
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#666' }}>Status:</span>
                <span style={{ color: inspectedAchievement.earned ? '#00ff88' : '#ffb800', fontWeight: 700 }}>
                  {inspectedAchievement.earned ? '✓ UNLOCKED & VERIFIED' : 'CRITERIA NOT MET'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#666' }}>Criteria:</span>
                <span style={{ color: '#aaa' }}>{inspectedAchievement.criteria}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>cNFT Mint Status:</span>
                <span style={{ color: '#00e5ff' }}>
                  {inspectedAchievement.earned ? 'Eligible (Deferred to Grant Phase)' : 'Ineligible'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setInspectedAchievement(null)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '12px' }}
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* GitHub Badge Embed Modal */}
      {selectedSvg && (
        <NFTBadgeModal
          isOpen={Boolean(selectedSvg)}
          onClose={() => setSelectedSvg(null)}
          svgString={selectedSvg}
          title={modalTitle}
        />
      )}
    </main>
  )
}
