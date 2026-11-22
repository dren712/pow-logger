import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchLeaderboard } from '@/app/lib/builderLeaderboard'
import UsernameForm from '@/app/components/UsernameForm'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Verified builder leaderboard — PROVN',
  description: 'Developers ranked by work that other maintainers merged. Every number links back to GitHub.',
}

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard(100)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <nav className="flex items-center justify-between text-xs">
        <Link href="/" className="font-bold text-emerald-400">PROVN</Link>
        <Link href="/log" className="text-gray-400 hover:text-emerald-400">Solana proof logger →</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-extrabold text-white">Verified builder leaderboard</h1>
        <p className="mt-2 text-sm text-gray-400">
          Ranked by work other maintainers merged, stars earned and time building in public. Add yourself by creating a profile.
        </p>
      </header>

      <UsernameForm cta="Add me" />

      {rows === null ? (
        <p className="glass-card p-6 text-sm text-gray-400">The leaderboard is not available right now.</p>
      ) : rows.length === 0 ? (
        <p className="glass-card p-6 text-sm text-gray-400">No builders yet. Be the first.</p>
      ) : (
        <ol className="glass-card divide-y divide-white/5">
          {rows.map((r, i) => (
            <li key={r.login}>
              <Link href={`/gh/${r.login}`} className="flex items-center gap-4 px-4 py-3 hover:bg-emerald-400/5">
                <span className="w-8 text-right text-sm font-bold text-gray-500">{i + 1}</span>
                {r.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-full" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{r.name || r.login}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {[`@${r.login}`, r.top_language, `${r.merged_external_prs} merged PRs`, `${r.stars} stars`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-black text-emerald-400">{r.score}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-amber-400">{r.tier}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
