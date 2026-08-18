import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import ProfileClient, { LogItem } from './ProfileClient'
import { getBuilderLevel, calculateStreak, fetchAllWalletLogs } from '@/app/lib/milestones'
import { isConfiguredSupabaseUrl } from '@/app/lib/canonicalMessage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ wallet: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const wallet = resolvedParams.wallet
  const walletShort = wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet

  let logs: { created_at: string }[] | null = null
  if (isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      logs = await fetchAllWalletLogs(supabase, wallet, { requirePublic: true })
    } catch {
      logs = []
    }
  }

  const count = logs?.length || 0
  const builderLevel = getBuilderLevel(count)

  const createdAts = (logs || []).map((l) => l.created_at)
  const streak = calculateStreak(createdAts)

  const ogTitle = `${walletShort} — ${builderLevel.emoji} ${builderLevel.title} • ${streak}d streak 🔥`
  const ogDesc = `Level ${builderLevel.level} builder with ${count} signed proof logs on PROVN protocol. Builder reputation on Solana.`

  return {
    title: ogTitle,
    description: ogDesc,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: `https://provn-sol.vercel.app/u/${wallet}`,
      siteName: 'PROVN',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: `${builderLevel.emoji} ${builderLevel.title} • ${count} signed proof logs on PROVN protocol 🗿`,
    },
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const resolvedParams = await params
  const wallet = resolvedParams.wallet

  let logs: LogItem[] = []

  if (isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      const fetchedLogs = await fetchAllWalletLogs(supabase, wallet, { requirePublic: true })
      logs = fetchedLogs || []
    } catch (e) {
      console.warn('Could not fetch wallet logs from Supabase, rendering empty state:', e)
      logs = []
    }
  }

  return <ProfileClient wallet={wallet} initialLogs={logs} />
}
