import type { Metadata } from 'next'
import Link from 'next/link'
import { PROFILE_REVALIDATE_SECONDS } from '@/app/lib/githubProfile'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import ProfileActions from '@/app/components/ProfileActions'
import UsernameForm from '@/app/components/UsernameForm'

export const dynamic = 'force-dynamic'

const SITE = 'https://provn-sol.vercel.app'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const result = await loadBuilderProfile(username)
  if (!result.ok) return { title: 'Builder profile — PROVN' }
  const p = result.profile
  const title = `${p.name || p.login} — ${p.tier}, score ${p.score}/100`
  const description = `${p.stats.mergedExternalPrs} merged pull requests in ${p.stats.externalRepos} other projects, ${p.stats.stars} stars. Every claim links to GitHub.`
  return {
    title,
    description,
    openGraph: { title, description, url: `${SITE}/gh/${p.login}`, siteName: 'PROVN', type: 'profile', images: [p.avatarUrl] },
    twitter: { card: 'summary', title, description, images: [p.avatarUrl] },
  }
}

const REASONS: Record<string, string> = {
  invalid: 'That is not a valid GitHub username.',
  not_found: 'No GitHub user with that name was found.',
  rate_limited: 'GitHub is limiting requests right now. Try again in a few minutes.',
  unavailable: 'GitHub could not be reached. Try again shortly.',
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default async function BuilderProfilePage({ params }: PageProps) {
  const { username } = await params
  const result = await loadBuilderProfile(username)

  if (!result.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-5 py-20 text-center">
        <h1 className="text-xl font-bold text-white">Profile not available</h1>
        <p className="text-sm text-gray-400">{REASONS[result.reason]}</p>
        <UsernameForm cta="Try again" />
      </main>
    )
  }

  const p = result.profile

  const profileUrl = `${SITE}/gh/${p.login}`
  const badgeMarkdown = `[![Verified builder](${SITE}/api/gh-badge/${p.login})](${profileUrl})`
  const stats = [
    { label: 'Merged PRs in other projects', value: p.stats.mergedExternalPrs },
    { label: 'Projects contributed to', value: p.stats.externalRepos },
    { label: 'Stars on own repos', value: p.stats.stars },
    { label: 'Public repos', value: p.stats.ownRepos },
  ]

  return (
    <main className="print-dark mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <nav className="no-print flex items-center justify-between text-xs">
        <Link href="/" className="font-bold text-emerald-400">PROVN</Link>
        <Link href="/leaderboard" className="text-gray-400 hover:text-emerald-400">Leaderboard →</Link>
      </nav>

      <div className="glass-card printable flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatarUrl} alt="" width={96} height={96} className="h-24 w-24 rounded-full border border-emerald-400/30" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-white">{p.name || p.login}</h1>
          <a href={p.githubUrl} className="text-sm text-emerald-400 hover:underline" rel="noopener noreferrer" target="_blank">
            github.com/{p.login}
          </a>
          {p.bio && <p className="mt-2 text-sm text-gray-300">{p.bio}</p>}
          <p className="mt-2 text-xs text-gray-500">
            {[p.location, p.company, `On GitHub since ${formatDate(p.memberSince)}`].filter(Boolean).join(' · ')}
          </p>
          {p.website && (
            <a href={p.website} className="mt-1 block truncate text-xs text-cyan-300 hover:underline" rel="noopener noreferrer nofollow" target="_blank">
              {p.website}
            </a>
          )}
        </div>
        <div className="text-center">
          <div className="text-4xl font-black text-emerald-400">{p.score}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">score / 100</div>
          <div className="mt-1 text-xs font-bold text-amber-400">{p.tier}</div>
        </div>
      </div>

      <ProfileActions url={profileUrl} badgeMarkdown={badgeMarkdown} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl font-extrabold text-white">{s.value.toLocaleString('en-US')}</div>
            <div className="mt-1 text-[11px] leading-snug text-gray-400">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="glass-card printable p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Verified contributions</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pull requests by {p.login} that maintainers of other projects merged. Each line links to the pull request on GitHub.
        </p>
        {p.contributions.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No merged pull requests in other public projects yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {p.contributions.slice(0, 12).map((c) => (
              <li key={c.repo}>
                <div className="flex items-baseline justify-between gap-3">
                  <a href={c.repoUrl} className="truncate text-sm font-bold text-white hover:underline" rel="noopener noreferrer" target="_blank">
                    {c.repo}
                  </a>
                  <span className="shrink-0 text-xs text-gray-400">{c.mergedPrs} merged</span>
                </div>
                <ul className="mt-1 flex flex-col gap-1">
                  {c.latest.map((pr) => (
                    <li key={pr.url} className="flex items-baseline justify-between gap-3 text-xs">
                      <a href={pr.url} className="truncate text-gray-300 hover:text-emerald-400" rel="noopener noreferrer" target="_blank">
                        {pr.title}
                      </a>
                      <span className="shrink-0 text-gray-500">{formatDate(pr.mergedAt)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.topRepos.length > 0 && (
        <section className="glass-card printable p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Projects</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {p.topRepos.map((r) => (
              <li key={r.url}>
                <a href={r.url} className="text-sm font-bold text-white hover:underline" rel="noopener noreferrer" target="_blank">
                  {r.name}
                </a>
                <span className="ml-2 text-xs text-gray-500">
                  {[r.language, `${r.stars.toLocaleString('en-US')} stars`].filter(Boolean).join(' · ')}
                </span>
                {r.description && <p className="mt-1 text-xs text-gray-400">{r.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.languages.length > 0 && (
        <section className="glass-card printable p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Languages</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.languages.map((l) => (
              <li key={l.name} className="rounded border border-emerald-400/20 px-2 py-1 text-xs text-gray-300">
                {l.name} <span className="text-gray-500">· {l.repos}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-[11px] leading-relaxed text-gray-500">
        <p>
          Built from public GitHub data on {new Date(p.generatedAt).toISOString().slice(0, 10)}; refreshed at most once every{' '}
          {PROFILE_REVALIDATE_SECONDS / 3600} hours. Verified at {profileUrl}
        </p>
        <p className="break-all">Evidence fingerprint (SHA-256): {p.fingerprint}</p>
      </div>

      <section className="no-print glass-card flex flex-col items-center gap-3 p-6 text-center">
        <h2 className="text-sm font-bold text-white">Get your own verified profile</h2>
        <UsernameForm />
      </section>
    </main>
  )
}
