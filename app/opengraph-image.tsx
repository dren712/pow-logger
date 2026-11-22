import { ImageResponse } from 'next/og'
import { OG, OG_SIZE, OgFrame, OgLogo } from './components/site-shell/og'

export const alt = 'PROVN — the developer résumé nobody can fake'
export const size = OG_SIZE
export const contentType = 'image/png'

const POINTS = ['Built from merged GitHub work', 'Every claim links to its source', 'Profile, résumé and README badge']

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgFrame>
        <OgLogo />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', color: OG.accent }}>
            VERIFIED DEVELOPER PROFILES
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 22,
              maxWidth: 940,
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: '-0.035em',
              color: '#fff',
            }}
          >
            The developer résumé nobody can fake
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {POINTS.map((point) => (
            <div
              key={point}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 18px',
                borderRadius: 999,
                border: `1px solid ${OG.line}`,
                background: OG.surface,
                fontSize: 18,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                color: '#c3cad6',
              }}
            >
              <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 9, background: OG.accent }} />
              {point}
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    size
  )
}
