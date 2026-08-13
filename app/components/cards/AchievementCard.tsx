'use client'

import React from 'react'
import MetalCard from './MetalCard'
import { CARD_THEMES, CardTheme } from '@/app/lib/cardThemes'
import { Achievement, BuilderReputation } from '@/app/lib/types'

export interface AchievementCardProps {
  achievement: Achievement
  reputation: BuilderReputation
  onClick?: () => void
  customTheme?: CardTheme
}

// Dedicated stealth theme for locked/unearned cards so they never look muddy or clashing
const LOCKED_THEME: CardTheme = {
  id: 'locked_vault',
  name: 'Stealth Vault (Locked)',
  material: 'obsidian',
  description: 'Locked cryptographic milestone awaiting verified proof-of-work.',
  baseTone: '#08090c',
  surfaceGradient: 'linear-gradient(150deg, #0f1218 0%, #08090d 50%, #11141c 85%, #050608 100%)',
  borderTone: 'rgba(255, 255, 255, 0.12)',
  innerBorderTone: 'rgba(255, 255, 255, 0.04)',
  accentTone: '#718096',
  highlightTone: '#a0aec0',
  engraveTone: 'rgba(0, 0, 0, 0.95)',
  specularColor: 'rgba(255, 255, 255, 0.05)',
  textColorPrimary: '#cbd5e0',
  textColorSecondary: '#718096',
  technicalTextColor: '#4a5568',
  pattern: 'machined_grid',
  lighting: 'diffuse_soft',
  badgeBg: 'rgba(0, 0, 0, 0.6)',
  badgeText: '#718096',
  rarityColor: '#4a5568',
}

export default function AchievementCard({
  achievement,
  reputation,
  onClick,
  customTheme,
}: AchievementCardProps) {
  // Map rarity to physical material for earned cards
  const earnedTheme = React.useMemo(() => {
    if (customTheme) return customTheme
    switch (achievement.rarity) {
      case 'Legendary':
        return CARD_THEMES.solar
      case 'Epic':
        return CARD_THEMES.chrome
      case 'Rare':
        return CARD_THEMES.titanium
      case 'Common':
      default:
        return CARD_THEMES.steel
    }
  }, [achievement.rarity, customTheme])

  const theme = achievement.earned ? earnedTheme : LOCKED_THEME
  const serialId = `ACH-${achievement.id.slice(0, 4)}-${reputation.wallet.slice(0, 4).toUpperCase()}`

  const frontContent = (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        padding: '2px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: achievement.earned ? theme.technicalTextColor : '#4a5568',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              display: 'block',
            }}
          >
            {achievement.earned ? 'PROVN EARNED //' : 'LOCKED MILESTONE //'} {achievement.rarity.toUpperCase()}
          </span>
          <div
            style={{
              fontSize: '13px',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontWeight: 800,
              color: achievement.earned ? theme.textColorPrimary : '#cbd5e0',
              marginTop: '1px',
            }}
          >
            {achievement.name}
          </div>
        </div>

        <div
          style={{
            background: achievement.earned ? theme.badgeBg : 'rgba(15, 20, 30, 0.8)',
            border: `1px solid ${achievement.earned ? theme.borderTone : 'rgba(255,255,255,0.08)'}`,
            color: achievement.earned ? theme.badgeText : '#718096',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '8.5px',
            fontFamily: 'var(--font-geist-mono), monospace',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          {achievement.earned ? (
            <>
              <span>✓</span> UNLOCKED
            </>
          ) : (
            <>
              <span style={{ fontSize: '7px' }}>🔒</span> LOCKED
            </>
          )}
        </div>
      </div>

      {/* Center Icon & Description */}
      <div style={{ textAlign: 'center', margin: 'auto 0', padding: '6px 0' }}>
        <div
          style={{
            fontSize: '32px',
            marginBottom: '4px',
            filter: achievement.earned
              ? 'drop-shadow(0 2px 8px rgba(0, 255, 136, 0.2))'
              : 'grayscale(1) opacity(0.25)',
            transition: 'transform 0.2s ease',
          }}
        >
          {achievement.icon}
        </div>
        <p
          style={{
            fontSize: '9.5px',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: achievement.earned ? theme.textColorSecondary : '#8a99ad',
            margin: 0,
            lineHeight: '1.4',
            maxWidth: '260px',
            marginInline: 'auto',
          }}
        >
          {achievement.description}
        </p>
      </div>

      {/* Bottom Bar: Criteria */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: `1px solid ${achievement.earned ? theme.innerBorderTone : 'rgba(255, 255, 255, 0.06)'}`,
          paddingTop: '6px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
          <div
            style={{
              fontSize: '7px',
              color: achievement.earned ? theme.technicalTextColor : '#4a5568',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            UNLOCK CRITERIA
          </div>
          <div
            style={{
              fontSize: '8.5px',
              color: achievement.earned ? theme.textColorSecondary : '#a0aec0',
              fontFamily: 'var(--font-geist-mono), monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {achievement.criteria}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '7.5px',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: achievement.earned ? theme.accentTone : '#5e687e',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {achievement.earned ? 'VERIFIED 🗿' : 'PENDING'}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <div
      style={{
        position: 'relative',
        transition: 'transform 0.2s ease',
      }}
      className={achievement.earned ? 'hover:scale-[1.02]' : 'opacity-85 hover:opacity-100'}
    >
      <MetalCard
        theme={theme}
        frontContent={frontContent}
        serialNumber={serialId}
        interactive={achievement.earned}
        aspectRatio="1.586 / 1"
      />
    </div>
  )
}
