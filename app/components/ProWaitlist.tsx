'use client'

import { useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/app/lib/analytics'

export default function ProWaitlist({ source, githubUsername }: { source: 'profile' | 'resume'; githubUsername: string }) {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [joined, setJoined] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || joined) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/pro-waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, github_username: githubUsername, source }),
      })
      const body = await response.json()
      if (response.status === 503) setMessage('Waitlist opens soon, try again later')
      else if (!response.ok) setMessage(body.error || 'Could not join right now. Please try again later.')
      else {
        setJoined(true)
        setMessage(body.message)
        if (response.status === 201) trackEvent('waitlist_join', { source })
      }
    } catch {
      setMessage('Could not connect. Please try again later.')
    } finally {
      setPending(false)
    }
  }

  return <section className="pv-card no-print p-6">
    <p className="pv-eyebrow">Pro, coming soon</p>
    <h2 className="pv-h2 mt-3">Your next chapter, tailored.</h2>
    <ul className="pv-muted my-4 list-disc space-y-2 pl-5 text-sm">
      <li>AI résumé tailored to a job post</li><li>Multiple résumé versions</li><li>No PROVN branding</li><li>Custom domain</li><li>Profile analytics</li>
    </ul>
    <p className="text-sm text-white">Planned pricing: $9/mo or $59/yr</p>
    <p className="pv-muted mt-2 text-sm">Join for a launch update. No payment, no commitment.</p>
    <form onSubmit={submit} className="mt-5">
      <label htmlFor={emailId} className="pv-muted text-sm">Email address</label>
      <div className="mt-2 flex flex-wrap gap-3">
        <input id={emailId} type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={pending || joined} className="pv-input min-w-0 flex-1" placeholder="you@example.com" />
        <button type="submit" disabled={pending || joined} className="pv-btn disabled:opacity-50">{joined ? 'You’re on the list' : pending ? 'Joining…' : 'Join waitlist'}</button>
      </div>
      <p role="status" className="pv-muted mt-3 text-sm">{message}</p>
    </form>
    <p className="pv-faint mt-3 text-xs">We store your email and this GitHub username for the Pro waitlist. <Link href="/privacy" className="pv-underline">Privacy</Link></p>
  </section>
}
