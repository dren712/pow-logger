'use client'

import { trackEvent } from '@/app/lib/analytics'

export default function YearShareLinks({ url }: { url: string }) {
  return <div className="mt-8 flex flex-wrap gap-3">
    <a className="pv-btn" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('My 2026 in merged PRs on PROVN')}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('share_click', { network: 'x', source: 'year' })}>Share on X</a>
    <a className="pv-btn-ghost" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('share_click', { network: 'linkedin', source: 'year' })}>Share on LinkedIn</a>
  </div>
}
