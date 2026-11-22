import type { Metadata } from 'next'
import Link from 'next/link'
import { PROFILE_REVALIDATE_SECONDS } from '@/app/lib/githubProfile'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { SITE, PROFILE_ERRORS, compact, formatMonth, languageColor } from '@/app/lib/profileFormat'
import ProfileActions from '@/app/components/ProfileActions'
import ScoreRing from '@/app/components/ScoreRing'
import SiteNav from '@/app/components/SiteNav'
import UsernameForm from '@/app/components/UsernameForm'

export const dynamic = 'force-dynamic'

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

export default async function BuilderProfilePage({ params }: PageProps) {
  const { username } = await params
  const result = await loadBuilderProfile(username)

  if (!result.ok) {
    const err = PROFILE_ERRORS[result.reason]
    return (
      <div className="pv flex flex-1 flex-col">
        <SiteNav cta={false} />
        <main className="pv-main mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
          <p className="pv-eyebrow">Profile not available</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">{err.title}</h1>
          <p className="pv-muted text-[15px]">{err.body}</p>
          <div className="mt-4 w-full">
            <UsernameForm cta="Try again" />
          </div>
        </main>
      </div>
    )
  }

  const p = result.profile
  const profileUrl = `${SITE}/gh/${p.login}`
  const badgeMarkdown = `[![Verified builder](${SITE}/api/gh-badge/${p.login})](${profileUrl})`
  const stats = [
    { label: 'Merged PRs in other projects', value: compact(p.stats.mergedExternalPrs) },
    { label: 'Projects contributed to', value: `${compact(p.stats.externalRepos)}${p.contributionsCapped ? '+' : ''}` },
    { label: 'Stars on own repos', value: compact(p.stats.stars) },
    { label: 'Public repos', value: compact(p.stats.ownRepos) },
  ]
  const languageTotal = p.languages.reduce((sum, l) => sum + l.repos, 0)
  const shown = p.contributions.slice(0, 10)

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto grid w-full max-w-5xl flex-1 gap-6 px-5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="pv-card p-6">
            <div className="flex items-start justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatarUrl} alt="" width={88} height={88} className="h-[88px] w-[88px] rounded-2xl border border-white/10" />
              <ScoreRing score={p.score} size={88} />
            </div>
            <h1 className="mt-4 text-[22px] font-bold leading-tight tracking-tight text-white">{p.name || p.login}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a href={p.githubUrl} className="pv-mono pv-muted text-[13px] hover:text-white" rel="noopener noreferrer" target="_blank">
                @{p.login}
              </a>
              <span className={`pv-tier pv-tier-${p.tier}`}>{p.tier}</span>
            </div>
            {p.bio && <p className="mt-3 text-[14px] leading-relaxed text-[#c3cad6]">{p.bio}</p>}
            <dl className="pv-muted mt-4 flex flex-col gap-1.5 text-[13px]">
              {p.company && <div><dt className="sr-only">Company</dt><dd>{p.company}</dd></div>}
              {p.location && <div><dt className="sr-only">Location</dt><dd>{p.location}</dd></div>}
              {p.website && (
                <div>
                  <dt className="sr-only">Website</dt>
                  <dd>
                    <a href={p.website} className="block truncate text-[#9fd8ff] hover:underline" rel="noopener noreferrer nofollow" target="_blank">
                      {p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </dd>
                </div>
              )}
              <div><dt className="sr-only">Member since</dt><dd>On GitHub since {formatMonth(p.memberSince)}</dd></div>
            </dl>
            <div className="mt-5">
              <ProfileActions url={profileUrl} badgeMarkdown={badgeMarkdown} resumeHref={`/gh/${p.login}/resume`} />
            </div>
          </div>

          <div className="pv-card p-5 text-[12px] leading-relaxed">
            <p className="pv-eyebrow">Verification</p>
            <p className="pv-muted mt-2">
              Built from public GitHub data on {new Date(p.generatedAt).toISOString().slice(0, 10)}. Refreshed at most once every{' '}
              {PROFILE_REVALIDATE_SECONDS / 3600} hours.
            </p>
            <p className="pv-faint mt-3">Evidence fingerprint (SHA-256)</p>
            <p className="pv-mono mt-1 break-all text-[11px] text-[#aab2c0]">{p.fingerprint}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
            {stats.map((s) => (
              <div key={s.label} className="pv-card px-4 py-4">
                <div className="text-[26px] font-bold leading-none tracking-tight text-white">{s.value}</div>
                <div className="pv-muted mt-2 text-[12px] leading-snug">{s.label}</div>
              </div>
            ))}
          </section>

          <section className="pv-card">
            <div className="border-b border-[#1c222c] px-6 py-4">
              <h2 className="pv-h2">Verified contributions</h2>
              <p className="pv-muted mt-1 text-[13px]">
                Pull requests that maintainers of other projects merged. Each one links to GitHub.
              </p>
            </div>
            {shown.length === 0 ? (
              <p className="pv-muted px-6 py-8 text-[14px]">No merged pull requests in other public projects yet.</p>
            ) : (
              <ul>
                {shown.map((c) => (
                  <li key={c.repo} className="border-b border-[#1c222c] px-6 py-4 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <a href={c.repoUrl} className="pv-link truncate text-[15px] font-semibold" rel="noopener noreferrer" target="_blank">
                        {c.repo}
                      </a>
                      <span className="pv-chip shrink-0">{c.mergedPrs} merged</span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {c.latest.map((pr) => (
                        <li key={pr.url} className="flex items-baseline justify-between gap-4 text-[13px]">
                          <a href={pr.url} className="truncate text-[#aab2c0] hover:text-[#2ee59d]" rel="noopener noreferrer" target="_blank">
                            {pr.title}
                          </a>
                          <span className="pv-mono pv-faint shrink-0 text-[11px]">{formatMonth(pr.mergedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {p.contributions.length > shown.length && (
              <p className="pv-faint border-t border-[#1c222c] px-6 py-3 text-[12px]">
                Showing the {shown.length} projects with the most merged work, out of {p.contributions.length}
                {p.contributionsCapped ? '+' : ''}.
              </p>
            )}
          </section>

          {p.topRepos.length > 0 && (
            <section>
              <h2 className="pv-h2 mb-3 px-1">Projects</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.topRepos.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} className="pv-card pv-card-hover flex h-full flex-col p-5" rel="noopener noreferrer" target="_blank">
                      <span className="truncate text-[15px] font-semibold text-white">{r.name}</span>
                      <span className="pv-muted mt-1.5 line-clamp-2 flex-1 text-[13px] leading-relaxed">
                        {r.description || 'No description.'}
                      </span>
                      <span className="pv-mono pv-faint mt-4 flex items-center gap-4 text-[11px]">
                        {r.language && <span>{r.language}</span>}
                        <span>★ {compact(r.stars)}</span>
                        <span>⑂ {compact(r.forks)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.languages.length > 0 && (
            <section className="pv-card p-6">
              <h2 className="pv-h2">Languages</h2>
              <p className="pv-muted mt-1 text-[13px]">By number of own public repositories.</p>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#1c222c]" aria-hidden="true">
                {p.languages.map((l, i) => (
                  <span key={l.name} style={{ width: `${(l.repos / languageTotal) * 100}%`, background: languageColor(i) }} />
                ))}
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
                {p.languages.map((l, i) => (
                  <li key={l.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: languageColor(i) }} aria-hidden="true" />
                    <span className="text-[#c3cad6]">{l.name}</span>
                    <span className="pv-faint">{l.repos}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="no-print pv-card flex flex-col items-center gap-4 px-6 py-8 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-white">Get your own verified profile</h2>
            <p className="pv-muted -mt-2 text-[14px]">Free, built from public GitHub data in seconds.</p>
            <UsernameForm />
            <Link href="/leaderboard" className="pv-muted text-[13px] hover:text-white">See the leaderboard →</Link>
          </section>
        </div>
      </main>
    </div>
  )
}
