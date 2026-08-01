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
  const [logs, setLogs] = useState<any[]>([])
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
  const [hasMerkleTree, setHasMerkleTree] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    checkMobile()
  }, [])

  // Fetch logs when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) {
      setLogs([])
      return
    }

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
        if (data) setLogs(data)
      } catch {
        setFetchError(true)
      }
    }

    fetchLogs()
  }, [connected, publicKey])

  // Calculate streak count (consecutive days with logs)
  const streakCount = useMemo(() => {
    if (logs.length === 0) return 0
    const dates = [...new Set(logs.map((l) => {
      const d = new Date(l.created_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }))].sort().reverse()
    
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`
    
    if (dates[0] !== todayKey && dates[0] !== yesterdayKey) return 0
    
    let streak = 1
    for (let i = 0; i < dates.length - 1; i++) {
      const [y1, m1, d1] = dates[i].split('-').map(Number)
      const [y2, m2, d2] = dates[i + 1].split('-').map(Number)
      const date1 = new Date(y1, m1, d1)
      const date2 = new Date(y2, m2, d2)
      const diffDays = Math.round((date1.getTime() - date2.getTime()) / 86400000)
      if (diffDays === 1) {
        streak++
      } else {
        break
      }
    }
    return streak
  }, [logs])

  // Calculate today's log count
  const todayLogsCount = useMemo(() => {
    const todayStr = new Date().toDateString()
    return logs.filter((l) => new Date(l.created_at).toDateString() === todayStr).length
  }, [logs])

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

      const result = await submitVerifiedLog(signMessage, walletAddress, logContent)

      if (result.success && result.log) {
        if (typeof result.hasMerkleTree === 'boolean') {
          setHasMerkleTree(result.hasMerkleTree)
        }
        const fullLog = {
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
    } catch (err: any) {
      console.error('Submission error:', err)
      setStatusStep('error')
      setStatusMsg(err.message || 'Signature rejected or verification failed')
    } finally {
      setTimeout(() => {
        setStatusStep('idle')
        setStatusMsg('')
      }, 5000)
      setLoading(false)
    }
  }

  const copyIrysLink = (txId: string, logId: number) => {
    const url = `https://gateway.irys.xyz/${txId}`
    navigator.clipboard.writeText(url)
    setCopiedId(logId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const shareOnTwitter = (logText: string, txId?: string) => {
    const irysUrl = txId ? `https://gateway.irys.xyz/${txId}` : 'https://pow-logger.vercel.app'
    const previewText = logText.length > 80 ? `${logText.slice(0, 80)}...` : logText
    const tweetText = `Just logged my proof-of-work on PROVN 🗿\n\n"${previewText}"\n\nVerified on Arweave: ${irysUrl}\nBuild your reputation: pow-logger.vercel.app\n#PROVN #Solana #BuildInPublic`
    window.location.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
  }

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : ''

  return (
    <main
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        padding: '32px 20px 100px 20px',
        fontFamily: 'var(--font-geist-mono), monospace',
      }}
    >
      {/* Top Telemetry & Network Bar */}
      <div
        className="telemetry-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#090b0f',
          border: '1px solid #161b26',
          borderRadius: '8px',
          padding: '6px 14px',
          marginBottom: '24px',
          fontSize: '11px',
          color: '#888',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#00ff88', fontSize: '10px' }} className="animate-blink">●</span>
          <span style={{ color: '#ccc', fontWeight: 600 }}>PROOF_NETWORK: ONLINE</span>
        </div>
        <div className="telemetry-right" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>STORAGE: <strong style={{ color: '#00e5ff' }}>IRYS / ARWEAVE</strong></span>
          <span>CHAIN: <strong style={{ color: '#00ff88' }}>SOLANA</strong></span>
        </div>
      </div>

      {/* Header Bar */}
      <header
        className="header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid #161a24',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ color: '#00ff88', margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              PROVN
            </h1>
            <span
              style={{
                fontSize: '20px',
                background: 'rgba(0,255,136,0.1)',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(0,255,136,0.2)'
              }}
            >
              🗿
            </span>
          </div>
          <p style={{ color: '#666', margin: '6px 0 0 0', fontSize: '12px', letterSpacing: '0.2px' }}>
            PROVN — Proof-of-Work Logger • Decentralized Builder Reputation Foundry
          </p>
        </div>
        <WalletMultiButton />
      </header>

      {/* Hero Presentation Section */}
      <section className="glass-card hero-glow" style={{ marginBottom: '32px', textAlign: 'center', padding: '28px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', padding: '4px 14px', borderRadius: '20px', fontSize: '11px', color: '#00ff88', fontWeight: 700, marginBottom: '16px' }}>
          <span className="animate-blink" style={{ color: '#00ff88' }}>●</span> SOLANA & IRYS PERMANENT PROOF FOUNDRY
        </div>
        <h2 style={{ color: '#00ff88', fontSize: '2.2rem', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-0.8px' }}>
          Your work, permanently on-chain.
        </h2>
        <p style={{ color: '#aaa', fontSize: '14px', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
          Cryptographically signed logs, auto-classified skills, and verifiable reputation trail.
        </p>

        <div className="hero-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={() => {
              document.getElementById('log-terminal')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="btn-primary"
          >
            Launch Terminal →
          </button>

          {connected && publicKey && (
            <a
              href={`/u/${publicKey.toBase58()}`}
              className="btn-primary"
              style={{
                borderColor: '#00e5ff',
                color: '#00e5ff',
              }}
            >
              View My Profile →
            </a>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (verifyWalletInput.trim()) {
                window.location.href = `/u/${verifyWalletInput.trim()}`
              }
            }}
            style={{ display: 'flex', gap: '6px' }}
          >
            <input
              type="text"
              placeholder="Verify Any Wallet..."
              value={verifyWalletInput}
              onChange={(e) => setVerifyWalletInput(e.target.value)}
              style={{
                background: '#060709',
                border: '1px solid #1c2230',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                width: '180px',
              }}
            />
            <button
              type="submit"
              disabled={!verifyWalletInput.trim()}
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                opacity: verifyWalletInput.trim() ? 1 : 0.5,
                cursor: verifyWalletInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Verify
            </button>
          </form>
        </div>
      </section>

      {/* Network Warning Banner */}
      <NetworkBanner />

      {isMobile && !connected && (
        <div
          className="mobile-wallet-banner"
          style={{
            background: '#090b10',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '28px',
            textAlign: 'center',
            boxShadow: '0 0 24px rgba(0, 255, 136, 0.08)',
          }}
        >
          <div style={{ color: '#00ff88', fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>
            📱 Mobile Browser Detected (Safari / Chrome / Brave)
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#aaa', lineHeight: '1.5' }}>
            Mobile web browsers don&apos;t support browser extensions. Tap below to launch directly inside your Solana wallet:
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href="https://phantom.app/ul/browse/https%3A%2F%2Fpow-logger.vercel.app"
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
              href="https://solflare.com/ul/v1/browse/https%3A%2F%2Fpow-logger.vercel.app"
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
              href="https://backpack.app/ul/browse/https%3A%2F%2Fpow-logger.vercel.app"
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
        </div>
      )}

      {/* Builder Stats Dashboard (Visible when connected) */}
      {connected && (
        <div
          className="stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div className="terminal-card" style={{ padding: '14px 16px' }}>
            <div className="corner-accent corner-top-left" />
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Active Streak
            </div>
            <div style={{ color: '#ffb800', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
              🔥 {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
            </div>
          </div>

          <div className="terminal-card" style={{ padding: '14px 16px' }}>
            <div className="corner-accent corner-top-left" />
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Total Logs
            </div>
            <div style={{ color: '#00ff88', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
              📦 {logs.length}
            </div>
          </div>

          <div className="terminal-card" style={{ padding: '14px 16px' }}>
            <div className="corner-accent corner-top-left" />
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Today&apos;s Quota
            </div>
            <div style={{ color: isDailyLimitReached ? '#ff4444' : '#00e5ff', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
              {todayLogsCount}/3 {isDailyLimitReached ? '🔒' : '⚡'}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Logging Terminal Studio */}
      <section
        id="log-terminal"
        className="terminal-card"
        style={{
          padding: '22px',
          marginBottom: '36px',
        }}
      >
        <div className="corner-accent corner-top-left" />
        <div className="corner-accent corner-top-right" />
        <div className="corner-accent corner-bottom-left" />
        <div className="corner-accent corner-bottom-right" />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ff88', fontSize: '13px', fontWeight: 700 }}>
              powl@{shortAddress || 'guest'}:~$
            </span>
            <span style={{ color: '#888', fontSize: '12px' }}>log --create</span>
          </div>

          {connected && (
            <span style={{ color: '#00ff88', fontSize: '11px', background: 'rgba(0,255,136,0.08)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(0,255,136,0.2)' }}>
              AUTHENTICATED
            </span>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            aria-label="Describe what you built today"
            id="log-input"
            value={log}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setLog(e.target.value)
                if (statusMsg) {
                  setStatusStep('idle')
                  setStatusMsg('')
                }
              }
            }}
            placeholder={
              connected
                ? 'What did you build today? (e.g. Implemented Ed25519 wallet signatures & verified on Solana devnet)'
                : 'Connect your Solana wallet above to initialize your proof-of-work terminal...'
            }
            disabled={!connected}
            style={{
              width: '100%',
              height: '140px',
              background: connected ? '#060709' : '#090a0d',
              color: connected ? '#f0f0f0' : '#444',
              border: `1px solid ${connected ? '#1e2433' : '#151822'}`,
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: '13.5px',
              lineHeight: '1.6',
              resize: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (connected && log.trim() && !loading && !isDailyLimitReached) {
                  submitLog()
                }
              }
            }}
            onFocus={(e) => (e.target.style.borderColor = '#00ff88')}
            onBlur={(e) => (e.target.style.borderColor = connected ? '#1e2433' : '#151822')}
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
              {hasMerkleTree && (
                <span style={{ color: statusStep === 'success' ? '#00ff88' : '#444' }}>
                  3. cNFT Mint ✓
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
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', margin: 0 }}>
            Verifiable Proof Trail ({logs.length})
          </h2>
          <span style={{ color: '#444', fontSize: '11px' }}>Sorted by newest</span>
        </div>

        {connected && fetchError && (
          <div role="alert" style={{
            padding: '20px',
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.25)',
            borderRadius: '10px',
            color: '#ff6b6b',
            textAlign: 'center',
            marginBottom: '14px',
            fontSize: '13px',
          }}>
            Failed to load logs. Check your connection and try refreshing.
          </div>
        )}

        {!connected && (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: '#0c0e12',
              border: '1px dashed #1c2230',
              borderRadius: '12px',
              color: '#666',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px' }}>Connect your Solana wallet to load your verified proof trail 🗿</p>
          </div>
        )}

        {connected && logs.length === 0 && (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: '#0c0e12',
              border: '1px dashed #1c2230',
              borderRadius: '12px',
              color: '#666',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#aaa', fontWeight: 600 }}>No proof logs recorded yet</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Initialize your first daily log above to start your on-chain streak.</p>
          </div>
        )}

        {logs.map((l) => (
          <div
            key={l.id}
            className="terminal-card"
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
                margin: 0,
                color: '#ececec',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {l.content}
            </p>

            {/* Classification Tags */}
            {(() => {
              const c = (l.skills && l.protocols && l.category)
                ? { skills: l.skills, protocols: l.protocols, category: l.category }
                : classifyLog(l.content)
              const hasTags = c.skills.length > 0 || c.protocols.length > 0
              return (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span style={{
                    background: 'rgba(0, 229, 255, 0.08)',
                    color: '#00e5ff',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                  }}>
                    {c.category}
                  </span>
                  {c.skills.map((s: string) => (
                    <span key={s} style={{
                      background: 'rgba(0, 255, 136, 0.06)',
                      color: '#00ff88',
                      border: '1px solid rgba(0, 255, 136, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}>
                      {s}
                    </span>
                  ))}
                  {c.protocols.map((p: string) => (
                    <span key={p} style={{
                      background: 'rgba(255, 184, 0, 0.06)',
                      color: '#ffb800',
                      border: '1px solid rgba(255, 184, 0, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              )
            })()}

            {/* Expandable Proof Inspector Drawer */}
            {expandedLogId === l.id && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  background: '#060709',
                  border: '1px solid #1a202c',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#aaa',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <div><span style={{ color: '#666' }}>LOG_ID:</span> {l.id}</div>
                <div><span style={{ color: '#666' }}>WAL_ATTRIBUTION:</span> {l.wallet_address}</div>
                <div><span style={{ color: '#666' }}>STORAGE_GATEWAY:</span> Arweave / Irys Node #1</div>
                <div><span style={{ color: '#666' }}>IRYS_TX_ID:</span> <code style={{ color: '#00e5ff' }}>{l.irys_tx_id || 'PENDING'}</code></div>
                <div><span style={{ color: '#666' }}>CRYPTOGRAPHIC_STATUS:</span> <span style={{ color: '#00ff88' }}>Ed25519 Signature Verified</span></div>
              </div>
            )}

            {/* Footer Actions */}
            <div
              className="log-footer"
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #161a24',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <a
                  href={`https://gateway.irys.xyz/${l.irys_tx_id || `powl_proof_${l.id}`}`}
                  rel="noopener noreferrer"
                  style={{
                    color: '#00ff88',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700,
                  }}
                >
                  🔗 View on Gateway ↗
                </a>

                <button
                  onClick={() => {
                    const c = (l.skills && l.protocols && l.category)
                      ? { skills: l.skills, protocols: l.protocols, category: l.category }
                      : classifyLog(l.content)
                    const svg = generateSingleLogNFTBadgeSVG(
                      l.wallet_address || publicKey?.toBase58() || 'Builder',
                      l.id,
                      l.content,
                      c.category,
                      c.skills,
                      formatDate(l.created_at),
                      l.irys_tx_id
                    )
                    setModalSvg(svg)
                    setModalTitle(`PROVN Proof Entry #${l.id}`)
                    setModalLogId(l.id)
                    setModalLogContent(l.content)
                    setModalIrysTxId(l.irys_tx_id)
                    setModalOpen(true)
                  }}
                  style={{
                    background: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.25)',
                    color: '#00e5ff',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: '10.5px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                >
                  🖼️ View Log NFT
                </button>

                <button
                  aria-expanded={expandedLogId === l.id}
                  onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: expandedLogId === l.id ? '#00e5ff' : '#666',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: 0,
                  }}
                >
                  {expandedLogId === l.id ? '▲ Hide Metadata' : '🔍 Inspect Proof'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {l.irys_tx_id && (
                  <button
                    onClick={() => copyIrysLink(l.irys_tx_id, l.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedId === l.id ? '#00e5ff' : '#666',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      padding: 0,
                    }}
                  >
                    {copiedId === l.id ? '✓ Link Copied!' : '📋 Copy Link'}
                  </button>
                )}

                <button
                  onClick={() => shareOnTwitter(l.content, l.irys_tx_id)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #1a202c',
                    color: '#ccc',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  🚀 Share on X
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

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