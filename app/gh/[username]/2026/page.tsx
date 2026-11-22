import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import YearShareLinks from '@/app/components/YearShareLinks'
import { loadYearStats } from '@/app/lib/yearStatsCache'
import { monthName } from '@/app/lib/yearStats'
import { PROFILE_ERRORS, SITE } from '@/app/lib/profileFormat'

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const url = `${SITE}/gh/${encodeURIComponent(username)}/2026`
  const title = `@${username} · 2026 in merged PRs — PROVN`
  const image = { url: `${url}/opengraph-image`, width: 1200, height: 630 }
  return { title, openGraph: { title, url, images: [image] }, twitter: { card: 'summary_large_image', title, images: [image.url] } }
}

export default async function YearPage({ params }: Props) {
  const { username } = await params
  const result = await loadYearStats(username, 2026)
  const url = `${SITE}/gh/${encodeURIComponent(username.toLowerCase())}/2026`
  const stats = result.ok ? result.stats : null
  return <div className="pv flex flex-1 flex-col">
    <SiteNav cta={false} />
    <main className="pv-main mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <Link href={`/gh/${encodeURIComponent(username)}`} className="pv-muted text-sm">← Builder profile</Link>
      <article className="pv-card mt-6 p-6 sm:p-10">
        <p className="pv-eyebrow">PROVN · Year in review</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">2026 in merged PRs</h1>
        <p className="pv-muted mt-3 break-all text-xl">@{username}</p>
        {stats ? <>
          <span className={`pv-tier pv-tier-${stats.tier} mt-5`}>{stats.tier}</span>
          <dl className="my-8 grid grid-cols-2 gap-6">
            {[{ label: 'Merged PRs', value: stats.total }, { label: 'Repositories contributed to', value: `${stats.repos}${stats.capped ? '+' : ''}` },
              { label: 'Best month', value: stats.bestMonth ? `${monthName(stats.bestMonth.month)} · ${stats.bestMonth.mergedPrs} PRs` : '—' },
              { label: 'Top languages', value: stats.languages.map(language => language.name).join(', ') || '—' }].map(fact => <div key={fact.label}>
                <dd className="text-2xl font-semibold text-white">{fact.value}</dd><dt className="pv-muted mt-1 text-sm">{fact.label}</dt>
              </div>)}
          </dl>
          {!stats.total && <p className="pv-muted mb-5">No public merged PRs in 2026 yet. Your next merge starts the story.</p>}
          <p className="pv-faint text-xs">Public PRs, including your own repositories. Updated daily. Languages count repositories, using their current primary language. Year tier is based only on merged PRs (200 merges reaches Legend), not your all-time builder score. Ties for best month use the earliest month.</p>
          {stats.capped && <p className="pv-muted mt-3 text-sm">GitHub limits search to 1,000 PRs. Repository, language, month and tier statistics cover the first 1,000 results only; the merged PR total covers the full year.</p>}
          <YearShareLinks url={url} />
        </> : <div className="mt-8"><h2 className="pv-h2">{PROFILE_ERRORS[result.ok ? 'unavailable' : result.reason].title}</h2><p className="pv-muted mt-3">{PROFILE_ERRORS[result.ok ? 'unavailable' : result.reason].body}</p></div>}
      </article>
    </main>
  </div>
}
