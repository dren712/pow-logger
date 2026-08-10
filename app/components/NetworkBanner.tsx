'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useState, useEffect } from 'react'

const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

export default function NetworkBanner() {
  const { connection } = useConnection()
  const { connected } = useWallet()
  const [isMainnet, setIsMainnet] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let isCancelled = false

    if (!connected) return

    connection.getGenesisHash().then((hash) => {
      if (!isCancelled) {
        setIsMainnet(hash === MAINNET_GENESIS_HASH)
      }
    }).catch(() => {
      if (!isCancelled) {
        setIsMainnet(null)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [connected, connection])

  // Don't show if wallet not connected, network checking, or user dismissed
  if (!connected || isMainnet === null || dismissed) return null

  return (
    <div
      style={{
        padding: '10px 16px',
        background: isMainnet ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 184, 0, 0.08)',
        border: `1px solid ${isMainnet ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 184, 0, 0.2)'}`,
        borderRadius: '8px',
        color: isMainnet ? '#00ff88' : '#ffb800',
        fontSize: '12px',
        fontFamily: 'monospace',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}
      className="animate-fade-in"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{isMainnet ? '⚡' : '🧪'}</span>
        <span>
          {isMainnet
            ? 'Connected Wallet RPC: Solana Mainnet Beta. Off-chain SIWS identity verification active.'
            : 'Connected Wallet RPC: Solana Devnet. Off-chain SIWS identity verification active.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            background: isMainnet ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 184, 0, 0.15)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '0.5px'
          }}
        >
          {isMainnet ? 'MAINNET' : 'DEVNET'}
        </span>
        <button
          aria-label="Dismiss network banner"
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: isMainnet ? '#00ff88' : '#ffb800',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '8px 12px',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
