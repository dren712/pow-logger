import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Documentation — PROVN',
  description: 'How to read PROVN profiles and proofs over HTTP, and how to record verifiable agent executions with the Agent SDK.',
}

const GUIDES = [
  {
    href: '/docs/api',
    title: 'REST API',
    body: 'Public JSON and SVG endpoints for GitHub profile badges, wallet passports, single proofs and eligibility checks.',
  },
  {
    href: '/docs/agent-sdk',
    title: 'Agent SDK',
    body: 'Sign each action an agent takes, chain the events, and produce a receipt anyone can verify.',
  },
]

export default function DocsIndexPage() {
  return (
    <article className="dl-prose">
      <p className="pv-eyebrow">Documentation</p>
      <h1>PROVN documentation</h1>
      <p className="dl-lead">
        PROVN has two parts. Builder profiles and résumés are generated from public GitHub data and need no setup. The proof
        protocol underneath lets wallets and software agents sign records of their work that anyone can check.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Link key={g.href} href={g.href} className="pv-card pv-card-hover dl-card">
            <span className="pv-h2 block">{g.title}</span>
            <span className="pv-muted mt-1.5 block text-[14px] leading-relaxed">{g.body}</span>
          </Link>
        ))}
      </div>

      <h2 id="no-code">Using PROVN without code</h2>
      <ul>
        <li>
          <Link href="/#start">Get a profile</Link>: enter a GitHub username to generate a profile and a printable résumé.
        </li>
        <li>
          <Link href="/leaderboard">Leaderboard</Link>: profiles that have been generated, ranked by score.
        </li>
        <li>
          <Link href="/log">Proof logger</Link>: sign a work log with a Solana wallet.
        </li>
        <li>
          <Link href="/agent-proof">Agent console</Link>: inspect and verify agent execution receipts.
        </li>
      </ul>

      <h2 id="source">Source code</h2>
      <p>
        The application, protocol libraries and SDK are in the{' '}
        <a href="https://github.com/dren712/pow-logger" rel="noopener noreferrer" target="_blank">dren712/pow-logger</a>{' '}
        repository. Longer protocol specifications live in its <code>docs/</code> folder.
      </p>
    </article>
  )
}
