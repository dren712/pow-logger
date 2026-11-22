'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import StatusPage from './components/site-shell/StatusPage'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage
      eyebrow="Something went wrong"
      title="This page could not be loaded"
      body="An unexpected error stopped the page from rendering. Trying again usually fixes it."
      footnote={
        error.digest ? (
          <>
            Error reference <span className="pv-mono break-all text-[#8a93a3]">{error.digest}</span>
          </>
        ) : undefined
      }
    >
      <button type="button" onClick={reset} className="pv-btn">Try again</button>
      <Link href="/" className="pv-btn-ghost">Go to the home page</Link>
    </StatusPage>
  )
}
