'use client'

import { useState } from 'react'

export default function ProfileActions({ url, badgeMarkdown }: { url: string; badgeMarkdown: string }) {
  const [copied, setCopied] = useState<'link' | 'badge' | null>(null)

  const copy = async (text: string, kind: 'link' | 'badge') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-3">
      <button type="button" className="btn-primary text-xs" onClick={() => window.print()}>
        Download résumé (PDF)
      </button>
      <button type="button" className="btn-primary text-xs" onClick={() => copy(url, 'link')}>
        {copied === 'link' ? 'Copied' : 'Copy profile link'}
      </button>
      <button type="button" className="btn-primary text-xs" onClick={() => copy(badgeMarkdown, 'badge')}>
        {copied === 'badge' ? 'Copied' : 'Copy README badge'}
      </button>
    </div>
  )
}
