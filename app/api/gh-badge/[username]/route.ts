import { NextRequest, NextResponse } from 'next/server'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'

export const dynamic = 'force-dynamic'

function svg(label: string, value: string, color: string): string {
  const leftWidth = 6 * label.length + 16
  const rightWidth = 6 * value.length + 16
  const width = leftWidth + rightWidth
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}"><rect width="${leftWidth}" height="20" fill="#0d0f14"/><rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${leftWidth / 2}" y="14">${label}</text><text x="${leftWidth + rightWidth / 2}" y="14" fill="#060709">${value}</text></g></svg>`
}

export async function GET(_req: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const result = await loadBuilderProfile(username.replace(/\.svg$/i, ''))
  // Tier and score are generated server-side from fixed strings and integers, so no escaping is needed.
  const body = result.ok
    ? svg('verified builder', `${result.profile.tier} ${result.profile.score}`, '#00ff88')
    : svg('verified builder', 'unknown', '#888888')
  return new NextResponse(body, {
    status: result.ok ? 200 : 404,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': result.ok ? 'public, s-maxage=86400, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
