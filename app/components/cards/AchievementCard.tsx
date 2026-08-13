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

export default function AchievementCard({
  achievement,
  reputation,
  onClick,
  customTheme,
}: AchievementCardProps) {
  // Map rarity to physical material
  const defaultTheme = React.useMemo(() => {
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

  const theme = customTheme || defaultTheme
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
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: theme.technicalTextColor,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            PROVN ACHIEVEMENT // {achievement.rarity.toUpperCase()}
          </span>
          <div
            style={{
              fontSize: '14px',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontWeight: 800,
              color: achievement.earned ? theme.textColorPrimary : theme.technicalTextColor,
            }}
          >
            {achievement.name}
          </div>
        </div>

        <div
          style={{
            background: achievement.earned ? theme.badgeBg : 'rgba(0,0,0,0.5)',
            border: `1px solid ${achievement.earned ? theme.borderTone : 'rgba(255,255,255,0.05)'}`,
            color: achievement.earned ? theme.badgeText : '#555',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '9px',
            fontFamily: 'var(--font-geist-mono), monospace',
            fontWeight: 700,
          }}
        >
          {achievement.earned ? '✓ UNLOCKED' : 'LOCKED'}
        </div>
      </div>

      {/* Center Icon & Name */}
      <div style={{ textAlign: 'center', margin: 'auto 0' }}>
        <div style={{ fontSize: '36px', marginBottom: '4px', filter: achievement.earned ? 'none' : 'grayscale(1) opacity(0.4)' }}>
          {achievement.icon}
        </div>
        <p
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: achievement.earned ? theme.textColorSecondary : theme.technicalTextColor,
            margin: 0,
            lineHeight: '1.4',
            maxWidth: '240px',
            marginInline: 'auto',
          }}
        >
          {achievement.description}
        </p>
      </div>

      {/* Bottom Bar: Criteria & cNFT State */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: `1px solid ${theme.innerBorderTone}`,
          paddingTop: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '7px', color: theme.technicalTextColor, textTransform: 'uppercase' }}>
            CRITERIA
          </div>
          <div style={{ fontSize: '9px', color: theme.textColorSecondary, fontFamily: 'var(--font-geist-mono), monospace' }}>
            {achievement.criteria}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-geist-mono), monospace',
              color: achievement.earned ? theme.accentTone : theme.technicalTextColor,
              fontWeight: 700,
            }}
          >
            {achievement.earned ? 'PROVN VERIFIED' : 'PENDING PROOF'}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <MetalCard
      theme={theme}
      frontContent={frontContent}
      serialNumber={serialId}
      interactive={achievement.earned}
      aspectRatio="1.5 / 1"
    />
  )
}
