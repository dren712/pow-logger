import Link from 'next/link'
import { Logo } from './SiteNav'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Get your profile', href: '/#start' },
      { label: 'Leaderboard', href: '/leaderboard' },
      { label: 'Example profile', href: '/gh/torvalds' },
    ],
  },
  {
    title: 'Proof protocol',
    links: [
      { label: 'Solana proof logger', href: '/log' },
      { label: 'Agent console', href: '/agent-proof' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'GitHub', href: 'https://github.com/dren712/pow-logger' },
      { label: 'Solana Explorer', href: 'https://explorer.solana.com' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="pv mt-16 border-t border-white/5 bg-[#060709]">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Logo />
          <p className="pv-muted mt-3 max-w-xs text-[13px] leading-relaxed">
            Verified developer profiles and résumés, built on the PROVN proof protocol.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="pv-mono pv-faint text-[11px] font-semibold uppercase tracking-[0.12em]">{col.title}</div>
            <ul className="mt-3 flex flex-col gap-2 text-[13.5px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith('http') ? (
                    <a href={l.href} rel="noopener noreferrer" className="text-[#aab2c0] hover:text-white">{l.label} ↗</a>
                  ) : (
                    <Link href={l.href} className="text-[#aab2c0] hover:text-white">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="pv-faint mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 px-5 py-5 text-[12px]">
          <span>© {new Date().getFullYear()} PROVN</span>
          <span>Proofs anchored on Solana · archived on Arweave</span>
        </div>
      </div>
    </footer>
  )
}
