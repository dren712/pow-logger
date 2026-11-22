'use client'

import dynamic from 'next/dynamic'

// WalletMultiButton accesses browser APIs at IMPORT time (not render time).
// dynamic() with ssr:false tells Next.js: "don't even import this on the server."
// Without this, you get "window is not defined" errors during build.
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        aria-label="Loading wallet connection"
        className="wallet-adapter-button"
      >
        Loading wallet…
      </button>
    ),
  }
)

export default WalletMultiButton
