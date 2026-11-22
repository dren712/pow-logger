'use client'

import React, { useState } from 'react'
import MetalCard from './MetalCard'
import { CardTheme, DEFAULT_CARD_THEME } from '@/app/lib/cardThemes'
import { BuilderReputation } from '@/app/lib/types'
import { useQRCode } from '@/app/lib/qrcode'
import '@/app/styles/modals-cards.css'

const SANS = "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
const MONO = 'var(--font-geist-mono), monospace'

export interface PassportCardProps {
  reputation: BuilderReputation
  theme?: CardTheme
  onCustomizeClick?: () => void
  showControls?: boolean
}

export default function PassportCard({
  reputation,
  theme = DEFAULT_CARD_THEME,
  onCustomizeClick,
  showControls = true,
}: PassportCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const walletShort = `${reputation.wallet.slice(0, 4)}...${reputation.wallet.slice(-4)}`
  const verificationUrl = `https://provn-sol.vercel.app/u/${reputation.wallet}`
  const qrUrl = useQRCode(verificationUrl, {
    width: 160,
    darkColor: theme.accentTone,
    lightColor: '#08090c',
  })

  const serialId = `PRV-${reputation.wallet.slice(0, 4).toUpperCase()}-${reputation.totalProofs.toString().padStart(4, '0')}`

  const label: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 'clamp(7px, 1.7vw, 8.5px)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: theme.technicalTextColor,
  }
  const statValue: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: 'clamp(14px, 3.6vw, 19px)',
    fontWeight: 650,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    color: theme.textColorPrimary,
    fontVariantNumeric: 'tabular-nums',
  }
  const stats = [
    { label: 'Proofs', value: String(reputation.totalProofs), accent: true },
    { label: 'Streak', value: `${reputation.currentStreak}d` },
    { label: 'Archived', value: `${reputation.archivalSuccessRate}%` },
  ]

  // ================= FRONT CONTENT =================
  const frontContent = (
    <>
      {/* Brand and level */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.6vw, 8px)', minWidth: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 'clamp(16px, 4vw, 20px)', height: 'clamp(16px, 4vw, 20px)', flexShrink: 0 }}>
            <rect x="1" y="1" width="22" height="22" rx="6" fill={theme.accentTone} />
            <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#06080b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(13px, 3.4vw, 16px)',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: theme.textColorPrimary,
              textShadow: `0 1px 2px ${theme.engraveTone}`,
            }}
          >
            PROVN
          </span>
          <span style={{ ...label, marginLeft: '2px', whiteSpace: 'nowrap' }}>Builder passport</span>
        </div>

        <div
          style={{
            background: theme.badgeBg,
            border: `1px solid ${theme.borderTone}`,
            color: theme.badgeText,
            padding: '2px clamp(6px, 1.8vw, 9px)',
            borderRadius: '999px',
            fontFamily: SANS,
            fontSize: 'clamp(8.5px, 2.2vw, 11px)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Level {reputation.builderLevel.level}
        </div>
      </div>

      {/* Identity and stats */}
      <div style={{ margin: 'auto 0' }}>
        <div style={label}>Solana wallet</div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 'clamp(16px, 4.6vw, 23px)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: theme.textColorPrimary,
            textShadow: `0 1px 2px ${theme.engraveTone}`,
            marginTop: '1px',
          }}
        >
          {walletShort}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, auto) 1fr',
            columnGap: 'clamp(14px, 4.5vw, 28px)',
            marginTop: 'clamp(6px, 2vw, 12px)',
            paddingTop: 'clamp(6px, 1.8vw, 10px)',
            borderTop: `1px solid ${theme.innerBorderTone}`,
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <div style={label}>{s.label}</div>
              <div style={{ ...statValue, color: s.accent ? theme.accentTone : theme.textColorPrimary }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills and QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px', marginBottom: '4px' }}>
            {reputation.skills.slice(0, 3).map((s) => (
              <span
                key={s.name}
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(7.5px, 1.9vw, 10px)',
                  fontWeight: 500,
                  color: theme.textColorSecondary,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${theme.innerBorderTone}`,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
          <div style={label}>Wallet-signed · Ed25519</div>
        </div>

        <div
          style={{
            width: 'clamp(36px, 8.5vw, 46px)',
            height: 'clamp(36px, 8.5vw, 46px)',
            background: '#06070a',
            border: `1px solid ${theme.borderTone}`,
            borderRadius: '7px',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title="Scan to open this passport"
        >
          {qrUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrUrl}
              alt="QR code linking to this passport"
              width={38}
              height={38}
              style={{ display: 'block', borderRadius: '3px', width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }} />
          )}
        </div>
      </div>
    </>
  )

  // ================= BACK CONTENT =================
  const backLabel: React.CSSProperties = { ...label, fontSize: 'clamp(6.5px, 1.6vw, 8px)' }
  const backStats = [
    { label: 'Longest streak', value: `${reputation.longestStreak} days` },
    { label: 'Active days', value: `${reputation.activeDaysCount}` },
    {
      label: 'Achievements',
      value: `${reputation.achievements.filter((a) => a.earned).length} / ${reputation.achievements.length}`,
    },
  ]
  const backContent = (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontFamily: SANS, color: theme.textColorSecondary }}>
      <div>
        <div style={backLabel}>Wallet address</div>
        <div style={{ fontFamily: MONO, color: theme.textColorPrimary, wordBreak: 'break-all', fontSize: 'clamp(7.5px, 2vw, 10px)', lineHeight: 1.4, marginTop: '1px' }}>
          {reputation.wallet}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(6px, 2vw, 14px)', borderTop: `1px solid ${theme.innerBorderTone}`, paddingTop: 'clamp(4px, 1.4vw, 8px)' }}>
        {backStats.map((s) => (
          <div key={s.label}>
            <div style={backLabel}>{s.label}</div>
            <div style={{ fontSize: 'clamp(10px, 2.6vw, 13px)', fontWeight: 600, color: theme.textColorPrimary }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: 'clamp(7px, 1.8vw, 9.5px)' }}>
        <span style={{ color: theme.technicalTextColor }}>Solana · Irys · Arweave</span>
        <span style={{ fontFamily: MONO, color: theme.accentTone, fontWeight: 600 }}>provn-sol.vercel.app</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <MetalCard
        theme={theme}
        frontContent={frontContent}
        backContent={backContent}
        isFlipped={isFlipped}
        onFlipToggle={() => setIsFlipped(!isFlipped)}
        serialNumber={serialId}
      />

      {showControls && (
        <div className="pvc-controls">
          <button type="button" onClick={() => setIsFlipped(!isFlipped)} className="pvc-control" aria-pressed={isFlipped}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 019.6-3.6M13.5 8a5.5 5.5 0 01-9.6 3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12.4 1.8v2.8H9.6M3.6 14.2v-2.8h2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isFlipped ? 'Show front' : 'Show back'}
          </button>

          {onCustomizeClick && (
            <button type="button" onClick={onCustomizeClick} className="pvc-control">
              <span
                aria-hidden="true"
                style={{ width: '12px', height: '12px', borderRadius: '50%', background: theme.surfaceGradient, border: `1px solid ${theme.borderTone}` }}
              />
              Change finish
              <span style={{ color: '#5c6473', fontWeight: 500 }}>{theme.name}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
