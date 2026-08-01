import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import ProfileClient from './ProfileClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface PageProps {
  params: Promise<{ wallet: string }> | { wallet: string }
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

  return {
    title: `${walletShort}'s PoWL Profile — ${streak} day streak 🔥`,
    description: `${count} verified work logs permanently stored on Arweave. Builder reputation on Solana.`,
    openGraph: {
      title: `${walletShort}'s PoWL Profile — ${streak} day streak 🔥`,
      description: `${count} verified work logs permanently stored on Arweave.`,
      url: `https://pow-logger.vercel.app/u/${wallet}`,
      siteName: 'PoWL',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${walletShort}'s PoWL Profile — ${streak} day streak 🔥`,
      description: `${count} verified work logs permanently stored on Arweave. 🗿`,
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
          <a
            href="/"
            className="btn-primary"
            style={{
              display: 'inline-flex',
            }}
          >
            Start building your proof of work at pow-logger.vercel.app →
          </a>
        </div>
      </main>
    )
  }

  return <ProfileClient wallet={wallet} initialLogs={logs} />
}
