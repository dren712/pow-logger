'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import ContributionHeatmap from '@/app/components/ContributionHeatmap'
import ExportPassportModal from '@/app/components/ExportPassportModal'
import PassportCard from '@/app/components/cards/PassportCard'
import AchievementCard from '@/app/components/cards/AchievementCard'
import CardCustomizerModal from '@/app/components/cards/CardCustomizerModal'
import ProofPacketModal from '@/app/components/ProofPacketModal'
import { CARD_THEMES, CardTheme, getCardTheme } from '@/app/lib/cardThemes'
import { Achievement, WalletLog } from '@/app/lib/types'
import { calculateReputation } from '@/app/lib/reputationEngine'

export type LogItem = WalletLog

interface ProfileClientProps {
  wallet: string
  initialLogs: LogItem[]
}

export default function ProfileClient({ wallet, initialLogs }: ProfileClientProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isProofPacketOpen, setIsProofPacketOpen] = useState(false)
  const [isQROpen, setIsQROpen] = useState(false)
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [showVerificationInfo, setShowVerificationInfo] = useState(false)
  const [inspectedAchievement, setInspectedAchievement] = useState<Achievement | null>(null)
  const [activeTheme, setActiveTheme] = useState<CardTheme>(CARD_THEMES.steel)
  const [copied, setCopied] = useState(false)
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

  // Initialize theme or packet from URL if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const themeParam = params.get('theme')
      if (themeParam) {
        setActiveTheme(getCardTheme(themeParam))
      }
      if (params.get('packet') === 'true') {
        setIsProofPacketOpen(true)
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

  return (
    <main
      style={{
        width: 'min(840px, 94vw)',
        margin: '0 auto',
        padding: '32px 16px 100px 16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Navigation & Streamlined Action Hierarchy */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <Link
          href="/"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
          }}
        >
          ← Back to Terminal
        </Link>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleCopyLink}
            className="btn-primary"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
            }}
          >
            {copied ? '✓ Link Copied' : '🔗 Share Passport'}
          </button>
          <button
            onClick={() => setIsProofPacketOpen(true)}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '11px', color: '#00e5ff', borderColor: 'rgba(0, 229, 255, 0.3)' }}
          >
            📦 Proof Packet
          </button>
          <button
            onClick={() => setIsExportOpen(true)}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '11px' }}
          >
            📥 Export
          </button>
          <button
            onClick={() => setIsQROpen(true)}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '11px' }}
          >
            📱 QR
          </button>
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '11px' }}
          >
            🎨 Metal Studio
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isPending}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '11px' }}
          >
            {isRefreshing ? '↻' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Layer 1: Identity Bar */}
      <div
        className="terminal-card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Solana Builder Identity
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {walletShort}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              background: 'rgba(0, 255, 136, 0.08)',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              color: '#00ff88',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            ✓ Cryptographically Verified
          </span>
          <button
            type="button"
            onClick={() => setShowVerificationInfo(true)}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            title="What does verified mean?"
          >
            ⓘ
          </button>
        </div>
      </div>

      {/* Historical Context Notice (Calm Informational Style) */}
      {reputation.legacyRecords > 0 && (
        <div
          style={{
            background: 'rgba(255, 184, 0, 0.05)',
            border: '1px solid rgba(255, 184, 0, 0.2)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '11px',
            color: 'var(--accent-achievement)',
            lineHeight: '1.45',
          }}
        >
          ℹ️ <strong>Historical Migration:</strong> {reputation.legacyRecords} record{reputation.legacyRecords === 1 ? '' : 's'} predate PROVN&apos;s v1.0 signing protocol. They remain visible for continuity but do not contribute to verified reputation metrics or streaks.
        </div>
      )}

      {/* Hero Metallic Passport Card (Tangible Builder Artifact) */}
      <div style={{ marginBottom: '24px' }}>
        <PassportCard
          reputation={reputation}
          theme={activeTheme}
          onCustomizeClick={() => setIsCustomizerOpen(true)}
          showControls={true}
        />
      </div>

      {/* Layer 2: 3-Signal Primary Reputation Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="terminal-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
            Verified Proofs
          </div>
          <div style={{ color: '#00ff88', fontSize: '24px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {reputation.verifiedProofs}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
            100% Ed25519 Signed
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
            Recent Activity
          </div>
          <div style={{ color: '#00e5ff', fontSize: '24px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {reputation.recentVerifiedProofs}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
            In last 30 days
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
            Evidence Coverage
          </div>
          <div style={{ color: '#ab9ff2', fontSize: '24px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {reputation.proofsWithGithubEvidence} / {reputation.verifiedProofs}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
            With GitHub PR / Commit links
          </div>
        </div>
      </div>

      {/* Secondary Metrics Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          marginBottom: '28px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <div>
          <span>Arweave Storage: </span>
          <strong style={{ color: '#ffffff' }}>{reputation.archivedVerifiedProofs} archived ({reputation.archivalSuccessRate}%)</strong>
        </div>
        <div>
          <span>Building Streak: </span>
          <strong style={{ color: '#ffb800' }}>🔥 {reputation.currentStreak}d (Best: {reputation.longestStreak}d)</strong>
        </div>
        <div>
          <span>Builder Level: </span>
          <strong style={{ color: reputation.builderLevel.color }}>{reputation.builderLevel.emoji} {reputation.builderLevel.title}</strong>
        </div>
      </div>

      {/* Heatmap Activity Section */}
      <div style={{ marginBottom: '28px' }}>
        <ContributionHeatmap logs={logs} />
      </div>

      {/* Skills & Protocol Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div className="terminal-card" style={{ padding: '16px' }}>
          <h3 style={{ color: '#00ff88', fontSize: '12px', margin: '0 0 12px 0', fontWeight: 700, textTransform: 'uppercase' }}>
            Verified Skills Frequency
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reputation.skills.length > 0 ? (
              reputation.skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSelectedSkill(selectedSkill === s.name ? 'ALL' : s.name)}
                  style={{
                    background: selectedSkill === s.name ? 'rgba(0, 255, 136, 0.15)' : 'var(--bg-base)',
                    border: selectedSkill === s.name ? '1px solid #00ff88' : '1px solid var(--border-subtle)',
                    color: selectedSkill === s.name ? '#00ff88' : 'var(--text-main)',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  #{s.name} <strong style={{ color: '#00ff88' }}>({s.count})</strong>
                </button>
              ))
            ) : (
              <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>No skills classified yet</span>
            )}
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '16px' }}>
          <h3 style={{ color: '#00e5ff', fontSize: '12px', margin: '0 0 12px 0', fontWeight: 700, textTransform: 'uppercase' }}>
            Protocols & Ecosystem Stack
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reputation.protocols.length > 0 ? (
              reputation.protocols.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedProtocol(selectedProtocol === p.name ? 'ALL' : p.name)}
                  style={{
                    background: selectedProtocol === p.name ? 'rgba(0, 229, 255, 0.15)' : 'var(--bg-base)',
                    border: selectedProtocol === p.name ? '1px solid #00e5ff' : '1px solid var(--border-subtle)',
                    color: selectedProtocol === p.name ? '#00e5ff' : '#00e5ff',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ {p.name} <strong style={{ color: '#ffb800' }}>({p.count})</strong>
                </button>
              ))
            ) : (
              <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>No protocols classified yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="terminal-card"
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
        <div style={{ display: 'flex', gap: '8px', flex: '1 1 240px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search proof descriptions or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(selectedCategory !== 'ALL' || selectedSkill !== 'ALL' || selectedProtocol !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedCategory('ALL')
                setSelectedSkill('ALL')
                setSelectedProtocol('ALL')
              }}
              style={{
                background: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid #ff4444',
                color: '#ff4444',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              ✕ Reset Filters
            </button>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            Showing <strong>{filteredLogs.length}</strong> of {logs.length}
          </div>
        </div>
      </div>

      {/* Layer 3: History & Proof Timeline */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '36px' }}>
        {filteredLogs.length === 0 ? (
          <div
            className="terminal-card"
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-faint)',
            }}
          >
            <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>No proof logs matched the selected filters.</p>
            <Link href="/" className="btn-primary" style={{ fontSize: '11px', padding: '6px 14px' }}>
              + Log New Proof
            </Link>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="terminal-card"
              style={{
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  Proof #{log.id} • {new Date(log.created_at).toLocaleDateString()}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: log.nonce ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 184, 0, 0.08)',
                    border: log.nonce ? '1px solid rgba(0, 255, 136, 0.25)' : '1px solid rgba(255, 184, 0, 0.25)',
                    color: log.nonce ? '#00ff88' : '#ffb800',
                  }}
                >
                  {log.nonce ? '✓ ED25519 VERIFIED' : 'HISTORICAL RECORD'}
                </span>
              </div>

              <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                {log.content}
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <Link href={`/proof/${log.id}`} style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}>
                  Inspect Record ↗
                </Link>
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
                    🔗 Live Demo ↗
                  </a>
                )}
                {log.irys_tx_id && !log.irys_tx_id.startsWith('powl_') && (
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

      {/* Layer 4: Milestone Credentials (Objective Activity Demoted Below Evidence) */}
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
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ color: '#ffffff', fontSize: '14px', margin: 0, fontWeight: 700 }}>
              Builder Milestones & Credentials
            </h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
              Deterministic milestones verified from your Ed25519 work history.
            </div>
          </div>

          {/* Achievement Status Filters */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setAchievementFilter('all')}
              style={{
                background: achievementFilter === 'all' ? 'rgba(0, 255, 136, 0.12)' : 'var(--bg-base)',
                border: achievementFilter === 'all' ? '1px solid #00ff88' : '1px solid var(--border-subtle)',
                color: achievementFilter === 'all' ? '#00ff88' : 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              All ({reputation.achievements.length})
            </button>
            <button
              onClick={() => setAchievementFilter('unlocked')}
              style={{
                background: achievementFilter === 'unlocked' ? 'rgba(0, 255, 136, 0.12)' : 'var(--bg-base)',
                border: achievementFilter === 'unlocked' ? '1px solid #00ff88' : '1px solid var(--border-subtle)',
                color: achievementFilter === 'unlocked' ? '#00ff88' : 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              ✓ Unlocked ({reputation.achievements.filter((a) => a.earned).length})
            </button>
            <button
              onClick={() => setAchievementFilter('locked')}
              style={{
                background: achievementFilter === 'locked' ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-base)',
                border: achievementFilter === 'locked' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-subtle)',
                color: achievementFilter === 'locked' ? '#ffffff' : 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              🔒 Locked ({reputation.achievements.filter((a) => !a.earned).length})
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {reputation.achievements
            .filter((ach) => {
              if (achievementFilter === 'unlocked') return ach.earned
              if (achievementFilter === 'locked') return !ach.earned
              return true
            })
            .map((ach) => (
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

      {/* Verification Info Modal */}
      {showVerificationInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '16px',
          }}
          onClick={() => setShowVerificationInfo(false)}
        >
          <div
            className="terminal-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#00ff88', fontSize: '15px', fontWeight: 800 }}>
                What PROVN Verifies
              </h3>
              <button
                onClick={() => setShowVerificationInfo(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
              PROVN verifies that the displayed Solana private key authored and signed the exact canonical proof statement with TweetNaCl Ed25519, within an anti-replay time window.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              PROVN does not independently evaluate code quality, commercial utility, or external truth of the builder&apos;s statement.
            </p>
            <button
              onClick={() => setShowVerificationInfo(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '12px' }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportOpen && (
        <ExportPassportModal
          wallet={wallet}
          reputation={reputation}
          logs={logs}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Proof Packet Modal */}
      <ProofPacketModal
        isOpen={isProofPacketOpen}
        onClose={() => setIsProofPacketOpen(false)}
        wallet={wallet}
        reputation={reputation}
        logs={logs}
      />

      {/* QR Code Modal */}
      {isQROpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
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
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: '#00ff88', margin: 0, fontSize: '14px', fontWeight: 700 }}>Mobile Verification QR</h3>
              <button
                onClick={() => setIsQROpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#060709',
                border: '1px solid var(--border-subtle)',
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

            <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 12px 0' }}>
              Scan to verify builder identity on mobile or in-person hackathons.
            </p>
            <code style={{ color: '#ffb800', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{walletShort}</code>
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
              padding: '24px',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{inspectedAchievement.icon}</span>
                <div>
                  <h3 style={{ color: '#00ff88', margin: 0, fontSize: '15px', fontWeight: 700 }}>
                    {inspectedAchievement.name}
                  </h3>
                  <span style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                    {inspectedAchievement.rarity} Milestone
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectedAchievement(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-main)', fontSize: '12px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              {inspectedAchievement.description}
            </p>

            <div
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-faint)' }}>Status:</span>
                <span style={{ color: inspectedAchievement.earned ? '#00ff88' : '#ffb800', fontWeight: 700 }}>
                  {inspectedAchievement.earned ? '✓ UNLOCKED & VERIFIED' : 'CRITERIA NOT MET'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-faint)' }}>Criteria:</span>
                <span style={{ color: 'var(--text-main)' }}>{inspectedAchievement.criteria}</span>
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
    </main>
  )
}
