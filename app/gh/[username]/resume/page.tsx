import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { SITE, formatMonth, plural, profileSummary } from '@/app/lib/profileFormat'
import PrintButton from '@/app/components/PrintButton'
import SiteNav from '@/app/components/SiteNav'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const result = await loadBuilderProfile(username)
  if (!result.ok) return { title: 'Résumé — PROVN' }
  // The browser uses the title as the PDF file name.
  return { title: `${result.profile.name || result.profile.login} — Résumé`, robots: { index: false } }
}

export default async function ResumePage({ params }: PageProps) {
  const { username } = await params
  const result = await loadBuilderProfile(username)
  if (!result.ok) notFound()
  const p = result.profile
  const profileUrl = `${SITE}/gh/${p.login}`
  const contact = [
    p.location,
    p.company,
    <a key="gh" href={p.githubUrl}>github.com/{p.login}</a>,
    p.website && <a key="web" href={p.website}>{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>,
  ].filter(Boolean)
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
          <Link href={`/gh/${p.login}`} className="pv-muted text-[13px] hover:text-white">← Back to profile</Link>
          <div className="flex items-center gap-3">
            <span className="pv-faint hidden text-[12px] sm:block">Choose “Save as PDF” in the print dialog</span>
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="pv-main resume-stage flex-1 px-4 py-8 sm:py-12">
        <article className="resume-sheet">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="resume-name">{p.name || p.login}</h1>
              {p.bio && <p className="mt-2 text-[14px] text-[#333a45]">{p.bio}</p>}
              <p className="resume-meta mt-2 flex flex-wrap gap-x-2 gap-y-0.5">
                {contact.map((c, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mr-2 text-[#b9bec7]">·</span>}
                    {c}
                  </span>
                ))}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatarUrl} alt="" width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full" />
          </div>

          <section className="resume-section">
            <h2 className="resume-heading">Summary</h2>
            <p className="text-[#333a45]">{profileSummary(p)}</p>
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
              {p.contributions.slice(0, 8).map((c) => (
                <div key={c.repo} className="resume-item">
                  <div className="flex items-baseline justify-between gap-4">
                    <a href={c.repoUrl} className="resume-item-title truncate">{c.repo}</a>
                    <span className="resume-aside">{plural(c.mergedPrs, 'merged pull request')}</span>
                  </div>
                  <ul className="resume-bullets">
                    {c.latest.map((pr) => (
                      <li key={pr.url}>
                        <a href={pr.url}>{pr.title}</a>
                        {pr.mergedAt && <span className="resume-aside"> · {formatMonth(pr.mergedAt)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {p.topRepos.length > 0 && (
            <section className="resume-section">
              <h2 className="resume-heading">Projects</h2>
              {p.topRepos.map((r) => (
                <div key={r.url} className="resume-item">
                  <div className="flex items-baseline justify-between gap-4">
                    <a href={r.url} className="resume-item-title truncate">{r.name}</a>
                    <span className="resume-aside">
                      {[r.language, r.stars > 0 ? plural(r.stars, 'star') : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {r.description && <p className="text-[#333a45]">{r.description}</p>}
                </div>
              ))}
            </section>
          )}

          {p.languages.length > 0 && (
            <section className="resume-section">
              <h2 className="resume-heading">Languages</h2>
              <p className="text-[#333a45]">{p.languages.map((l) => l.name).join(' · ')}</p>
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
    </div>
  )
}
