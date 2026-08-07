'use client'

import { classifyLog } from '@/app/lib/classifier'

interface TerminalStudioProps {
  log: string
  setLog: (val: string) => void
  evidenceUrl: string
  setEvidenceUrl: (val: string) => void
  githubUrl: string
  setGithubUrl: (val: string) => void
  loading: boolean
  connected: boolean
  isDailyLimitReached: boolean
  statusStep: 'idle' | 'saving' | 'storing' | 'success' | 'error'
  statusMsg: string
  onSubmitLog: () => void
  maxChars: number
}

export default function TerminalStudio({
  log,
  setLog,
  evidenceUrl,
  setEvidenceUrl,
  githubUrl,
  setGithubUrl,
  loading,
  connected,
  isDailyLimitReached,
  statusStep,
  statusMsg,
  onSubmitLog,
  maxChars,
}: TerminalStudioProps) {
  const liveClassification = log.trim() ? classifyLog(log.trim()) : null
  const charPercent = Math.min(100, Math.round((log.length / maxChars) * 100))

  return (
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

      {/* Terminal Title Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #161a24',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
          <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>PROVN_SIWS_TERMINAL_STUDIO_v1.0</span>
        </div>
        <div style={{ color: '#00ff88', fontSize: '11px' }}>[READY]</div>
      </div>

      {/* Log Input Area */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
          <span>Describe your work output...</span>
          <span style={{ color: log.length > maxChars ? '#ff4444' : charPercent > 80 ? '#ffb800' : '#888' }}>
            {log.length}/{maxChars}
          </span>
        </div>
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder="e.g. Built TweetNaCl SIWS verification logic, deployed RLS security migration, tested Arweave archival..."
          rows={3}
          style={{
            width: '100%',
            background: '#060709',
            border: '1px solid #1c2230',
            borderRadius: '6px',
            color: '#00ff88',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Live Auto-Classifier Tag Badge */}
        {liveClassification && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#555' }}>CLASSIFIED:</span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.3)',
                color: '#00ff88',
                fontWeight: 700,
              }}
            >
              {liveClassification.category}
            </span>
            {liveClassification.skills.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#0d1117',
                  border: '1px solid #1c2230',
                  color: '#00e5ff',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Optional Proof URLs Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '4px' }}>
            GitHub PR / Commit URL (Optional)
          </label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo/pull/1"
            style={{
              width: '100%',
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              color: '#ab9ff2',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '4px' }}>
            Evidence / Demo URL (Optional)
          </label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://my-app.vercel.app"
            style={{
              width: '100%',
              background: '#060709',
              border: '1px solid #1c2230',
              borderRadius: '6px',
              color: '#00e5ff',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      {statusStep !== 'idle' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            background:
              statusStep === 'error'
                ? 'rgba(255, 68, 68, 0.1)'
                : statusStep === 'success'
                ? 'rgba(0, 255, 136, 0.1)'
                : 'rgba(0, 229, 255, 0.1)',
            border:
              statusStep === 'error'
                ? '1px solid rgba(255, 68, 68, 0.3)'
                : statusStep === 'success'
                ? '1px solid rgba(0, 255, 136, 0.3)'
                : '1px solid rgba(0, 229, 255, 0.3)',
            color:
              statusStep === 'error'
                ? '#ff4444'
                : statusStep === 'success'
                ? '#00ff88'
                : '#00e5ff',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={onSubmitLog}
        disabled={loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars}
        className="btn-primary"
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '13px',
          fontWeight: 800,
          opacity: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 0.5 : 1,
          cursor: loading || !log.trim() || !connected || isDailyLimitReached || log.length > maxChars ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? '⚡ Processing SIWS Cryptographic Signature...'
          : isDailyLimitReached
          ? '🔒 Daily Limit Reached (3/3 logs today)'
          : !connected
          ? '🔌 Connect Solana Wallet to Log Proof'
          : '🗿 Sign & Publish Proof-of-Work Log'}
      </button>
    </section>
  )
}
