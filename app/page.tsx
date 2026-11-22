import Link from 'next/link'
import UsernameForm from './components/UsernameForm'
import { fetchLeaderboard } from './lib/builderLeaderboard'

export const revalidate = 300

const STEPS = [
  { title: 'Enter your GitHub username', body: 'No sign-up, no wallet. Your profile is built from your public work in seconds.' },
  { title: 'Get a résumé recruiters can check', body: 'Every contribution links to the pull request a maintainer merged. Nothing is self-reported.' },
  { title: 'Share it and climb the leaderboard', body: 'Put the link in your bio, add the badge to your README, or download it as a PDF.' },
]

export default async function Home() {
  const top = (await fetchLeaderboard(5)) || []

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-5 py-12">
      <nav className="flex items-center justify-between text-xs">
        <span className="font-bold text-emerald-400">PROVN</span>
        <span className="flex gap-5 text-gray-400">
          <Link href="/leaderboard" className="hover:text-emerald-400">Leaderboard</Link>
          <Link href="/log" className="hover:text-emerald-400">Solana proof logger</Link>
        </span>
      </nav>

      <section className="hero-glow flex flex-col items-center gap-6 py-8 text-center">
        <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">
          The developer résumé <span className="text-emerald-400">nobody can fake</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-gray-400">
          Anyone can write &ldquo;contributed to open source&rdquo; on a résumé. PROVN builds yours from work that was actually merged,
          with a link to prove each line.
        </p>
        <UsernameForm />
        <p className="text-xs text-gray-500">Free. Built from public GitHub data only.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="stat-card">
            <div className="text-xs font-bold text-emerald-400">0{i + 1}</div>
            <h2 className="mt-2 text-sm font-bold text-white">{s.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">{s.body}</p>
          </div>
        ))}
      </section>

      {top.length > 0 && (
        <section className="glass-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Top builders</h2>
            <Link href="/leaderboard" className="text-xs text-gray-400 hover:text-emerald-400">See all →</Link>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {top.map((r, i) => (
              <li key={r.login}>
                <Link href={`/gh/${r.login}`} className="flex items-center gap-3 text-sm hover:text-emerald-400">
                  <span className="w-5 text-gray-500">{i + 1}</span>
                  <span className="flex-1 truncate font-bold text-white">{r.name || r.login}</span>
                  <span className="font-black text-emerald-400">{r.score}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="text-center text-xs leading-relaxed text-gray-500">
        Built on the PROVN proof protocol: signed evidence, public verification and optional Solana anchoring.{' '}
        <Link href="/log" className="text-emerald-400 hover:underline">Log signed proofs with a wallet →</Link>
      </section>
    </main>
  )
}
