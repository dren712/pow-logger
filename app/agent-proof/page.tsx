import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import StatusPill from '@/app/components/agent-console/StatusPill'
import { formatUtc, sentenceCase, shortHash, type Tone } from '@/app/components/agent-console/format'
import '@/app/styles/agent-console.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Agent console — PROVN',
  description: 'Inspect signed agent executions: per-event signatures, hash chains, Merkle commitments on Solana and policy audits.',
}

const FLOW = [
  { title: 'Sign every action', body: 'The agent signs each tool call, file write, shell command and git operation with its own Ed25519 key.' },
  { title: 'Chain the events', body: 'Each event includes the hash of the one before it, so events cannot be removed or reordered unnoticed.' },
  { title: 'Commit the batch', body: 'Event hashes roll up into a Merkle root that is committed to Solana, with the evidence archived on Irys.' },
  { title: 'Verify the receipt', body: 'Anyone can check the exported receipt offline, then audit the actions against a policy.' },
]

const PRINCIPLES = [
  {
    title: 'The database is only an index',
    body: 'Stored rows are used to find executions. What counts as proof is the agent-signed hash chain and the committed Merkle root.',
  },
  {
    title: 'Commits survive outages',
    body: 'Anchoring and archiving run through a transactional outbox with leases and idempotent retries, then reconcile.',
  },
  {
    title: 'Receipts are portable',
    body: 'A receipt can be verified with TweetNaCl and SHA-256 alone, without calling the PROVN backend.',
  },
]

function statusTone(status: string): Tone {
  if (status === 'completed') return 'ok'
  if (status === 'failed') return 'bad'
  return 'warn'
}

export default async function AgentConsolePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

  const { data: executions, error } = await supabase
    .from('agent_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && serviceKey)
  const count = executions?.length || 0

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-10 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="pv-eyebrow">Agent console</p>
            <h1 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px]">
              Proof of what an AI agent did
            </h1>
            <p className="pv-muted mt-4 text-[16px] leading-relaxed">
              Every action an agent takes is signed, chained and committed, so a run can be checked later by anyone. Open an execution to
              inspect its events, verify it and audit it against a policy.
            </p>
          </div>
          <Link href="/agent-proof/demo" className="pv-btn">Open the example execution</Link>
        </header>

        <section aria-labelledby="ac-flow-title">
          <h2 id="ac-flow-title" className="pv-eyebrow">How it works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((s, i) => (
              <li key={s.title} className="pv-card p-5">
                <span className="pv-mono flex h-8 w-8 items-center justify-center rounded-lg border border-[#1c222c] bg-[#11151c] text-[13px] font-semibold text-[#2ee59d]">{i + 1}</span>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{s.title}</h3>
                <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ac-recent-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ac-recent-title" className="text-[20px] font-semibold tracking-tight text-white">Recent executions</h2>
            {count > 0 ? <span className="pv-faint text-[13px]">Latest {count}</span> : null}
          </div>

          <div className="pv-card mt-4 overflow-hidden">
            {count === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[16px] font-semibold text-white">
                  {!configured ? 'Execution index not connected' : error ? 'Executions could not be loaded' : 'No executions recorded yet'}
                </p>
                <p className="pv-muted mx-auto mt-2 max-w-lg text-[14px] leading-relaxed">
                  {!configured ? (
                    'This deployment has no database configured, so stored executions cannot be listed. The example execution works without one.'
                  ) : error ? (
                    'The execution index did not respond. Reload the page to try again.'
                  ) : (
                    <>
                      Record a first run with{' '}
                      <code className="pv-mono ac-break rounded bg-[#080a0e] px-1.5 py-0.5 text-[12.5px] text-[#c3cad6]">npx tsx scripts/agent-demo/demo-phase2.ts</code>, or
                      send events through the Agent SDK.
                    </>
                  )}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/agent-proof/demo" className="pv-btn-ghost">View the example</Link>
                  <Link href="/docs/agent-sdk" className="pv-btn-ghost">Agent SDK docs</Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[#1c222c]">
                {(executions || []).map((exec) => (
                  <li key={exec.execution_id}>
                    <Link href={`/agent-proof/${exec.execution_id}`} className="pv-row flex items-center justify-between gap-4 px-5 py-4 text-inherit no-underline">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="pv-mono text-[14px] font-semibold text-white">{String(exec.execution_id).slice(0, 8)}</span>
                          <StatusPill tone={statusTone(exec.status)}>{sentenceCase(String(exec.status || 'unknown'))}</StatusPill>
                        </span>
                        <span className="pv-muted mt-1 block text-[13px]">
                          {formatUtc(exec.started_at)} · {exec.event_count || 0} {exec.event_count === 1 ? 'event' : 'events'} · agent{' '}
                          <span className="pv-mono text-[12px]">{shortHash(String(exec.agent_public_key || ''), 8, 4)}</span>
                        </span>
                      </span>
                      <span className="pv-muted flex-none text-[13px]" aria-hidden="true">Inspect →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="pv-card flex flex-wrap items-center justify-between gap-5 p-6" aria-labelledby="ac-example-title">
          <div className="max-w-2xl">
            <span className="pv-chip !text-[11px]">Example</span>
            <h2 id="ac-example-title" className="mt-3 text-[18px] font-semibold text-white">A coding agent runs the tests, commits and opens a pull request</h2>
            <p className="pv-muted mt-2 text-[14px] leading-relaxed">
              A generated sample run. Step through its signed events and the six verification checks, then simulate a tampered record and a
              hostile agent to see how each failure is reported.
            </p>
          </div>
          <Link href="/agent-proof/demo" className="pv-btn-ghost">Open the example</Link>
        </section>

        <section aria-labelledby="ac-design-title">
          <h2 id="ac-design-title" className="pv-eyebrow">Design principles</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="pv-card p-5">
                <h3 className="text-[15px] font-semibold text-white">{p.title}</h3>
                <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
