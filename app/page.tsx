import Link from 'next/link'
import ScoreRing from './components/ScoreRing'
import SiteNav from './components/SiteNav'
import UsernameForm from './components/UsernameForm'
import { fetchLeaderboard } from './lib/builderLeaderboard'

export const revalidate = 300

const STEPS = [
  { title: 'Enter your GitHub username', body: 'No sign-up and no wallet. Your profile is built from your public work in seconds.' },
  { title: 'Get a résumé people can check', body: 'Every contribution links to the pull request a maintainer merged. Nothing is self-reported.' },
  { title: 'Share it anywhere', body: 'Put the link in your bio, add the badge to your README, or download a clean PDF.' },
]

const COMPARE = [
  { claim: '“Contributed to open source”', proof: '12 pull requests merged into vercel/next.js, each one linked' },
  { claim: '“Experienced with Rust”', proof: '9 public Rust repositories and merged Rust PRs in 4 projects' },
  { claim: '“Built popular tools”', proof: '3,480 stars across own repositories, counted from GitHub' },
]

const FAQ = [
  { q: 'Is it free?', a: 'Yes. The profile, the résumé PDF, the badge and the leaderboard are free.' },
  { q: 'What data do you read?', a: 'Only what GitHub already shows publicly: your profile, your public repositories and your merged pull requests in public projects. No login and no private data.' },
  { q: 'How is the score calculated?', a: 'Mostly from pull requests merged by other maintainers, then the number of projects you contributed to, stars on your own repositories, public repositories, followers and account age. Each part is capped, so one viral repo cannot max the score.' },
  { q: 'Where does Solana come in?', a: 'PROVN started as a proof protocol on Solana. Signed proof logging with a wallet is still available in the proof logger, and it is optional.' },
]

function ExampleCard() {
  return (
    <div className="pv-card relative w-full max-w-sm p-6 shadow-[0_40px_120px_rgba(46,229,157,0.08)]" aria-label="Example profile">
      <span className="pv-chip absolute right-4 top-4 !text-[11px]">Example</span>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2ee59d] to-[#6cc4ff] text-xl font-bold text-[#04130c]">AK</div>
        <div>
          <div className="text-[17px] font-semibold text-white">Asha Kumar</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="pv-mono pv-muted text-[12px]">@ashak</span>
            <span className="pv-tier pv-tier-Veteran">Veteran</span>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <ScoreRing score={68} size={84} />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
          {[['47', 'merged PRs'], ['12', 'projects'], ['3.4k', 'stars'], ['31', 'repos']].map(([v, l]) => (
            <div key={l}>
              <dd className="text-[17px] font-semibold leading-none text-white">{v}</dd>
              <dt className="pv-muted mt-1">{l}</dt>
            </div>
          ))}
        </dl>
      </div>
      <ul className="mt-5 flex flex-col gap-2 border-t border-[#1c222c] pt-4 text-[13px]">
        {[['vercel/next.js', '12 merged'], ['solana-labs/solana', '8 merged'], ['tokio-rs/tokio', '5 merged']].map(([repo, n]) => (
          <li key={repo} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="pv-accent" aria-hidden="true">✓</span>
              <span className="truncate text-[#c3cad6]">{repo}</span>
            </span>
            <span className="pv-mono pv-faint text-[11px]">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function Home() {
  const top = (await fetchLeaderboard(5)) || []

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main flex-1">
        <section id="start" className="hero-glow scroll-mt-20">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 py-12 sm:gap-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-24">
            <div className="flex flex-col items-start gap-6">
              <span className="pv-chip"><span className="h-1.5 w-1.5 rounded-full bg-[#2ee59d]" aria-hidden="true" /> Free · no sign-up</span>
              <h1 className="text-[38px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[56px]">
                The developer résumé <span className="pv-accent sm:whitespace-nowrap">nobody can fake</span>
              </h1>
              <p className="pv-muted max-w-xl text-[17px] leading-relaxed">
                Anyone can write &ldquo;contributed to open source&rdquo;. PROVN builds your résumé from work that was actually merged,
                with a link to prove each line.
              </p>
              <UsernameForm />
              <p className="pv-faint text-[13px]">
                Built from public GitHub data only. See an example:{' '}
                <Link href="/gh/torvalds" className="pv-underline">torvalds</Link>
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <ExampleCard />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-12">
          <p className="pv-eyebrow">How it works</p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="pv-card p-6">
                <span className="pv-mono flex h-8 w-8 items-center justify-center rounded-lg border border-[#1c222c] bg-[#11151c] text-[13px] font-semibold text-[#2ee59d]">{i + 1}</span>
                <h2 className="mt-4 text-[16px] font-semibold text-white">{s.title}</h2>
                <p className="pv-muted mt-2 text-[14px] leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-12">
          <p className="pv-eyebrow">Claims versus proof</p>
          <h2 className="mt-3 max-w-2xl text-balance text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">
            Recruiters read hundreds of résumés that say the same thing. Yours shows the receipts.
          </h2>
          <div className="pv-card mt-6 overflow-hidden">
            <div className="pv-mono pv-faint hidden grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 border-b border-[#1c222c] px-6 py-3 text-[11px] uppercase tracking-[0.12em] sm:grid" aria-hidden="true">
              <span>A normal résumé says</span>
              <span>Yours says</span>
            </div>
            {COMPARE.map((c) => (
              <div key={c.claim} className="grid gap-x-6 gap-y-2 border-b border-[#1c222c] px-5 py-4 text-[14px] leading-relaxed last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:px-6">
                <span className="pv-muted">
                  <span className="sr-only">A normal résumé says: </span>
                  {c.claim}
                </span>
                <span className="flex gap-2 text-[#d9dee6]">
                  <span className="pv-accent" aria-hidden="true">✓</span>
                  <span><span className="sr-only">Yours says: </span>{c.proof}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="pv-faint mt-3 text-[12px]">Illustrative examples.</p>
        </section>

        {top.length > 0 && (
          <section className="mx-auto w-full max-w-5xl px-5 py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="pv-eyebrow">Leaderboard</p>
                <h2 className="mt-3 text-[24px] font-bold tracking-tight text-white sm:text-[28px]">Top builders right now</h2>
              </div>
              <Link href="/leaderboard" className="pv-muted shrink-0 text-[14px] hover:text-white">See all →</Link>
            </div>
            <ol className="pv-card mt-6 overflow-hidden">
              {top.map((r, i) => (
                <li key={r.login} className="border-b border-[#1c222c] last:border-b-0">
                  <Link href={`/gh/${r.login}`} className="pv-row flex items-center gap-4 px-5 py-3.5">
                    <span className="pv-mono pv-faint w-5 text-right text-[13px]">{i + 1}</span>
                    {r.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 shrink-0 rounded-full bg-[#1c222c]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{r.name || r.login}</span>
                    <span className={`pv-tier pv-tier-${r.tier} hidden sm:inline-flex`}>{r.tier}</span>
                    <span className="w-8 shrink-0 text-right text-[16px] font-bold tabular-nums text-[#2ee59d]">{r.score}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mx-auto w-full max-w-5xl px-5 py-12">
          <p className="pv-eyebrow">Questions</p>
          <dl className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-[16px] font-semibold text-white">{f.q}</dt>
                <dd className="pv-muted mt-2 text-[14px] leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-8 pt-12">
          <div className="pv-card flex flex-col items-center gap-5 px-6 py-12 text-center">
            <h2 className="text-balance text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">See what your work adds up to</h2>
            <UsernameForm />
            <Link href="/log" className="pv-muted text-balance text-[13px] hover:text-white">
              Building on Solana? Log signed proofs with a wallet →
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
