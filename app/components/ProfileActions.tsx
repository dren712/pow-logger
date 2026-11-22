'use client'

import { useState } from 'react'

export default function ProfileActions({ url, badgeMarkdown, resumeHref }: { url: string; badgeMarkdown: string; resumeHref: string }) {
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
    <div className="no-print flex flex-col gap-2">
      <a href={resumeHref} className="pv-btn w-full">View résumé</a>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="pv-btn-ghost !px-2 !text-[13px]" onClick={() => copy(url, 'link')}>
          {copied === 'link' ? 'Copied ✓' : 'Copy link'}
        </button>
        <button type="button" className="pv-btn-ghost !px-2 !text-[13px]" onClick={() => copy(badgeMarkdown, 'badge')}>
          {copied === 'badge' ? 'Copied ✓' : 'Copy badge'}
        </button>
      </div>
      <span className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</span>
    </div>
  )
}
