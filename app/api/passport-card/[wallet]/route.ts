import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllWalletLogs } from '@/app/lib/milestones'
import { calculateReputation } from '@/app/lib/reputationEngine'

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

    const logs = await fetchAllWalletLogs(supabase, wallet)
    const reputation = calculateReputation(wallet, logs || [])

    const shortWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    const topSkills = reputation.skills.slice(0, 4).map((s) => s.name).join(' · ') || 'Solana · Web3'

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06070a" />
      <stop offset="50%" stop-color="#0a0c14" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00ff88" />
      <stop offset="100%" stop-color="#00e5ff" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141824" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#0d1017" stop-opacity="0.9" />
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="20" y="20" width="1160" height="590" rx="24" fill="none" stroke="#1c2438" stroke-width="2" />

  <!-- Brand Header -->
  <g transform="translate(80, 80)">
    <text x="0" y="40" font-family="monospace, sans-serif" font-size="38" font-weight="900" fill="url(#brand)" letter-spacing="2">PROVN 🗿</text>
    <text x="210" y="38" font-family="monospace, sans-serif" font-size="16" font-weight="700" fill="#667" letter-spacing="1">BUILDER PASSPORT</text>
  </g>

  <!-- Wallet Header -->
  <g transform="translate(80, 160)">
    <text x="0" y="30" font-family="monospace, sans-serif" font-size="20" font-weight="600" fill="#889">SOLANA WALLET</text>
    <text x="0" y="70" font-family="monospace, sans-serif" font-size="34" font-weight="800" fill="#ffffff">${shortWallet}</text>
  </g>

  <!-- Stat Cards -->
  <g transform="translate(80, 280)">
    <!-- Card 1: Verified Proofs -->
    <rect x="0" y="0" width="320" height="150" rx="16" fill="url(#cardGrad)" stroke="#222b40" stroke-width="1.5" />
    <text x="28" y="42" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="#889" letter-spacing="1">VERIFIED PROOFS</text>
    <text x="28" y="105" font-family="monospace, sans-serif" font-size="48" font-weight="900" fill="#00ff88">${reputation.totalProofs}</text>
    <text x="130" y="105" font-family="monospace, sans-serif" font-size="18" font-weight="600" fill="#556">LOGS</text>

    <!-- Card 2: Streak -->
    <rect x="360" y="0" width="320" height="150" rx="16" fill="url(#cardGrad)" stroke="#222b40" stroke-width="1.5" />
    <text x="388" y="42" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="#889" letter-spacing="1">ACTIVE STREAK</text>
    <text x="388" y="105" font-family="monospace, sans-serif" font-size="48" font-weight="900" fill="#ffb800">🔥 ${reputation.currentStreak}</text>
    <text x="515" y="105" font-family="monospace, sans-serif" font-size="18" font-weight="600" fill="#556">DAYS</text>

    <!-- Card 3: Builder Level -->
    <rect x="720" y="0" width="320" height="150" rx="16" fill="url(#cardGrad)" stroke="#222b40" stroke-width="1.5" />
    <text x="748" y="42" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="#889" letter-spacing="1">BUILDER LEVEL</text>
    <text x="748" y="105" font-family="monospace, sans-serif" font-size="32" font-weight="900" fill="#00e5ff">${reputation.builderLevel.emoji} LVL ${reputation.builderLevel.level}</text>
  </g>

  <!-- Skills & Verification Footer -->
  <g transform="translate(80, 490)">
    <text x="0" y="24" font-family="monospace, sans-serif" font-size="14" font-weight="700" fill="#667" letter-spacing="1">VERIFIED SKILLS</text>
    <text x="0" y="58" font-family="monospace, sans-serif" font-size="20" font-weight="700" fill="#ab9ff2">${topSkills}</text>

    <text x="1040" y="58" text-anchor="end" font-family="monospace, sans-serif" font-size="15" font-weight="700" fill="#00ff88">provn-sol.vercel.app ↗</text>
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
