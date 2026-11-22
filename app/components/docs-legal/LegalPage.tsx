import type { ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import '@/app/styles/docs-legal.css'

export const LEGAL_LAST_UPDATED = 'November 22, 2026'

const LEGAL_PAGES = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export default function LegalPage({
  current,
  title,
  lead,
  children,
}: {
  current: '/privacy' | '/terms'
  title: string
  lead: string
  children: ReactNode
}) {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        <nav aria-label="Legal pages" className="no-print mb-8 flex gap-1">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="dl-navlink" aria-current={p.href === current ? 'page' : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
        <article className="dl-prose">
          <p className="pv-eyebrow">Legal</p>
          <h1>{title}</h1>
          <p className="dl-lead">{lead}</p>
          <p className="pv-faint text-[13px]">Last updated {LEGAL_LAST_UPDATED}</p>
          {children}
        </article>
      </main>
    </div>
  )
}
