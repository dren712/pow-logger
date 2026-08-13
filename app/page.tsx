'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { createClient } from '@supabase/supabase-js'
import HeroHeader from './components/HeroHeader'
import TerminalStudio from './components/TerminalStudio'
import NetworkBanner from './components/NetworkBanner'
import MobileWalletNotice from './components/MobileWalletNotice'
import { submitVerifiedLog, requestAuthorizedArchivalRetry } from './lib/irys'
import { classifyLog } from './lib/classifier'
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

interface LastVerifiedProof {
  id: number
  content: string
  irysTxId?: string | null
  createdAt: string
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
  const [lastVerifiedProof, setLastVerifiedProof] = useState<LastVerifiedProof | null>(null)

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
      setStatusMsg('Daily limit reached (3/3 logs today).')
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
        setLastVerifiedProof({
          id: result.log.id,
          content: result.log.content,
          irysTxId: result.log.irys_tx_id,
          createdAt: result.log.created_at,
        })
        setLog('')
        setEvidenceUrl('')
        setGithubUrl('')

        setStatusStep('success')
        setStatusMsg('✓ Proof cryptographically verified & saved!')
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
          prev.map((l) => (l.id === logId ? { ...l, irys_tx_id: data.irysTxId, archival_state: 'archived' } : l))
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
      ? `https://gateway.irys.xyz/${txId}`
      : `https://provn-sol.vercel.app`
    const tweetText = `Just logged verified proof on PROVN 🗿\n\n"${previewText}"\n\n${proofLink}\n#PROVN #Solana #BuildInPublic`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener')
  }

  const walletShort = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : ''

  return (
    <main
      style={{
        width: 'min(840px, 94vw)',
        margin: '0 auto',
        padding: '24px 16px 100px 16px',
        boxSizing: 'border-box',
      }}
    >
      <HeroHeader connected={connected} walletAddress={publicKey?.toBase58()} />

      {/* Connected Builder Quick Status Bar */}
      {connected && (
        <div
          className="terminal-card"
          style={{
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              Welcome back, <span style={{ fontFamily: 'var(--font-mono)', color: '#00ff88' }}>{walletShort}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {displayReputation.verifiedProofs} verified proofs · {displayReputation.recentVerifiedProofs} in last 30d · {displayReputation.archivedVerifiedProofs} archived
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href={`/u/${publicKey?.toBase58()}`}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              View My Passport →
            </Link>
          </div>
        </div>
      )}

      {/* Proof Verified Ceremony Success Moment */}
      {lastVerifiedProof && (
        <div
          className="terminal-card"
          style={{
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid rgba(0, 255, 136, 0.4)',
            background: 'rgba(0, 255, 136, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00ff88', fontSize: '18px' }}>✓</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#00ff88' }}>
                  ✓ PROOF CREATED — Your wallet signed this record. Proof #{lastVerifiedProof.id}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Ed25519 signature verified. Envelope sealed and queued for Arweave L1 archival.
                </div>
              </div>
            </div>
            <button
              onClick={() => setLastVerifiedProof(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>

          <p
            style={{
              color: '#ffffff',
              fontSize: '13px',
              margin: '0 0 14px 0',
              lineHeight: 1.5,
              background: 'var(--bg-base)',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            &ldquo;{lastVerifiedProof.content}&rdquo;
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              href={`/proof/${lastVerifiedProof.id}`}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '11px' }}
            >
              Inspect Proof Record ↗
            </Link>
            <Link
              href={`/u/${publicKey?.toBase58()}`}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              View Passport →
            </Link>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://provn-sol.vercel.app/proof/${lastVerifiedProof.id}`)
                alert('Copied proof verification link!')
              }}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              Copy Link
            </button>
            <button
              onClick={() => shareOnTwitter(lastVerifiedProof.content, lastVerifiedProof.irysTxId || undefined)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              Share on X
            </button>
          </div>
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
            <h3 style={{ color: '#ffffff', fontSize: '16px', margin: 0, fontWeight: 700 }}>
              Recent Proof Activity Feed
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{logs.length} Total Records</span>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {logs.map((l) => {
              const classification = classifyLog(l.content)
              const skills = l.skills && l.skills.length > 0 ? l.skills : classification.skills
              const category = l.category || classification.category
              const isExpanded = expandedLogId === l.id

              return (
                <div key={l.id} className="terminal-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(l.created_at)} • {formatTime(l.created_at)}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(0,255,136,0.08)',
                        border: '1px solid rgba(0,255,136,0.25)',
                        color: '#00ff88',
                      }}
                    >
                      {category}
                    </span>
                  </div>

                  <p
                    style={{
                      color: 'var(--text-main)',
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
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                    )}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {skills.slice(0, 3).map((s) => (
                        <span key={s} style={{ fontSize: '10px', color: 'var(--text-faint)', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          #{s}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                      <Link href={`/proof/${l.id}`} style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 600 }}>
                        Inspect Proof #{l.id} ↗
                      </Link>
                      {l.irys_tx_id && !l.irys_tx_id.startsWith('powl_') ? (
                        <button
                          onClick={() => copyIrysLink(l.irys_tx_id as string, l.id)}
                          style={{ background: 'none', border: 'none', color: '#ffb800', cursor: 'pointer', padding: 0, fontSize: '11px' }}
                        >
                          {copiedId === l.id ? '✓ Copied' : '📦 Arweave Link'}
                        </button>
                      ) : (
                        <button
                          onClick={() => retryArchival(l.id)}
                          disabled={retryingLogId === l.id}
                          style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', padding: 0, fontSize: '11px' }}
                        >
                          {retryingLogId === l.id ? 'Archiving...' : 'Retry Archival'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}