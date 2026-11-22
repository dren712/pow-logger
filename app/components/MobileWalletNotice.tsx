'use client'

import { useState, useEffect } from 'react'

const WALLET_BROWSERS = [
  { name: 'Phantom', base: 'https://phantom.app/ul/browse/' },
  { name: 'Solflare', base: 'https://solflare.com/ul/v1/browse/' },
  { name: 'Backpack', base: 'https://backpack.app/ul/browse/' },
]

export default function MobileWalletNotice() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    }
    checkMobile()
  }, [])

  if (!isMobile) return null

  const currentHost = typeof window !== 'undefined' ? encodeURIComponent(`${window.location.origin}/log`) : 'https%3A%2F%2Fprovn-sol.vercel.app%2Flog'

  return (
    <section className="pv-card p-5" aria-labelledby="mobile-wallet-title">
      <h2 id="mobile-wallet-title" className="pv-h2">On a phone? Open this page in your wallet</h2>
      <p className="pv-muted mt-1.5 text-[13px] leading-relaxed">
        Mobile browsers cannot reach your wallet to sign. Open the logger in your wallet&apos;s built-in browser instead.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {WALLET_BROWSERS.map((w) => (
          <a
            key={w.name}
            href={`${w.base}${currentHost}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pv-btn-ghost !px-3 !py-2 !text-[13px]"
          >
            Open in {w.name}
          </a>
        ))}
      </div>
    </section>
  )
}
