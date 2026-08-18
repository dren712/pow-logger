import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { WalletLog } from '@/app/lib/types'
import { verifyLogCryptographically } from '@/app/lib/canonicalMessage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'PROVN Grant Evidence & Ecosystem Metrics Dashboard',
  description: 'Live cryptographic evidence metrics and traction data for Example Grant Review Dashboard.',
}

export default async function GrantEvidencePage() {
  const { data: rawLogs } = await supabase
    .from('logs')
    .select('id, wallet_address, content, created_at, category, skills, protocols, archival_state, irys_tx_id, signature, nonce, domain, github_url, evidence_url, protocol_version, challenge_id')
    .order('created_at', { ascending: false })

  const logs = (rawLogs || []) as WalletLog[]
  const totalProofs = logs.length

  const uniqueWallets = new Set(logs.map((l) => l.wallet_address).filter(Boolean))
  const totalBuilders = uniqueWallets.size

  const archivedCount = logs.filter(
    (l) => l.archival_state === 'receipt_obtained' || l.archival_state === 'finalized' || (l.irys_tx_id && !l.irys_tx_id.startsWith('powl_'))
  ).length

  const verifiedCount = logs.filter((l) => verifyLogCryptographically(l)).length

  const skillCount: Record<string, number> = {}
  const protocolCount: Record<string, number> = {}

  logs.forEach((l) => {
    ;(l.skills || []).forEach((s) => (skillCount[s] = (skillCount[s] || 0) + 1))
    ;(l.protocols || []).forEach((p) => (protocolCount[p] = (protocolCount[p] || 0) + 1))
  })

  const topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const topProtocols = Object.entries(protocolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/" className="text-xs font-mono text-emerald-400 hover:underline mb-2 block">
              ← Back to PROVN Terminal
            </Link>
            <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-3">
              <span>📊</span> Grant Evidence & Ecosystem Metrics
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Live, queryable proof-of-work metrics backing the Example Grant Review Dashboard.
            </p>
          </div>
          <span className="text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-3 py-1.5 rounded-full font-bold">
            Live Database Metrics
          </span>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs font-mono text-gray-400 uppercase">Unique Builders</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400">{totalBuilders}</div>
            <div className="text-[11px] font-mono text-gray-500">Solana Wallets</div>
          </div>

          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs font-mono text-gray-400 uppercase">Total Proofs</div>
            <div className="text-3xl font-extrabold font-mono text-cyan-400">{totalProofs}</div>
            <div className="text-[11px] font-mono text-gray-500">Signed Work Records</div>
          </div>

          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs font-mono text-gray-400 uppercase">Ed25519 Verified</div>
            <div className="text-3xl font-extrabold font-mono text-yellow-400">{verifiedCount}</div>
            <div className="text-[11px] font-mono text-gray-500">Signature Authenticated</div>
          </div>

          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-5 space-y-1">
            <div className="text-xs font-mono text-gray-400 uppercase">Arweave Archived</div>
            <div className="text-3xl font-extrabold font-mono text-purple-400">{archivedCount}</div>
            <div className="text-[11px] font-mono text-gray-500">Permanent Irys TXs</div>
          </div>
        </div>

        {/* Skills & Protocols Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Top Classified Skills
            </h2>
            <div className="space-y-3">
              {topSkills.map(([skill, count]) => (
                <div key={skill} className="flex justify-between items-center text-xs font-mono">
                  <span className="text-gray-300">#{skill}</span>
                  <span className="text-emerald-400 font-bold">{count} Proofs</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#11111a] border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Top Solana Protocols
            </h2>
            <div className="space-y-3">
              {topProtocols.map(([proto, count]) => (
                <div key={proto} className="flex justify-between items-center text-xs font-mono">
                  <span className="text-purple-300">⚡ {proto}</span>
                  <span className="text-purple-400 font-bold">{count} Proofs</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Capital Efficiency Callout */}
        <div className="bg-gradient-to-r from-emerald-950/30 to-purple-950/30 border border-emerald-500/30 rounded-2xl p-6 space-y-2">
          <h3 className="text-sm font-bold font-mono text-white">
            🌱 $0 Infrastructure Capital Efficiency
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Every metric displayed above was achieved at <strong>$0/month recurring cost</strong> using serverless edge hosting, browser-native Ed25519 signing, and Irys micro-archival. The requested grant capital directly funds on-chain Merkle trees for compressed NFT achievement minting, public SDK infrastructure, and ecosystem bounty integrations.
          </p>
        </div>
      </div>
    </div>
  )
}
