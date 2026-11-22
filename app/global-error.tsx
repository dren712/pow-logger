'use client'

import { useEffect } from 'react'
import './globals.css'

// Replaces the root layout when the layout itself fails, so it carries its own
// <html> and <body> and avoids every shared component that could be the cause.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ background: '#060709', color: '#e8ecf2' }}>
        <title>Something went wrong — PROVN</title>
        <div className="pv flex flex-1 flex-col">
          <div className="border-b border-white/5">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5">
              {/* A plain link: a full reload is the point when the app shell has failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white" aria-label="PROVN home">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="6" fill="#2ee59d" />
                  <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#04130c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                PROVN
              </a>
            </div>
          </div>
          <main className="pv-main mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
            <p className="pv-eyebrow">Something went wrong</p>
            <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-[34px]">
              PROVN could not load
            </h1>
            <p className="pv-muted mt-3 max-w-md text-[15px] leading-relaxed">
              An unexpected error stopped the site from rendering. Trying again usually fixes it.
            </p>
            <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button type="button" onClick={reset} className="pv-btn">Try again</button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="pv-btn-ghost">Reload the home page</a>
            </div>
            {error.digest && (
              <p className="pv-faint mt-8 text-[13px]">
                Error reference <span className="pv-mono break-all text-[#8a93a3]">{error.digest}</span>
              </p>
            )}
          </main>
        </div>
      </body>
    </html>
  )
}
