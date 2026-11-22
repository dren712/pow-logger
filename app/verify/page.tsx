import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import ReceiptVerifier from '@/app/components/ReceiptVerifier'
import { generateMandateDemoReceipt } from '@/app/lib/agent/mandateDemo'
import '@/app/styles/agent-console.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verify an agent receipt — PROVN Verify',
  description: 'Paste a PROVN agent receipt or ID and check its signatures, mandate, evidence hashes and Solana devnet anchor in your browser.',
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  const sample = JSON.stringify(await generateMandateDemoReceipt(), null, 2)

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:py-14">
        <header className="max-w-2xl">
          <p className="pv-eyebrow">PROVN Verify</p>
          <h1 className="mt-3 text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[38px]">Verify an agent receipt</h1>
          <p className="pv-muted mt-4 text-[16px] leading-relaxed">
            Check what an agent was allowed to do, what it asked to do and what happened, without trusting the PROVN dashboard. Learn more on the{' '}
            <Link href="/agent-proof" className="pv-link underline">PROVN Verify overview</Link>.
          </p>
        </header>
        <ReceiptVerifier sampleJson={sample} initialId={typeof id === 'string' ? id : undefined} />
      </main>
    </div>
  )
}
