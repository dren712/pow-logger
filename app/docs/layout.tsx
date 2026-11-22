import type { ReactNode } from 'react'
import SiteNav from '@/app/components/SiteNav'
import DocsNav from '@/app/components/docs-legal/DocsNav'
import '@/app/styles/docs-legal.css'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-x-12 gap-y-6 px-5 py-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-12">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <DocsNav />
        </aside>
        <main className="pv-main min-w-0 pb-10">{children}</main>
      </div>
    </div>
  )
}
