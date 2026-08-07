'use client'

import BuilderBadge from './BuilderBadge'
import { BadgeSummary } from '@/app/lib/milestones'

interface StatsDashboardProps {
  connected: boolean
  badgeSummary: BadgeSummary
  streakCount: number
  totalLogsCount: number
  todayLogsCount: number
  isDailyLimitReached: boolean
}

export default function StatsDashboard({
  connected,
  badgeSummary,
  streakCount,
  totalLogsCount,
  todayLogsCount,
  isDailyLimitReached,
}: StatsDashboardProps) {
  return (
    <>
      {/* 4-Column Stats Dashboard */}
      <div
        className="stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div className="corner-accent corner-top-left" />
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Builder Level
          </div>
          <div style={{ color: badgeSummary?.level?.color || '#888', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            {badgeSummary?.level?.emoji || '🔧'} LVL {badgeSummary?.level?.level || 1}
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
            {badgeSummary?.level?.title || 'Apprentice Builder'}
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div className="corner-accent corner-top-left" />
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Active Streak
          </div>
          <div style={{ color: '#ffb800', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
            🔥 {connected ? streakCount : 0} {streakCount === 1 ? 'Day' : 'Days'}
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div className="corner-accent corner-top-left" />
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Total Logs
          </div>
          <div style={{ color: '#00ff88', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
            📦 {connected ? totalLogsCount : 0}
          </div>
        </div>

        <div className="terminal-card" style={{ padding: '14px 16px' }}>
          <div className="corner-accent corner-top-left" />
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Today&apos;s Quota
          </div>
          <div style={{ color: isDailyLimitReached ? '#ff4444' : '#00e5ff', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
            {connected ? todayLogsCount : 0}/3 {isDailyLimitReached ? '🔒' : '⚡'}
          </div>
        </div>
      </div>

      {/* Builder Level & Skill Badges Card */}
      <div style={{ marginBottom: '24px' }}>
        <BuilderBadge badge={badgeSummary} />
      </div>
    </>
  )
}
