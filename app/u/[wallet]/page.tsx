import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import ProfileClient, { LogItem } from './ProfileClient'
import { getBuilderLevel, calculateStreak } from '@/app/lib/milestones'
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
      const { data } = await supabase
        .from('logs')
        .select('created_at')
        .eq('wallet_address', wallet)
      logs = data
    } catch {
      logs = null
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

  let logs: LogItem[] | null = null
  let error: unknown = null

  if (isConfiguredSupabaseUrl(supabaseUrl)) {
    try {
      const res = await supabase
        .from('logs')
        .select('*')
        .eq('wallet_address', wallet)
        .order('created_at', { ascending: false })
      logs = res.data
      error = res.error
    } catch (e) {
      error = e
    }
  }

  if (error || !logs || logs.length === 0) {
    return (
      <main
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          padding: '80px 20px',
          fontFamily: 'var(--font-geist-mono), monospace',
          textAlign: 'center',
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: '48px 24px',
            border: '1px dashed rgba(255, 68, 68, 0.3)',
          }}
        >
          <h1 style={{ color: '#ff4444', fontSize: '1.8rem', marginBottom: '12px', fontWeight: 800 }}>
            Builder Not Found 🔍
          </h1>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            No verified proof logs recorded for wallet <code style={{ color: '#ffb800' }}>{wallet}</code> yet.
          </p>
          <Link
            href="/"
            className="btn-primary"
            style={{
              display: 'inline-flex',
            }}
          >
            Start building your proof of work at provn-sol.vercel.app →
          </Link>
        </div>
      </main>
    )
  }

  return <ProfileClient wallet={wallet} initialLogs={logs} />
}
