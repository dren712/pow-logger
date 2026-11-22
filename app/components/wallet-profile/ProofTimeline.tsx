'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import type { WalletLog } from '@/app/lib/types'
import { SectionHeader } from './ui'

const PAGE_SIZE = 20

const PROVENANCE: Record<string, { label: string; className: string }> = {
  source_verified: { label: 'Source-verified', className: 'border-[#2ee59d]/35 bg-[#2ee59d]/[0.08] text-[#2ee59d]' },
  source_linked: { label: 'Source-linked', className: 'border-[#6cc4ff]/35 bg-[#6cc4ff]/[0.08] text-[#6cc4ff]' },
  self_attested: { label: 'Self-attested', className: 'border-[#272e3a] bg-white/[0.03] text-[#9aa3b2]' },
}

function ProvenanceChip({ level }: { level?: string | null }) {
  const p = level === 'source_verified' || level === 'source_linked' ? PROVENANCE[level] : !level || level === 'self_attested' ? PROVENANCE.self_attested : null
  if (!p) return null
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${p.className}`}>{p.label}</span>
}

interface ProofTimelineProps {
  logs: WalletLog[]
  totalCount: number
  categories: { name: string; count: number }[]
  searchQuery: string
  onSearchChange: (v: string) => void
  selectedCategory: string
  onCategoryChange: (v: string) => void
  activeTags: { label: string; onClear: () => void }[]
  onClearAll: () => void
}

export default function ProofTimeline({
  logs,
  totalCount,
  categories,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  activeTags,
  onClearAll,
}: ProofTimelineProps) {
  const searchId = useId()
  const categoryId = useId()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const shown = logs.slice(0, limit)
  const filtered = searchQuery !== '' || selectedCategory !== 'ALL' || activeTags.length > 0

  return (
    <section className="pv-card" id="proofs">
      <SectionHeader
        title="Proofs"
        description={`${filtered ? `${logs.length} of ${totalCount}` : totalCount} signed ${totalCount === 1 ? 'entry' : 'entries'}. Strongest evidence first, then newest.`}
      />
      <div className="flex flex-col gap-3 border-b border-[#1c222c] px-5 py-4 sm:flex-row sm:items-end sm:px-6">
        <div className="min-w-0 flex-1">
          <label htmlFor={searchId} className="wp-label">Search</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5c6473]" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id={searchId}
              type="search"
              className="pv-input !py-2.5 !text-[14px]"
              placeholder="Search proof text or category"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="sm:w-56">
          <label htmlFor={categoryId} className="wp-label">Category</label>
          <select id={categoryId} className="pv-input wp-select !py-2.5 !pl-3.5 !text-[14px]" value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="ALL">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1c222c] px-5 py-3 text-[12px] sm:px-6">
          <span className="pv-faint">Filtered by</span>
          {activeTags.map((t) => (
            <button key={t.label} type="button" className="wp-tag" aria-pressed="true" onClick={t.onClear} aria-label={`Remove filter ${t.label}`}>
              {t.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="pv-muted text-[14px]">No proofs match these filters.</p>
          <button type="button" className="pv-btn-ghost !py-2 !text-[13px]" onClick={onClearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul>
          {shown.map((log) => (
            <li key={log.id} className="pv-row border-b border-[#1c222c] px-5 py-4 last:border-b-0 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/proof/${log.id}`} className="pv-link pv-mono text-[13px] font-semibold">
                    Proof #{log.id}
                  </Link>
                  {log.category && <span className="pv-chip !py-0.5 !text-[11px]">{log.category}</span>}
                  <ProvenanceChip level={log.provenance_level} />
                </div>
                <time dateTime={log.created_at} className="pv-mono pv-faint text-[11px]">
                  {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#d5dae3]">{log.content}</p>
              {(log.github_url || log.evidence_url || log.irys_tx_id) && (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {log.github_url && (
                    <a href={log.github_url} target="_blank" rel="noopener noreferrer" className="wp-evidence">
                      GitHub evidence
                    </a>
                  )}
                  {log.evidence_url && (
                    <a href={log.evidence_url} target="_blank" rel="noopener noreferrer" className="wp-evidence">
                      Demo or evidence link
                    </a>
                  )}
                  {log.irys_tx_id && (
                    <a href={`https://gateway.irys.xyz/${log.irys_tx_id}`} target="_blank" rel="noopener noreferrer" className="wp-evidence">
                      Arweave record
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {logs.length > shown.length && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1c222c] px-5 py-3 sm:px-6">
          <span className="pv-faint text-[12px]">
            Showing {shown.length} of {logs.length}
          </span>
          <button type="button" className="pv-btn-ghost !py-2 !text-[13px]" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show more
          </button>
        </div>
      )}
    </section>
  )
}
