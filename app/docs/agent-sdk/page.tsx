import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'PROVN Agent SDK — Autonomous Software Verification Quickstart',
  description: 'Integrate non-repudiable Ed25519 signing, hash chains, and Solana Merkle commitments into any AI agent in under 3 minutes.'
}

export default function AgentSdkDocsPage() {
  return (
    <div className="min-h-screen bg-[#080a0f] text-zinc-200 py-10 px-4 sm:px-6 font-mono">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link href="/agent-proof" className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition font-semibold">
            ← Return to Agent Control Plane
          </Link>
        </div>

        {/* Title Header */}
        <div className="mb-8 pb-6 border-b border-[#1e2533]">
          <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
            DEVELOPER QUICKSTART // TRACK B AGENT PROTOCOL
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
            PROVN Agent SDK Integration
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-sans">
            Equip autonomous software agents, DevOps bots, and CI/CD pipelines with an independently verifiable cryptographic execution receipt anchored to Solana.
          </p>
        </div>

        {/* 3-Minute Quickstart Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#0e1117] border border-emerald-500/30 mb-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-emerald-400 tracking-tight">
              ⚡ 3-Line TypeScript Quickstart
            </h2>
            <span className="text-[11px] font-semibold text-zinc-400 bg-[#141822] px-2.5 py-1 rounded-md border border-[#1e2533]">
              Zero-Trust Architecture
            </span>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4 font-sans">
            Install the client library and wrap any consequential action (reading code, modifying files, executing shell commands, or opening PRs):
          </p>

          <pre className="p-3.5 rounded-xl bg-[#080a0f] border border-[#1e2533] text-emerald-400 text-xs sm:text-sm overflow-x-auto mb-4 font-mono">
{`npm install @provn/sdk`}
          </pre>

          <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">
            AGENT EXECUTION WRAPPER
          </div>
          <pre className="p-4 rounded-xl bg-[#080a0f] border border-[#1e2533] text-zinc-200 text-xs leading-relaxed overflow-x-auto font-mono">
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
        <div className="mb-8">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4">
            Protocol Guarantees & Non-Repudiation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-[#0e1117] border border-[#1e2533]">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
                1. Sovereign Agent Signatures
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                The server never signs agent events. Each event is signed locally by the agent runtime using Ed25519 detached signatures over deterministic canonical strings.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0e1117] border border-[#1e2533]">
              <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-2">
                2. Zero Database Trust
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                The PostgreSQL database is merely an indexing layer. Any modification or deletion of events immediately breaks the cryptographic hash chain and Merkle root.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0e1117] border border-[#1e2533]">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
                3. On-Chain Solana PDA Anchoring
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                Batch Merkle roots are committed into Program Derived Address (PDA) accounts on Solana, establishing an immutable public timestamp that cannot be backdated.
              </p>
            </div>
          </div>
        </div>

        {/* Live Verifier Callout */}
        <div className="p-6 rounded-2xl bg-[#0e1117] border border-[#1e2533] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1">
              Interactive Proof Console & Tamper Simulator
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 font-sans">
              Inspect live executions, trace Ed25519 signatures, and simulate database intrusion attacks in real-time.
            </p>
          </div>
          <Link
            href="/agent-proof/demo"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black active:scale-[0.98] transition shadow-sm"
          >
            Launch Demo Console →
          </Link>
        </div>

      </div>
    </div>
  )
}
