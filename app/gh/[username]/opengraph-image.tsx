import { ImageResponse } from 'next/og'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { isValidGithubLogin } from '@/app/lib/githubProfile'
import { compact } from '@/app/lib/profileFormat'
import { OG, OG_SIZE, OgFrame, OgLogo, OgScoreRing, TIER_COLORS } from '@/app/components/site-shell/og'

export const alt = 'Verified developer profile on PROVN'
export const size = OG_SIZE
export const contentType = 'image/png'

// Inlined so a slow or failing avatar host cannot break the whole image.
async function avatarDataUrl(url: string): Promise<string | null> {
  try {
    const sized = new URL(url)
    sized.searchParams.set('s', '320')
    const res = await fetch(sized, { signal: AbortSignal.timeout(4000) })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !/^image\/(png|jpeg|gif)/.test(type)) return null
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

function Fallback({ login }: { login: string | null }) {
  return (
    <OgFrame>
      <OgLogo />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', color: OG.accent }}>
          VERIFIED DEVELOPER PROFILE
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: login && login.length > 28 ? 46 : login && login.length > 18 ? 60 : 82,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: '-0.035em',
            color: '#fff',
          }}
        >
          {login ? `@${login}` : 'Builder profile'}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: OG.muted }}>
        Built from merged GitHub work. Every claim links to its source.
      </div>
    </OgFrame>
  )
}

export default async function OpengraphImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const result = await loadBuilderProfile(username)

  if (!result.ok) {
    // Never cached: the next request may find the profile.
    return new ImageResponse(<Fallback login={isValidGithubLogin(username) ? username : null} />, {
      ...size,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const p = result.profile
  const avatar = await avatarDataUrl(p.avatarUrl)
  const displayName = p.name || p.login
  const tierColor = TIER_COLORS[p.tier] || TIER_COLORS.Starter
  const stats = [
    { label: 'Merged PRs in other projects', value: compact(p.stats.mergedExternalPrs) },
    { label: 'Projects contributed to', value: `${compact(p.stats.externalRepos)}${p.contributionsCapped ? '+' : ''}` },
    { label: 'Stars on own repos', value: compact(p.stats.stars) },
    { label: 'Public repos', value: compact(p.stats.ownRepos) },
  ]

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <OgLogo size={38} />
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, letterSpacing: '0.14em', color: OG.faint }}>
            VERIFIED DEVELOPER PROFILE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36, flex: 1, minWidth: 0 }}>
            {avatar ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={avatar} width={176} height={176} style={{ borderRadius: 36, border: '2px solid rgba(255,255,255,0.12)' }} />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 176,
                  height: 176,
                  borderRadius: 36,
                  background: OG.surface,
                  border: `2px solid ${OG.line}`,
                  fontSize: 84,
                  fontWeight: 700,
                  color: OG.muted,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'block',
                  maxWidth: 560,
                  fontSize: displayName.length > 18 ? 52 : 66,
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: '-0.035em',
                  color: '#fff',
                  overflow: 'hidden',
                  lineClamp: 2,
                }}
              >
                {displayName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
                <div style={{ display: 'flex', fontSize: 28, color: OG.muted }}>@{p.login}</div>
                <div
                  style={{
                    display: 'flex',
                    padding: '5px 18px',
                    borderRadius: 999,
                    border: `2px solid ${tierColor}`,
                    background: `${tierColor}14`,
                    fontSize: 24,
                    fontWeight: 600,
                    color: tierColor,
                  }}
                >
                  {p.tier}
                </div>
              </div>
            </div>
          </div>
          <OgScoreRing score={p.score} />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                padding: '18px 22px',
                borderRadius: 18,
                border: `1px solid ${OG.line}`,
                background: OG.surface,
              }}
            >
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>{s.value}</div>
              <div style={{ display: 'flex', marginTop: 4, fontSize: 18, color: OG.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    // Scores change daily, so this must not get the year-long immutable default.
    { ...size, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' } }
  )
}
