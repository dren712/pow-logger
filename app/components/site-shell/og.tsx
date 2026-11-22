import type { ReactNode } from 'react'

// Shared pieces for the generated Open Graph images. Satori (next/og) only supports
// inline styles and flex layout, so none of the .pv classes can be used here.
export const OG_SIZE = { width: 1200, height: 630 }

export const OG = {
  bg: '#060709',
  surface: '#0c0f14',
  line: '#1c222c',
  text: '#e8ecf2',
  muted: '#8a93a3',
  faint: '#5c6473',
  accent: '#2ee59d',
}

export const TIER_COLORS: Record<string, string> = {
  Legend: '#f5c451',
  Veteran: '#c4a5ff',
  Shipper: '#2ee59d',
  Builder: '#6cc4ff',
  Starter: '#9aa3b2',
}

export function OgLogo({ size = 44 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.36 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="1" y="1" width="22" height="22" rx="6" fill={OG.accent} />
        <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#04130c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', fontSize: size * 0.7, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>PROVN</div>
    </div>
  )
}

export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: OG.bg,
        backgroundImage: 'radial-gradient(circle at 85% -10%, rgba(46, 229, 157, 0.16) 0%, rgba(6, 7, 9, 0) 55%)',
        color: OG.text,
        fontFamily: 'sans-serif',
      }}
    >
      {children}
    </div>
  )
}

export function OgScoreRing({ score, size = 190 }: { score: number; size?: number }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c
  return (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={OG.line} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={OG.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: size * 0.36, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{score}</div>
        <div style={{ display: 'flex', marginTop: 6, fontSize: size * 0.1, color: OG.muted }}>out of 100</div>
      </div>
    </div>
  )
}
