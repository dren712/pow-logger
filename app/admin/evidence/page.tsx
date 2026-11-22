import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { WalletLog } from '@/app/lib/types'
import SiteNav from '@/app/components/SiteNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Proof logger metrics — PROVN',
  description: 'Counts of public proof records, signer wallets and archived proofs, read live from the PROVN proof database.',
}

export default async function GrantEvidencePage() {
  const { data: rawLogs, error } = await supabase
    .from('logs')
    .select('id, wallet_address, skills, protocols, archival_state, irys_tx_id, visibility, is_public')
    .or('visibility.eq.public,visibility.is.null,is_public.eq.true')
    .order('created_at', { ascending: false })

  const logs = (rawLogs || []) as Partial<WalletLog>[]
  const totalProofs = logs.length

  const uniqueWallets = new Set(logs.map((l) => l.wallet_address).filter(Boolean))
  const totalBuilders = uniqueWallets.size

  const archivedCount = logs.filter(
    (l) => l.archival_state === 'receipt_obtained' || l.archival_state === 'finalized' || (l.irys_tx_id && !l.irys_tx_id.startsWith('powl_'))
  ).length

  const verifiedCount = totalProofs

  const skillCount: Record<string, number> = {}
  const protocolCount: Record<string, number> = {}

  logs.forEach((l) => {
    ;(l.skills || []).forEach((s) => (skillCount[s] = (skillCount[s] || 0) + 1))
    ;(l.protocols || []).forEach((p) => (protocolCount[p] = (protocolCount[p] || 0) + 1))
  })

  const topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const topProtocols = Object.entries(protocolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const unavailable = Boolean(error)
  const show = (n: number) => (unavailable ? '—' : n.toLocaleString('en-US'))
  const stats = [
    { label: 'Unique builders', value: show(totalBuilders), hint: 'Distinct Solana wallets' },
    { label: 'Total proofs', value: show(totalProofs), hint: 'Signed work records' },
    { label: 'Public proof records', value: show(verifiedCount), hint: 'Visible to anyone' },
    { label: 'Archived on Arweave', value: show(archivedCount), hint: 'Stored through Irys' },
  ]
  const breakdowns = [
    { title: 'Most common skills', rows: topSkills, prefix: '#', empty: 'No skills have been tagged on public proofs yet.' },
    { title: 'Most common Solana protocols', rows: topProtocols, prefix: '', empty: 'No protocols have been tagged on public proofs yet.' },
  ]

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8 lg:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="pv-eyebrow">Proof logger</p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">Evidence metrics</h1>
            <p className="pv-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
              Counts of public proof records in the PROVN proof logger, read from the database each time this page loads.
            </p>
          </div>
          <span className="pv-chip self-start sm:self-auto">
            <span className={`h-1.5 w-1.5 rounded-full ${unavailable ? 'bg-[#f5c451]' : 'bg-[#2ee59d]'}`} aria-hidden="true" />
            {unavailable ? 'Database unavailable' : 'Live data'}
          </span>
        </header>

        {unavailable && (
          <div role="alert" className="rounded-xl border border-[rgba(245,196,81,0.35)] bg-[rgba(245,196,81,0.07)] px-4 py-3 text-[14px]">
            <p className="font-semibold text-[#f5c451]">Metrics are unavailable right now</p>
            <p className="mt-1 text-[13px] text-[#c3cad6]">The proof database could not be reached, so no counts are shown. Reload the page to try again.</p>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
          {stats.map((s) => (
            <div key={s.label} className="pv-card px-4 py-4 sm:px-5 sm:py-5">
              <div className="text-[28px] font-bold leading-none tracking-tight text-white">{s.value}</div>
              <div className="mt-2.5 text-[13px] font-medium leading-snug text-[#c3cad6]">{s.label}</div>
              <div className="pv-faint mt-0.5 text-[12px] leading-snug">{s.hint}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {breakdowns.map((b) => {
            const max = b.rows[0]?.[1] || 1
            return (
              <section key={b.title} className="pv-card p-5 sm:p-6">
                <h2 className="pv-h2">{b.title}</h2>
                {b.rows.length === 0 ? (
                  <p className="pv-faint mt-4 rounded-xl border border-dashed border-[#272e3a] px-4 py-8 text-center text-[13px]">
                    {unavailable ? 'Nothing to show while the database is unavailable.' : b.empty}
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3.5">
                    {b.rows.map(([name, count]) => (
                      <li key={name}>
                        <div className="flex items-baseline justify-between gap-3 text-[14px]">
                          <span className="min-w-0 break-words text-[#c3cad6]">{b.prefix}{name}</span>
                          <span className="pv-muted shrink-0 text-[13px]">{count} {count === 1 ? 'proof' : 'proofs'}</span>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-[#11151c]" aria-hidden="true">
                          <div className="h-1 rounded-full bg-[#2ee59d]/70" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>

        <section className="pv-card p-5 text-[13px] leading-relaxed sm:p-6">
          <h2 className="pv-h2">How these numbers are counted</h2>
          <p className="pv-muted mt-2 max-w-3xl">
            Only proofs with public visibility are included. A builder is one distinct signer wallet. A proof counts as archived
            once it has an Irys transaction ID or a confirmed archival receipt. Skills and protocols are the tags stored on each proof.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/log" className="pv-btn-ghost">Open the proof logger</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
