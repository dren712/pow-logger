'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function extractLogin(input: string): string {
  const trimmed = input.trim().replace(/^@/, '')
  const match = trimmed.match(/github\.com\/([^/?#\s]+)/i)
  return match ? match[1] : trimmed
}

export default function UsernameForm({ cta = 'Get my profile' }: { cta?: string }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const login = extractLogin(value)
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
      setError('Enter a GitHub username, like torvalds')
      return
    }
    setError('')
    setLoading(true)
    router.push(`/gh/${login}`)
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="github-username">GitHub username</label>
        <input
          id="github-username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="your GitHub username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 rounded-md border border-emerald-400/30 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button type="submit" className="btn-primary text-sm" disabled={loading}>
          {loading ? 'Building…' : cta}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-amber-400">{error}</p>}
    </form>
  )
}
