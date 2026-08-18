import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLogCryptographically, decodeBase58 } from '@/app/lib/canonicalMessage'
import { computeBadgeSummary, calculateStreak, calculateLongestStreak, fetchAllWalletLogs, PROTOCOL_TIMEZONE } from '@/app/lib/milestones'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest, props: { params: Promise<{ wallet: string }> }) {
  try {
    const params = await props.params
    const wallet = params.wallet

    if (!wallet || typeof wallet !== 'string' || wallet.trim().length < 32 || wallet.trim().length > 44) {
      return NextResponse.json(
        { verified: false, message: 'Valid Solana wallet parameter is required (32-44 characters)' },
        { status: 400, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
      )
    }

    try {
      const pk = decodeBase58(wallet)
      if (pk.length !== 32) throw new Error('Invalid key length')
    } catch {
      return NextResponse.json(
        { verified: false, message: 'Invalid Base58 Solana wallet public key' },
        { status: 400, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
      )
    }

    const logs = await fetchAllWalletLogs(supabase, wallet)

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { verified: false, message: 'Builder profile not found' },
        {
          status: 404,
          headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
        }
      )
    }

    const allProcessedLogs = logs.map((l) => {
      let isCryptoVerified = false
      let status: 'verified' | 'unverified' | 'legacy_unindexed' = 'unverified'

      if (!l.nonce && (l as { protocol_version?: number }).protocol_version !== 2) {
        status = 'legacy_unindexed'
      } else {
        isCryptoVerified = verifyLogCryptographically(l)
        status = isCryptoVerified ? 'verified' : 'unverified'
      }

      return {
        id: l.id,
        content: l.content,
        category: l.category,
        skills: l.skills,
        created_at: l.created_at,
        archival_state: l.archival_state || 'pending',
        evidence_url: l.evidence_url || null,
        github_url: l.github_url || null,
        irys_url: l.irys_tx_id && !l.irys_tx_id.startsWith('powl_') ? `https://gateway.irys.xyz/${l.irys_tx_id}` : null,
        cryptographically_verified: isCryptoVerified,
        verification_status: status,
      }
    })

    // Strict Invariant: Metrics and badges are derived EXCLUSIVELY from cryptographically verified proofs
    const verifiedLogs = logs.filter((l) => verifyLogCryptographically(l))
    const verifiedLogsCount = verifiedLogs.length
    const legacyCount = logs.filter((l) => !l.nonce && (l as { protocol_version?: number }).protocol_version !== 2).length

    const createdAts = verifiedLogs.map((l) => l.created_at)
    const streak = calculateStreak(createdAts, PROTOCOL_TIMEZONE)
    const longestStreak = calculateLongestStreak(createdAts, PROTOCOL_TIMEZONE)

    // Compute badge summary from verified proofs ONLY
    const badgeSummary = computeBadgeSummary(verifiedLogs.length, streak, longestStreak, verifiedLogs)

    // Aggregate skills, protocols, categories ONLY from verified proofs
    const skillCount: Record<string, number> = {}
    const protocolCount: Record<string, number> = {}
    const categoryCount: Record<string, number> = {}

    verifiedLogs.forEach((log) => {
      ;(log.skills || []).forEach(
        (s: string) => (skillCount[s] = (skillCount[s] || 0) + 1)
      )
      ;(log.protocols || []).forEach(
        (p: string) => (protocolCount[p] = (protocolCount[p] || 0) + 1)
      )
      if (log.category)
        categoryCount[log.category] = (categoryCount[log.category] || 0) + 1
    })

    const topSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((e) => e[0])

    const topProtocols = Object.entries(protocolCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((e) => e[0])

    const walletShort =
      wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet

    // Only count entries with real Irys receipts and confirmed 'archived' state from verified proofs
    const confirmedArchivedLogs = verifiedLogs.filter(
      (l) => l.irys_tx_id && !l.irys_tx_id.startsWith('powl_') && (l.archival_state === 'receipt_obtained' || l.archival_state === 'finalized')
    )

    // Compute detailed counts for transparency
    const unverifiedCount = logs.length - verifiedLogsCount - legacyCount
    const sourceVerifiedCount = verifiedLogs.filter((l) => l.provenance_level === 'source_verified').length

    return NextResponse.json(
      {
        profile_found: true,
        verified_proofs: verifiedLogsCount,
        unverified_proofs: unverifiedCount,
        legacy_proofs: legacyCount,
        source_verified_proofs: sourceVerifiedCount,
        wallet: walletShort,
        wallet_full: wallet,
        streak,
        longest_streak: longestStreak,
        total_logs: logs.length,
        irys_archived_count: confirmedArchivedLogs.length,
        member_since: new Date(logs[logs.length - 1].created_at)
          .toISOString()
          .split('T')[0],
        top_skills: topSkills,
        top_protocols: topProtocols,
        work_categories: categoryCount,
        badge: {
          level: badgeSummary.level.level,
          title: badgeSummary.level.title,
          emoji: badgeSummary.level.emoji,
          color: badgeSummary.level.color,
          progress: badgeSummary.levelProgress,
          next_level: badgeSummary.nextLevel ? {
            title: badgeSummary.nextLevel.next.title,
            emoji: badgeSummary.nextLevel.next.emoji,
            logs_remaining: badgeSummary.nextLevel.logsRemaining,
          } : null,
          earned_milestones: badgeSummary.earnedMilestones.map(m => ({
            days: m.days,
            title: m.title,
            emoji: m.emoji,
          })),
          next_milestone: badgeSummary.nextMilestone ? {
            title: badgeSummary.nextMilestone.milestone.title,
            emoji: badgeSummary.nextMilestone.milestone.emoji,
            days_remaining: badgeSummary.nextMilestone.daysRemaining,
          } : null,
        },
        recent_logs: allProcessedLogs.slice(0, 5),
      },
      {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      }
    )
  } catch (error) {
    console.error('Verify API error:', error)
    return NextResponse.json(
      { verified: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
