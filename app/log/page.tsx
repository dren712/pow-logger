'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '../components/SiteNav'
import HeroHeader from '../components/HeroHeader'
import StatsDashboard from '../components/StatsDashboard'
import TerminalStudio from '../components/TerminalStudio'
import ContributionHeatmap from '../components/ContributionHeatmap'
import ShareCardModal from '../components/ShareCardModal'
import NetworkBanner from '../components/NetworkBanner'
import MobileWalletNotice from '../components/MobileWalletNotice'
import { submitVerifiedLog, requestArchivalRetry } from '../lib/irys'
import { classifyLog } from '../lib/classifier'
import { generateSingleLogNFTBadgeSVG } from '../lib/badgeGenerator'
import { fetchAllWalletLogs, toLocalDateString, PROTOCOL_TIMEZONE } from '../lib/milestones'
import { LogItem } from '@/app/u/[wallet]/ProfileClient'
import { calculateReputation } from '../lib/reputationEngine'
import '../styles/logger.css'

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
  const [logsState, setLogsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [reloadKey, setReloadKey] = useState(0)

  // NFT Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSvg, setModalSvg] = useState('')
  const [modalTitle, setModalTitle] = useState('PROVN Proof Card')
  const [modalLogId, setModalLogId] = useState<number | undefined>(undefined)
  const [modalLogContent, setModalLogContent] = useState<string>('')
  const [modalIrysTxId, setModalIrysTxId] = useState<string | undefined>(undefined)

  // Fetch logs when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) return

    let active = true
    const fetchLogs = async () => {
      setLogsState('loading')
      try {
        const walletAddress = publicKey.toBase58()
        const data = await fetchAllWalletLogs(supabase, walletAddress)
        if (data && active) setLogs(data as LogItem[])
        if (active) setLogsState('ready')
      } catch (err) {
        console.error('Fetch logs error:', err)
        if (active) setLogsState('error')
      }
    }
    fetchLogs()
    return () => {
      active = false
    }
  }, [connected, publicKey, reloadKey])

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
      setStatusMsg('Daily limit reached (3 of 3 today). Come back tomorrow.')
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
      setStatusMsg('Waiting for your wallet. Approve the signature request to continue.')

      const result = await submitVerifiedLog(signMessage, walletAddress, logContent, evidenceUrl, githubUrl)

      if (result.success && result.log) {
        setLogs([result.log, ...logs])
        setLog('')
        setEvidenceUrl('')
        setGithubUrl('')

        if (result.newMilestone) {
          setStatusStep('success')
          setStatusMsg(`Proof verified and stored. Milestone unlocked: ${result.newMilestone.title}.`)
        } else if (result.builderLevel) {
          setStatusStep('success')
          setStatusMsg(`Proof verified and stored. You are at level ${result.builderLevel.level}.`)
        } else {
          setStatusStep('success')
          setStatusMsg('Proof verified and stored.')
        }
      } else {
        setStatusStep('error')
        setStatusMsg('Verification or upload failed. Nothing was stored; try again.')
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
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\n${proofLink}\nBuild your reputation: provn-sol.vercel.app\n#PROVN #Solana #BuildInPublic`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener')
  }

  const walletAddress = publicKey?.toBase58()
  const showProofs = connected && logs.length > 0
  const logsLoading = connected && logsState === 'loading' && logs.length === 0

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8 lg:py-12">
        <HeroHeader connected={connected} walletAddress={walletAddress} />

        <NetworkBanner />

        {!connected && <MobileWalletNotice />}

        {connected && (
          <section aria-label="Your logging stats">
            <StatsDashboard
              connected={connected}
              streakCount={displayReputation.currentStreak}
              totalLogsCount={displayReputation.totalProofs}
              todayLogsCount={todayLogsCount}
              isDailyLimitReached={isDailyLimitReached}
              levelLabel={`${displayReputation.builderLevel.level} · ${displayReputation.builderLevel.title}`}
              archivedPercent={displayReputation.archivalSuccessRate}
            />
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <TerminalStudio
              log={log}
              setLog={setLog}
              evidenceUrl={evidenceUrl}
              setEvidenceUrl={setEvidenceUrl}
              githubUrl={githubUrl}
              setGithubUrl={setGithubUrl}
              loading={loading}
              connected={connected}
              walletAddress={walletAddress}
              isDailyLimitReached={isDailyLimitReached}
              statusStep={statusStep}
              statusMsg={statusMsg}
              onSubmitLog={submitLog}
              maxChars={MAX_CHARS}
            />

            <section className="pv-card" aria-labelledby="proofs-title">
              <div className="flex items-baseline justify-between gap-4 border-b border-[#1c222c] px-5 py-4 sm:px-6">
                <h2 id="proofs-title" className="pv-h2">Your proofs</h2>
                {showProofs && (
                  <span className="pv-faint text-[12px]">
                    {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
              </div>

              {!connected ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-[15px] font-medium text-white">Connect a wallet to see your proofs</p>
                  <p className="pv-muted mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed">
                    Proofs are listed per wallet. Use the connect button at the top of the page.
                  </p>
                </div>
              ) : logsLoading ? (
                <div className="flex flex-col gap-3 px-5 py-5 sm:px-6" aria-busy="true" aria-label="Loading your proofs">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="pv-skeleton h-[72px] w-full" />
                  ))}
                </div>
              ) : logsState === 'error' && logs.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6" role="alert">
                  <p className="text-[15px] font-medium text-white">Your proofs could not be loaded</p>
                  <p className="pv-muted mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed">
                    The proof database did not respond. You can still try again in a moment.
                  </p>
                  <button type="button" className="pv-btn-ghost mt-4" onClick={() => setReloadKey((k) => k + 1)}>
                    Try again
                  </button>
                </div>
              ) : logs.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-[15px] font-medium text-white">No proofs yet</p>
                  <p className="pv-muted mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed">
                    Log your first piece of work above. Once it is signed and stored it appears here and on your public
                    passport.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#1c222c]">
                  {logs.map((l) => {
                    const classification = classifyLog(l.content)
                    const skills = l.skills && l.skills.length > 0 ? l.skills : classification.skills
                    const category = l.category || classification.category
                    const isExpanded = expandedLogId === l.id

                    return (
                      <li key={l.id} className="px-5 py-5 sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                          <span className="pv-mono pv-faint text-[12px]">
                            #{l.id} · {formatDate(l.created_at)}
                            {formatTime(l.created_at) ? ` · ${formatTime(l.created_at)}` : ''}
                          </span>
                          <span className="pv-chip">{category}</span>
                        </div>

                        <p className="mt-2.5 break-words text-[15px] leading-relaxed text-[#e8ecf2]">
                          {isExpanded || l.content.length <= 140 ? l.content : `${l.content.slice(0, 140)}...`}
                          {l.content.length > 140 && (
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                              className="pv-accent ml-1.5 cursor-pointer rounded text-[13px] font-medium hover:underline"
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </p>

                        {skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {skills.map((s) => (
                              <span key={s} className="pv-chip !text-[11px]">{s}</span>
                            ))}
                          </div>
                        )}

                        <div className="-mx-2.5 mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
                          <Link href={`/proof/${l.id}`} className="lg-action !text-[#e8ecf2]">
                            View proof
                          </Link>
                          {l.irys_tx_id ? (
                            <a
                              href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="lg-action"
                            >
                              Arweave record <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => retryArchival(l.id)}
                              disabled={retryingLogId === l.id}
                              className="lg-action lg-action-warn mx-1.5"
                            >
                              {retryingLogId === l.id ? 'Archiving…' : 'Not archived · Retry'}
                            </button>
                          )}
                          {l.irys_tx_id && (
                            <button type="button" onClick={() => copyIrysLink(l.irys_tx_id!, l.id)} className="lg-action">
                              {copiedId === l.id ? 'Copied' : 'Copy link'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => shareOnTwitter(l.content, l.irys_tx_id || undefined)}
                            className="lg-action"
                          >
                            Share on X
                          </button>
                          <button
                            type="button"
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
                            className="lg-action"
                          >
                            Share card
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {showProofs && (
              <section aria-label="Contribution activity">
                <ContributionHeatmap logs={logs} />
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="pv-card p-5">
              <h2 className="pv-h2">How it works</h2>
              <ol className="mt-4 flex flex-col gap-4">
                {[
                  ['Connect', 'Connect a Solana wallet that supports message signing.'],
                  ['Describe', 'Write what you did and, if you have one, add the GitHub PR or commit.'],
                  ['Sign', 'Review the exact message, then approve the signature in your wallet.'],
                  ['Share', 'The proof gets its own page and is added to your public passport.'],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="pv-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#272e3a] text-[11px] text-[#c3cad6]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-white">{title}</div>
                      <p className="pv-muted mt-0.5 text-[13px] leading-relaxed">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pv-card p-5 text-[13px] leading-relaxed">
              <p className="pv-eyebrow">Limits</p>
              <ul className="pv-muted mt-3 flex flex-col gap-1.5">
                <li>Up to 3 proofs per wallet per day.</li>
                <li>{MAX_CHARS} characters per proof.</li>
                <li>Archival to Arweave can be retried from the list if it fails.</li>
              </ul>
            </div>
          </aside>
        </div>

        {/* Proof card share modal */}
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
    </div>
  )
}
