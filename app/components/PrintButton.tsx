'use client'

export default function PrintButton({ label = 'Download PDF' }: { label?: string }) {
  return (
    <button type="button" className="pv-btn" onClick={() => window.print()}>
      {label}
    </button>
  )
}
