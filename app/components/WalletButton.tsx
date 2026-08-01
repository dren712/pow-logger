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
        style={{
          backgroundColor: '#12151c',
          color: '#555',
          border: '1px solid rgba(0, 255, 136, 0.2)',
          borderRadius: '8px',
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '13px',
          fontWeight: 700,
          height: '42px',
          padding: '0 18px',
          cursor: 'default',
        }}
      >
        Connecting...
      </button>
    ),
  }
)

export default WalletMultiButton
