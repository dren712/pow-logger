import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import StatusPill from '@/app/components/agent-console/StatusPill'
import { formatUtc, sentenceCase, shortHash, type Tone } from '@/app/components/agent-console/format'
import { generateMandateDemoReceipt } from '@/app/lib/agent/mandateDemo'
import { verifyProvnVerifyReceipt } from '@/app/lib/agent/mandate'
import '@/app/styles/agent-console.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'PROVN Verify — receipts for AI agents that act and pay',
  description:
    'Signed, mandate-checked receipts for agent tool calls and x402-style Solana payments. Verify any receipt in your browser; anchors are on Solana devnet.',
}

const QUICKSTART = `import { ProvnVerify } from './sdk' // not on npm yet: copy sdk/ from GitHub
const pv = await ProvnVerify.start({ intent: 'Buy data', mandate: { mandateId: 'm1', principal: 'you', spendLimit: { amount: '500.00', currency: 'USDC' }, allowedActions: ['mcp:search', 'x402.pay'] } })
await pv.mcp(mcpClient, 'search', { q: 'solana x402' })  // MCP tool call, signed
await pv.pay({ resource, payTo, amount: '700.00', asset: 'USDC' }, payOnDevnet)  // over the mandate: rejected, still receipted
const receipt = await pv.complete()  // paste it into /verify`

const HONESTY = [
  { title: 'Not on npm yet', body: 'The SDK lives in the sdk/ folder of the GitHub repo. Copy it or import it from a clone until the package is published.' },
  {
    title: 'Integrity, not truth',
    body: 'A hash on Solana proves the record has not changed since it was committed. It does not prove the off-chain tool call or payment happened as described.',
  },
  { title: 'Devnet only', body: 'Anchors go to Solana devnet and archives to Irys devnet. Payments in the demo are simulated and move no funds.' },
]

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
  const demoReport = verifyProvnVerifyReceipt(await generateMandateDemoReceipt())

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
            <p className="pv-eyebrow">PROVN Verify</p>
            <h1 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px]">
              Receipts for AI agents that act and pay
            </h1>
            <p className="pv-muted mt-4 text-[16px] leading-relaxed">
              Give an agent a mandate: a spend limit and the actions it may take. PROVN Verify checks every tool call, MCP call and x402-style
              Solana payment against it, signs the request and the result, and hands you a receipt anyone can verify, including the actions it refused.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/verify" className="pv-btn">Verify a receipt</Link>
            <Link href="/docs/agent-sdk" className="pv-btn-ghost">SDK docs</Link>
          </div>
        </header>

        <section aria-labelledby="pv-quickstart-title">
          <h2 id="pv-quickstart-title" className="pv-eyebrow">Quickstart</h2>
          <pre className="pv-card pv-mono ac-scroll mt-5 overflow-x-auto p-5 text-[12.5px] leading-[1.75] text-[#c3cad6]"><code>{QUICKSTART}</code></pre>
          <p className="pv-faint mt-3 text-[13px] leading-relaxed">
            Full example: <code className="pv-code">sdk/examples/provn-verify-quickstart.ts</code>. Without an API key it runs offline; with one, the
            receipt syncs to PROVN and is anchored on Solana devnet.
          </p>
        </section>

        <section aria-labelledby="pv-demo-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <span className="pv-chip !text-[11px]">Live demo</span>
              <h2 id="pv-demo-title" className="mt-3 text-[20px] font-semibold tracking-tight text-white">A research agent with a $500 mandate</h2>
              <p className="pv-muted mt-2 text-[14px] leading-relaxed">
                Generated fresh on every page load and signed with a new agent key. It buys a $120 dataset, then tries a $700 payment and a shell command.
              </p>
            </div>
            <Link href="/verify" className="pv-btn-ghost">Verify this receipt yourself</Link>
          </div>
          <ul className="pv-card mt-4 divide-y divide-[#1c222c] overflow-hidden">
            {demoReport.actions.map((a) => (
              <li key={a.actionId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <span className="min-w-0">
                  <span className="pv-mono text-[13px] text-white">{a.action}</span>
                  {a.amount ? <span className="pv-muted text-[13px]"> · {a.amount} {a.currency}</span> : null}
                  {a.reasons.length > 0 ? <span className="pv-muted mt-1 block text-[12.5px]">{a.reasons[0]}</span> : null}
                </span>
                <StatusPill tone={a.recomputedDecision === 'allow' ? 'ok' : 'warn'}>
                  {a.recomputedDecision === 'allow' ? 'Allowed' : 'Rejected, receipted'}
                </StatusPill>
              </li>
            ))}
          </ul>
          <p className="pv-faint mt-3 text-[13px]">
            Receipt {demoReport.verified ? 'verifies' : 'does not verify'}: signatures, hash chain, Merkle root, mandate replay and evidence hashes.
            Want the adversarial version? <Link href="/agent-proof/demo" className="pv-link underline">Run the hostile agent simulation</Link>.
          </p>
        </section>

        <section aria-labelledby="pv-honest-title">
          <h2 id="pv-honest-title" className="pv-eyebrow">What it does and does not prove</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {HONESTY.map((p) => (
              <div key={p.title} className="pv-card p-5">
                <h3 className="text-[15px] font-semibold text-white">{p.title}</h3>
                <p className="pv-muted mt-2 text-[13.5px] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

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
            <h2 id="ac-example-title" className="mt-3 text-[18px] font-semibold text-white">Inspect a full execution in the agent console</h2>
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
