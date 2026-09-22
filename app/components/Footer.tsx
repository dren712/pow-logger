'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-[#1e2533] bg-[#08090d] text-[#8b9bb4] text-xs font-sans mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Protocol Info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-emerald-400 text-xs">
                P
              </div>
              <span className="font-bold text-sm tracking-tight text-[#f0f4fc]">PROVN Protocol</span>
            </div>
            <p className="text-xs text-[#8b9bb4] leading-relaxed mb-4">
              Cryptographic Trust & Provenance Infrastructure for Autonomous AI Agents and High-Stakes Codebases.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#141822] border border-[#212836] font-mono text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              v2.1 · agent/1 Production
            </div>
          </div>

          {/* Col 2: Platform Links */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#f0f4fc] font-semibold mb-3">
              Platform
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link href="/agent-proof" className="hover:text-emerald-400 transition-colors">
                  Agent Control Plane
                </Link>
              </li>
              <li>
                <Link href="/agent-proof/demo" className="hover:text-emerald-400 transition-colors">
                  Interactive Tamper Simulator
                </Link>
              </li>
              <li>
                <Link href="/demo/bounty" className="hover:text-emerald-400 transition-colors">
                  Verifiable Bounties
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-emerald-400 transition-colors">
                  Privacy Policy & Guardrails
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Developer Tools */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#f0f4fc] font-semibold mb-3">
              Developers & SDK
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link href="/docs/agent-sdk" className="hover:text-cyan-400 transition-colors">
                  ProvnAgent TypeScript SDK
                </Link>
              </li>
              <li>
                <Link href="/docs/api" className="hover:text-cyan-400 transition-colors">
                  HTTP Ingestion & Verify API
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/dren712/pow-logger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
                >
                  GitHub Repository ↗
                </a>
              </li>
              <li>
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#141822] text-[#8b9bb4] border border-[#212836]">
                  npx provn verify
                </code>
              </li>
            </ul>
          </div>

          {/* Col 4: Settlement & Archives */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#f0f4fc] font-semibold mb-3">
              On-Chain & Storage
            </div>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://explorer.solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  Solana Devnet Anchor ↗
                </a>
              </li>
              <li>
                <a
                  href="https://gateway.irys.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  Irys Arweave Gateway ↗
                </a>
              </li>
              <li>
                <a
                  href="https://india.superteam.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  Superteam India ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[#1e2533] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#57657d] font-mono">
          <div>Built on Solana · Anchored with Ed25519 & Merkle Trees · Stored on Arweave</div>
          <div>© {new Date().getFullYear()} PROVN Protocol. All rights reserved.</div>
        </div>
      </div>
    </footer>
  )
}
