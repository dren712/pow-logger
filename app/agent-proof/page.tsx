import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'PROVN Agent Infrastructure Console — Verifiable AI Workloads',
  description: 'Inspect verifiable execution provenance, on-chain Merkle commitments, and permanent evidence archives for autonomous software.',
}

export default async function AgentConsolePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

  const { data: executions } = await supabase
    .from('agent_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-[#08090d] text-[#f0f4fc] px-4 sm:px-6 py-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-mono text-[#8b9bb4] hover:text-[#f0f4fc] transition-colors inline-flex items-center gap-1.5"
          >
            ← Back to Overview
          </Link>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#141822] border border-[#212836] text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Control Plane Active
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-[#1e2533] gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold mb-1">
              PROVN // VERIFIABLE RUNTIME
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f0f4fc]">
              Agent Provenance Console
            </h1>
            <p className="text-sm text-[#8b9bb4] mt-1.5 max-w-2xl">
              Verifiable cryptographic infrastructure for autonomous agents, CI/CD pipelines, and high-stakes automated DevOps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/agent-proof/demo"
              className="btn-primary"
            >
              Launch Tamper Demo ↗
            </Link>
          </div>
        </div>

        {/* Featured Verification Walkthrough Banner */}
        <div className="provn-card p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="max-w-3xl">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-1.5">
                Featured Protocol Walkthrough
              </div>
              <h2 className="text-lg md:text-xl font-bold text-[#f0f4fc] mb-2 font-mono">
                Execution #8f92c10b — Claude 3.5 Sonnet (CI/CD Pipeline & PR #42)
              </h2>
              <p className="text-xs md:text-sm text-[#8b9bb4] leading-relaxed">
                Inspect 47 signed actions across 3 batches, validated via Ed25519 signatures, hash chains, odd-leaf promoted Merkle trees, and on-chain Solana commitments. Includes an interactive live database intrusion simulator.
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href="/agent-proof/demo"
                className="btn-secondary"
              >
                Inspect Execution Trace →
              </Link>
            </div>
          </div>
        </div>

        {/* Persisted Executions (PostgreSQL Index) */}
        <div className="provn-card p-6 mb-8">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1e2533]">
            <div>
              <h2 className="text-base font-bold text-[#f0f4fc] font-mono">
                Persisted Executions (PostgreSQL Operational Index)
              </h2>
              <p className="text-xs text-[#8b9bb4] mt-0.5">
                Records ingested via authenticated API routes and sealed through atomic finalization.
              </p>
            </div>
            <span className="text-xs font-mono text-[#8b9bb4] px-2 py-1 rounded bg-[#141822] border border-[#212836]">
              {executions?.length || 0} recorded runs
            </span>
          </div>

          {!executions || executions.length === 0 ? (
            <div className="py-12 text-center text-[#8b9bb4] text-xs font-mono">
              <p className="mb-2">No database executions recorded yet.</p>
              <p>
                Run <code className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">npx tsx scripts/agent-demo/demo.ts</code> to ingest real agent events.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2533]">
              {executions.map((exec) => (
                <Link
                  key={exec.execution_id}
                  href={`/agent-proof/${exec.execution_id}`}
                  className="py-3.5 px-3 -mx-3 rounded-lg flex items-center justify-between hover:bg-[#141822] transition-colors group text-xs font-mono no-underline text-inherit"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#f0f4fc] group-hover:text-emerald-400 transition-colors">
                        #{exec.execution_id.slice(0, 8)}
                      </span>
                      <span className="text-[#8b9bb4]">
                        {exec.agent_public_key.slice(0, 8)}...{exec.agent_public_key.slice(-4)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        exec.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                      }`}>
                        {exec.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#57657d] mt-1">
                      Started {new Date(exec.started_at).toLocaleString()} · {exec.event_count || 0} Events
                    </div>
                  </div>

                  <span className="text-emerald-400 text-xs font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Inspect Proof →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Architecture Principles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="provn-card p-5">
            <div className="text-xs font-mono font-bold text-emerald-400 mb-2">
              Control vs Data Plane Split
            </div>
            <p className="text-xs text-[#8b9bb4] leading-relaxed">
              The database is an operational index, never the source of cryptographic truth. All provenance stems from agent-signed hash chains and on-chain Merkle roots.
            </p>
          </div>

          <div className="provn-card p-5">
            <div className="text-xs font-mono font-bold text-cyan-400 mb-2">
              Transactional Outbox Engine
            </div>
            <p className="text-xs text-[#8b9bb4] leading-relaxed">
              Asynchronous worker claiming, lease expirations, idempotent retries, and reconciliation ensure Solana and Irys commits survive network outages.
            </p>
          </div>

          <div className="provn-card p-5">
            <div className="text-xs font-mono font-bold text-amber-400 mb-2">
              Self-Contained Portable Receipts
            </div>
            <p className="text-xs text-[#8b9bb4] leading-relaxed">
              Any independent verifier can validate a receipt offline using TweetNaCl and SHA-256 without ever communicating with the PROVN backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
