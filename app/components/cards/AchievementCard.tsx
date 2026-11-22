'use client'

import React from 'react'
import MetalCard from './MetalCard'
import { CARD_THEMES, CardTheme } from '@/app/lib/cardThemes'
import { Achievement, BuilderReputation } from '@/app/lib/types'
import '@/app/styles/modals-cards.css'

const SANS = "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
const MONO = 'var(--font-geist-mono), monospace'

export interface AchievementCardProps {
  achievement: Achievement
  reputation: BuilderReputation
  onClick?: () => void
  customTheme?: CardTheme
}

// Dedicated stealth theme for locked/unearned cards so they never look muddy or clashing
const LOCKED_THEME: CardTheme = {
  id: 'locked_vault',
  name: 'Locked',
  material: 'obsidian',
  description: 'Not earned yet.',
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

  const earned = achievement.earned
  const label: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: '8px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: theme.technicalTextColor,
  }
  const emblemTone = earned ? theme.accentTone : theme.technicalTextColor

  const inner = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        padding: '2px',
        boxSizing: 'border-box',
        textAlign: 'left',
      }}
    >
      {/* Rarity and status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...label, color: earned ? theme.rarityColor : theme.technicalTextColor }}>{achievement.rarity}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: theme.badgeBg,
            border: `1px solid ${earned ? theme.borderTone : 'rgba(255,255,255,0.08)'}`,
            color: theme.badgeText,
            padding: '2px 8px',
            borderRadius: '999px',
            fontFamily: SANS,
            fontSize: '9.5px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {earned ? (
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
          {earned ? 'Earned' : 'Locked'}
        </span>
      </div>

      {/* Emblem, name and description */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 'auto 0', padding: '6px 0', minWidth: 0 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: earned ? 1 : 0.7 }}>
          <path
            d="M20 2.5l14 8.1v16.2l-14 8.1-14-8.1V10.6z"
            fill={earned ? theme.badgeBg : 'rgba(255,255,255,0.02)'}
            stroke={emblemTone}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {earned ? (
            <path d="M13.5 20.5l4.5 4.5 8.8-9.5" stroke={emblemTone} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <rect x="14.5" y="19" width="11" height="8" rx="1.8" stroke={emblemTone} strokeWidth="1.6" />
              <path d="M17 19v-2.2a3 3 0 016 0V19" stroke={emblemTone} strokeWidth="1.6" />
            </>
          )}
        </svg>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: '15px',
              fontWeight: 650,
              letterSpacing: '-0.015em',
              lineHeight: 1.2,
              color: theme.textColorPrimary,
            }}
          >
            {achievement.name}
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '11px',
              color: theme.textColorSecondary,
              margin: '3px 0 0',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Criteria */}
      <div style={{ borderTop: `1px solid ${theme.innerBorderTone}`, paddingTop: '6px', minWidth: 0 }}>
        <div style={label}>{earned ? 'Earned by' : 'How to earn'}</div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: '10.5px',
            color: theme.textColorSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '1px',
          }}
        >
          {achievement.criteria}
        </div>
      </div>
    </div>
  )

  const frontContent = onClick ? (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="pvc-hit"
      aria-label={`${achievement.name}, ${achievement.rarity}, ${earned ? 'earned' : 'locked'}. View details`}
    >
      {inner}
    </div>
  ) : (
    inner
  )

  return (
    <div className={`pvc-achievement ${earned ? 'pvc-achievement-earned' : 'pvc-achievement-locked'}`}>
      <MetalCard theme={theme} frontContent={frontContent} interactive={earned} aspectRatio="1.586 / 1" />
    </div>
  )
}
