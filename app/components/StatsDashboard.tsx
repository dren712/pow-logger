'use client'

import BuilderBadge from './BuilderBadge'
import { BadgeSummary } from '@/app/lib/milestones'

interface StatsDashboardProps {
  connected: boolean
  /** When given, the level and skill badge card is rendered under the stats. */
  badgeSummary?: BadgeSummary
  streakCount: number
  totalLogsCount: number
  todayLogsCount: number
  isDailyLimitReached: boolean
  /** e.g. "Level 2". Adds a level tile when given. */
  levelLabel?: string
  /** Level name shown under the level, e.g. "Shipper". */
  levelTitle?: string
  /** Share of proofs archived to Arweave, 0-100. Shown under the proof count when given. */
  archivedPercent?: number
  dailyLimit?: number
}

export default function StatsDashboard({
  connected,
  badgeSummary,
  streakCount,
  totalLogsCount,
  todayLogsCount,
  isDailyLimitReached,
  levelLabel,
  levelTitle,
  archivedPercent,
  dailyLimit = 3,
}: StatsDashboardProps) {
  const streak = connected ? streakCount : 0
  const total = connected ? totalLogsCount : 0
  const today = connected ? todayLogsCount : 0

  const tiles: { label: string; value: string; note?: string; warn?: boolean }[] = []
  if (levelLabel) tiles.push({ label: 'Builder level', value: levelLabel, note: levelTitle })
  tiles.push({ label: 'Current streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` })
  tiles.push({
    label: 'Proofs logged',
    value: String(total),
    note: archivedPercent !== undefined && total > 0 ? `${archivedPercent}% archived` : undefined,
  })
  tiles.push({
    label: 'Today',
    value: `${today} of ${dailyLimit}`,
    note: isDailyLimitReached ? 'Daily limit reached' : `${Math.max(0, dailyLimit - today)} left today`,
    warn: isDailyLimitReached,
  })

  return (
    <>
      <dl className={`grid grid-cols-2 gap-3 ${tiles.length > 3 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {tiles.map((t) => (
          <div key={t.label} className="pv-card min-w-0 px-4 py-4">
            <dt className="pv-muted text-[12px]">{t.label}</dt>
            <dd className="mt-1.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] text-white" title={t.value}>
              {t.value}
            </dd>
            {t.note && (
              <dd className={`mt-1 text-[12px] ${t.warn ? 'text-[#f5c451]' : 'pv-faint'}`}>{t.note}</dd>
            )}
          </div>
        ))}
      </dl>

      {badgeSummary && (
        <div className="mt-4">
          <BuilderBadge badge={badgeSummary} />
        </div>
      )}
    </>
  )
}
