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
import { useQRCode } from '@/app/lib/qrcode'
import { useWallet } from '@solana/wallet-adapter-react'
import { buildCanonicalIdentityLinkMessage } from '@/app/lib/canonicalMessage'
import bs58 from 'bs58'

export type LogItem = WalletLog

interface ProfileClientProps {
  wallet: string
  initialLogs: LogItem[]
}

export default function ProfileClient({ wallet, initialLogs }: ProfileClientProps) {
  const { publicKey, signMessage } = useWallet()
  const [logs, setLogs] = useState<LogItem[]>(initialLogs)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isProofPacketOpen, setIsProofPacketOpen] = useState(false)
  const [isQROpen, setIsQROpen] = useState(false)
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [inspectedAchievement, setInspectedAchievement] = useState<Achievement | null>(null)
  const [activeTheme, setActiveTheme] = useState<CardTheme>(CARD_THEMES.steel)
  const [copied, setCopied] = useState(false)
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [identityLinkStatus, setIdentityLinkStatus] = useState<'success' | 'error' | null>(null)

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
      // GitHub OAuth identity linking feedback
      const identityLinked = params.get('identity_linked')
      if (identityLinked === 'true') {
        setIdentityLinkStatus('success')
        // Clean up URL params
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('identity_linked')
        window.history.replaceState({}, '', cleanUrl.toString())
        // Auto-dismiss after 5 seconds
        setTimeout(() => setIdentityLinkStatus(null), 5000)
      } else if (identityLinked === 'false') {
        setIdentityLinkStatus('error')
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('identity_linked')
        cleanUrl.searchParams.delete('error')
        window.history.replaceState({}, '', cleanUrl.toString())
        setTimeout(() => setIdentityLinkStatus(null), 8000)
      }
    }
  }, [])

  const handleLinkGithub = async () => {
    if (!publicKey || publicKey.toBase58() !== wallet) {
      setIdentityLinkStatus('error')
      // Custom error message for wallet mismatch handled implicitly, but let's just alert
      alert('Please connect the wallet for this profile to link GitHub.')
      return
    }
    if (!signMessage) {
      alert('Your wallet does not support message signing.')
      return
    }

    try {
      // 1. Fetch Challenge
      const challengeRes = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet })
      })
      if (!challengeRes.ok) throw new Error('Failed to fetch signing challenge')
      const { challenge } = await challengeRes.json()

      // 2. Sign canonical message
      const timestamp = new Date().toISOString()
      const clientDomain = window.location.host.split(':')[0]
      const canonicalMsg = buildCanonicalIdentityLinkMessage({
        domain: clientDomain,
        walletAddress: wallet,
        challenge,
        timestamp
      })

      const messageBytes = new TextEncoder().encode(canonicalMsg)
      const rawSigResult = await signMessage(messageBytes)
      
      // Support Uint8Array or Buffer returns
      const signatureBytes = rawSigResult instanceof Uint8Array ? rawSigResult : new Uint8Array((rawSigResult as { data?: number[] }).data || Object.values(rawSigResult))
      const signature = bs58.encode(signatureBytes)

      // 3. Initiate OAuth securely
      const authRes = await fetch('/api/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet,
          challenge,
          signature,
          timestamp
        })
      })

      if (!authRes.ok) {
        const err = await authRes.json()
        throw new Error(err.error || 'Failed to initiate OAuth')
      }

      const { url } = await authRes.json()
      window.location.href = url
    } catch (err: unknown) {
      console.error(err)
      setIdentityLinkStatus('error')
      alert(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

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

  // Phase 2: Sort evidence by provenance quality
  const provenanceRank: Record<string, number> = {
    source_verified: 3,
    source_linked: 2,
    partner_attested: 2,
    self_attested: 1,
  }
  
  const sortedFilteredLogs = [...filteredLogs].sort((a, b) => {
    const aRank = provenanceRank[a.provenance_level || 'self_attested'] || 1
    const bRank = provenanceRank[b.provenance_level || 'self_attested'] || 1
    if (aRank !== bRank) return bRank - aRank
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const walletShort = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
  const verificationUrl = `https://provn-sol.vercel.app/u/${wallet}`
  const qrUrl = useQRCode(verificationUrl, {
    width: 240,
    darkColor: '#00ff88',
    lightColor: '#060709',
  })

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
            onClick={() => setIsProofPacketOpen(true)}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: '1px solid #00ff88',
              color: '#00ff88',
              fontWeight: 700,
            }}
          >
            📦 Proof Packet
          </button>
          {publicKey && publicKey.toBase58() === wallet && (
            <button
              onClick={handleLinkGithub}
              className="btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                background: '#0d111a',
                border: '1px solid #1e2638',
                color: '#ffffff',
              }}
            >
              🐙 Link GitHub
            </button>
          )}
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
            📥 Export All
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

      {/* GitHub Identity Link Feedback Toast */}
      {identityLinkStatus === 'success' && (
        <div
          style={{
            background: 'rgba(0, 255, 136, 0.08)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#00ff88',
            lineHeight: '1.45',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ <strong>GitHub account linked successfully!</strong> Your future proof submissions will be identity-verified against your GitHub profile.</span>
          <button
            onClick={() => setIdentityLinkStatus(null)}
            style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}
      {identityLinkStatus === 'error' && (
        <div
          style={{
            background: 'rgba(255, 68, 68, 0.08)',
            border: '1px solid rgba(255, 68, 68, 0.3)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#ff4444',
            lineHeight: '1.45',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ <strong>GitHub linking failed.</strong> Please try again. If the problem persists, check that your GitHub OAuth app is configured correctly.</span>
          <button
            onClick={() => setIdentityLinkStatus(null)}
            style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Legacy Context Banner (if applicable) */}
      {reputation.legacyRecords > 0 && (
        <div
          style={{
            background: 'rgba(255, 184, 0, 0.06)',
            border: '1px solid rgba(255, 184, 0, 0.25)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '11px',
            color: '#ffb800',
            lineHeight: '1.45',
          }}
        >
          <strong>ℹ️ Historical Context:</strong> This wallet contains <strong>{reputation.legacyRecords} legacy record{reputation.legacyRecords === 1 ? '' : 's'}</strong> logged prior to PROVN protocol v1.0 signing standards. To preserve cryptographic integrity, legacy records remain visible in your timeline below but do not contribute to verified reputation metrics or daily streak calculations.
        </div>
      )}

      {/* Metallic Builder Passport Hero Card */}
      <div style={{ marginBottom: '32px' }}>
        <PassportCard
          reputation={reputation}
          theme={activeTheme}
          onCustomizeClick={() => setIsCustomizerOpen(true)}
          showControls={true}
        />
      </div>

      {/* Evidence-First Reputation Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Verified Proofs</div>
          <div style={{ color: '#00ff88', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            ⚡ {reputation.verifiedProofs}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>100% Ed25519 Signed</div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>30-Day Activity</div>
          <div style={{ color: '#00e5ff', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            📊 {reputation.recentVerifiedProofs}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>Recent Verified Proofs</div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>GitHub Evidence</div>
          <div style={{ color: '#ab9ff2', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            🐙 {reputation.proofsWithGithubEvidence}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>Self-Attested PRs</div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Arweave Archival</div>
          <div style={{ color: '#27c93f', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            📦 {reputation.archivalSuccessRate}%
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
            {reputation.archivedVerifiedProofs} Confirmed L1 TXs
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Active Streak</div>
          <div style={{ color: '#ffb800', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            🔥 {reputation.currentStreak}d
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
            Longest: {reputation.longestStreak}d
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div style={{ marginBottom: '24px' }}>
        <ContributionHeatmap logs={logs} />
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
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ color: '#00ff88', fontSize: '14px', margin: 0, fontWeight: 800 }}>
              🏆 Proven Builder Achievements
            </h2>
            <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
              Deterministic milestones verified from your Ed25519 work log history.
            </div>
          </div>

          {/* Achievement Status Filters */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setAchievementFilter('all')}
              style={{
                background: achievementFilter === 'all' ? 'rgba(0, 255, 136, 0.15)' : '#0d111a',
                border: achievementFilter === 'all' ? '1px solid #00ff88' : '1px solid #1a2030',
                color: achievementFilter === 'all' ? '#00ff88' : '#889',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: achievementFilter === 'all' ? 700 : 400,
              }}
            >
              All ({reputation.achievements.length})
            </button>
            <button
              onClick={() => setAchievementFilter('unlocked')}
              style={{
                background: achievementFilter === 'unlocked' ? 'rgba(0, 255, 136, 0.15)' : '#0d111a',
                border: achievementFilter === 'unlocked' ? '1px solid #00ff88' : '1px solid #1a2030',
                color: achievementFilter === 'unlocked' ? '#00ff88' : '#889',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: achievementFilter === 'unlocked' ? 700 : 400,
              }}
            >
              ✓ Unlocked ({reputation.achievements.filter((a) => a.earned).length})
            </button>
            <button
              onClick={() => setAchievementFilter('locked')}
              style={{
                background: achievementFilter === 'locked' ? 'rgba(255, 255, 255, 0.1)' : '#0d111a',
                border: achievementFilter === 'locked' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #1a2030',
                color: achievementFilter === 'locked' ? '#f0f4fc' : '#889',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: achievementFilter === 'locked' ? 700 : 400,
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
            gap: '16px',
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
            Verifiable Proof Timeline ({sortedFilteredLogs.length})
          </h2>
          <span style={{ color: '#555', fontSize: '11px' }}>Sorted by evidence quality (Source-Verified first)</span>
        </div>

        {sortedFilteredLogs.length === 0 ? (
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
          sortedFilteredLogs.map((log) => (
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
                  {log.provenance_level === 'source_verified' && (
                    <span style={{ background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', color: '#00ff88', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      🟢 Source-Verified
                    </span>
                  )}
                  {log.provenance_level === 'source_linked' && (
                    <span style={{ background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#00e5ff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      🔵 Source-Linked
                    </span>
                  )}
                  {(!log.provenance_level || log.provenance_level === 'self_attested') && (
                    <span style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#aaa', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                      ⚪ Self-Attested
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
                minWidth: '200px',
                minHeight: '200px',
              }}
            >
              {qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrUrl}
                  alt={`QR code for ${wallet}`}
                  width={200}
                  height={200}
                  style={{ display: 'block', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '11px' }}>
                  Generating QR...
                </div>
              )}
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
    </main>
  )
}
