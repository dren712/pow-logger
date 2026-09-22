'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { createClient } from '@supabase/supabase-js'
import HeroHeader from './components/HeroHeader'
import TerminalStudio from './components/TerminalStudio'
import ContributionHeatmap from './components/ContributionHeatmap'
import ShareCardModal from './components/ShareCardModal'
import NetworkBanner from './components/NetworkBanner'
import MobileWalletNotice from './components/MobileWalletNotice'
import { submitVerifiedLog, requestArchivalRetry } from './lib/irys'
import { classifyLog } from './lib/classifier'
import { generateSingleLogNFTBadgeSVG } from './lib/badgeGenerator'
import { fetchAllWalletLogs, toLocalDateString, PROTOCOL_TIMEZONE } from './lib/milestones'
import { LogItem } from '@/app/u/[wallet]/ProfileClient'
import { calculateReputation } from './lib/reputationEngine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

const MAX_CHARS = 280

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Just now'
  const d = new Date(dateStr)
  return isNaN(d.getTime())
    ? 'Just now'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatTime = (dateStr?: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function LoggerApp() {
  const { publicKey, connected, signMessage } = useWallet()
  const [activeTab, setActiveTab] = useState<'AGENT_TRACK' | 'BUILDER_TRACK'>('AGENT_TRACK')
  const [log, setLog] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [retryingLogId, setRetryingLogId] = useState<number | null>(null)
  const [statusStep, setStatusStep] = useState<'idle' | 'saving' | 'storing' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)

  // Interactive Live Proof Simulation State (Track B)
  const [isTamperSimulated, setIsTamperSimulated] = useState(false)

  // NFT Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSvg, setModalSvg] = useState('')
  const [modalTitle, setModalTitle] = useState('PROVN Proof Card 🗿')
  const [modalLogId, setModalLogId] = useState<number | undefined>(undefined)
  const [modalLogContent, setModalLogContent] = useState<string>('')
  const [modalIrysTxId, setModalIrysTxId] = useState<string | undefined>(undefined)

  // Fetch logs when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) return

    let active = true
    const fetchLogs = async () => {
      try {
        const walletAddress = publicKey.toBase58()
        const data = await fetchAllWalletLogs(supabase, walletAddress)
        if (data && active) {
          setLogs(data as LogItem[])
          setActiveTab('BUILDER_TRACK')
        }
      } catch (err) {
        console.error('Fetch logs error:', err)
      }
    }
    fetchLogs()
    return () => {
      active = false
    }
  }, [connected, publicKey])

  // Calculate today's log count & daily limit
  const todayLogsCount = useMemo(() => {
    const today = toLocalDateString(new Date(), PROTOCOL_TIMEZONE)
    return logs.filter((l) => toLocalDateString(l.created_at, PROTOCOL_TIMEZONE) === today).length
  }, [logs])

  // Reputation Calculation
  const activeWallet = publicKey?.toBase58() || 'AocAQAwVo8req1XQ9WfBmj5CLVrwic1xCiQrDKN2hF3p'
  const displayReputation = useMemo(
    () => calculateReputation(activeWallet, logs),
    [activeWallet, logs]
  )

  const isDailyLimitReached = todayLogsCount >= 3

  const submitLog = async () => {
    if (!log.trim() || !connected || !publicKey) return
    if (log.length > MAX_CHARS) return
    if (isDailyLimitReached) {
      setStatusStep('error')
      setStatusMsg('Daily limit reached (3/3 logs today). Come back tomorrow.')
      return
    }
    if (!signMessage) {
      setStatusStep('error')
      setStatusMsg('Connected wallet does not support message signing')
      return
    }

    setLoading(true)
    const walletAddress = publicKey.toBase58()
    const logContent = log.trim()

    try {
      setStatusStep('saving')
      setStatusMsg('Please sign the cryptographic prompt in your wallet...')

      const result = await submitVerifiedLog(signMessage, walletAddress, logContent, evidenceUrl, githubUrl)

      if (result.success && result.log) {
        setLogs([result.log, ...logs])
        setLog('')
        setEvidenceUrl('')
        setGithubUrl('')

        if (result.newMilestone) {
          setStatusStep('success')
          setStatusMsg(`🏆 Milestone unlocked: ${result.newMilestone.emoji} ${result.newMilestone.title}!`)
        } else if (result.builderLevel) {
          setStatusStep('success')
          setStatusMsg(`✓ Verified & anchored! ${result.builderLevel.emoji} Level ${result.builderLevel.level}`)
        } else {
          setStatusStep('success')
          setStatusMsg('✓ Wallet signature verified & committed to database!')
        }
      } else {
        setStatusStep('error')
        setStatusMsg('Verification or upload failed.')
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Signature rejected or verification failed'
      console.error('Submission error:', err)
      setStatusStep('error')
      setStatusMsg(errorMsg)
    } finally {
      setTimeout(() => {
        setStatusStep('idle')
        setStatusMsg('')
      }, 5000)
      setLoading(false)
    }
  }

  const retryArchival = async (logId: number) => {
    if (!connected || !publicKey) return
    setRetryingLogId(logId)
    try {
      const data = await requestArchivalRetry(publicKey.toBase58(), logId)
      if (data.success && data.irysTxId) {
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, irys_tx_id: data.irysTxId, archival_state: 'receipt_obtained' } : l))
        )
      }
    } catch (e: unknown) {
      console.error('Retry error:', e)
    } finally {
      setRetryingLogId(null)
    }
  }

  const copyIrysLink = (txId: string, logId: number) => {
    navigator.clipboard.writeText(`https://gateway.irys.xyz/${txId}`)
    setCopiedId(logId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const shareOnTwitter = (logText: string, txId?: string) => {
    const previewText = logText.length > 80 ? `${logText.slice(0, 80)}...` : logText
    const proofLink = txId
      ? `Verified on Arweave: https://gateway.irys.xyz/${txId}`
      : `Verified SIWS Proof: https://provn-sol.vercel.app`
    const tweetText = `Just logged verified proof on PROVN 🗿\n\n"${previewText}"\n\n${proofLink}\n#PROVN #Solana`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener')
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      <HeroHeader connected={connected} walletAddress={publicKey?.toBase58()} />

      {/* Track Selection Switcher */}
      <div className="flex items-center justify-center mb-8">
        <div className="inline-flex p-1 rounded-xl bg-[#0e1117] border border-[#1e2533]">
          <button
            onClick={() => setActiveTab('AGENT_TRACK')}
            className={`px-5 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'AGENT_TRACK'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-[#8b9bb4] hover:text-[#f0f4fc]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Autonomous Agent Provenance (Track B)
          </button>
          <button
            onClick={() => setActiveTab('BUILDER_TRACK')}
            className={`px-5 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'BUILDER_TRACK'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-[#8b9bb4] hover:text-[#f0f4fc]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Human Builder Proof-of-Work (Track A)
          </button>
        </div>
      </div>

      {/* TRACK B VIEW: Autonomous Agent Provenance Console */}
      {activeTab === 'AGENT_TRACK' && (
        <section className="space-y-8 mb-12">
          {/* Interactive 5-Layer Cryptographic Proof Explorer */}
          <div className="provn-card p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1e2533] flex-wrap gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                  Interactive Cryptographic Inspector
                </div>
                <h2 className="text-xl font-bold text-[#f0f4fc]">
                  Execution #8f92c10b — 5-Layer Cryptographic Verification Chain
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTamperSimulated(!isTamperSimulated)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    isTamperSimulated
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-[#141822] text-[#8b9bb4] border-[#212836] hover:border-rose-500/40 hover:text-rose-300'
                  }`}
                >
                  {isTamperSimulated ? '↩ Revert to Authentic State' : '⚔️ Simulate Database Intrusion'}
                </button>
                <Link href="/agent-proof/demo" className="btn-primary text-xs">
                  Full Console ↗
                </Link>
              </div>
            </div>

            {/* Tamper Alert Banner */}
            {isTamperSimulated && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                <div className="font-bold flex items-center gap-2 mb-1 text-sm">
                  <span>🚨 TAMPERING DETECTED: PAYLOAD_HASH_MISMATCH</span>
                </div>
                <p className="leading-relaxed text-[#8b9bb4]">
                  Simulated attacker executed <code className="text-rose-300">UPDATE agent_events SET payload = &apos;rm -rf&apos; WHERE sequence = 3</code>. Recomputing SHA-256 hash immediately severed the hash chain and invalidated the Merkle commitment.
                </p>
              </div>
            )}

            {/* 5-Node Visual Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 mb-8">
              {/* Layer 1: Ed25519 Signatures */}
              <div className={`p-4 rounded-xl border transition-all ${
                isTamperSimulated
                  ? 'bg-[#0e1117] border-rose-500/30'
                  : 'bg-[#0e1117] border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[#8b9bb4]">LAYER 1</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isTamperSimulated ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isTamperSimulated ? 'INVALID' : 'VALID'}
                  </span>
                </div>
                <div className="font-semibold text-xs text-[#f0f4fc] mb-1">Ed25519 Identity</div>
                <p className="text-[11px] text-[#8b9bb4] leading-relaxed">
                  Every action signed with agent&apos;s ephemeral private key.
                </p>
              </div>

              {/* Layer 2: SHA-256 Hash Chain */}
              <div className={`p-4 rounded-xl border transition-all ${
                isTamperSimulated
                  ? 'bg-rose-500/10 border-rose-500/40 shadow-sm'
                  : 'bg-[#0e1117] border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[#8b9bb4]">LAYER 2</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isTamperSimulated ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isTamperSimulated ? 'SEVERED' : 'UNBROKEN'}
                  </span>
                </div>
                <div className="font-semibold text-xs text-[#f0f4fc] mb-1">Hash Chain</div>
                <p className="text-[11px] text-[#8b9bb4] leading-relaxed">
                  Canonical SHA-256 linking prevents insertion and reordering.
                </p>
              </div>

              {/* Layer 3: Merkle Tree */}
              <div className={`p-4 rounded-xl border transition-all ${
                isTamperSimulated
                  ? 'bg-[#0e1117] border-rose-500/30'
                  : 'bg-[#0e1117] border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[#8b9bb4]">LAYER 3</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isTamperSimulated ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isTamperSimulated ? 'DIVERGED' : 'PROVED'}
                  </span>
                </div>
                <div className="font-semibold text-xs text-[#f0f4fc] mb-1">Merkle Commitment</div>
                <p className="text-[11px] text-[#8b9bb4] leading-relaxed">
                  Odd-leaf promoted binary tree collapses execution to 32 bytes.
                </p>
              </div>

              {/* Layer 4: Solana Anchor */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-[#0e1117]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[#8b9bb4]">LAYER 4</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    ANCHORED
                  </span>
                </div>
                <div className="font-semibold text-xs text-[#f0f4fc] mb-1">Solana PDA</div>
                <p className="text-[11px] text-[#8b9bb4] leading-relaxed">
                  Batch commitment written on-chain to deterministic PDA.
                </p>
              </div>

              {/* Layer 5: Irys Arweave */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-[#0e1117]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[#8b9bb4]">LAYER 5</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                    PERMANENT
                  </span>
                </div>
                <div className="font-semibold text-xs text-[#f0f4fc] mb-1">Irys Arweave</div>
                <p className="text-[11px] text-[#8b9bb4] leading-relaxed">
                  Decentralized, permanent evidence bundle archival.
                </p>
              </div>
            </div>

            {/* Quick Demonstration Payload Diff */}
            <div className="p-4 rounded-xl bg-[#090b10] border border-[#212836]">
              <div className="flex items-center justify-between mb-2 text-xs font-mono">
                <span className="text-[#8b9bb4]">Sample Event Trace (Sequence #3 · git.operation)</span>
                <span className="text-emerald-400">Deterministic Serialization</span>
              </div>
              <pre className="font-mono text-xs text-[#f0f4fc] overflow-x-auto whitespace-pre leading-relaxed">
{isTamperSimulated ? (
  <span className="text-rose-400">
{`{
  "sequence": 3,
  "eventType": "git.operation",
  "payload": {
    "action": "commit",
    "commitHash": "malicious_override_deadbeef"  // ❌ FORGED HASH
  },
  "payloadHash": "687a3e54...0011",               // ❌ PAYLOAD_HASH_MISMATCH
  "signatureValid": false                         // ❌ Attacker lacks Ed25519 private key
}`}
  </span>
) : (
  <span className="text-emerald-400">
{`{
  "sequence": 3,
  "eventType": "git.operation",
  "payload": {
    "action": "commit",
    "commitHash": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    "message": "release: ship verifiable agent settlement v2"
  },
  "payloadHash": "664ea073f8a4ef755743b0ebf4e64f7b4914c6d66e5f1710927871b6ba404ca3",
  "signatureValid": true
}`}
  </span>
)}
              </pre>
            </div>
          </div>

          {/* Quickstart Developer Snippets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="provn-card p-6">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                TypeScript / Node.js SDK
              </div>
              <h3 className="text-base font-bold text-[#f0f4fc] mb-3">
                Seamless ProvnAgent Integration
              </h3>
              <p className="text-xs text-[#8b9bb4] mb-4 leading-relaxed">
                Add 3 lines of code to your autonomous agent runtime to produce cryptographically verifiable execution receipts.
              </p>
              <pre className="p-3.5 bg-[#090b10] border border-[#212836] rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto">
{`import { ProvnAgentRuntime } from 'provn/agent'

const runtime = new ProvnAgentRuntime(agentKeypair)
const exec = runtime.startExecution({ taskDescription: 'Deploy PR' })

// Consequential action with automatic payload hashing
runtime.logAction(exec, 'payment.executed', {
  recipient: '9xQe...VFin',
  amount: '5000 USDC'
})

const receipt = runtime.finalizeExecution(exec)`}
              </pre>
            </div>

            <div className="provn-card p-6">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-2">
                Zero-Trust Verifier CLI
              </div>
              <h3 className="text-base font-bold text-[#f0f4fc] mb-3">
                Independent Verification Anywhere
              </h3>
              <p className="text-xs text-[#8b9bb4] mb-4 leading-relaxed">
                Verify any agent receipt offline without querying a centralized server. Cross-checks on-chain Solana state automatically.
              </p>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#090b10] border border-[#212836] rounded-lg text-[#f0f4fc]">
                  <span className="text-[#8b9bb4]">$</span> npx provn verify ./sample-receipt.json
                </div>
                <div className="p-3.5 bg-[#090b10] border border-[#212836] rounded-lg text-[#8b9bb4] text-[11px] leading-relaxed">
                  ✓ Event 0: agent.started · Signature Valid<br/>
                  ✓ Event 1: tool.request · Hash Chain Valid<br/>
                  ✓ Event 2: payment.executed · Payload Authenticated<br/>
                  ✓ Merkle Root: 8c12...49e1 matches Solana PDA<br/>
                  <span className="text-emerald-400 font-bold">✓ VERIFICATION PASSED (5/5 Layers Valid)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TRACK A VIEW: Human Builder Proof-of-Work */}
      {activeTab === 'BUILDER_TRACK' && (
        <section className="space-y-8 mb-12">
          {/* Connected Builder Quick Status Bar */}
          {connected && (
            <div className="provn-card p-4 flex items-center justify-between flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase font-mono text-[#8b9bb4]">Rank</div>
                  <div className="text-emerald-400 font-bold font-mono text-sm">
                    {displayReputation.builderLevel.emoji} Level {displayReputation.builderLevel.level} — {displayReputation.builderLevel.title}
                  </div>
                </div>

                <div className="border-l border-[#1e2533] pl-4">
                  <div className="text-[10px] uppercase font-mono text-[#8b9bb4]">Streak</div>
                  <div className="text-amber-400 font-bold font-mono text-sm">
                    🔥 {displayReputation.currentStreak} {displayReputation.currentStreak === 1 ? 'Day' : 'Days'}
                  </div>
                </div>

                <div className="border-l border-[#1e2533] pl-4">
                  <div className="text-[10px] uppercase font-mono text-[#8b9bb4]">Proofs</div>
                  <div className="text-cyan-400 font-bold font-mono text-sm">
                    ⚡ {displayReputation.totalProofs} ({displayReputation.archivalSuccessRate}% Archived)
                  </div>
                </div>

                <div className="border-l border-[#1e2533] pl-4">
                  <div className="text-[10px] uppercase font-mono text-[#8b9bb4]">Daily Quota</div>
                  <div className={`font-bold font-mono text-sm ${isDailyLimitReached ? 'text-rose-400' : 'text-[#f0f4fc]'}`}>
                    {todayLogsCount}/3 {isDailyLimitReached ? '🔒' : '⚡'}
                  </div>
                </div>
              </div>

              <Link
                href={`/u/${publicKey?.toBase58()}`}
                className="btn-secondary text-xs"
              >
                🎴 View 3D Metal Passport →
              </Link>
            </div>
          )}

          <NetworkBanner />
          <MobileWalletNotice />

          {/* Onboarding Zero State */}
          {connected && logs.length === 0 && (
            <div className="p-6 rounded-xl bg-cyan-500/5 border border-cyan-500/25 text-center">
              <h3 className="text-cyan-400 font-bold text-base mb-2">Welcome to PROVN</h3>
              <p className="text-xs text-[#8b9bb4] max-w-lg mx-auto leading-relaxed">
                Your builder passport is currently empty. Start by logging your first piece of engineering work below. Once signed, you will unlock your verifiable on-chain profile.
              </p>
            </div>
          )}

          {/* Primary Work Logging Terminal */}
          <TerminalStudio
            log={log}
            setLog={setLog}
            evidenceUrl={evidenceUrl}
            setEvidenceUrl={setEvidenceUrl}
            githubUrl={githubUrl}
            setGithubUrl={setGithubUrl}
            loading={loading}
            connected={connected}
            walletAddress={publicKey?.toBase58()}
            isDailyLimitReached={isDailyLimitReached}
            statusStep={statusStep}
            statusMsg={statusMsg}
            onSubmitLog={submitLog}
            maxChars={MAX_CHARS}
          />

          {/* Log Feed & Activity Section */}
          {connected && logs.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#f0f4fc] font-mono">
                  Recent Proof Activity Feed
                </h3>
                <span className="text-xs font-mono text-[#8b9bb4]">{logs.length} Total Entries</span>
              </div>

              <div className="grid gap-3.5">
                {logs.map((l) => {
                  const classification = classifyLog(l.content)
                  const skills = l.skills && l.skills.length > 0 ? l.skills : classification.skills
                  const category = l.category || classification.category
                  const isExpanded = expandedLogId === l.id

                  return (
                    <div key={l.id} className="provn-card p-5">
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="text-[#8b9bb4] font-mono">
                          {formatDate(l.created_at)} · {formatTime(l.created_at)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                          {category}
                        </span>
                      </div>

                      <p className="text-sm text-[#f0f4fc] leading-relaxed mb-3.5 break-words">
                        {isExpanded || l.content.length <= 140 ? l.content : `${l.content.slice(0, 140)}...`}
                        {l.content.length > 140 && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                            className="text-cyan-400 hover:underline text-xs ml-1.5 cursor-pointer font-mono"
                          >
                            {isExpanded ? '[show less]' : '[read more]'}
                          </button>
                        )}
                      </p>

                      {/* Skills Pills */}
                      {skills.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-4">
                          {skills.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141822] border border-[#212836] text-cyan-400"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#1e2533] text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/proof/${l.id}`}
                            className="text-cyan-400 hover:text-cyan-300 font-mono font-medium"
                          >
                            Proof #{l.id} ↗
                          </Link>
                          {l.irys_tx_id ? (
                            <a
                              href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline font-mono"
                            >
                              Arweave ↗
                            </a>
                          ) : (
                            <button
                              onClick={() => retryArchival(l.id)}
                              disabled={retryingLogId === l.id}
                              className="text-amber-400 border border-amber-500/30 rounded px-2 py-0.5 text-[10px] font-mono cursor-pointer disabled:opacity-50"
                            >
                              {retryingLogId === l.id ? '⚡ Archiving...' : '⚠️ Retry Archival'}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {l.irys_tx_id && (
                            <button
                              onClick={() => copyIrysLink(l.irys_tx_id!, l.id)}
                              className="btn-secondary text-[11px] py-1 px-2.5"
                            >
                              {copiedId === l.id ? '✓ Copied' : '📋 Copy Link'}
                            </button>
                          )}

                          <button
                            onClick={() => shareOnTwitter(l.content, l.irys_tx_id || undefined)}
                            className="btn-secondary text-[11px] py-1 px-2.5"
                          >
                            Share on X
                          </button>

                          <button
                            onClick={() => {
                              const svg = generateSingleLogNFTBadgeSVG(
                                publicKey?.toBase58() || '',
                                l.id,
                                l.content,
                                l.category || 'Development',
                                l.skills || [],
                                l.created_at || 'Just now',
                                l.irys_tx_id || undefined
                              )
                              setModalSvg(svg)
                              setModalTitle(`PROVN Proof Card #${l.id}`)
                              setModalLogId(l.id)
                              setModalLogContent(l.content)
                              setModalIrysTxId(l.irys_tx_id || undefined)
                              setModalOpen(true)
                            }}
                            className="btn-primary text-[11px] py-1 px-3"
                          >
                            Share Card
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Contribution Heatmap */}
          {connected && logs.length > 0 && (
            <section className="mb-10">
              <ContributionHeatmap logs={logs} />
            </section>
          )}
        </section>
      )}

      {/* NFT Proof Card Modal */}
      <ShareCardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        svgString={modalSvg}
        title={modalTitle}
        logId={modalLogId}
        logContent={modalLogContent}
        irysTxId={modalIrysTxId}
      />
    </main>
  )
}