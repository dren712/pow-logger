'use client'

import AchievementCard from '@/app/components/cards/AchievementCard'
import type { CardTheme } from '@/app/lib/cardThemes'
import type { Achievement, BuilderReputation } from '@/app/lib/types'
import { Modal, SectionHeader } from './ui'

export type AchievementFilter = 'all' | 'unlocked' | 'locked'

interface AchievementsProps {
  reputation: BuilderReputation
  theme: CardTheme
  filter: AchievementFilter
  onFilterChange: (f: AchievementFilter) => void
  onInspect: (a: Achievement) => void
}

export default function Achievements({ reputation, theme, filter, onFilterChange, onInspect }: AchievementsProps) {
  const all = reputation.achievements
  const unlocked = all.filter((a) => a.earned).length
  const tabs: { id: AchievementFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: all.length },
    { id: 'unlocked', label: 'Unlocked', count: unlocked },
    { id: 'locked', label: 'Locked', count: all.length - unlocked },
  ]
  const shown = all.filter((a) => (filter === 'unlocked' ? a.earned : filter === 'locked' ? !a.earned : true))

  return (
    <section className="pv-card">
      <SectionHeader title="Achievements" description="Milestones computed from this wallet's signed proof history.">
        <div className="wp-segment" role="group" aria-label="Filter achievements">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={filter === t.id} onClick={() => onFilterChange(t.id)}>
              {t.label} <span className="wp-count">{t.count}</span>
            </button>
          ))}
        </div>
      </SectionHeader>
      {shown.length === 0 ? (
        <p className="pv-muted px-6 py-8 text-[14px]">
          {filter === 'unlocked' ? 'No achievements unlocked yet.' : 'Nothing to show for this filter.'}
        </p>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          {shown.map((ach) => (
            <AchievementCard key={ach.id} achievement={ach} reputation={reputation} customTheme={theme} onClick={() => onInspect(ach)} />
          ))}
        </div>
      )}
    </section>
  )
}

export function AchievementInspector({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const rows = [
    { label: 'Status', value: achievement.earned ? 'Unlocked' : 'Criteria not met', accent: achievement.earned },
    { label: 'Criteria', value: achievement.criteria },
    { label: 'cNFT mint', value: achievement.earned ? 'Eligible (minting not yet available)' : 'Not eligible' },
  ]
  return (
    <Modal title={achievement.name} subtitle={`${achievement.rarity} credential`} onClose={onClose} maxWidth={460}>
      <p className="mt-4 text-[14px] leading-relaxed text-[#c3cad6]">{achievement.description}</p>
      <dl className="mt-4 divide-y divide-[#1c222c] rounded-xl border border-[#1c222c] bg-[#080a0e] text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="pv-muted shrink-0">{r.label}</dt>
            <dd className={`text-right ${r.accent ? 'font-semibold text-[#2ee59d]' : 'text-[#c3cad6]'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onClose} className="pv-btn-ghost mt-5 w-full">
        Close
      </button>
    </Modal>
  )
}
