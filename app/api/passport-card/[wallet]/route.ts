import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'
import { getCardTheme } from '@/app/lib/cardThemes'
import { decodeBase58 } from '@/app/lib/canonicalMessage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'

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
    const params = await props.params
    const rawWallet = params.wallet || ''
    const wallet = rawWallet.replace(/\.(svg|png)$/i, '').trim()

    // Strict Base58 public key validation
    if (!wallet || wallet.length < 32 || wallet.length > 44) {
      return new NextResponse('Invalid wallet address', { status: 400 })
    }

    try {
      const pubKeyBytes = decodeBase58(wallet)
      if (pubKeyBytes.length !== 32) {
        return new NextResponse('Invalid 32-byte Ed25519 public key', { status: 400 })
      }
    } catch {
      return new NextResponse('Invalid Base58 wallet address', { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const themeId = searchParams.get('theme') || 'steel'
    const theme = getCardTheme(themeId)

    const logs = await fetchAllWalletLogs(supabase, wallet)
    const reputation = calculateReputation(wallet, logs || [])

    const rawShort = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    const shortWallet = escapeXml(rawShort)
    const rawTopSkills =
      reputation.skills.slice(0, 4).map((s) => '#' + s.name).join('  ') || '#Solana  #Web3'
    const topSkills = escapeXml(rawTopSkills)
    const serialId = escapeXml(`PRV-${wallet.slice(0, 4).toUpperCase()}-${reputation.totalProofs.toString().padStart(4, '0')}`)
    const levelTitle = escapeXml(reputation.builderLevel.title.toUpperCase())
    const themeName = escapeXml(theme.name.toUpperCase())

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
    <text x="210" y="30" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="${theme.textColorSecondary}" letter-spacing="1.5">BUILDER PASSPORT // ${themeName}</text>
    <text x="1040" y="30" text-anchor="end" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}">SERIAL: ${serialId}</text>
  </g>

  <!-- Signer Identity -->
  <g transform="translate(80, 175)">
    <text x="0" y="20" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">SOLANA SIGNER WALLET</text>
    <text x="0" y="60" font-family="monospace, sans-serif" font-size="36" font-weight="900" fill="${theme.textColorPrimary}" letter-spacing="1.5">${shortWallet}</text>
    <text x="1040" y="60" text-anchor="end" font-family="monospace, sans-serif" font-size="20" font-weight="800" fill="${theme.accentTone}">LVL ${reputation.builderLevel.level} — ${levelTitle}</text>
  </g>

  <!-- Triple Metric Inset Plates -->
  <g transform="translate(80, 275)">
    <!-- Plate 1: Verified Proofs -->
    <rect x="0" y="0" width="325" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="30" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">VERIFIED PROOFS</text>
    <text x="30" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="${theme.accentTone}">${reputation.totalProofs}</text>
    <text x="145" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">LOGS</text>

    <!-- Plate 2: Active Streak -->
    <rect x="357" y="0" width="325" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="387" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">ACTIVE STREAK</text>
    <text x="387" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="${theme.highlightTone}">🔥 ${reputation.currentStreak}</text>
    <text x="535" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">DAYS</text>

    <!-- Plate 3: Arweave Archival Rate -->
    <rect x="715" y="0" width="325" height="155" rx="16" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1.5" />
    <text x="745" y="44" font-family="monospace, sans-serif" font-size="13" font-weight="700" fill="${theme.technicalTextColor}" letter-spacing="1">ARWEAVE ARCHIVAL</text>
    <text x="745" y="112" font-family="monospace, sans-serif" font-size="52" font-weight="900" fill="${theme.accentTone}">${reputation.archivalSuccessRate}%</text>
    <text x="895" y="112" font-family="monospace, sans-serif" font-size="16" font-weight="600" fill="${theme.textColorSecondary}">PERMANENT</text>
  </g>

  <!-- Bottom Bar: Skills & Verification Metadata -->
  <g transform="translate(80, 485)">
    <rect x="0" y="0" width="1040" height="65" rx="12" fill="url(#cardGrad)" stroke="${theme.innerBorderTone}" stroke-width="1" />
    <text x="30" y="38" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="${theme.accentTone}" letter-spacing="1">${topSkills}</text>
    <text x="1010" y="38" text-anchor="end" font-family="monospace, sans-serif" font-size="12" font-weight="600" fill="${theme.technicalTextColor}">CRYPTOGRAPHICALLY ATTESTED // ED25519</text>
  </g>
</svg>
    `.trim()

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    })
  } catch (error) {
    console.error('Passport Card SVG route error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
