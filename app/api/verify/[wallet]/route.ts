import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import { buildCanonicalSubmitMessage, decodeBase58, getVerifiedDomain } from '@/app/lib/canonicalMessage'
import { computeBadgeSummary, calculateStreak, calculateLongestStreak, PROTOCOL_TIMEZONE } from '@/app/lib/milestones'

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

    let publicKeyBytes: Uint8Array | null = null
    try {
      publicKeyBytes = decodeBase58(wallet)
    } catch {}

    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (error || !logs || logs.length === 0) {
      return NextResponse.json(
        { verified: false, message: 'Builder profile not found' },
        {
          status: 404,
          headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
        }
      )
    }

    const createdAts = logs.map((l) => l.created_at)
    const tz = req.nextUrl.searchParams.get('tz') || PROTOCOL_TIMEZONE
    const streak = calculateStreak(createdAts, tz)
    const longestStreak = calculateLongestStreak(createdAts, tz)

    // Compute badge summary
    const badgeSummary = computeBadgeSummary(logs.length, streak, longestStreak, logs)

    // Aggregate skills, protocols, categories
    const skillCount: Record<string, number> = {}
    const protocolCount: Record<string, number> = {}
    const categoryCount: Record<string, number> = {}

    logs.forEach((log) => {
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

    // Only count entries with real Irys receipts and confirmed 'archived' state
    const confirmedArchivedLogs = logs.filter(
      (l) => l.irys_tx_id && !l.irys_tx_id.startsWith('powl_') && l.archival_state === 'archived'
    )

    const allProcessedLogs = logs.map((l) => {
      let isCryptoVerified = false
      let status: 'verified' | 'unverified' | 'legacy_unindexed' = 'unverified'

      if (!l.nonce) {
        status = 'legacy_unindexed'
      } else if (l.signature && publicKeyBytes) {
        try {
          const reqHost = getVerifiedDomain(req.headers.get('host'))
          const candidateDomains = Array.from(new Set([
            l.domain,
            reqHost,
            'provn-sol.vercel.app',
            'localhost'
          ].filter(Boolean)))

          const sigBytes = decodeBase58(l.signature)

          for (const domain of candidateDomains) {
            const canonicalMsg = buildCanonicalSubmitMessage({
              domain,
              walletAddress: wallet,
              content: l.content,
              timestamp: l.created_at,
              nonce: l.nonce,
              githubUrl: l.github_url || undefined,
              evidenceUrl: l.evidence_url || undefined,
            })
            const msgBytes = new TextEncoder().encode(canonicalMsg)
            if (nacl.sign.detached.verify(msgBytes, sigBytes, publicKeyBytes)) {
              isCryptoVerified = true
              status = 'verified'
              break
            }
          }
        } catch {
          isCryptoVerified = false
          status = 'unverified'
        }
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

    const verifiedLogsCount = allProcessedLogs.filter((l) => l.cryptographically_verified).length
    const legacyCount = logs.filter((l) => !l.nonce).length

    return NextResponse.json(
      {
        profile_found: true,
        verified: verifiedLogsCount > 0,
        verified_logs_count: verifiedLogsCount,
        legacy_unindexed_count: legacyCount,
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
