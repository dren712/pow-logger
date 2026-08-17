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
import { submitVerifiedLog, requestAuthorizedArchivalRetry } from './lib/irys'
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
        if (data && active) setLogs(data as LogItem[])
      } catch (err) {
        console.error('Fetch logs error:', err)
      }
    }
    fetchLogs()
    return () => {
      active = false
    }
  }, [connected, publicKey])

  // Calculate today's log count & daily limit (standardized to PROTOCOL_TIMEZONE midnight)
  const todayLogsCount = useMemo(() => {
    const today = toLocalDateString(new Date(), PROTOCOL_TIMEZONE)
    return logs.filter((l) => toLocalDateString(l.created_at, PROTOCOL_TIMEZONE) === today).length
  }, [logs])

  // Reputation Calculation for Digital Metal Card
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
      setStatusMsg('Daily limit reached (3/3 logs today). Come back tomorrow 🗿')
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
          setStatusMsg(`🏆 MILESTONE UNLOCKED: ${result.newMilestone.emoji} ${result.newMilestone.title}!`)
        } else if (result.builderLevel) {
          setStatusStep('success')
          setStatusMsg(`✓ Verified & stored! ${result.builderLevel.emoji} Level ${result.builderLevel.level}`)
        } else {
          setStatusStep('success')
          setStatusMsg('✓ Wallet signature verified & stored in database!')
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
    if (!connected || !publicKey || !signMessage) return
    setRetryingLogId(logId)
    try {
      const data = await requestAuthorizedArchivalRetry(signMessage, publicKey.toBase58(), logId)
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
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\n${proofLink}\nBuild your reputation: provn-sol.vercel.app\n#PROVN #Solana #BuildInPublic`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener')
  }

  return (
    <main
      style={{
        width: 'min(820px, 94vw)',
        margin: '0 auto',
        padding: '24px 16px 100px 16px',
        fontFamily: 'var(--font-geist-mono), monospace',
        boxSizing: 'border-box',
      }}
    >
      <HeroHeader connected={connected} walletAddress={publicKey?.toBase58()} />

      {/* Connected Builder Quick Status Bar */}
      {connected && (
        <div
          style={{
            background: '#090b10',
            border: '1px solid #1a2233',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#666', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Rank
              </div>
              <div style={{ color: '#00ff88', fontWeight: 800, fontSize: '13px' }}>
                {displayReputation.builderLevel.emoji} Level {displayReputation.builderLevel.level} — {displayReputation.builderLevel.title}
              </div>
            </div>

            <div style={{ borderLeft: '1px solid #1a2233', paddingLeft: '14px' }}>
              <div style={{ color: '#666', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Streak
              </div>
              <div style={{ color: '#ffb800', fontWeight: 800, fontSize: '13px' }}>
                🔥 {displayReputation.currentStreak} {displayReputation.currentStreak === 1 ? 'Day' : 'Days'}
              </div>
            </div>

            <div style={{ borderLeft: '1px solid #1a2233', paddingLeft: '14px' }}>
              <div style={{ color: '#666', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Proofs
              </div>
              <div style={{ color: '#00e5ff', fontWeight: 800, fontSize: '13px' }}>
                ⚡ {displayReputation.totalProofs} ({displayReputation.archivalSuccessRate}% Archived)
              </div>
            </div>

            <div style={{ borderLeft: '1px solid #1a2233', paddingLeft: '14px' }}>
              <div style={{ color: '#666', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quota
              </div>
              <div style={{ color: isDailyLimitReached ? '#ff4444' : '#aaa', fontWeight: 800, fontSize: '13px' }}>
                {todayLogsCount}/3 {isDailyLimitReached ? '🔒' : '⚡'}
              </div>
            </div>
          </div>

          <Link
            href={`/u/${publicKey?.toBase58()}`}
            className="btn-primary"
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              background: '#0d121c',
              border: '1px solid #00e5ff',
              color: '#00e5ff',
              textDecoration: 'none',
            }}
          >
            🎴 View 3D Metal Passport →
          </Link>
        </div>
      )}

      <NetworkBanner />

      <MobileWalletNotice />

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
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#00ff88', fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>
              Recent Proof Activity Feed
            </h3>
            <span style={{ fontSize: '11px', color: '#666' }}>{logs.length} Total Entries</span>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {logs.map((l) => {
              const classification = classifyLog(l.content)
              const skills = l.skills && l.skills.length > 0 ? l.skills : classification.skills
              const category = l.category || classification.category
              const isExpanded = expandedLogId === l.id

              return (
                <div key={l.id} className="terminal-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                    <span style={{ color: '#888' }}>
                      {formatDate(l.created_at)} • {formatTime(l.created_at)}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: 'rgba(0,255,136,0.1)',
                        border: '1px solid rgba(0,255,136,0.25)',
                        color: '#00ff88',
                      }}
                    >
                      {category}
                    </span>
                  </div>

                  <p
                    style={{
                      color: '#eee',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      margin: '0 0 10px 0',
                      wordBreak: 'break-word',
                    }}
                  >
                    {isExpanded || l.content.length <= 140 ? l.content : `${l.content.slice(0, 140)}...`}
                    {l.content.length > 140 && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#00e5ff',
                          cursor: 'pointer',
                          fontSize: '11px',
                          marginLeft: '6px',
                        }}
                      >
                        {isExpanded ? '[show less]' : '[read more]'}
                      </button>
                    )}
                  </p>

                  {/* Skills Pills */}
                  {skills.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {skills.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#0a0c10',
                            border: '1px solid #1c2230',
                            color: '#00e5ff',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '10px',
                      borderTop: '1px solid #141822',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link
                        href={`/proof/${l.id}`}
                        style={{ color: '#00e5ff', textDecoration: 'none', fontWeight: 600, fontSize: '11px' }}
                      >
                        🔍 Proof #{l.id} ↗
                      </Link>
                      {l.irys_tx_id ? (
                        <a
                          href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}
                        >
                          🔗 Arweave ↗
                        </a>
                      ) : (
                        <button
                          onClick={() => retryArchival(l.id)}
                          disabled={retryingLogId === l.id}
                          style={{
                            background: 'none',
                            border: '1px solid #ffb800',
                            color: '#ffb800',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '10px',
                          }}
                        >
                          {retryingLogId === l.id ? '⚡ Archiving...' : '⚠️ Retry Archival'}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {l.irys_tx_id && (
                        <button
                          onClick={() => copyIrysLink(l.irys_tx_id!, l.id)}
                          style={{
                            background: 'none',
                            border: '1px solid #1c2230',
                            color: copiedId === l.id ? '#00e5ff' : '#888',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          {copiedId === l.id ? '✓ Copied' : '📋 Copy Link'}
                        </button>
                      )}

                      <button
                        onClick={() => shareOnTwitter(l.content, l.irys_tx_id || undefined)}
                        style={{
                          background: 'none',
                          border: '1px solid #1c2230',
                          color: '#ab9ff2',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        🚀 Share on X
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
                          setModalTitle(`PROVN Proof Card #${l.id} 🗿`)
                          setModalLogId(l.id)
                          setModalLogContent(l.content)
                          setModalIrysTxId(l.irys_tx_id || undefined)
                          setModalOpen(true)
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #00e5ff',
                          color: '#00e5ff',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        🖼️ Share Card
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
        <section style={{ marginBottom: '32px' }}>
          <ContributionHeatmap logs={logs} />
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