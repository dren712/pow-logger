import { NextRequest, NextResponse } from 'next/server'
import { loadBuilderProfile } from '@/app/lib/builderProfileCache'

export const dynamic = 'force-dynamic'

const HEIGHT = 20
const FONT = 'Verdana,Geneva,DejaVu Sans,sans-serif'
const TIER_COLORS: Record<string, string> = {
  Legend: '#f5c451',
  Veteran: '#c4a5ff',
  Shipper: '#2ee59d',
  Builder: '#6cc4ff',
  Starter: '#9aa3b2',
}

// Approximate advance widths for 11px Verdana, the font README badges are drawn in.
function textWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    if (ch === ' ') width += 3.9
    else if ('ijl.,:;|!\''.includes(ch)) width += 3.2
    else if ('ftrI1'.includes(ch)) width += 4.6
    else if ('mwMW'.includes(ch)) width += 9.8
    else if (/[A-Z]/.test(ch)) width += 7.6
    else if (/[0-9]/.test(ch)) width += 7
    else width += 6.6
  }
  return Math.ceil(width)
}

// Same proportions as shields.io badges so it lines up with the others in a README row:
// dark label with the PROVN mark on the left, tier and score on the right.
function svg(label: string, value: string, color: string): string {
  const pad = 7
  const mark = 12
  const labelText = textWidth(label)
  const valueText = textWidth(value)
  const leftWidth = pad + mark + 5 + labelText + pad
  const rightWidth = pad + valueText + pad
  const width = leftWidth + rightWidth
  const labelX = pad + mark + 5 + labelText / 2
  const valueX = leftWidth + rightWidth / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" role="img" aria-label="${label}: ${value}">` +
    `<title>${label}: ${value}</title>` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-opacity=".08"/></linearGradient>` +
    `<clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="4"/></clipPath>` +
    `<g clip-path="url(#r)">` +
    `<rect width="${leftWidth}" height="${HEIGHT}" fill="#11151c"/>` +
    `<rect x="${leftWidth}" width="${rightWidth}" height="${HEIGHT}" fill="${color}"/>` +
    `<rect width="${width}" height="${HEIGHT}" fill="url(#s)"/>` +
    `</g>` +
    `<g transform="translate(${pad} ${(HEIGHT - mark) / 2}) scale(${mark / 24})">` +
    `<rect x="1" y="1" width="22" height="22" rx="6" fill="#2ee59d"/>` +
    `<path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#04130c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>` +
    `<g font-family="${FONT}" font-size="11" text-anchor="middle" text-rendering="geometricPrecision">` +
    `<text x="${labelX}" y="14" fill="#e8ecf2" textLength="${labelText}">${label}</text>` +
    `<text x="${valueX}" y="14" fill="#04130c" font-weight="bold" textLength="${valueText}">${value}</text>` +
    `</g>` +
    `</svg>`
  )
}

export async function GET(_req: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const result = await loadBuilderProfile(username.replace(/\.svg$/i, ''))
  // Tier and score are generated server-side from fixed strings and integers, so no escaping is needed.
  const body = result.ok
    ? svg('verified builder', `${result.profile.tier} ${result.profile.score}`, TIER_COLORS[result.profile.tier] || TIER_COLORS.Shipper)
    : svg('verified builder', 'unknown', '#8a93a3')
  return new NextResponse(body, {
    status: result.ok ? 200 : 404,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': result.ok ? 'public, s-maxage=86400, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
