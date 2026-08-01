'use client'

import { useMemo, useState, useEffect } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'

// Wallet adapter's built-in modal styles (dark theme, looks good out of the box)
import '@solana/wallet-adapter-react-ui/styles.css'

export default function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    }
    return process.env.NODE_ENV === 'production'
      ? clusterApiUrl('mainnet-beta')
      : clusterApiUrl('devnet')
  }, [])

  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
