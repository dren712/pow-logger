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
      role="status"
      className={`lg-note animate-fade-in flex items-center justify-between gap-3 !py-1.5 !pr-1.5 ${isMainnet ? '' : 'lg-note-warn'}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="pv-chip pv-mono !text-[11px] font-semibold uppercase tracking-wider">
          <span className={isMainnet ? 'pv-accent' : 'text-[#f5c451]'} aria-hidden="true">●</span>
          {isMainnet ? 'Mainnet' : 'Devnet'}
        </span>
        <span className="text-[13px]">
          {isMainnet
            ? 'Wallet RPC is Solana mainnet-beta. Proofs are verified off-chain from your wallet signature.'
            : 'Wallet RPC is Solana devnet. Proofs are verified off-chain from your wallet signature.'}
        </span>
      </div>
      <button
        type="button"
        aria-label="Dismiss network banner"
        onClick={() => setDismissed(true)}
        className="lg-action shrink-0 !h-9 !w-9 justify-center !p-0 text-[18px] leading-none"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
