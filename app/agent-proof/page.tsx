import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'PROVN Agent Infrastructure Console — Verifiable AI Workloads',
  description: 'Inspect verifiable execution provenance, on-chain Merkle commitments, and permanent evidence archives for autonomous software.'
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
    <div style={{ minHeight: '100vh', backgroundColor: '#060709', color: '#f0f3f8', padding: '40px 24px', fontFamily: 'var(--font-geist-mono, monospace)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #1a1e28' }}>
          <div>
            <div style={{ color: '#00ff88', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>
              PROVN // CONTROL & DATA PLANE
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>
              Agent Provenance Console
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '6px 0 0 0' }}>
              Verifiable cryptographic infrastructure for autonomous software agents, CI/CD, and DevOps workflows.
            </p>
          </div>

          <Link
            href="/agent-proof/demo"
            style={{
              backgroundColor: '#00ff88',
              color: '#060709',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '13px',
              textDecoration: 'none',
              boxShadow: '0 0 20px rgba(0, 255, 136, 0.2)'
            }}
          >
            Launch Killer Demo ↗
          </Link>
        </div>

        {/* Featured Killer Demo Banner */}
        <div style={{ backgroundColor: '#0d0f14', border: '1px solid #00ff88', borderRadius: '12px', padding: '24px', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ color: '#00e5ff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                FEATURED VERIFICATION WALKTHROUGH
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
                Execution #8f92c10b — Claude 3.5 Sonnet (CI/CD Pipeline & PR #42)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, maxWidth: '750px' }}>
                Inspect 47 signed actions across 3 batches, validated via Ed25519 signatures, hash chains, odd-leaf promoted Merkle trees, and on-chain Solana commitments. Includes an interactive live database intrusion simulator.
              </p>
            </div>

            <Link
              href="/agent-proof/demo"
              style={{
                backgroundColor: '#131720',
                color: '#00ff88',
                border: '1px solid #00ff88',
                padding: '10px 18px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              Open Proof Console →
            </Link>
          </div>
        </div>

        {/* Recent Executions in Database */}
        <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f0f3f8' }}>
              Persisted Executions (PostgreSQL Index)
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {executions?.length || 0} recorded runs
            </span>
          </div>

          {(!executions || executions.length === 0) ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No database executions logged yet. Run <code style={{ color: '#00ff88' }}>npx tsx scripts/agent-demo/demo-phase2.ts</code> to ingest real events.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {executions.map(exec => (
                <Link
                  key={exec.execution_id}
                  href={`/agent-proof/${exec.execution_id}`}
                  style={{
                    backgroundColor: '#131720',
                    border: '1px solid #1e2430',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#f0f3f8' }}>
                        #{exec.execution_id.slice(0, 8)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {exec.agent_public_key.slice(0, 10)}...{exec.agent_public_key.slice(-4)}
                      </span>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                        {exec.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Started {new Date(exec.started_at).toLocaleString()} • {exec.event_count || 0} Events
                    </div>
                  </div>

                  <span style={{ color: '#00ff88', fontSize: '12px' }}>
                    Inspect Proof →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Architecture Principles Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              Control vs Data Plane Split
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
              The database is an operational index, never the source of cryptographic truth. All provenance stems from agent-signed hash chains and on-chain Merkle roots.
            </div>
          </div>

          <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              Transactional Outbox Engine
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
              Asynchronous worker claiming, lease expirations, idempotent retries, and reconciliation ensure Solana and Irys commits survive network outages.
            </div>
          </div>

          <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#ffb800', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              Self-Contained Portable Receipts
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
              Any independent verifier can validate a receipt offline using TweetNaCl and SHA-256 without ever communicating with the PROVN backend.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
