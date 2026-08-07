'use client'

export default function TelemetryBar() {
  return (
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
        <span style={{ color: '#00ff88', fontSize: '10px' }} className="animate-blink">
          ●
        </span>
        <span style={{ color: '#ccc', fontWeight: 600 }}>PROOF_NETWORK: ONLINE</span>
      </div>
      <div className="telemetry-right" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>
          STORAGE: <strong style={{ color: '#00e5ff' }}>IRYS / ARWEAVE</strong>
        </span>
        <span>
          CHAIN: <strong style={{ color: '#00ff88' }}>SOLANA</strong>
        </span>
      </div>
    </div>
  )
}
