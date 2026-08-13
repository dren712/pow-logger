import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'PROVN Protocol API & SDK Documentation',
  description: 'Public REST endpoints and TypeScript SDK documentation for programmatic proof verification on Solana.',
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Navigation */}
        <div>
          <Link href="/" className="text-xs font-mono text-emerald-400 hover:underline mb-2 block">
            ← Back to PROVN Terminal
          </Link>
          <h1 className="text-3xl font-bold font-mono text-white">PROVN Protocol API & SDK</h1>
          <p className="text-sm text-gray-400 mt-2">
            Open, composable proof-of-work and builder reputation endpoints on Solana.
          </p>
        </div>

        {/* Overview */}
        <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-base sm:text-lg font-bold font-mono text-emerald-400">⚡ Developer Quickstart</h2>
          <p className="text-xs text-gray-300 leading-relaxed font-mono">
            Integrate PROVN builder verification directly into your dApp, hackathon portal, or bounty platform using our standard REST endpoints or zero-dependency TypeScript SDK.
          </p>
          <div className="bg-[#08080c] border border-gray-800 rounded-lg p-3 sm:p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
            <code>npm install @provn/sdk</code>
          </div>
        </div>

        {/* REST Endpoints Reference */}
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-lg sm:text-xl font-bold font-mono text-white">Public REST Endpoints</h2>

          {/* Endpoint 1: Passport API */}
          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-mono font-bold">
                GET
              </span>
              <code className="text-xs sm:text-sm font-mono text-white break-all">/api/passport/:wallet</code>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Returns the complete deterministic Builder Passport JSON including reputation, streaks, and proof details.
            </p>
          </div>

          {/* Endpoint 2: Single Proof API */}
          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-mono font-bold">
                GET
              </span>
              <code className="text-xs sm:text-sm font-mono text-white break-all">/api/proof/:id</code>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Returns an individual proof-of-work record with live Ed25519 cryptographic validation and Arweave transaction link.
            </p>
          </div>

          {/* Endpoint 3: Social Card */}
          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-mono font-bold">
                GET
              </span>
              <code className="text-xs sm:text-sm font-mono text-white break-all">/api/passport-card/:wallet</code>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Dynamically renders a 1200×630 OpenGraph / Twitter SVG social card with builder reputation metrics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
