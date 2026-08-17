'use client'

import { BadgeSummary } from '@/app/lib/milestones'

interface BuilderBadgeProps {
  badge: BadgeSummary
  /** Compact mode for stats dashboard row */
  compact?: boolean
}

export default function BuilderBadge({ badge, compact = false }: BuilderBadgeProps) {
  if (!badge || !badge.level) return null

  const {
    level,
  } = badge

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: level.glow,
            border: `1.5px solid ${level.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: `0 0 12px ${level.glow}`,
          }}
        >
          {level.emoji}
        </div>
        <div>
          <div style={{ fontSize: '11px', color: level.color, fontWeight: 700, letterSpacing: '0.3px' }}>
            {badge.totalLogs} Logs
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="terminal-card"
      style={{
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="corner-accent corner-top-left" />
      <div className="corner-accent corner-top-right" />

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${level.glow} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header: Level Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: level.glow,
            border: `2px solid ${level.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            boxShadow: `0 0 20px ${level.glow}, inset 0 0 12px ${level.glow}`,
            flexShrink: 0,
          }}
        >
          {level.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Activity Level
          </div>
          <div style={{ color: level.color, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            {badge.totalLogs} Logs
          </div>
        </div>
      </div>
    </div>
  )
}
