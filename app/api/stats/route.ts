import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60 // Cache for 60 seconds

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET() {
  if (!serviceKey) {
    return NextResponse.json({ error: 'Missing service key' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // 1. Total proofs
    const { count: totalProofs, error: countError } = await supabase
      .from('logs')
      .select('id', { count: 'exact', head: true })

    if (countError) throw countError

    // 2. Total archived
    const { count: totalArchived, error: archiveError } = await supabase
      .from('logs')
      .select('id', { count: 'exact', head: true })
      .in('archival_state', ['receipt_obtained', 'finalized', 'archived'])

    if (archiveError) throw archiveError

    // 3. Total unique builders (wallets)
    // Supabase REST doesn't natively do COUNT(DISTINCT column). We have to fetch or use an RPC.
    // For now, since data is small, fetching unique wallets or estimating is fine. 
    // Wait, let's just use an RPC if we had one, but we don't.
    // As a workaround, we can query unique wallet_addresses manually if it's < 1000, 
    // but the best way is using an RPC. Since we can't create an RPC now without the user's help,
    // we will fetch all distinct wallets by doing a basic select and set.
    const { data: wallets, error: walletsError } = await supabase
      .from('logs')
      .select('wallet_address')

    if (walletsError) throw walletsError

    const uniqueBuilders = new Set(wallets?.map(w => w.wallet_address)).size

    return NextResponse.json({
      totalBuilders: uniqueBuilders || 0,
      totalProofs: totalProofs || 0,
      totalArchived: totalArchived || 0
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Stats fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch network stats' }, { status: 500 })
  }
}
