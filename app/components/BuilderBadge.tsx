'use client'

import { BadgeSummary } from '@/app/lib/milestones'

interface BuilderBadgeProps {
  badge: BadgeSummary
  /** Compact mode for stats dashboard row */
  compact?: boolean
}

function LevelMark({ level, color, size }: { level: number; color: string; size: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 3.6),
        background: '#11151c',
        border: `1px solid ${color}`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      L{level}
    </div>
  )
}

export default function BuilderBadge({ badge, compact = false }: BuilderBadgeProps) {
  if (!badge || !badge.level) return null

  const { level, nextLevel, levelProgress, totalLogs } = badge
  const logsLabel = `${totalLogs} ${totalLogs === 1 ? 'log' : 'logs'}`

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LevelMark level={level.level} color={level.color} size={36} />
        <div style={{ fontSize: 12, color: '#e8ecf2', fontWeight: 600 }}>{logsLabel}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 20,
        background: '#0c0f14',
        border: '1px solid #1c222c',
        borderRadius: 16,
        fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <LevelMark level={level.level} color={level.color} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#8a93a3', fontSize: 12 }}>Activity level</div>
          <div style={{ color: '#e8ecf2', fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>{level.title}</div>
        </div>
        <div style={{ color: '#c3cad6', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{logsLabel}</div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={levelProgress}
        aria-label="Progress to next level"
        style={{ marginTop: 16, height: 6, borderRadius: 999, background: '#1c222c', overflow: 'hidden' }}
      >
        <div style={{ width: `${levelProgress}%`, height: '100%', background: '#2ee59d', borderRadius: 999 }} />
      </div>
      <div style={{ marginTop: 8, color: '#5c6473', fontSize: 12 }}>
        {nextLevel
          ? `${nextLevel.logsRemaining} more ${nextLevel.logsRemaining === 1 ? 'log' : 'logs'} to reach ${nextLevel.next.title}`
          : 'Highest level reached'}
      </div>
    </div>
  )
}
