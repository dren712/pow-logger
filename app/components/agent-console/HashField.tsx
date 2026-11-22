import type { ReactNode } from 'react'
import CopyButton from './CopyButton'

interface HashFieldProps {
  label: string
  value: string | null | undefined
  /** Shown instead of the value when there is none. */
  empty?: string
  /** Optional link shown next to the copy button. */
  href?: string
  linkLabel?: string
  note?: ReactNode
}

/** A labelled hash, key or address: full value, wrapped, with a copy button. */
export default function HashField({ label, value, empty = 'Not available', href, linkLabel, note }: HashFieldProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="ac-label">{label}</span>
        {value ? (
          <span className="flex items-center gap-2">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="pv-link pv-muted text-[12px] underline decoration-[#3a4250] underline-offset-4">
                {linkLabel || 'Open'}
              </a>
            ) : null}
            <CopyButton value={value} label={label.toLowerCase()} />
          </span>
        ) : null}
      </div>
      {value ? (
        <code className="ac-code ac-break mt-1.5 block px-3 py-2">{value}</code>
      ) : (
        <p className="pv-faint mt-1.5 text-[13px]">{empty}</p>
      )}
      {note ? <p className="pv-faint mt-1.5 text-[12px] leading-relaxed">{note}</p> : null}
    </div>
  )
}
