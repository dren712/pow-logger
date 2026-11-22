'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

function extractLogin(input: string): string {
  const trimmed = input.trim().replace(/^@/, '')
  const match = trimmed.match(/github\.com\/([^/?#\s]+)/i)
  return match ? match[1] : trimmed
}

export default function UsernameForm({ cta = 'Get my profile' }: { cta?: string }) {
  const router = useRouter()
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, startNavigation] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const login = extractLogin(value)
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
      setError('Enter a GitHub username, like torvalds')
      return
    }
    setError('')
    startNavigation(() => router.push(`/gh/${login}`))
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl" noValidate>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="sr-only" htmlFor={id}>GitHub username</label>
        <div className="relative flex-1">
          <span className="pv-mono pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#5c6473]" aria-hidden="true">@</span>
          <input
            id={id}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError('') }}
            name="username"
            placeholder="your-github-username"
            enterKeyHint="go"
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="pv-input"
          />
        </div>
        <button type="submit" className="pv-btn" disabled={loading} aria-busy={loading || undefined}>
          {loading && <span className="pv-spinner" aria-hidden="true" />}
          {loading ? 'Building…' : cta}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-left text-[13px] text-[#f5c451]">{error}</p>}
    </form>
  )
}
