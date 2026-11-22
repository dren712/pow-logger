'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import ContributionHeatmap from '@/app/components/ContributionHeatmap'
import ExportPassportModal from '@/app/components/ExportPassportModal'
import PassportCard from '@/app/components/cards/PassportCard'
import IdentityCard from '@/app/components/wallet-profile/IdentityCard'
import StatGrid from '@/app/components/wallet-profile/StatGrid'
import Achievements, { AchievementInspector, AchievementFilter } from '@/app/components/wallet-profile/Achievements'
import TagFilter from '@/app/components/wallet-profile/TagFilter'
import ProofTimeline from '@/app/components/wallet-profile/ProofTimeline'
import { Modal, Notice, shortWallet } from '@/app/components/wallet-profile/ui'
import '@/app/styles/wallet-profile.css'
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
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all')
  const [identityLinkStatus, setIdentityLinkStatus] = useState<'success' | 'error' | null>(null)
  const [identityLinkError, setIdentityLinkError] = useState<string | null>(null)
  const [identityRelinkRequired, setIdentityRelinkRequired] = useState(false)

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
        if (params.get('error') === 'relink_required') {
          setIdentityRelinkRequired(true)
          setIdentityLinkError('This wallet is already linked to a different GitHub account.')
        }
        setIdentityLinkStatus('error')
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('identity_linked')
        cleanUrl.searchParams.delete('error')
        window.history.replaceState({}, '', cleanUrl.toString())
        setTimeout(() => setIdentityLinkStatus(null), 8000)
      }
    }
  }, [])

  const handleLinkGithub = async (action: 'Link' | 'Relink' = 'Link') => {
    if (!publicKey || publicKey.toBase58() !== wallet) {
      setIdentityLinkError('Connect the wallet for this profile to link GitHub.')
      setIdentityLinkStatus('error')
      return
    }
    if (!signMessage) {
      setIdentityLinkError('Your wallet does not support message signing.')
      setIdentityLinkStatus('error')
      return
    }

    setIdentityLinkError(null)
    setIdentityLinkStatus(null)
    setIdentityRelinkRequired(false)
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
        timestamp,
        action
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
          timestamp,
          action
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
      setIdentityLinkError(err instanceof Error ? err.message : 'Authentication failed')
      setIdentityLinkStatus('error')
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

  const walletShort = shortWallet(wallet)
  const verificationUrl = `https://provn-sol.vercel.app/u/${wallet}`
  const qrUrl = useQRCode(verificationUrl, {
    width: 240,
    darkColor: '#0b0d11',
    lightColor: '#ffffff',
  })

  const isOwner = !!publicKey && publicKey.toBase58() === wallet
  const hasLogs = logs.length > 0
  const activeTags = [
    ...(selectedSkill !== 'ALL' ? [{ label: `Skill: ${selectedSkill}`, onClear: () => setSelectedSkill('ALL') }] : []),
    ...(selectedProtocol !== 'ALL' ? [{ label: `Protocol: ${selectedProtocol}`, onClear: () => setSelectedProtocol('ALL') }] : []),
  ]
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('ALL')
    setSelectedSkill('ALL')
    setSelectedProtocol('ALL')
  }

  return (
    <main className="pv-main mx-auto grid w-full max-w-5xl flex-1 gap-6 px-5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <IdentityCard
          wallet={wallet}
          reputation={reputation}
          isOwner={isOwner}
          copied={copied}
          refreshing={isRefreshing || isPending}
          themeName={activeTheme.name}
          onProofPacket={() => setIsProofPacketOpen(true)}
          onCopyLink={handleCopyLink}
          onQr={() => setIsQROpen(true)}
          onExport={() => setIsExportOpen(true)}
          onCustomize={() => setIsCustomizerOpen(true)}
          onRefresh={handleRefresh}
          onLinkGithub={() => handleLinkGithub()}
        />

        <div className="pv-card p-5 text-[12px] leading-relaxed">
          <p className="pv-eyebrow">Verification</p>
          <p className="pv-muted mt-2">
            Each proof is signed by this wallet with Ed25519 and can be checked independently. Evidence links are provided by the wallet
            owner unless a proof is marked source-verified.
          </p>
          <p className="pv-faint mt-3">Wallet address</p>
          <p className="pv-mono mt-1 break-all text-[11px] text-[#aab2c0]">{wallet}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {identityLinkStatus === 'success' && (
          <Notice tone="success" title="GitHub account linked." onDismiss={() => setIdentityLinkStatus(null)}>
            Future proof submissions will be checked against your GitHub identity.
          </Notice>
        )}
        {identityLinkStatus === 'error' && (
          <Notice
            tone="error"
            title="GitHub linking failed."
            onDismiss={() => {
              setIdentityLinkStatus(null)
              setIdentityLinkError(null)
            }}
          >
            {identityLinkError || 'Please try again. If it keeps failing, the GitHub OAuth app may not be configured for this deployment.'}
            {identityRelinkRequired && (
              <button type="button" className="pv-btn mt-3" onClick={() => handleLinkGithub('Relink')}>
                Replace with the GitHub account I sign in with
              </button>
            )}
          </Notice>
        )}
        {reputation.legacyRecords > 0 && (
          <Notice tone="info" title="Legacy records.">
            This wallet has {reputation.legacyRecords} record{reputation.legacyRecords === 1 ? '' : 's'} logged before the v1.0 signing
            standard. They stay visible in the list below but do not count toward verified totals or streaks.
          </Notice>
        )}

        <StatGrid reputation={reputation} />

        <section className="pv-card overflow-hidden" aria-label="Builder passport card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1c222c] px-5 py-4 sm:px-6">
            <h2 className="pv-h2">Builder passport</h2>
            <span className="pv-faint text-[12px]">Shareable card for this wallet</span>
          </div>
          <div className="px-3 py-6 sm:px-6">
            <PassportCard
              reputation={reputation}
              theme={activeTheme}
              onCustomizeClick={() => setIsCustomizerOpen(true)}
              showControls={true}
            />
          </div>
        </section>

        {!hasLogs ? (
          <section className="pv-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="pv-eyebrow">No public proofs</p>
            <h2 className="text-lg font-semibold tracking-tight text-white">Nothing has been logged from this wallet yet</h2>
            <p className="pv-muted max-w-md text-[14px] leading-relaxed">
              Proofs appear here once the wallet owner signs and publishes them. If you expected to see entries, check the address or
              refresh.
            </p>
            <div className="no-print mt-2 flex flex-wrap justify-center gap-2">
              <Link href="/log" className="pv-btn-ghost">Log a proof</Link>
              <button type="button" className="pv-btn-ghost" onClick={handleRefresh} disabled={isRefreshing || isPending}>
                {isRefreshing || isPending ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </section>
        ) : (
          <>
            <ContributionHeatmap logs={logs} />

            <Achievements
              reputation={reputation}
              theme={activeTheme}
              filter={achievementFilter}
              onFilterChange={setAchievementFilter}
              onInspect={setInspectedAchievement}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <TagFilter
                title="Skills"
                emptyText="No skills classified yet."
                tags={reputation.skills}
                selected={selectedSkill}
                onSelect={setSelectedSkill}
              />
              <TagFilter
                title="Protocols"
                emptyText="No protocols classified yet."
                tags={reputation.protocols}
                selected={selectedProtocol}
                onSelect={setSelectedProtocol}
              />
            </div>

            <ProofTimeline
              logs={sortedFilteredLogs}
              totalCount={logs.length}
              categories={reputation.categories}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              activeTags={activeTags}
              onClearAll={clearFilters}
            />
          </>
        )}
      </div>

      {isExportOpen && (
        <ExportPassportModal wallet={wallet} reputation={reputation} logs={logs} onClose={() => setIsExportOpen(false)} />
      )}

      <ProofPacketModal
        isOpen={isProofPacketOpen}
        onClose={() => setIsProofPacketOpen(false)}
        wallet={wallet}
        reputation={reputation}
        logs={logs}
      />

      {isQROpen && (
        <Modal title="Profile QR code" onClose={() => setIsQROpen(false)} maxWidth={360}>
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white p-3">
              {qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrUrl} alt={`QR code linking to the profile of ${wallet}`} width={200} height={200} className="block" />
              ) : (
                <div className="pv-skeleton h-[200px] w-[200px]" role="status" aria-label="Generating QR code" />
              )}
            </div>
            <p className="pv-muted mt-4 text-[13px] leading-relaxed">Scan to open this wallet profile on another device.</p>
            <code className="pv-mono pv-faint mt-2 text-[12px]">{walletShort}</code>
          </div>
        </Modal>
      )}

      {isCustomizerOpen && (
        <CardCustomizerModal
          reputation={reputation}
          currentTheme={activeTheme}
          onThemeSelect={(theme) => setActiveTheme(theme)}
          onClose={() => setIsCustomizerOpen(false)}
        />
      )}

      {inspectedAchievement && (
        <AchievementInspector achievement={inspectedAchievement} onClose={() => setInspectedAchievement(null)} />
      )}
    </main>
  )
}
