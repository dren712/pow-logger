'use client'

import { useState } from 'react'

interface ProfileActionsProps {
  url: string
  badgeMarkdown: string
  resumeHref: string
  shareText?: string
}

export default function ProfileActions({ url, badgeMarkdown, resumeHref, shareText }: ProfileActionsProps) {
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

  const xHref = `https://twitter.com/intent/tweet?${new URLSearchParams({ ...(shareText ? { text: shareText } : {}), url }).toString()}`
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`

  return (
    <div className="no-print flex flex-col gap-2">
      <a href={resumeHref} className="pv-btn w-full">View résumé</a>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="pv-btn-ghost pv-btn-sm" onClick={() => copy(url, 'link')}>
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          className="pv-btn-ghost pv-btn-sm"
          title="Markdown for your README"
          onClick={() => copy(badgeMarkdown, 'badge')}
        >
          {copied === 'badge' ? 'Copied' : 'Copy badge'}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#1c222c] pt-3">
        <span className="pv-faint text-[12px]">Share</span>
        <div className="flex items-center gap-1">
          <a href={xHref} target="_blank" rel="noopener noreferrer" className="pv-share" aria-label="Share on X">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>X</span>
          </a>
          <a href={linkedInHref} target="_blank" rel="noopener noreferrer" className="pv-share" aria-label="Share on LinkedIn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0" />
            </svg>
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
      <span className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</span>
    </div>
  )
}
