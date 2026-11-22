import { unstable_cache } from 'next/cache'
import { githubGet, isValidGithubLogin } from './githubProfile'
import { computeYearStats, type YearPr } from './yearStats'

interface SearchPr {
  id: number
  repository_url: string
  pull_request: { merged_at: string | null }
}

const cachedYear = unstable_cache(async (username: string, year: number) => {
  const user = await githubGet(`/users/${username}`)
  if (user.status === 404) return null
  if (!user.ok) throw new Error('GitHub unavailable')
  if ((await user.json()).type !== 'User') return null
  const query = encodeURIComponent(`author:${username} is:pr is:merged is:public merged:${year}-01-01..${year}-12-31`)
  const items = new Map<number, SearchPr>()
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const response = await githubGet(`/search/issues?q=${query}&per_page=100&page=${page}&sort=created&order=asc`)
    if (!response.ok) throw new Error('GitHub search unavailable')
    const body = await response.json() as { total_count: number; incomplete_results: boolean; items: SearchPr[] }
    if (body.incomplete_results) throw new Error('Incomplete GitHub search')
    total = body.total_count
    for (const pr of body.items) items.set(pr.id, pr)
    if (page * 100 >= total) break
  }
  const languages = new Map<string, string | null>()
  for (const pr of items.values()) {
    if (languages.has(pr.repository_url)) continue
    const path = new URL(pr.repository_url)
    if (path.origin !== 'https://api.github.com' || !/^\/repos\/[^/]+\/[^/]+$/.test(path.pathname)) throw new Error('Invalid repository')
    const response = await githubGet(path.pathname)
    if (!response.ok) throw new Error('GitHub repository unavailable')
    languages.set(pr.repository_url, (await response.json()).language || null)
  }
  const prs: YearPr[] = [...items.values()].map(pr => ({
    id: pr.id, mergedAt: pr.pull_request.merged_at,
    repo: pr.repository_url, language: languages.get(pr.repository_url) || null,
  }))
  return { ...computeYearStats(username, year, prs), capped: total > items.size, total }
}, ['builder-year-v1'], { revalidate: 86400 })

export async function loadYearStats(username: string, year: number) {
  if (!isValidGithubLogin(username)) return { ok: false, reason: 'invalid' } as const
  try {
    const stats = await cachedYear(username.toLowerCase(), year)
    return stats ? { ok: true, stats } as const : { ok: false, reason: 'not_found' } as const
  } catch {
    return { ok: false, reason: 'unavailable' } as const
  }
}
