'use client'

import { trackEvent } from '@/app/lib/analytics'

export default function PrintButton({ label = 'Download PDF' }: { label?: string }) {
  return (
    <button type="button" className="pv-btn" onClick={() => { trackEvent('resume_download'); window.print() }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16" />
      </svg>
      {label}
    </button>
  )
}
