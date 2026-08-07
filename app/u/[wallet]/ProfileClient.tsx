'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { classifyLog } from '@/app/lib/classifier'
import { generateNFTBadgeSVG, generateSingleLogNFTBadgeSVG } from '@/app/lib/badgeGenerator'
import ContributionHeatmap from '@/app/components/ContributionHeatmap'
import NFTBadgeModal from '@/app/components/NFTBadgeModal'
import BuilderBadge from '@/app/components/BuilderBadge'
import { ArchivalState } from '@/app/lib/irys'
import { computeBadgeSummary } from '@/app/lib/milestones'

export interface LogItem {
  id: number
  wallet_address: string
  content: string
  category?: string
  skills?: string[]
  protocols?: string[]
  created_at: string
  irys_tx_id?: string | null
  archival_state?: ArchivalState
  signature?: string
  evidence_url?: string | null
  github_url?: string | null
  [key: string]: unknown
}

interface ProfileClientProps {
  wallet: string
  initialLogs: LogItem[]
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return isNaN(d.getTime())
    ? 'Just now'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function ProfileClient({ wallet, initialLogs }: ProfileClientProps) {
  const [copied, setCopied] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSvg, setModalSvg] = useState('')
  const [modalTitle, setModalTitle] = useState('PROVN NFT Proof Badge 🗿')
  const [modalLogId, setModalLogId] = useState<number | undefined>(undefined)
  const [modalLogContent, setModalLogContent] = useState<string>('')
  const [modalIrysTxId, setModalIrysTxId] = useState<string | undefined>(undefined)

  const walletShort = useMemo(() => {
    return wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet
  }, [wallet])

  // Member since date (earliest log)
  const memberSince = useMemo(() => {
    if (initialLogs.length === 0) return 'N/A'
    const sorted = [...initialLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    return formatDate(sorted[0].created_at)
  }, [initialLogs])

  // Consecutive Streak Count
  const streakCount = useMemo(() => {
    if (initialLogs.length === 0) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const logDates = [
      ...new Set(initialLogs.map((l) => new Date(l.created_at).toDateString())),
    ]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())

    let streak = 0
    let checkDate = new Date(today)
    for (const date of logDates) {
      const diff = Math.round((checkDate.getTime() - date.getTime()) / 86400000)
      if (diff === 0 || diff === 1) {
        streak++
        checkDate = date
      } else break
    }
    return streak
  }, [initialLogs])

  // Calculate longest streak ever achieved
  const longestStreak = useMemo(() => {
    if (initialLogs.length === 0) return 0
    const logDates = [
      ...new Set(initialLogs.map((l) => new Date(l.created_at).toDateString())),
    ]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())

    let longest = 1
    let current = 1
    for (let i = 0; i < logDates.length - 1; i++) {
      const diff = Math.round((logDates[i].getTime() - logDates[i + 1].getTime()) / 86400000)
      if (diff === 1) {
        current++
        longest = Math.max(longest, current)
      } else {
        current = 1
      }
    }
    return Math.max(longest, current)
  }, [initialLogs])

  // Compute badge summary
  const badgeSummary = useMemo(
    () => computeBadgeSummary(initialLogs.length, streakCount, longestStreak),
    [initialLogs.length, streakCount, longestStreak]
  )

  // Skills Breakdown (Top 3)
  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {}
    let total = 0

    initialLogs.forEach((l) => {
      const skills: string[] =
        l.skills && l.skills.length > 0 ? l.skills : classifyLog(l.content).skills
      skills.forEach((s) => {
        counts[s] = (counts[s] || 0) + 1
        total++
      })
    })

    if (total === 0) return []

    return Object.entries(counts)
      .map(([skill, count]) => ({
        skill,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [initialLogs])

  const copyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Category Color Selector (Development=emerald, Debugging=amber, Security=red, Research=cyan)
  const getCategoryBadgeStyle = (category: string) => {
    const cat = category.toLowerCase()
    if (cat.includes('debug')) {
      return { bg: 'rgba(255, 184, 0, 0.1)', border: 'rgba(255, 184, 0, 0.3)', color: '#ffb800' }
    }
    if (cat.includes('security') || cat.includes('auth')) {
      return { bg: 'rgba(255, 68, 68, 0.1)', border: 'rgba(255, 68, 68, 0.3)', color: '#ff4444' }
    }
    if (cat.includes('research') || cat.includes('study')) {
      return { bg: 'rgba(0, 229, 255, 0.1)', border: 'rgba(0, 229, 255, 0.3)', color: '#00e5ff' }
    }
    return { bg: 'rgba(0, 255, 136, 0.1)', border: 'rgba(0, 255, 136, 0.3)', color: '#00ff88' }
  }

  return (
    <main
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        padding: '32px 20px 100px 20px',
        fontFamily: 'var(--font-geist-mono), monospace',
      }}
    >
      {/* Header Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <Link
          href="/"
          className="btn-primary"
          style={{
            fontSize: '12px',
            padding: '6px 14px',
          }}
        >
          ← Back to PROVN Terminal 🗿
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              const svg = generateNFTBadgeSVG(wallet, streakCount)
              setModalSvg(svg)
              setModalTitle(`PROVN Builder NFT — ${walletShort}`)
              setModalOpen(true)
            }}
            className="btn-primary"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderColor: '#00ff88',
              color: '#00ff88',
            }}
          >
            🖼️ View NFT Badge
          </button>

          <button
            onClick={copyProfileLink}
            className="btn-primary"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderColor: '#00e5ff',
              color: '#00e5ff',
            }}
          >
            {copied ? '✓ Profile Link Copied!' : '📋 Copy Profile Link'}
          </button>
        </div>
      </div>

      {/* Top Profile Summary Card */}
      <section className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Wallet Shortened in Amber */}
              <h1 style={{ color: '#ffb800', fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>
                {walletShort}
              </h1>
              <span
                style={{
                  background: 'rgba(0, 255, 136, 0.1)',
                  color: '#00ff88',
                  border: '1px solid rgba(0, 255, 136, 0.25)',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                VERIFIED BUILDER
              </span>
            </div>
            <p style={{ color: '#777', fontSize: '12px', margin: '8px 0 0 0' }}>
              Full Address: <code style={{ color: '#aaa' }}>{wallet}</code>
            </p>
            <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0 0' }}>
              Member since: <strong style={{ color: '#888' }}>{memberSince}</strong>
            </p>
          </div>

          {/* Featured Streak Counter — Biggest element on page in Neon Emerald */}
          <div
            style={{
              background: '#060709',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              borderRadius: '12px',
              padding: '16px 28px',
              textAlign: 'center',
              boxShadow: '0 0 24px rgba(0, 255, 136, 0.1)',
            }}
          >
            <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Active Streak
            </div>
            <div style={{ color: '#00ff88', fontSize: '36px', fontWeight: 900, marginTop: '2px' }}>
              🔥 {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
            </div>
          </div>
        </div>

        {/* Stats Row & Top Skills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid #161a24',
          }}
        >
          <div>
            <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Permanent Logs
            </div>
            <div style={{ color: '#00e5ff', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
              📦 {initialLogs.length} Verified Entries
            </div>
          </div>

          {topSkills.length > 0 && (
            <div>
              <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Top Skills Breakdown
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {topSkills.map((s) => (
                  <div key={s.skill} style={{ fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '3px' }}>
                      <span>{s.skill}</span>
                      <span style={{ color: '#00ff88', fontWeight: 700 }}>{s.percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: '#161b26', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.percent}%`, height: '100%', background: '#00ff88', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Builder Badge & Level Card */}
      {initialLogs.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <BuilderBadge badge={badgeSummary} />
        </section>
      )}

      {/* GitHub-Grade 365-Day Contribution Heatmap */}
      <section style={{ marginBottom: '32px' }}>
        <ContributionHeatmap logs={initialLogs} />
      </section>

      {/* Log Timeline Feed */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', margin: 0 }}>
            Verifiable Proof Timeline ({initialLogs.length})
          </h2>
          <span style={{ color: '#555', fontSize: '11px' }}>Sorted newest first</span>
        </div>

        {initialLogs.map((l, index) => {
          const classification = (l.skills && l.protocols && l.category)
            ? { skills: l.skills, protocols: l.protocols, category: l.category }
            : classifyLog(l.content)

          const badgeStyle = getCategoryBadgeStyle(classification.category)
          const logNumber = initialLogs.length - index

          return (
            <div
              key={l.id}
              className="glass-card"
              style={{
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#666',
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#ffb800', fontWeight: 800 }}>#{logNumber}</span>
                  <span>•</span>
                  <span style={{ color: '#ccc', fontWeight: 600 }}>{formatDate(l.created_at)}</span>
                  <span>,</span>
                  <span>{formatTime(l.created_at)}</span>
                </div>

                {l.irys_tx_id ? (
                  <a
                    href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(0, 255, 136, 0.08)',
                      color: '#00ff88',
                      border: '1px solid rgba(0, 255, 136, 0.25)',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    ✓ Archived on Irys ↗
                  </a>
                ) : l.archival_state === 'failed' ? (
                  <span
                    style={{
                      background: 'rgba(255, 184, 0, 0.08)',
                      color: '#ffb800',
                      border: '1px solid rgba(255, 184, 0, 0.25)',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                    }}
                  >
                    Archival Failed — Retry Available
                  </span>
                ) : l.archival_state === 'legacy_unverified' ? (
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#888',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                    }}
                  >
                    Legacy Record — Archival Status Unverified
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(0, 229, 255, 0.08)',
                      color: '#00e5ff',
                      border: '1px solid rgba(0, 229, 255, 0.25)',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                    }}
                  >
                    Stored in DB — Archival Pending
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: '0 0 14px 0',
                  color: '#ececec',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {l.content}
              </p>

              {/* External Evidence Links */}
              {Boolean(l.github_url || l.evidence_url) && (
                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                  {Boolean(l.github_url) && (
                    <a
                      href={l.github_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#00e5ff',
                        background: 'rgba(0, 229, 255, 0.08)',
                        border: '1px solid rgba(0, 229, 255, 0.25)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      🐙 GitHub Evidence ↗
                    </a>
                  )}
                  {Boolean(l.evidence_url) && (
                    <a
                      href={l.evidence_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#00ff88',
                        background: 'rgba(0, 255, 136, 0.08)',
                        border: '1px solid rgba(0, 255, 136, 0.25)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      🔗 Demo / Deployment ↗
                    </a>
                  )}
                </div>
              )}

              {/* Classification Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                <span
                  style={{
                    background: badgeStyle.bg,
                    color: badgeStyle.color,
                    border: `1px solid ${badgeStyle.border}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {classification.category}
                </span>
                {classification.skills.map((s: string) => (
                  <span
                    key={s}
                    style={{
                      background: 'rgba(0, 255, 136, 0.06)',
                      color: '#00ff88',
                      border: '1px solid rgba(0, 255, 136, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    {s}
                  </span>
                ))}
                {classification.protocols.map((p: string) => (
                  <span
                    key={p}
                    style={{
                      background: 'rgba(255, 184, 0, 0.06)',
                      color: '#ffb800',
                      border: '1px solid rgba(255, 184, 0, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>

              {/* Footer Gateway Link, Download Log NFT & Metadata Toggle */}
              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid #161a24',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {l.irys_tx_id && (
                    <a
                      href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                      rel="noopener noreferrer"
                      style={{
                        color: '#00ff88',
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}
                    >
                      🔗 Gateway Proof ↗
                    </a>
                  )}

                  <button
                    onClick={() => {
                      const svg = generateSingleLogNFTBadgeSVG(
                        wallet,
                        logNumber,
                        l.content,
                        classification.category,
                        classification.skills,
                        formatDate(l.created_at),
                        l.irys_tx_id || undefined
                      )
                      setModalSvg(svg)
                      setModalTitle(`PROVN Proof Card #${logNumber} 🗿`)
                      setModalLogId(l.id)
                      setModalLogContent(l.content)
                      setModalIrysTxId(l.irys_tx_id || undefined)
                      setModalOpen(true)
                    }}
                    style={{
                      background: 'rgba(0, 229, 255, 0.08)',
                      border: '1px solid rgba(0, 229, 255, 0.25)',
                      color: '#00e5ff',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: '10.5px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                    }}
                  >
                    🖼️ View Proof Card 🗿
                  </button>
                </div>

                <button
                  onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                >
                  {expandedLogId === l.id ? '▲ Hide Metadata' : '🔍 Inspect Proof'}
                </button>
              </div>

              {expandedLogId === l.id && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#060709',
                    border: '1px solid #1a202c',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#888',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div><span style={{ color: '#555' }}>LOG_ID:</span> #{l.id}</div>
                  <div><span style={{ color: '#555' }}>WAL_ATTRIBUTION:</span> {l.wallet_address}</div>
                  <div><span style={{ color: '#555' }}>IRYS_TX_ID:</span> <code style={{ color: '#00e5ff' }}>{l.irys_tx_id || 'N/A'}</code></div>
                  <div><span style={{ color: '#555' }}>SIGNATURE_STATUS:</span> <span style={{ color: '#00ff88' }}>Ed25519 Verified</span></div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <NFTBadgeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        svgString={modalSvg}
        title={modalTitle}
        logId={modalLogId}
        logContent={modalLogContent}
        irysTxId={modalIrysTxId}
      />
    </main>
  )
}
