import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchLeaderboard } from '@/app/lib/builderLeaderboard'
import UsernameForm from '@/app/components/UsernameForm'
import SiteNav from '@/app/components/SiteNav'
import { compact } from '@/app/lib/profileFormat'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Verified builder leaderboard — PROVN',
  description: 'Developers ranked by work that other maintainers merged. Every number links back to GitHub.',
}

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard(100)

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:py-14">
        <div>
          <p className="pv-eyebrow">Leaderboard</p>
          <h1 className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.03em] text-white">Verified builders</h1>
          <p className="pv-muted mt-3 max-w-xl text-[15px] leading-relaxed">
            Ranked by work other maintainers merged, stars earned and time building in public. Create a profile to add yourself.
          </p>
          <div className="mt-6">
            <UsernameForm cta="Add me" />
          </div>
        </div>

        {rows === null || rows.length === 0 ? (
          <div className="pv-card flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[16px] font-semibold text-white">
              {rows === null ? 'The leaderboard is not available right now' : 'No builders yet'}
            </p>
            <p className="pv-muted text-[14px]">
              {rows === null ? 'Profiles still work. Check back shortly.' : 'Create your profile above to take the first spot.'}
            </p>
          </div>
        ) : (
          <ol className="pv-card overflow-hidden">
            {rows.map((r, i) => (
              <li key={r.login} className="border-b border-[#1c222c] last:border-b-0">
                <Link href={`/gh/${r.login}`} className="pv-row flex items-center gap-4 px-4 py-3.5 sm:px-5">
                  <span className={`pv-mono w-7 text-right text-[13px] font-semibold ${i < 3 ? 'text-[#f5c451]' : 'pv-faint'}`}>{i + 1}</span>
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatar_url} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full" />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-[#1c222c]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">{r.name || r.login}</span>
                    <span className="pv-muted block truncate text-[12.5px]">
                      {[`@${r.login}`, r.top_language, `${compact(r.merged_external_prs)} merged PRs`, `${compact(r.stars)} stars`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`pv-tier pv-tier-${r.tier} hidden sm:inline-flex`}>{r.tier}</span>
                  <span className="w-9 text-right text-[18px] font-bold text-[#2ee59d]">{r.score}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <p className="pv-faint text-center text-[13px]">
          Building on Solana? <Link href="/log" className="text-[#aab2c0] hover:text-white">Open the proof logger →</Link>
        </p>
      </main>
    </div>
  )
}
