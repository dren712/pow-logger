'use client'

import React, { useState } from 'react'
import MetalCard from './MetalCard'
import { CardTheme, DEFAULT_CARD_THEME } from '@/app/lib/cardThemes'
import { BuilderReputation } from '@/app/lib/types'

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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    verificationUrl
  )}&bgcolor=08090c&color=${theme.accentTone.replace('#', '')}`

  const serialId = `PRV-${reputation.wallet.slice(0, 4).toUpperCase()}-${reputation.totalProofs.toString().padStart(4, '0')}`

  // ================= FRONT CONTENT =================
  const frontContent = (
    <>
      {/* Top Bar: Brand & Chip / Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'clamp(15px, 3.8vw, 18px)' }}>🗿</span>
            <span
              style={{
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: 'clamp(13px, 3.5vw, 16px)',
                fontWeight: 900,
                letterSpacing: '1.5px',
                color: theme.textColorPrimary,
                textShadow: `0 1px 2px ${theme.engraveTone}`,
              }}
            >
              PROVN
            </span>
          </div>
          <div
            style={{
              fontSize: 'clamp(7.5px, 1.8vw, 9px)',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: theme.technicalTextColor,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            BUILDER PASSPORT // SPEC-01
          </div>
        </div>

        {/* Smart Card Chip Hologram Accent */}
        <div
          style={{
            width: 'clamp(28px, 6.5vw, 36px)',
            height: 'clamp(22px, 5vw, 28px)',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #d4af37 0%, #aa8c2c 40%, #f5e184 70%, #997b25 100%)',
            border: '1px solid rgba(0,0,0,0.5)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.6)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2px',
            padding: '2px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ border: '0.5px solid rgba(0,0,0,0.3)', borderRadius: '1px' }} />
          <div style={{ border: '0.5px solid rgba(0,0,0,0.3)', borderRadius: '1px' }} />
          <div style={{ border: '0.5px solid rgba(0,0,0,0.3)', borderRadius: '1px' }} />
        </div>
      </div>

      {/* Middle Bar: Identity & Core Stats */}
      <div style={{ margin: 'auto 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
          <div>
            <div
              style={{
                fontSize: 'clamp(7.5px, 1.8vw, 9px)',
                fontFamily: 'var(--font-geist-mono), monospace',
                color: theme.technicalTextColor,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              SOLANA SIGNER WALLET
            </div>
            <div
              style={{
                fontSize: 'clamp(15px, 4.2vw, 20px)',
                fontFamily: 'var(--font-geist-mono), monospace',
                fontWeight: 800,
                color: theme.textColorPrimary,
                letterSpacing: '1px',
                textShadow: `0 1px 2px ${theme.engraveTone}`,
              }}
            >
              {walletShort}
            </div>
          </div>

          <div
            style={{
              background: theme.badgeBg,
              border: `1px solid ${theme.borderTone}`,
              color: theme.badgeText,
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: 'clamp(8.5px, 2.2vw, 10px)',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {reputation.builderLevel.emoji} LVL {reputation.builderLevel.level}
          </div>
        </div>

        {/* Proof Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'clamp(4px, 1.5vw, 8px)',
            background: 'rgba(0, 0, 0, 0.35)',
            border: `1px solid ${theme.innerBorderTone}`,
            borderRadius: '8px',
            padding: 'clamp(6px, 1.8vw, 8px) clamp(8px, 2.5vw, 12px)',
          }}
        >
          <div>
            <div style={{ fontSize: 'clamp(7px, 1.8vw, 8px)', color: theme.technicalTextColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PROOFS
            </div>
            <div style={{ fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 900, color: theme.accentTone }}>
              {reputation.totalProofs}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'clamp(7px, 1.8vw, 8px)', color: theme.technicalTextColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              STREAK
            </div>
            <div style={{ fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 900, color: '#ffb800' }}>
              🔥 {reputation.currentStreak}d
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'clamp(7px, 1.8vw, 8px)', color: theme.technicalTextColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ARWEAVE
            </div>
            <div style={{ fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 900, color: '#00e5ff' }}>
              {reputation.archivalSuccessRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Skills & Scannable QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '280px', marginBottom: '3px' }}>
            {reputation.skills.slice(0, 3).map((s) => (
              <span
                key={s.name}
                style={{
                  fontSize: 'clamp(7.5px, 1.8vw, 9px)',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  color: theme.textColorSecondary,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `0.5px solid ${theme.innerBorderTone}`,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                }}
              >
                #{s.name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 'clamp(6.5px, 1.6vw, 8px)', fontFamily: 'var(--font-geist-mono), monospace', color: theme.technicalTextColor, letterSpacing: '0.5px' }}>
            VERIFIED PROOF-OF-WORK // ED25519
          </div>
        </div>

        {/* Embedded QR Code Cutout */}
        <div
          style={{
            width: 'clamp(36px, 8.5vw, 46px)',
            height: 'clamp(36px, 8.5vw, 46px)',
            background: '#06070a',
            border: `1px solid ${theme.borderTone}`,
            borderRadius: '6px',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
            flexShrink: 0,
          }}
          title="Scan to verify passport"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="Passport QR"
            width={38}
            height={38}
            style={{ display: 'block', borderRadius: '3px', width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
    </>
  )

  // ================= BACK CONTENT =================
  const backContent = (
    <div style={{ fontSize: '10px', fontFamily: 'var(--font-geist-mono), monospace', color: theme.textColorSecondary }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '8px', color: theme.technicalTextColor, textTransform: 'uppercase' }}>
            FULL WALLET ADDRESS
          </div>
          <div style={{ color: theme.textColorPrimary, wordBreak: 'break-all', fontSize: '9px' }}>
            {reputation.wallet}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '8px', color: theme.technicalTextColor, textTransform: 'uppercase' }}>
            PROTOCOL ATTRIBUTION
          </div>
          <div style={{ color: theme.accentTone, fontWeight: 700 }}>
            SOLANA · IRYS · ARWEAVE
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', border: `0.5px solid ${theme.innerBorderTone}` }}>
          <div style={{ fontSize: '7px', color: theme.technicalTextColor }}>LONGEST STREAK</div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: theme.textColorPrimary }}>{reputation.longestStreak} Days</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', border: `0.5px solid ${theme.innerBorderTone}` }}>
          <div style={{ fontSize: '7px', color: theme.technicalTextColor }}>ACTIVE DAYS</div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: theme.textColorPrimary }}>{reputation.activeDaysCount} Days</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', border: `0.5px solid ${theme.innerBorderTone}` }}>
          <div style={{ fontSize: '7px', color: theme.technicalTextColor }}>ACHIEVEMENTS</div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: theme.textColorPrimary }}>{reputation.achievements.filter((a) => a.earned).length} / {reputation.achievements.length}</div>
        </div>
      </div>

      <div style={{ borderTop: `1px dashed ${theme.innerBorderTone}`, paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '8px', color: theme.technicalTextColor }}>
          Cryptographically attributable. Immutable provenance.
        </span>
        <span style={{ color: theme.accentTone, fontWeight: 700, fontSize: '9px' }}>
          provn-sol.vercel.app ↗
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <MetalCard
        theme={theme}
        frontContent={frontContent}
        backContent={backContent}
        isFlipped={isFlipped}
        onFlipToggle={() => setIsFlipped(!isFlipped)}
        serialNumber={serialId}
      />

      {showControls && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#0d111a',
              border: `1px solid ${theme.borderTone}`,
              color: theme.textColorPrimary,
            }}
          >
            🔄 Flip Card ({isFlipped ? 'Back' : 'Front'})
          </button>

          {onCustomizeClick && (
            <button
              onClick={onCustomizeClick}
              className="btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                background: '#0d111a',
                border: `1px solid ${theme.borderTone}`,
                color: theme.accentTone,
              }}
            >
              🎨 Customize Metal ({theme.name})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
