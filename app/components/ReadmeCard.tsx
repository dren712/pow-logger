'use client'

import { useState } from 'react'
import { SITE } from '@/app/lib/profileFormat'
import { trackEvent } from '@/app/lib/analytics'

export default function ReadmeCard({ username }: { username: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [status, setStatus] = useState('')
  const image = `${SITE}/api/gh-card/${username}?theme=${theme}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(`[![${username} on PROVN](${image})](${SITE}/gh/${username})`)
      trackEvent('readme_card_copy', { theme })
      setStatus('Markdown copied')
    } catch {
      setStatus('Could not copy. Copy the Markdown below.')
    }
  }
  return <section className="pv-card p-5">
    <h2 className="pv-h2">README card</h2>
    <p className="pv-muted mt-2 text-sm">Your builder score and top-100 leaderboard position, ready for GitHub.</p>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/api/gh-card/${username}?theme=${theme}`} width={480} height={240} alt={`${username}'s PROVN rank card`} className="my-4 h-auto w-full max-w-[480px]" />
    <div className="flex flex-wrap items-center gap-3">
      <label className="pv-muted text-sm">Theme <select className="pv-input ml-2" value={theme} onChange={event => setTheme(event.target.value as 'light' | 'dark')}>
        <option value="dark">Dark</option><option value="light">Light</option>
      </select></label>
      <button className="pv-btn-ghost pv-btn-sm" onClick={copy}>Copy Markdown</button>
    </div>
    <code className="pv-faint mt-3 block break-all text-xs">{`[![${username} on PROVN](${image})](${SITE}/gh/${username})`}</code>
    <p role="status" className="pv-muted mt-2 text-sm">{status}</p>
  </section>
}
