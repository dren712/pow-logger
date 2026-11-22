'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const DOCS_PAGES = [
  {
    href: '/docs',
    label: 'Overview',
    sections: [],
  },
  {
    href: '/docs/api',
    label: 'REST API',
    sections: [
      { id: 'basics', label: 'Basics' },
      { id: 'profiles', label: 'GitHub profiles' },
      { id: 'proofs', label: 'Wallet proofs' },
      { id: 'eligibility', label: 'Eligibility' },
      { id: 'client', label: 'TypeScript client' },
      { id: 'errors', label: 'Errors' },
    ],
  },
  {
    href: '/docs/agent-sdk',
    label: 'Agent SDK',
    sections: [
      { id: 'install', label: 'Install' },
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'events', label: 'Event types' },
      { id: 'guarantees', label: 'What a receipt proves' },
      { id: 'endpoints', label: 'Gateway endpoints' },
      { id: 'verify', label: 'Verify a receipt' },
    ],
  },
]

export default function DocsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Documentation" className="no-print">
      {/* Mobile: one scrollable row of pages */}
      <ul className="-mx-5 flex gap-1 overflow-x-auto border-b border-white/5 px-5 pb-3 lg:hidden">
        {DOCS_PAGES.map((page) => (
          <li key={page.href}>
            <Link href={page.href} className="dl-navlink" aria-current={pathname === page.href ? 'page' : undefined}>
              {page.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: sidebar with the current page's sections */}
      <div className="hidden lg:block">
        <div className="pv-mono pv-faint px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Documentation</div>
        <ul className="mt-3 flex flex-col gap-0.5">
          {DOCS_PAGES.map((page) => {
            const active = pathname === page.href
            return (
              <li key={page.href}>
                <Link href={page.href} className="dl-navlink" aria-current={active ? 'page' : undefined}>
                  {page.label}
                </Link>
                {active && page.sections.length > 0 && (
                  <ul className="mb-2 mt-1 flex flex-col">
                    {page.sections.map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} className="dl-navlink dl-sublink">{s.label}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
