'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

export function shortWallet(wallet: string) {
  return wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet
}

export function SectionHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-[#1c222c] px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="pv-h2">{title}</h2>
        {description && <p className="pv-muted mt-1 text-[13px] leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

const NOTICE_TONES = {
  success: 'border-[#2ee59d]/30 bg-[#2ee59d]/[0.06] text-[#b9f5dc]',
  error: 'border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.06] text-[#ffc9c9]',
  info: 'border-[#f5c451]/25 bg-[#f5c451]/[0.05] text-[#ecdcae]',
} as const

export function Notice({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: keyof typeof NOTICE_TONES
  title: string
  children?: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${NOTICE_TONES[tone]}`}
    >
      <p className="min-w-0">
        <strong className="font-semibold text-white">{title}</strong> {children}
      </p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="wp-icon-btn -mr-1 -mt-0.5 shrink-0">
          <CloseIcon />
        </button>
      )}
    </div>
  )
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 400,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: number
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className="pv fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pv-card max-h-full w-full overflow-y-auto p-6"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[16px] font-semibold tracking-tight text-white">{title}</h3>
            {subtitle && <p className="pv-faint pv-mono mt-1 text-[11px] uppercase tracking-[0.1em]">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="wp-icon-btn -mr-1.5 -mt-1 shrink-0">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
