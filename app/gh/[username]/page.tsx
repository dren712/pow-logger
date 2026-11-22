import type { Metadata } from 'next'
import Link from 'next/link'
import { PROFILE_REVALIDATE_SECONDS } from '@/app/lib/githubProfile'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { SITE, PROFILE_ERRORS, compact, formatMonth, languageColor, plural } from '@/app/lib/profileFormat'
import ProfileActions from '@/app/components/ProfileActions'
import RichText, { cleanText } from '@/app/components/builder-qa/RichText'
import ScoreRing from '@/app/components/ScoreRing'
import SiteNav from '@/app/components/SiteNav'
import UsernameForm from '@/app/components/UsernameForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ username: string }>
}

const ICONS = {
  company: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
  location: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  calendar: 'M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  fork: 'M7 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 15.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8.5v1.5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8.5M12 12v3.5',
}

function Icon({ name, size = 14 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Verification({ generatedAt, fingerprint, className = '' }: { generatedAt: string; fingerprint: string; className?: string }) {
  return (
    <div className={`pv-card p-5 text-[12px] leading-relaxed ${className}`}>
      <p className="pv-eyebrow">Verification</p>
      <p className="pv-muted mt-2">
        Built from public GitHub data on {new Date(generatedAt).toISOString().slice(0, 10)}. Refreshed at most once every{' '}
        {PROFILE_REVALIDATE_SECONDS / 3600} hours.
      </p>
      <p className="pv-faint mt-3">Evidence fingerprint (SHA-256)</p>
      <p className="pv-mono mt-1 break-all text-[11px] text-[#aab2c0]">{fingerprint}</p>
    </div>
  )
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
    openGraph: { title, description, url: `${SITE}/gh/${p.login}`, siteName: 'PROVN', type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
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
          <h1 className="text-balance text-2xl font-bold tracking-tight text-white">{err.title}</h1>
          <p className="pv-muted text-balance text-[15px] leading-relaxed">{err.body}</p>
          <div className="mt-4 flex w-full justify-center">
            <UsernameForm cta="Try again" />
          </div>
          <p className="pv-faint mt-2 text-[13px]">
            Or see an <Link href="/gh/torvalds" className="pv-underline">example profile</Link> or the{' '}
            <Link href="/leaderboard" className="pv-underline">leaderboard</Link>.
          </p>
        </main>
      </div>
    )
  }

  const p = result.profile
  const profileUrl = `${SITE}/gh/${p.login}`
  const badgeMarkdown = `[![Verified builder](${SITE}/api/gh-badge/${p.login})](${profileUrl})`
  const displayName = cleanText(p.name) || p.login
  const bio = cleanText(p.bio)
  const company = cleanText(p.company)
  const location = cleanText(p.location)
  const shareText = `${displayName} on PROVN: ${p.tier}, score ${p.score}/100. ${plural(p.stats.mergedExternalPrs, 'merged pull request')} in ${plural(p.stats.externalRepos, 'project')}${p.contributionsCapped ? ' or more' : ''}, each one linked to GitHub.`
  const stats = [
    { label: 'Merged PRs', hint: 'in other projects', value: compact(p.stats.mergedExternalPrs) },
    { label: 'Projects', hint: 'contributed to', value: `${compact(p.stats.externalRepos)}${p.contributionsCapped ? '+' : ''}` },
    { label: 'Stars', hint: 'on own repositories', value: compact(p.stats.stars) },
    { label: 'Repositories', hint: 'public', value: compact(p.stats.ownRepos) },
  ]
  const languageTotal = p.languages.reduce((sum, l) => sum + l.repos, 0)
  const shown = p.contributions.slice(0, 10)

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto grid w-full max-w-5xl flex-1 gap-6 px-5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="pv-card p-6">
            <div className="flex items-start justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatarUrl} alt="" width={88} height={88} className="h-[88px] w-[88px] rounded-2xl border border-white/10 bg-[#11151c] object-cover" />
              <ScoreRing score={p.score} size={88} />
            </div>
            <h1 className="mt-4 break-words text-[22px] font-bold leading-tight tracking-tight text-white">{displayName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <a href={p.githubUrl} className="pv-mono pv-muted min-w-0 break-all text-[13px] hover:text-white" rel="noopener noreferrer" target="_blank">
                @{p.login}
              </a>
              <span className={`pv-tier pv-tier-${p.tier}`}>{p.tier}</span>
            </div>
            {bio && <p className="mt-3 break-words text-[14px] leading-relaxed text-[#c3cad6]">{bio}</p>}
            <dl className="pv-muted mt-4 flex flex-col gap-2 text-[13px]">
              {company && (
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Company</dt>
                  <span className="pv-faint mt-[3px]"><Icon name="company" /></span>
                  <dd className="min-w-0 break-words">{company}</dd>
                </div>
              )}
              {location && (
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Location</dt>
                  <span className="pv-faint mt-[3px]"><Icon name="location" /></span>
                  <dd className="min-w-0 break-words">{location}</dd>
                </div>
              )}
              {p.website && (
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Website</dt>
                  <span className="pv-faint mt-[3px]"><Icon name="link" /></span>
                  <dd className="min-w-0">
                    <a href={p.website} className="block truncate text-[#9fd8ff] hover:underline" rel="noopener noreferrer nofollow" target="_blank">
                      {p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-2">
                <dt className="sr-only">Member since</dt>
                <span className="pv-faint mt-[3px]"><Icon name="calendar" /></span>
                <dd>On GitHub since {formatMonth(p.memberSince)}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <ProfileActions url={profileUrl} badgeMarkdown={badgeMarkdown} resumeHref={`/gh/${p.login}/resume`} shareText={shareText} />
            </div>
          </div>

          <Verification generatedAt={p.generatedAt} fingerprint={p.fingerprint} className="hidden lg:block" />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
            {stats.map((s) => (
              <div key={s.label} className="pv-card px-4 py-4">
                <div className="text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">{s.value}</div>
                <div className="mt-2.5 text-[13px] font-medium leading-snug text-[#c3cad6]">{s.label}</div>
                <div className="pv-faint text-[12px] leading-snug">{s.hint}</div>
              </div>
            ))}
          </section>

          <section className="pv-card overflow-hidden">
            <div className="border-b border-[#1c222c] px-5 py-4 sm:px-6">
              <h2 className="pv-h2">Verified contributions</h2>
              <p className="pv-muted mt-1 text-[13px]">
                Pull requests that maintainers of other projects merged. Each one links to GitHub.
              </p>
            </div>
            {shown.length === 0 ? (
              <div className="px-5 py-10 text-center sm:px-6">
                <p className="text-[15px] font-medium text-white">No merged pull requests in other projects yet</p>
                <p className="pv-muted mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed">
                  When a maintainer of another public project merges a pull request from @{p.login}, it shows up here.
                </p>
              </div>
            ) : (
              <ul>
                {shown.map((c) => (
                  <li key={c.repo} className="border-b border-[#1c222c] px-5 py-4 last:border-b-0 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <a href={c.repoUrl} className="pv-link min-w-0 truncate text-[15px] font-semibold" rel="noopener noreferrer" target="_blank">
                        {c.repo}
                      </a>
                      <span className="pv-chip shrink-0">{c.mergedPrs} merged</span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {c.latest.map((pr) => (
                        <li key={pr.url} className="flex items-baseline justify-between gap-4 text-[13px]">
                          <a href={pr.url} className="min-w-0 truncate text-[#aab2c0] hover:text-[#2ee59d]" rel="noopener noreferrer" target="_blank" title={cleanText(pr.title)}>
                            <RichText text={pr.title} />
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
              <p className="pv-faint border-t border-[#1c222c] px-5 py-3 text-[12px] sm:px-6">
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
                      {cleanText(r.description) ? (
                        <span className="pv-muted mt-1.5 line-clamp-2 flex-1 break-words text-[13px] leading-relaxed">
                          <RichText text={r.description} />
                        </span>
                      ) : (
                        <span className="pv-faint mt-1.5 flex-1 text-[13px] leading-relaxed">No description</span>
                      )}
                      <span className="pv-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                        {r.language && (
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#5c6473]" aria-hidden="true" />
                            {r.language}
                          </span>
                        )}
                        <span className="flex items-center gap-1 tabular-nums" title={`${r.stars.toLocaleString('en-US')} stars`}>
                          <Icon name="star" size={13} />
                          <span className="sr-only">Stars:</span>
                          {compact(r.stars)}
                        </span>
                        <span className="flex items-center gap-1 tabular-nums" title={`${r.forks.toLocaleString('en-US')} forks`}>
                          <Icon name="fork" size={13} />
                          <span className="sr-only">Forks:</span>
                          {compact(r.forks)}
                        </span>
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
                    <span className="pv-faint tabular-nums">{l.repos}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Verification generatedAt={p.generatedAt} fingerprint={p.fingerprint} className="lg:hidden" />

          <section className="no-print pv-card flex flex-col items-center gap-4 px-6 py-8 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-white">Get your own verified profile</h2>
            <p className="pv-muted -mt-2 text-balance text-[14px]">Free, built from public GitHub data in seconds.</p>
            <UsernameForm />
            <Link href="/leaderboard" className="pv-muted text-[13px] hover:text-white">See the leaderboard →</Link>
          </section>
        </div>
      </main>
    </div>
  )
}
