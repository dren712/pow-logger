'use client'

import { StreakMilestone, BadgeSummary } from '@/app/lib/milestones'

interface BuilderBadgeProps {
  badge: BadgeSummary
  /** Compact mode for stats dashboard row */
  compact?: boolean
}

export default function BuilderBadge({ badge, compact = false }: BuilderBadgeProps) {
  if (!badge || !badge.level) return null

  const {
    level,
    nextLevel = null,
    levelProgress = 0,
    currentStreak = 0,
    earnedMilestones = [],
    nextMilestone = null,
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
            LVL {level.level} • {level.title}
          </div>
          {nextLevel && (
            <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
              {nextLevel.logsRemaining} logs to {nextLevel.next.title}
            </div>
          )}
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
            Builder Level
          </div>
          <div style={{ color: level.color, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Level {level.level} — {level.title}
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      {nextLevel && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginBottom: '6px' }}>
            <span>Progress to {nextLevel.next.emoji} {nextLevel.next.title}</span>
            <span style={{ color: level.color }}>{levelProgress}%</span>
          </div>
          <div
            style={{
              height: '6px',
              background: '#0d1117',
              borderRadius: '3px',
              border: '1px solid #1c2230',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${levelProgress}%`,
                background: `linear-gradient(90deg, ${level.color}, ${nextLevel.next.color})`,
                borderRadius: '3px',
                transition: 'width 0.6s ease',
                boxShadow: `0 0 8px ${level.color}`,
              }}
            />
          </div>
          <div style={{ fontSize: '9px', color: '#444', marginTop: '4px' }}>
            {nextLevel.logsRemaining} more {nextLevel.logsRemaining === 1 ? 'log' : 'logs'} to level up
          </div>
        </div>
      )}

      {levelProgress === 100 && (
        <div style={{ marginBottom: '18px', fontSize: '11px', color: '#ff4400', fontWeight: 700, textAlign: 'center' }}>
          👑 MAX LEVEL ACHIEVED
        </div>
      )}

      {/* Streak Milestone Trophies */}
      <div>
        <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Streak Trophies
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {([
            { days: 7,   emoji: '🔥', title: '7d' },
            { days: 14,  emoji: '⚡', title: '14d' },
            { days: 30,  emoji: '🛡️',  title: '30d' },
            { days: 60,  emoji: '⚔️',  title: '60d' },
            { days: 100, emoji: '💎', title: '100d' },
            { days: 365, emoji: '👑', title: '365d' },
          ] as { days: number; emoji: string; title: string }[]).map((m) => {
            const earned = Array.isArray(earnedMilestones) && earnedMilestones.some((em: StreakMilestone) => em?.days === m.days)
            return (
              <div
                key={m.days}
                title={earned ? `${m.title} Streak — Earned!` : `${m.title} Streak — ${m.days - currentStreak} days remaining`}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  background: earned ? 'rgba(0,255,136,0.08)' : '#0a0c10',
                  border: `1.5px solid ${earned ? '#00ff88' : '#1c2230'}`,
                  opacity: earned ? 1 : 0.35,
                  cursor: 'default',
                  transition: 'all 0.3s ease',
                  boxShadow: earned ? '0 0 10px rgba(0,255,136,0.15)' : 'none',
                }}
              >
                {m.emoji}
              </div>
            )
          })}
        </div>

        {/* Next Milestone Hint */}
        {nextMilestone && (
          <div style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>
            Next: {nextMilestone.milestone.emoji} {nextMilestone.milestone.title} in{' '}
            <span style={{ color: nextMilestone.milestone.color, fontWeight: 700 }}>
              {nextMilestone.daysRemaining} {nextMilestone.daysRemaining === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
