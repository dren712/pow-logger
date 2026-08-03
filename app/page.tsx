'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { createClient } from '@supabase/supabase-js'
import WalletMultiButton from './components/WalletButton'
import NetworkBanner from './components/NetworkBanner'
import { submitVerifiedLog } from './lib/irys'
import { classifyLog } from './lib/classifier'
import { generateSingleLogNFTBadgeSVG } from './lib/badgeGenerator'
import NFTBadgeModal from './components/NFTBadgeModal'
import { LogItem } from '@/app/u/[wallet]/ProfileClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

const MAX_CHARS = 500

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

function LoggerApp() {
  const { publicKey, connected, signMessage } = useWallet()
  const [log, setLog] = useState('')
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusStep, setStatusStep] = useState<'idle' | 'saving' | 'storing' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [verifyWalletInput, setVerifyWalletInput] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSvg, setModalSvg] = useState('')
  const [modalTitle, setModalTitle] = useState('PROVN NFT Proof Badge 🗿')
  const [modalLogId, setModalLogId] = useState<number | undefined>(undefined)
  const [modalLogContent, setModalLogContent] = useState<string>('')
  const [modalIrysTxId, setModalIrysTxId] = useState<string | undefined>(undefined)
  const [lastCnftAssetId, setLastCnftAssetId] = useState<string | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    checkMobile()
  }, [])

  // Fetch logs when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) return

    let active = true
    const fetchLogs = async () => {
      try {
        setFetchError(false)
        const walletAddress = publicKey.toBase58()
        const { data } = await supabase
          .from('logs')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('created_at', { ascending: false })
          .limit(30)
        if (data && active) setLogs(data as LogItem[])
      } catch {
        if (active) setFetchError(true)
      }
    }
    fetchLogs()
    return () => {
      active = false
    }
  }, [connected, publicKey])

  // Calculate today's submitted log count for daily limit (3/day)
  const todayLogsCount = useMemo(() => {
    if (!logs || logs.length === 0) return 0
    const todayStr = new Date().toDateString()
    return logs.filter((l) => new Date(l.created_at).toDateString() === todayStr).length
  }, [logs])

  const isDailyLimitReached = todayLogsCount >= 3

  const submitLog = async () => {
    if (!connected || !publicKey || !log.trim()) return
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

      const result = await submitVerifiedLog(signMessage, walletAddress, logContent)

      if (result.success && result.log) {
        setLastCnftAssetId(result.cnftAssetId || null)
        const fullLog: LogItem = {
          ...result.log,
          irys_tx_id: result.log.irys_tx_id || result.irysTxId,
        }
        setLogs([fullLog, ...logs])
        setLog('')
        setStatusStep('success')
        setStatusMsg('✓ Cryptographically verified & stored permanently on Irys!')
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

  const copyIrysUrl = (txId: string, logId: number) => {
    const url = `https://gateway.irys.xyz/${txId}`
    navigator.clipboard.writeText(url)
    setCopiedId(logId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const shareOnTwitter = (logText: string, txId?: string) => {
    const irysUrl = txId ? `https://gateway.irys.xyz/${txId}` : 'https://provn-sol.vercel.app'
    const previewText = logText.length > 80 ? `${logText.slice(0, 80)}...` : logText
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\nVerified on Arweave: ${irysUrl}\nBuild your reputation: provn-sol.vercel.app\n#PROVN #Solana #BuildInPublic`
    window.location.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
  }

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : ''

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 20px 80px 20px', fontFamily: 'var(--font-geist-mono), monospace' }}>
      {/* Network Warning Banner */}
      <NetworkBanner />

      {/* Header Banner */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ color: '#00ff88', fontSize: '1.8rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
              PROVN
            </h1>
            <span style={{ fontSize: '1.4rem' }}>🗿</span>
          </div>
          <p style={{ color: '#666', fontSize: '12px', margin: '4px 0 0 0' }}>
            Cryptographically Verified Proof-of-Work Logger for Solana Builders
          </p>
        </div>

        <WalletMultiButton />
      </header>

      {/* Primary Log Foundry Interface */}
      <section className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        {/* Terminal Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ff88', fontSize: '13px', fontWeight: 700 }}>
              provn@{shortAddress || 'guest'}:~$
            </span>
            <span style={{ color: '#888', fontSize: '12px' }}>log --create</span>
          </div>

          {connected && (
            <span style={{ color: '#00ff88', fontSize: '11px', background: 'rgba(0,255,136,0.08)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(0,255,136,0.2)' }}>
              AUTHENTICATED
            </span>
          )}
        </div>

        {/* Text Input Container */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={log}
            onChange={(e) => setLog(e.target.value)}
            disabled={!connected || loading || isDailyLimitReached}
            placeholder={
              !connected
                ? '▶ Connect your Solana wallet to sign & record daily proof of work...'
                : isDailyLimitReached
                ? '🔒 Daily quota complete (3/3). Your builder streak is locked for today.'
                : '▶ Describe your work completed today (e.g. Built Solana program, fixed auth flow, deployed RPC node)...'
            }
            maxLength={MAX_CHARS}
            rows={5}
            style={{
              width: '100%',
              background: '#060709',
              border: '1px solid #1a202c',
              borderRadius: '8px',
              color: '#e0e0e0',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Character counter badge */}
          <span
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '14px',
              color: log.length > MAX_CHARS * 0.9 ? '#ff4444' : '#555',
              fontSize: '11px',
              fontFamily: 'monospace',
              background: 'rgba(0,0,0,0.7)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #1a1e28'
            }}
          >
            {log.length}/{MAX_CHARS}
          </span>
        </div>

        {/* Pipeline Progress Status Widget */}
        {loading && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <div className="pipeline-steps" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <span style={{ color: statusStep === 'saving' ? '#00ff88' : '#888' }}>
                1. Signature &amp; DB {statusStep !== 'saving' ? '✓' : '⏳'}
              </span>
              <span style={{ color: statusStep === 'storing' ? '#00e5ff' : '#444' }}>
                2. Irys Permanent {statusStep === 'storing' ? '⏳' : statusStep === 'success' ? '✓' : '○'}
              </span>
              {!!lastCnftAssetId && (
                <span style={{ color: statusStep === 'success' ? '#00ff88' : '#444' }}>
                  3. cNFT Minted ✓
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div
          className="submit-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '18px',
          }}
        >
          <button
            onClick={submitLog}
            disabled={!connected || loading || !log.trim() || isDailyLimitReached}
            style={{
              padding: '12px 30px',
              background: connected && log.trim() && !isDailyLimitReached ? '#00ff88' : '#14241b',
              color: connected && log.trim() && !isDailyLimitReached ? '#000' : '#395c47',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontWeight: 800,
              cursor: connected && log.trim() && !isDailyLimitReached ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              letterSpacing: '0.5px',
              boxShadow: connected && log.trim() && !isDailyLimitReached ? '0 0 20px rgba(0,255,136,0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {loading
              ? 'Executing Pipeline...'
              : isDailyLimitReached
              ? 'Daily Limit Reached (3/3) 🔒'
              : 'Log Work →'}
          </button>

          {statusMsg && (
            <span
              role="status" aria-live="polite"
              style={{
                color: statusStep === 'error' ? '#ff4444' : '#00ff88',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              {statusMsg}
            </span>
          )}
        </div>
      </section>

      {/* Log History Timeline Feed */}
      {connected && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: '#00ff88', fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
              📜 Verified Logs ({logs.length})
            </h2>

            {publicKey && (
              <a
                href={`/u/${publicKey.toBase58()}`}
                className="btn-primary"
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderColor: '#00e5ff',
                  color: '#00e5ff',
                  textDecoration: 'none',
                }}
              >
                🔥 View 365-Day Profile Grid →
              </a>
            )}
          </div>

          {fetchError && (
            <div style={{ color: '#ff4444', fontSize: '12px', padding: '12px', background: 'rgba(255,68,68,0.1)', borderRadius: '6px', marginBottom: '16px' }}>
              Failed to load logs from Supabase. Refresh to retry.
            </div>
          )}

          {logs.length === 0 ? (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              No verified logs found for this wallet address yet. Submit your first log above!
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {logs.map((l) => {
                const isExpanded = expandedLogId === l.id
                const classification = (l.skills && l.protocols && l.category)
                  ? { skills: l.skills, protocols: l.protocols, category: l.category }
                  : classifyLog(l.content)

                return (
                  <div
                    key={l.id}
                    className="glass-card"
                    style={{
                      padding: '18px',
                      marginBottom: '14px',
                    }}
                  >
                    {/* Header: Date + Status Badge */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                        fontSize: '11px',
                        color: '#666',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#ccc', fontWeight: 600 }}>{formatDate(l.created_at)}</span>
                        <span>•</span>
                        <span>{formatTime(l.created_at)}</span>
                      </div>

                      <a
                        href={`https://gateway.irys.xyz/${l.irys_tx_id || `powl_proof_${l.id}`}`}
                        rel="noopener noreferrer"
                        style={{
                          background: 'rgba(0, 255, 136, 0.08)',
                          color: '#00ff88',
                          border: '1px solid rgba(0, 255, 136, 0.25)',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          letterSpacing: '0.3px',
                          textDecoration: 'none',
                        }}
                      >
                        ✓ Permanent on Irys
                      </a>
                    </div>

                    {/* Log Content */}
                    <p
                      style={{
                        color: '#e0e0e0',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {l.content}
                    </p>

                    {/* Classification Tags */}
                    {(() => {
                      const c = classification
                      return (
                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span style={{
                            background: 'rgba(0, 229, 255, 0.08)',
                            color: '#00e5ff',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700
                          }}>
                            🏷️ {c.category}
                          </span>

                          {c.skills.map((skill) => (
                            <span key={skill} style={{
                              background: 'rgba(255, 184, 0, 0.08)',
                              color: '#ffb800',
                              border: '1px solid rgba(255, 184, 0, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              {skill}
                            </span>
                          ))}

                          {c.protocols.map((proto) => (
                            <span key={proto} style={{
                              background: 'rgba(0, 255, 136, 0.08)',
                              color: '#00ff88',
                              border: '1px solid rgba(0, 255, 136, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              ⚡ {proto}
                            </span>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
                      {l.irys_tx_id && (
                        <button
                          onClick={() => copyIrysUrl(l.irys_tx_id!, l.id)}
                          className="btn-primary"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          {copiedId === l.id ? '✓ Copied URL!' : '🔗 Copy Proof URL'}
                        </button>
                      )}

                      <button
                        onClick={() => shareOnTwitter(l.content, l.irys_tx_id || undefined)}
                        className="btn-primary"
                        style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#1da1f2', color: '#1da1f2' }}
                      >
                        🐦 Share on X
                      </button>

                      <button
                        onClick={() => {
                          const svg = generateSingleLogNFTBadgeSVG(
                            publicKey ? publicKey.toBase58() : '',
                            l.id,
                            l.content,
                            classification.category,
                            classification.skills,
                            formatDate(l.created_at),
                            l.irys_tx_id || undefined
                          )
                          setModalSvg(svg)
                          setModalTitle(`PROVN Proof Badge #${l.id} 🗿`)
                          setModalLogId(l.id)
                          setModalLogContent(l.content)
                          setModalIrysTxId(l.irys_tx_id || undefined)
                          setModalOpen(true)
                        }}
                        className="btn-primary"
                        style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#00ff88', color: '#00ff88' }}
                      >
                        🖼️ Proof Badge Card 🗿
                      </button>

                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#666',
                          fontSize: '11px',
                          cursor: 'pointer',
                          marginLeft: 'auto',
                          fontFamily: 'monospace'
                        }}
                      >
                        {isExpanded ? '▲ Hide Details' : '▼ Technical Specs'}
                      </button>
                    </div>

                    {/* Expanded Technical Details Panel */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '12px',
                          background: '#060709',
                          borderRadius: '6px',
                          border: '1px solid #161b24',
                          fontSize: '11px',
                          display: 'grid',
                          gap: '6px',
                          color: '#aaa',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#00ff88' }}>Log ID:</strong> #{l.id}
                        </div>
                        <div>
                          <strong style={{ color: '#00ff88' }}>Ed25519 Signer:</strong> {l.wallet_address}
                        </div>
                        <div>
                          <strong style={{ color: '#00ff88' }}>Permanent Irys Gateway:</strong>{' '}
                          {l.irys_tx_id ? (
                            <a
                              href={`https://gateway.irys.xyz/${l.irys_tx_id}`}
                              rel="noopener noreferrer"
                              style={{ color: '#00e5ff', textDecoration: 'underline' }}
                            >
                              https://gateway.irys.xyz/{l.irys_tx_id}
                            </a>
                          ) : (
                            'Staging Database Index (Fallback SHA-256 Hash)'
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Public Verification API Demo Box */}
      <section className="glass-card" style={{ padding: '20px', marginTop: '40px' }}>
        <h3 style={{ color: '#00e5ff', fontSize: '13px', margin: '0 0 10px 0', fontWeight: 800 }}>
          📡 Public Builder Verification API
        </h3>
        <p style={{ color: '#888', fontSize: '11.5px', margin: '0 0 14px 0', lineHeight: '1.5' }}>
          DAOs, grant committees, and dApps can verify builder records in real-time via REST:
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            value={verifyWalletInput}
            onChange={(e) => setVerifyWalletInput(e.target.value)}
            placeholder="Enter Solana wallet address (e.g. 7xKp...)"
            style={{
              flex: 1,
              background: '#060709',
              border: '1px solid #1a202c',
              borderRadius: '6px',
              color: '#e0e0e0',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (verifyWalletInput.trim()) {
                window.location.href = `/api/verify/${verifyWalletInput.trim()}`
              }
            }}
            className="btn-primary"
            style={{ fontSize: '12px', padding: '8px 14px', borderColor: '#00e5ff', color: '#00e5ff' }}
          >
            Query API ↗
          </button>
        </div>
      </section>

      {/* Mobile Guidance Banner */}
      {isMobile && (
        <section
          style={{
            marginTop: '32px',
            padding: '16px',
            background: 'rgba(0, 229, 255, 0.05)',
            border: '1px solid rgba(0, 229, 255, 0.2)',
            borderRadius: '8px',
            color: '#888',
            fontSize: '12px',
            lineHeight: '1.6',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#00e5ff', fontWeight: 700, marginBottom: '6px' }}>
            📱 Phantom Mobile Browser Mode
          </div>
          <p style={{ margin: '0 0 12px 0' }}>
            Mobile web browsers don&apos;t support browser extensions. Tap below to launch directly inside your Solana wallet:
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href="https://phantom.app/ul/browse/https%3A%2F%2Fprovn-sol.vercel.app"
              className="btn-primary"
              style={{
                fontSize: '12px',
                padding: '8px 14px',
                borderColor: '#ab9ff2',
                color: '#ab9ff2',
                textDecoration: 'none',
              }}
            >
              👻 Open in Phantom
            </a>

            <a
              href="https://solflare.com/ul/v1/browse/https%3A%2F%2Fprovn-sol.vercel.app"
              className="btn-primary"
              style={{
                fontSize: '12px',
                padding: '8px 14px',
                borderColor: '#ff8800',
                color: '#ff8800',
                textDecoration: 'none',
              }}
            >
              ☀️ Open in Solflare
            </a>

            <a
              href="https://backpack.app/ul/browse/https%3A%2F%2Fprovn-sol.vercel.app"
              className="btn-primary"
              style={{
                fontSize: '12px',
                padding: '8px 14px',
                borderColor: '#00e5ff',
                color: '#00e5ff',
                textDecoration: 'none',
              }}
            >
              🎒 Open in Backpack
            </a>
          </div>
        </section>
      )}

      {/* High-Res SVG NFT Badge Modal */}
      <NFTBadgeModal
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

export default function Home() {
  return <LoggerApp />
}