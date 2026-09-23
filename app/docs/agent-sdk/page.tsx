import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'PROVN Agent SDK — Autonomous Software Verification Quickstart',
  description: 'Integrate non-repudiable Ed25519 signing, hash chains, and Solana Merkle commitments into any AI agent in under 3 minutes.'
}

export default function AgentSdkDocsPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#060709', color: '#f0f3f8', padding: '40px 24px', fontFamily: 'var(--font-geist-mono, monospace)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/agent-proof" style={{ color: '#00ff88', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            ← Back to Agent Console
          </Link>
        </div>

        {/* Title Header */}
        <div style={{ marginBottom: '36px', paddingBottom: '20px', borderBottom: '1px solid #1a1e28' }}>
          <div style={{ color: '#00e5ff', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            DEVELOPER QUICKSTART // TRACK B AGENT PROTOCOL
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0' }}>
            PROVN Agent SDK Integration
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            Give autonomous software agents, DevOps bots, and CI/CD pipelines an independently verifiable cryptographic execution receipt anchored to Solana.
          </p>
        </div>

        {/* 3-Minute Quickstart Card */}
        <div style={{ backgroundColor: '#0d0f14', border: '1px solid #00ff88', borderRadius: '12px', padding: '28px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#00ff88' }}>
              ⚡ 3-Line TypeScript Quickstart
            </h2>
            <span style={{ fontSize: '11px', color: '#94a3b8', backgroundColor: '#131720', padding: '4px 8px', borderRadius: '4px', border: '1px solid #1e2430' }}>
              Zero-Trust Architecture
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '16px' }}>
            Install the client library and wrap any consequential action (reading code, modifying files, executing shell commands, or opening PRs):
          </p>

          <pre style={{ backgroundColor: '#08090d', padding: '14px', borderRadius: '8px', border: '1px solid #1a1e28', color: '#00ff88', fontSize: '13px', overflowX: 'auto', marginBottom: '20px' }}>
{`npm install @provn/sdk`}
          </pre>

          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
            AGENT EXECUTION WRAPPER
          </div>
          <pre style={{ backgroundColor: '#08090d', padding: '16px', borderRadius: '8px', border: '1px solid #1a1e28', color: '#f0f3f8', fontSize: '12px', lineHeight: '1.7', overflowX: 'auto', margin: 0 }}>
{`import { ProvnAgent } from '@provn/sdk'

// 1. Initialize ProvnAgent (Auto-generates sovereign Ed25519 keypair if none provided)
const provn = new ProvnAgent({
  apiKey: process.env.PROVN_API_KEY, // Optional project metering key
  agentName: 'Claude 3.5 Sonnet'
})

// 2. Start a verifiable execution session
const session = await provn.startSession({
  taskDescription: 'Execute full CI pipeline, run unit tests, and open PR #42'
})

// 3. Record consequential actions with automatic detached signing & hash-chaining
await session.record('tool.request', { 
  tool: 'github.read', 
  repo: 'dren712/pow-logger', 
  path: 'src/index.ts' 
})

await session.record('shell.execute', { 
  command: 'npm test', 
  exitCode: 0, 
  stdoutHash: 'a7b3...hash' 
})

await session.record('git.operation', { 
  operation: 'commit', 
  commitHash: '81d39fa', 
  author: 'Claude <agent@provn.io>' 
})

// 4. Seal the execution: computes Merkle root and returns public proof receipt
const receipt = await session.seal('Pipeline executed successfully')

console.log('Portable Merkle Root:', receipt.merkle.root)
console.log('Public Verification Console:', receipt.proofUrl)`}
          </pre>
        </div>

        {/* Security Invariants Grid */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#f0f3f8' }}>
            Protocol Guarantees & Non-Repudiation
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '8px', padding: '18px' }}>
              <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                1. Sovereign Agent Signatures
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                The server never signs agent events. Each event is signed locally by the agent runtime using Ed25519 detached signatures over deterministic canonical strings.
              </div>
            </div>

            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '8px', padding: '18px' }}>
              <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                2. Zero Database Trust
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                The PostgreSQL database is merely an indexing layer. Any modification or deletion of events immediately breaks the cryptographic hash chain and Merkle root.
              </div>
            </div>

            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '8px', padding: '18px' }}>
              <div style={{ color: '#ffb800', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                3. On-Chain Solana PDA Anchoring
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
                Batch Merkle roots are committed into Program Derived Address (PDA) accounts on Solana, establishing an immutable public timestamp that cannot be backdated.
              </div>
            </div>
          </div>
        </div>

        {/* Live Verifier Callout */}
        <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1e2430', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#f0f3f8' }}>
              Try the Interactive Proof Console & Tamper Simulator
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
              Inspect live executions, trace Ed25519 signatures, and simulate database intrusion attacks in real-time.
            </p>
          </div>
          <Link
            href="/agent-proof/demo"
            style={{
              backgroundColor: '#00ff88',
              color: '#060709',
              padding: '10px 18px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none'
            }}
          >
            Launch Demo Console →
          </Link>
        </div>

      </div>
    </div>
  )
}
