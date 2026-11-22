import type { Metadata } from 'next'
import Link from 'next/link'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { SITE, PROFILE_ERRORS, formatMonth, plural, profileSummary } from '@/app/lib/profileFormat'
import RichText, { cleanText } from '@/app/components/builder-qa/RichText'
import PrintButton from '@/app/components/PrintButton'
import SiteNav from '@/app/components/SiteNav'
import UsernameForm from '@/app/components/UsernameForm'
import ProWaitlist from '@/app/components/ProWaitlist'
import ResumeTailor from '@/app/components/ResumeTailor'

export const dynamic = 'force-dynamic'

// Keeps the printed résumé to two pages for the most active accounts.
const MAX_CONTRIBUTIONS = 8

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const result = await loadBuilderProfile(username)
  if (!result.ok) return { title: 'Résumé — PROVN' }
  // The browser uses the title as the PDF file name.
  return { title: `${cleanText(result.profile.name) || result.profile.login} — Résumé`, robots: { index: false } }
}

export default async function ResumePage({ params }: PageProps) {
  const { username } = await params
  const result = await loadBuilderProfile(username)
  if (!result.ok) {
    const err = PROFILE_ERRORS[result.reason]
    return (
      <div className="pv flex flex-1 flex-col">
        <SiteNav cta={false} />
        <main className="pv-main mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
          <p className="pv-eyebrow">Résumé not available</p>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-white">{err.title}</h1>
          <p className="pv-muted text-balance text-[15px] leading-relaxed">{err.body}</p>
          <div className="mt-4 flex w-full justify-center">
            <UsernameForm cta="Try again" />
          </div>
        </main>
      </div>
    )
  }
  const p = result.profile
  const profileUrl = `${SITE}/gh/${p.login}`
  const displayName = cleanText(p.name) || p.login
  const bio = cleanText(p.bio)
  const contact = [
    cleanText(p.location),
    cleanText(p.company),
    <a key="gh" href={p.githubUrl}>github.com/{p.login}</a>,
    p.website && <a key="web" href={p.website}>{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>,
  ].filter(Boolean)
  const contributions = p.contributions.slice(0, MAX_CONTRIBUTIONS)
  const moreContributions = p.contributions.length - contributions.length
  const facts = [
    { value: p.stats.mergedExternalPrs.toLocaleString('en-US'), label: 'merged PRs in other projects' },
    { value: `${p.stats.externalRepos.toLocaleString('en-US')}${p.contributionsCapped ? '+' : ''}`, label: 'projects contributed to' },
    { value: p.stats.stars.toLocaleString('en-US'), label: 'stars on own repositories' },
    { value: p.stats.ownRepos.toLocaleString('en-US'), label: 'public repositories' },
  ]

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <div className="no-print border-b border-white/5">
        <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href={`/gh/${p.login}`} className="pv-muted -ml-2 rounded-md px-2 py-1.5 text-[13px] hover:text-white">← Back to profile</Link>
          <div className="flex items-center gap-3">
            <span className="pv-faint hidden text-[12px] sm:block">Opens the print dialog. Choose “Save as PDF”.</span>
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="pv-main resume-stage flex-1 px-4 py-8 sm:py-12">
        <article className="resume-sheet">
          <div className="resume-top flex items-start justify-between gap-5 sm:gap-6">
            <div className="min-w-0">
              <h1 className="resume-name">{displayName}</h1>
              {bio && <p className="resume-bio">{bio}</p>}
              <p className="resume-meta">
                {contact.map((c, i) => <span key={i}>{c}</span>)}
              </p>
              <p className="resume-score">
                <b>PROVN score {p.score}/100</b> · {p.tier} · verified at{' '}
                <a href={profileUrl}>{profileUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatarUrl} alt="" width={72} height={72} className="h-14 w-14 shrink-0 rounded-full bg-[#eef0f3] object-cover sm:h-[72px] sm:w-[72px]" />
          </div>

          <section className="resume-section">
            <h2 className="resume-heading">Summary</h2>
            <p className="resume-text">{profileSummary(p)}</p>
            <div className="resume-facts mt-4">
              {facts.map((f) => (
                <div key={f.label} className="resume-fact">
                  <b>{f.value}</b>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </section>

          {p.contributions.length > 0 && (
            <section className="resume-section">
              <h2 className="resume-heading">Open-source contributions</h2>
              {contributions.map((c) => (
                <div key={c.repo} className="resume-item">
                  <div className="resume-row">
                    <a href={c.repoUrl} className="resume-item-title">{c.repo}</a>
                    <span className="resume-aside">{plural(c.mergedPrs, 'merged pull request')}</span>
                  </div>
                  <ul className="resume-bullets">
                    {c.latest.map((pr) => (
                      <li key={pr.url}>
                        <a href={pr.url}><RichText text={pr.title} codeClassName="resume-code" /></a>
                        {pr.mergedAt && <span className="resume-aside"> · {formatMonth(pr.mergedAt)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {moreContributions > 0 && (
                <p className="resume-more">
                  Merged work in {moreContributions.toLocaleString('en-US')}{p.contributionsCapped ? '+' : ''} more{' '}
                  {moreContributions === 1 ? 'project' : 'projects'} is listed at <a href={profileUrl}>{profileUrl.replace(/^https?:\/\//, '')}</a>.
                </p>
              )}
            </section>
          )}

          {p.topRepos.length > 0 && (
            <section className="resume-section">
              <h2 className="resume-heading">Projects</h2>
              {p.topRepos.map((r) => (
                <div key={r.url} className="resume-item">
                  <div className="resume-row">
                    <a href={r.url} className="resume-item-title">{r.name}</a>
                    <span className="resume-aside">
                      {[r.language, r.stars > 0 ? plural(r.stars, 'star') : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {cleanText(r.description) && <p className="resume-text"><RichText text={r.description} codeClassName="resume-code" /></p>}
                </div>
              ))}
            </section>
          )}

          {p.languages.length > 0 && (
            <section className="resume-section">
              <h2 className="resume-heading">Languages</h2>
              <p className="resume-text">{p.languages.map((l) => l.name).join(' · ')}</p>
            </section>
          )}

          <div className="resume-verify">
            <p>
              Every line above is taken from public GitHub records on {new Date(p.generatedAt).toISOString().slice(0, 10)} and can be
              checked at <a href={profileUrl}>{profileUrl.replace('https://', '')}</a>.
            </p>
            <p className="pv-mono mt-1 break-all">SHA-256 {p.fingerprint}</p>
          </div>
        </article>
      </main>
      <div className="no-print mx-auto mb-12 flex w-full max-w-[820px] flex-col gap-6 px-5">
        <ResumeTailor githubUsername={p.login} />
        <ProWaitlist source="resume" githubUsername={p.login} />
      </div>
    </div>
  )
}
