import Link from 'next/link'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white" aria-label="PROVN home">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="22" height="22" rx="6" fill="#2ee59d" />
        <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#04130c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      PROVN
    </Link>
  )
}

export default function SiteNav({ cta = true }: { cta?: boolean }) {
  return (
    <nav className="no-print sticky top-0 z-30 border-b border-white/5 bg-[#060709]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/leaderboard" className="rounded-md px-2.5 py-1.5 text-[#aab2c0] hover:text-white">Leaderboard</Link>
          <Link href="/log" className="rounded-md px-2.5 py-1.5 text-[#aab2c0] hover:text-white">Logger</Link>
          {cta && (
            <span className="ml-1 hidden sm:block">
              <Link href="/#start" className="pv-btn !px-3 !py-1.5 !text-[13px]">Get your profile</Link>
            </span>
          )}
        </div>
      </div>
    </nav>
  )
}
