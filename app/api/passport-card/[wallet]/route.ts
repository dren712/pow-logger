import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'
import { getCardTheme } from '@/app/lib/cardThemes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, props: { params: Promise<{ wallet: string }> }) {
  try {
    const params = await props.params
    const wallet = params.wallet

    if (!wallet || wallet.trim().length < 32) {
      return new NextResponse('Invalid wallet address', { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const themeId = searchParams.get('theme') || 'steel'
    const theme = getCardTheme(themeId)

    const logs = await fetchAllWalletLogs(supabase, wallet)
    const reputation = calculateReputation(wallet, logs || [])

    const shortWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    const topSkills = reputation.skills.slice(0, 4).map((s) => '#' + s.name).join('  ') || '#Solana  #Web3'
    const serialId = `PRV-${wallet.slice(0, 4).toUpperCase()}-${reputation.totalProofs.toString().padStart(4, '0')}`

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.baseTone}" />
      <stop offset="50%" stop-color="#0a0c12" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>

    <linearGradient id="metalPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.baseTone}" />
      <stop offset="50%" stop-color="#141822" />
      <stop offset="100%" stop-color="${theme.baseTone}" />
    </linearGradient>

    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accentTone}" />
      <stop offset="100%" stop-color="${theme.highlightTone}" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#151924" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0c0e15" stop-opacity="0.95" />
    </linearGradient>

    <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
    </pattern>
  </defs>

  <!-- Base Canvas -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#gridPattern)" />

  <!-- Outer Machined Chassis Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="url(#metalPlate)" stroke="${theme.borderTone}" stroke-width="2" />
  <rect x="36" y="36" width="1128" height="558" rx="20" fill="none" stroke="${theme.innerBorderTone}" stroke-width="1" />

  <!-- Corner Rivet Accents -->
  <circle cx="50" cy="50" r="4" fill="${theme.borderTone}" />
  <circle cx="1150" cy="50" r="4" fill="${theme.borderTone}" />
  <circle cx="50" cy="580" r="4" fill="${theme.borderTone}" />
  <circle cx="1150" cy="580" r="4" fill="${theme.borderTone}" />

  <!-- Top Header: Brand & Spec -->
  <g transform="translate(80, 90)">
    <text x="0" y="32" font-family="monospace, sans-serif" font-size="34" font-weight="900" fill="url(#brand)" letter-spacing="2">PROVN 🗿</text>
    <text x="210" y="30" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="${theme.textColorSecondary}" letter-spacing="1.5">BUILDER PASSPORT // ${theme.name.toUpperCase()}</text>
    <text x="1040" y="30" text-anchor="end" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}">SERIAL: ${serialId}</text>
  </g>

  <!-- Signer Identity -->
  <g transform="translate(80, 175)">
    <text x="0" y="20" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">SOLANA SIGNER WALLET</text>
    <text x="0" y="60" font-family="monospace, sans-serif" font-size="36" font-weight="900" fill="${theme.textColorPrimary}" letter-spacing="1.5">${shortWallet}</text>
    <text x="1040" y="60" text-anchor="end" font-family="monospace, sans-serif" font-size="20" font-weight="800" fill="${theme.accentTone}">LVL ${reputation.builderLevel.level} — ${reputation.builderLevel.title.toUpperCase()}</text>
  </g>

  <!-- Triple Metric Inset Plates -->
  <g transform="translate(80, 275)">
    <!-- Plate 1: Verified Proofs -->
    <rect x="0" y="0" width="325" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="30" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">VERIFIED PROOFS</text>
    <text x="30" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="${theme.accentTone}">${reputation.totalProofs}</text>
    <text x="145" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">LOGS</text>

    <!-- Plate 2: Active Streak -->
    <rect x="355" y="0" width="325" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="385" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">ACTIVE STREAK</text>
    <text x="385" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="#ffb800">🔥 ${reputation.currentStreak}</text>
    <text x="530" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">DAYS</text>

    <!-- Plate 3: Arweave Archival -->
    <rect x="710" y="0" width="330" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="740" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">PERMANENT ARCHIVE</text>
    <text x="740" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="#00e5ff">${reputation.archivalSuccessRate}%</text>
    <text x="895" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">ARWEAVE</text>
  </g>

  <!-- Skills & Verification Footer -->
  <g transform="translate(80, 485)">
    <text x="0" y="24" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">VERIFIED SKILL ATTRIBUTION</text>
    <text x="0" y="58" font-family="monospace, sans-serif" font-size="20" font-weight="700" fill="${theme.textColorSecondary}">${topSkills}</text>

    <text x="1040" y="58" text-anchor="end" font-family="monospace, sans-serif" font-size="15" font-weight="800" fill="${theme.accentTone}">provn-sol.vercel.app ↗</text>
  </g>
</svg>
`

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    })
  } catch (error) {
    console.error('Passport Card Error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
