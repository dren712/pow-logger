import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RouteParams {
  params: Promise<{ wallet: string }> | { wallet: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params
    const wallet = resolvedParams.wallet

    if (!wallet || typeof wallet !== 'string' || wallet.trim().length < 32 || wallet.trim().length > 44) {
      return NextResponse.json(
        { verified: false, message: 'Valid Solana wallet parameter is required (32-44 characters)' },
        { status: 400, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
      )
    }

    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false })

    if (error || !logs || logs.length === 0) {
      return NextResponse.json(
        { verified: false, message: 'Builder profile not found' },
        {
          status: 444,
          headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
        }
      )
    }

    // Calculate consecutive streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const logDates = [
      ...new Set(logs.map((l) => new Date(l.created_at).toDateString())),
    ]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())

    let streak = 0
    let checkDate = new Date(today)
    for (const date of logDates) {
      const diff = Math.round((checkDate.getTime() - date.getTime()) / 86400000)
      if (diff === 0 || diff === 1) {
        streak++
        checkDate = date
      } else break
    }

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

    return NextResponse.json(
      {
        verified: true,
        wallet: walletShort,
        wallet_full: wallet,
        streak,
        total_logs: logs.length,
        irys_archived_count: confirmedArchivedLogs.length,
        member_since: new Date(logs[logs.length - 1].created_at)
          .toISOString()
          .split('T')[0],
        top_skills: topSkills,
        top_protocols: topProtocols,
        work_categories: categoryCount,
        recent_logs: logs.slice(0, 5).map((l) => ({
          id: l.id,
          content: l.content,
          category: l.category,
          skills: l.skills,
          created_at: l.created_at,
          archival_state: l.archival_state || 'pending',
          evidence_url: l.evidence_url || null,
          github_url: l.github_url || null,
          irys_url: l.irys_tx_id && !l.irys_tx_id.startsWith('powl_') ? `https://gateway.irys.xyz/${l.irys_tx_id}` : null,
        })),
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
