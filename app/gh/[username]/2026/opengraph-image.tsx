import { ImageResponse } from 'next/og'
import { loadYearStats } from '@/app/lib/yearStatsCache'
import { monthName } from '@/app/lib/yearStats'

export const alt = '2026 in merged PRs — PROVN'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const result = await loadYearStats(username, 2026)
  const s = result.ok ? result.stats : null
  return new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#0b0f15', color: '#e8ecf2', display: 'flex', flexDirection: 'column', padding: 64, fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', color: '#2ee59d', fontSize: 24 }}>PROVN · YEAR IN REVIEW</div>
    <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, marginTop: 25 }}>2026 in merged PRs</div>
    <div style={{ display: 'flex', fontSize: 30, color: '#aab2c0', marginTop: 14 }}>@{username.slice(0, 39)}</div>
    {s ? <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 75, marginTop: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 72, color: '#2ee59d' }}>{s.total}</span><span style={{ fontSize: 22 }}>merged PRs</span></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 72 }}>{s.repos}{s.capped ? '+' : ''}</span><span style={{ fontSize: 22 }}>repositories</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 36 }}>{s.tier}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 22, marginTop: 32 }}>Best month: {s.bestMonth ? `${monthName(s.bestMonth.month)} (${s.bestMonth.mergedPrs} PRs)` : '—'} · Languages: {s.languages.map(l => l.name).join(', ') || '—'}</div>
      <div style={{ display: 'flex', color: '#8a93a3', fontSize: 16, marginTop: 26 }}>{s.capped ? 'Breakdowns cover first 1,000 PRs · ' : ''}Public merged PRs · Updated daily · provn-sol.vercel.app</div>
    </div> : <div style={{ display: 'flex', fontSize: 32, marginTop: 70 }}>{result.ok || result.reason !== 'not_found' ? 'Year stats currently unavailable' : 'GitHub builder not found'}</div>}
  </div>, size)
}
