import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import ProfileClient from './ProfileClient'
import { getBuilderLevel } from '@/app/lib/milestones'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface PageProps {
  params: Promise<{ wallet: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const wallet = resolvedParams.wallet
  const walletShort = wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet

  const { data: logs } = await supabase
    .from('logs')
    .select('created_at')
    .eq('wallet_address', wallet)

  const count = logs?.length || 0
  const builderLevel = getBuilderLevel(count)

  // Calculate streak count for metadata
  let streak = 0
  if (logs && logs.length > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const logDates = [
      ...new Set(logs.map((l) => new Date(l.created_at).toDateString())),
    ]
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())

    let checkDate = new Date(today)
    for (const date of logDates) {
      const diff = Math.round((checkDate.getTime() - date.getTime()) / 86400000)
      if (diff === 0 || diff === 1) {
        streak++
        checkDate = date
      } else break
    }
  }

  const ogTitle = `${walletShort} — ${builderLevel.emoji} ${builderLevel.title} • ${streak}d streak 🔥`
  const ogDesc = `Level ${builderLevel.level} builder with ${count} verified work logs on Arweave. Builder reputation on Solana.`

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
      description: `${builderLevel.emoji} ${builderLevel.title} • ${count} verified logs on Arweave 🗿`,
    },
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const resolvedParams = await params
  const wallet = resolvedParams.wallet

  const { data: logs, error } = await supabase
    .from('logs')
    .select('*')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })

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
