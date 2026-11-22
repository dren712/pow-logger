'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { trackEvent } from '@/app/lib/analytics'
import type { TailoredResult } from '@/app/lib/resumeTailor'

const MIN = 80
const MAX = 8000

export default function ResumeTailor({ githubUsername }: { githubUsername: string }) {
  const fieldId = useId()
  const [jobPost, setJobPost] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TailoredResult | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/resume-tailor')
      .then((r) => r.json())
      .then((b: { remaining?: number }) => setRemaining(typeof b.remaining === 'number' ? b.remaining : null))
      .catch(() => setRemaining(null))
  }, [])

  const length = jobPost.trim().length
  const exhausted = remaining === 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || exhausted) return
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/resume-tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: githubUsername, jobPost }),
      })
      const body = await response.json()
      if (typeof body.remaining === 'number') setRemaining(body.remaining)
      if (!response.ok) setError(body.error || 'Could not tailor the résumé. Please try again.')
      else {
        setResult(body.result)
        setCopied(false)
        trackEvent('resume_tailor', { source: 'resume' })
      }
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!result) return
    const text = [
      result.headline,
      '',
      result.summary,
      '',
      'Relevant work',
      ...result.highlights.map((h) => `- ${h.repo} (${h.detail}): ${h.reason} ${h.url}`),
      '',
      result.matchedSkills.length ? `Skills: ${result.matchedSkills.join(', ')}` : '',
      `Verified at https://provn-sol.vercel.app/gh/${githubUsername}`,
    ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the text and copy it instead.')
    }
  }

  return (
    <section className="pv-card no-print p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="pv-eyebrow">AI tailoring · Pro preview</p>
        {remaining !== null && (
          <span className="pv-chip">{remaining} of 2 free {remaining === 1 ? 'try' : 'tries'} left</span>
        )}
      </div>
      <h2 className="pv-h2 mt-3">Tailor this résumé to a job post.</h2>
      <p className="pv-muted mt-2 text-sm">
        Paste a job post. PROVN picks the verified GitHub work that fits it and writes a matching summary. It only uses what is on
        this profile, and flags skills the job asks for that the profile doesn’t show.
      </p>

      <form onSubmit={submit} className="mt-5">
        <label htmlFor={fieldId} className="pv-muted text-sm">Job post</label>
        <textarea
          id={fieldId}
          value={jobPost}
          onChange={(event) => setJobPost(event.target.value)}
          maxLength={MAX}
          rows={7}
          disabled={pending || exhausted}
          placeholder="Paste the role description, responsibilities and requirements"
          className="pv-input mt-2 min-h-40 w-full resize-y py-3 leading-relaxed"
          style={{ paddingLeft: 14 }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="pv-faint text-xs">{length.toLocaleString('en-US')} / {MAX.toLocaleString('en-US')} characters</span>
          <button type="submit" disabled={pending || exhausted || length < MIN} className="pv-btn disabled:opacity-50">
            {pending ? 'Tailoring…' : 'Tailor résumé'}
          </button>
        </div>
        {exhausted && !result && (
          <p className="pv-muted mt-3 text-sm">You’ve used your free tries. Unlimited tailoring is part of Pro: join the waitlist below.</p>
        )}
        <p role="status" className="mt-3 text-sm text-[#ff8f6b]">{error}</p>
      </form>

      {result && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[15px] font-semibold text-white">{result.headline}</p>
          <p className="pv-muted mt-2 text-sm leading-relaxed">{result.summary}</p>
          {result.highlights.length > 0 && (
            <>
              <p className="pv-eyebrow mt-5">Relevant verified work</p>
              <ul className="mt-2 space-y-3">
                {result.highlights.map((h) => (
                  <li key={h.repo} className="text-sm">
                    <a href={h.url} className="pv-mono text-white hover:underline">{h.repo}</a>
                    <span className="pv-faint"> · {h.detail}</span>
                    <p className="pv-muted mt-1 leading-relaxed">{h.reason}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.matchedSkills.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {result.matchedSkills.map((s) => <span key={s} className="pv-chip">{s}</span>)}
            </div>
          )}
          {result.gaps.length > 0 && (
            <p className="pv-faint mt-4 text-xs">Not shown on this profile: {result.gaps.join(', ')}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copy} className="pv-btn-ghost">{copied ? 'Copied' : 'Copy as text'}</button>
            <span className="pv-faint text-xs">AI-written from public GitHub records. Check it before you send it.</span>
          </div>
        </div>
      )}
    </section>
  )
}
