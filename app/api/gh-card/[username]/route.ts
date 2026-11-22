import { NextRequest, NextResponse } from 'next/server'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'
import { fetchLeaderboard } from '@/app/lib/builderLeaderboard'
import { renderRankCard } from '@/app/lib/rankCard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const login = username.replace(/\.svg$/i, '')
  const result = await loadBuilderProfile(login)
  const rows = result.ok ? await fetchLeaderboard() : null
  const index = rows?.findIndex(row => row.login.toLowerCase() === login.toLowerCase()) ?? -1
  const body = renderRankCard({
    username: result.ok ? result.profile.login : login.slice(0, 39),
    score: result.ok ? result.profile.score : null,
    tier: result.ok ? result.profile.tier : 'Unknown builder',
    rank: index >= 0 ? index + 1 : null,
    theme: request.nextUrl.searchParams.get('theme') === 'light' ? 'light' : 'dark',
  })
  return new NextResponse(body, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
  } })
}
