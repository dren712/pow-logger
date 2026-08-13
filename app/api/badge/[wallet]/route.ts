import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeBadgeSummary, calculateStreak, calculateLongestStreak, fetchAllWalletLogs } from '@/app/lib/milestones'
import { decodeBase58 } from '@/app/lib/canonicalMessage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(req: NextRequest, props: { params: Promise<{ wallet: string }> }) {
  try {
    const resolvedParams = await props.params
    const rawWallet = resolvedParams?.wallet || ''
    const wallet = rawWallet.replace(/\.(svg|png)$/i, '').trim()

    if (!wallet || wallet.length < 32 || wallet.length > 44) {
      return new NextResponse(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30"><rect width="200" height="30" fill="#222"/><text x="10" y="20" fill="#ff4444" font-family="monospace" font-size="12">Invalid Wallet</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    try {
      const pubKeyBytes = decodeBase58(wallet)
      if (pubKeyBytes.length !== 32) throw new Error('Invalid key length')
    } catch {
      return new NextResponse(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30"><rect width="200" height="30" fill="#222"/><text x="10" y="20" fill="#ff4444" font-family="monospace" font-size="12">Invalid Base58 Key</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    const logList = await fetchAllWalletLogs(supabase, wallet)
    const totalLogs = logList.length

    const createdAts = logList.map((l) => l.created_at)
    const streak = calculateStreak(createdAts)
    const longestStreak = calculateLongestStreak(createdAts)

    const rawShort = wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet
    const shortWallet = escapeXml(rawShort)

    const badgeSummary = computeBadgeSummary(totalLogs, streak, longestStreak, logList)
    const level = badgeSummary.level
    const levelTitle = escapeXml(level.title)
    const levelColor = escapeXml(level.color)

    // Build responsive Shields.io style SVG badge
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="460" height="110" viewBox="0 0 460 110" fill="none">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="460" y2="110" gradientUnits="userSpaceOnUse">
      <stop stop-color="#090b10" />
      <stop offset="1" stop-color="#121620" />
    </linearGradient>
    <linearGradient id="border-grad" x1="0" y1="0" x2="460" y2="110" gradientUnits="userSpaceOnUse">
      <stop stop-color="${levelColor}" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#00e5ff" stop-opacity="0.2"/>
    </linearGradient>
    <style>
      .text-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-weight: 800; font-size: 13px; fill: ${levelColor}; }
      .text-sub { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 11px; fill: #888888; }
      .text-val { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-weight: 700; font-size: 13px; fill: #ffffff; }
    </style>
  </defs>

  <!-- Background Card -->
  <rect width="460" height="110" rx="10" fill="url(#bg-grad)" stroke="url(#border-grad)" stroke-width="1.5" />

  <!-- Protocol Badge Tag -->
  <rect x="360" y="12" width="86" height="20" rx="10" fill="rgba(0, 255, 136, 0.1)" stroke="rgba(0, 255, 136, 0.3)" stroke-width="1" />
  <text x="370" y="26" font-family="monospace" font-size="10" font-weight="700" fill="#00ff88">PROVN 🗿</text>

  <!-- Builder Level Badge Icon -->
  <rect x="16" y="16" width="46" height="46" rx="10" fill="${escapeXml(level.glow)}" stroke="${levelColor}" stroke-width="1.5" />
  <text x="28" y="47" font-size="24">${level.emoji}</text>

  <!-- Level & Wallet Title -->
  <text x="74" y="32" class="text-title">LVL ${level.level} • ${levelTitle}</text>
  <text x="74" y="50" class="text-sub">Builder: ${shortWallet}</text>

  <!-- Stats Grid -->
  <line x1="16" y1="74" x2="444" y2="74" stroke="#1c2230" stroke-width="1" />

  <text x="20" y="94" class="text-sub">Streak:</text>
  <text x="66" y="94" class="text-val" fill="#ffb800">🔥 ${streak}d</text>

  <text x="140" y="94" class="text-sub">Total Logs:</text>
  <text x="210" y="94" class="text-val" fill="#00ff88">📦 ${totalLogs}</text>

  <text x="285" y="94" class="text-sub">Badges:</text>
  <text x="338" y="94" class="text-val" fill="#ab9ff2">🏆 ${badgeSummary.earnedSkillBadges.length + badgeSummary.earnedMilestones.length}</text>
</svg>
`.trim()

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
        'Surrogate-Control': 'max-age=60',
      },
    })
  } catch (error: unknown) {
    const errDetail = error instanceof Error ? error.message : String(error)
    console.error('Badge SVG API Error:', errDetail)
    return new NextResponse(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><rect width="400" height="40" fill="#222"/><text x="10" y="25" fill="#ff4444" font-family="monospace" font-size="12">Badge Error: ${escapeXml(errDetail)}</text></svg>`,
      {
        headers: { 'Content-Type': 'image/svg+xml' },
      }
    )
  }
}
