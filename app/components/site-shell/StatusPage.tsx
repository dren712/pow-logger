import type { ReactNode } from 'react'
import SiteNav from '@/app/components/SiteNav'

// Shared frame for the 404 and error pages: one message, one primary action.
export default function StatusPage({
  code,
  eyebrow,
  title,
  body,
  children,
  footnote,
}: {
  code?: string
  eyebrow: string
  title: string
  body: string
  children: ReactNode
  footnote?: ReactNode
}) {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 py-20 text-center sm:py-28">
        {code && (
          <p className="pv-mono select-none text-[72px] font-bold leading-none tracking-tight text-[#1c222c] sm:text-[96px]" aria-hidden="true">
            {code}
          </p>
        )}
        <p className={`pv-eyebrow ${code ? 'mt-6' : ''}`}>{eyebrow}</p>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-[34px]">{title}</h1>
        <p className="pv-muted mt-3 max-w-md text-[15px] leading-relaxed">{body}</p>
        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          {children}
        </div>
        {footnote && <div className="pv-faint mt-8 text-[13px] leading-relaxed">{footnote}</div>}
      </main>
    </div>
  )
}
