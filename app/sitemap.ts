import type { MetadataRoute } from 'next'
import { SITE } from './lib/profileFormat'
import { fetchLeaderboard } from './lib/builderLeaderboard'

export const revalidate = 3600

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/leaderboard', priority: 0.9, changeFrequency: 'daily' },
  { path: '/log', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/agent-proof', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/verify', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/api', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/agent-sdk', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'monthly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  // Profiles on the leaderboard are the public ones worth indexing. Without a database the sitemap is just the static pages.
  const rows = await fetchLeaderboard(100).catch(() => null)
  for (const row of rows ?? []) {
    entries.push({ url: `${SITE}/gh/${row.login}`, changeFrequency: 'daily', priority: 0.7 })
    entries.push({ url: `${SITE}/gh/${row.login}/resume`, changeFrequency: 'daily', priority: 0.5 })
  }
  return entries
}
