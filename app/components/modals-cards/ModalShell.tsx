'use client'

import React, { useEffect, useId, useRef } from 'react'
import '@/app/styles/modals-cards.css'

export interface ModalShellProps {
  title: string
  description?: React.ReactNode
  onClose: () => void
  size?: 'md' | 'lg'
  footer?: React.ReactNode
  children: React.ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared dialog frame: header with title and close button, scrolling body,
 * sticky footer. Traps focus, closes on Escape or backdrop click, locks page
 * scroll while open and returns focus to the trigger on close.
 */
export default function ModalShell({ title, description, onClose, size = 'md', footer, children }: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (!dialog) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="pvm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`pv pvm-dialog${size === 'lg' ? ' pvm-dialog-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="pvm-header">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="pvm-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="pvm-desc">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="pvm-close" onClick={onClose} aria-label="Close dialog">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="pvm-body">{children}</div>
        {footer && <div className="pvm-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
