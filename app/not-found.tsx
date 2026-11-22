import type { Metadata } from 'next'
import Link from 'next/link'
import StatusPage from './components/site-shell/StatusPage'

export const metadata: Metadata = {
  title: 'Page not found — PROVN',
  description: 'This page does not exist on PROVN.',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      eyebrow="Page not found"
      title="There is nothing at this address"
      body="The link may be mistyped, or the page may have moved. Profiles live at /gh/ followed by a GitHub username."
      footnote={
        <>
          Looking for the Solana tools?{' '}
          <Link href="/log" className="text-[#aab2c0] underline-offset-4 hover:text-white hover:underline">
            Open the proof logger
          </Link>
        </>
      }
    >
      <Link href="/" className="pv-btn">Go to the home page</Link>
      <Link href="/leaderboard" className="pv-btn-ghost">View the leaderboard</Link>
    </StatusPage>
  )
}
