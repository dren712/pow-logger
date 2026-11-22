'use client'

import type { BuilderReputation } from '@/app/lib/types'
import { shortWallet } from './ui'

function formatDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function walletHue(wallet: string) {
  let h = 0
  for (let i = 0; i < wallet.length; i++) h = (h * 31 + wallet.charCodeAt(i)) % 360
  return h
}

interface IdentityCardProps {
  wallet: string
  reputation: BuilderReputation
  isOwner: boolean
  copied: boolean
  refreshing: boolean
  themeName: string
  onProofPacket: () => void
  onCopyLink: () => void
  onQr: () => void
  onExport: () => void
  onCustomize: () => void
  onRefresh: () => void
  onLinkGithub: () => void
}

export default function IdentityCard({
  wallet,
  reputation,
  isOwner,
  copied,
  refreshing,
  themeName,
  onProofPacket,
  onCopyLink,
  onQr,
  onExport,
  onCustomize,
  onRefresh,
  onLinkGithub,
}: IdentityCardProps) {
  const hue = walletHue(wallet)
  const first = formatDate(reputation.firstProofAt)
  const latest = formatDate(reputation.latestProofAt)
  const ghost = 'pv-btn-ghost !px-2 !text-[13px]'

  return (
    <div className="pv-card p-6">
      <div
        aria-hidden="true"
        className="pv-mono flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/10 text-[20px] font-semibold text-white/90"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 70) % 360} 60% 18%))` }}
      >
        {wallet.slice(0, 2)}
      </div>
      <p className="pv-eyebrow mt-4">Wallet profile</p>
      <h1 className="pv-mono mt-1.5 text-[22px] font-semibold leading-tight text-white" title={wallet}>
        {shortWallet(wallet)}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="pv-chip">
          Level {reputation.builderLevel.level} · {reputation.builderLevel.title}
        </span>
      </div>

      <dl className="mt-4 flex flex-col gap-2 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="pv-muted">Signed proofs</dt>
          <dd className="font-medium text-white">{reputation.verifiedProofs}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="pv-muted">Active days</dt>
          <dd className="font-medium text-white">{reputation.activeDaysCount}</dd>
        </div>
        {first && (
          <div className="flex justify-between gap-3">
            <dt className="pv-muted">First proof</dt>
            <dd className="text-[#c3cad6]">{first}</dd>
          </div>
        )}
        {latest && (
          <div className="flex justify-between gap-3">
            <dt className="pv-muted">Latest proof</dt>
            <dd className="text-[#c3cad6]">{latest}</dd>
          </div>
        )}
      </dl>

      <div className="no-print mt-5 flex flex-col gap-2">
        <button type="button" className="pv-btn w-full" onClick={onProofPacket}>
          Open proof packet
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={ghost} onClick={onCopyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" className={ghost} onClick={onQr}>
            QR code
          </button>
          <button type="button" className={ghost} onClick={onExport}>
            Export
          </button>
          <button type="button" className={ghost} onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <button type="button" className={`${ghost} w-full`} onClick={onCustomize}>
          <span className="truncate">Card style: {themeName}</span>
        </button>
        {isOwner && (
          <button type="button" className={`${ghost} w-full`} onClick={onLinkGithub}>
            Link GitHub account
          </button>
        )}
        <span className="sr-only" role="status">{copied ? 'Profile link copied to clipboard' : ''}</span>
      </div>
    </div>
  )
}
