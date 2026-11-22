import { createHash } from 'crypto'
import { canonicalize } from './agent/canonicalize'

const GITHUB_API = 'https://api.github.com'
export const PROFILE_REVALIDATE_SECONDS = 60 * 60 * 24

export interface GithubUser {
  login: string
  id: number
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  followers: number
  public_repos: number
  created_at: string
  type?: string
}

export interface GithubRepo {
  name: string
  full_name: string
  html_url: string
  description: string | null
  fork: boolean
  stargazers_count: number
  forks_count: number
  language: string | null
  pushed_at: string | null
  archived?: boolean
}

export interface GithubMergedPr {
  title: string
  html_url: string
  repository_url: string
  closed_at: string | null
}

export interface ProfileRepo {
  name: string
  url: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  pushedAt: string | null
}

export interface ProfileContribution {
  repo: string
  repoUrl: string
  mergedPrs: number
  latest: { title: string; url: string; mergedAt: string | null }[]
}

export interface BuilderProfile {
  login: string
  githubId: number
  name: string | null
  avatarUrl: string
  githubUrl: string
  bio: string | null
  company: string | null
  location: string | null
  website: string | null
  followers: number
  memberSince: string
  stats: {
    ownRepos: number
    stars: number
    forks: number
    mergedExternalPrs: number
    externalRepos: number
    accountYears: number
  }
  languages: { name: string; repos: number }[]
  topRepos: ProfileRepo[]
  contributions: ProfileContribution[]
  // True when GitHub search returned fewer PRs than exist, so externalRepos is a minimum.
  contributionsCapped: boolean
  score: number
  tier: string
  fingerprint: string
  generatedAt: string
}

export type ProfileResult =
  | { ok: true; profile: BuilderProfile }
  | { ok: false; reason: 'invalid' | 'not_found' | 'rate_limited' | 'unavailable' }

export function isValidGithubLogin(login: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)
}

export function getTier(score: number): string {
  if (score >= 80) return 'Legend'
  if (score >= 60) return 'Veteran'
  if (score >= 40) return 'Shipper'
  if (score >= 20) return 'Builder'
  return 'Starter'
}

// Each part is log-scaled so one huge number (a viral repo) cannot max the score alone.
function scaled(value: number, cap: number, points: number): number {
  if (value <= 0) return 0
  return Math.min(1, Math.log10(1 + value) / Math.log10(1 + cap)) * points
}

export function scoreProfile(stats: BuilderProfile['stats'], followers: number): number {
  const total =
    scaled(stats.mergedExternalPrs, 200, 35) +
    scaled(stats.externalRepos, 40, 15) +
    scaled(stats.stars, 5000, 25) +
    scaled(stats.ownRepos, 50, 10) +
    scaled(followers, 2000, 10) +
    Math.min(1, stats.accountYears / 8) * 5
  return Math.round(Math.min(100, total))
}

export function buildProfile(
  user: GithubUser,
  repos: GithubRepo[],
  mergedPrs: GithubMergedPr[],
  mergedPrTotal: number,
  now: Date = new Date()
): BuilderProfile {
  const own = repos.filter((r) => !r.fork)
  const stars = own.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
  const forks = own.reduce((sum, r) => sum + (r.forks_count || 0), 0)

  const languageCounts = new Map<string, number>()
  for (const r of own) {
    if (r.language) languageCounts.set(r.language, (languageCounts.get(r.language) || 0) + 1)
  }
  const languages = [...languageCounts.entries()]
    .map(([name, count]) => ({ name, repos: count }))
    .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
    .slice(0, 8)

  const topRepos = [...own]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || (b.pushed_at || '').localeCompare(a.pushed_at || ''))
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      url: r.html_url,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      pushedAt: r.pushed_at,
    }))

  const byRepo = new Map<string, ProfileContribution>()
  const newestFirst = [...mergedPrs].sort((a, b) => (b.closed_at || '').localeCompare(a.closed_at || ''))
  for (const pr of newestFirst) {
    const repo = pr.repository_url.replace(`${GITHUB_API}/repos/`, '')
    const entry = byRepo.get(repo) || { repo, repoUrl: `https://github.com/${repo}`, mergedPrs: 0, latest: [] }
    entry.mergedPrs += 1
    if (entry.latest.length < 3) entry.latest.push({ title: pr.title, url: pr.html_url, mergedAt: pr.closed_at })
    byRepo.set(repo, entry)
  }
  const contributions = [...byRepo.values()].sort((a, b) => b.mergedPrs - a.mergedPrs || a.repo.localeCompare(b.repo))

  const accountYears = Math.max(
    0,
    Math.floor(((now.getTime() - new Date(user.created_at).getTime()) / (365.25 * 24 * 3600 * 1000)) * 10) / 10
  )

  const stats = {
    ownRepos: own.length,
    stars,
    forks,
    mergedExternalPrs: Math.max(mergedPrTotal, mergedPrs.length),
    externalRepos: contributions.length,
    accountYears,
  }
  const score = scoreProfile(stats, user.followers || 0)

  // Hash of the evidence the page shows, so a saved copy can be compared with a later one.
  const fingerprint = createHash('sha256')
    .update(
      canonicalize({
        githubId: user.id,
        login: user.login,
        stats: { ...stats, accountYears: Math.floor(accountYears) },
        repos: topRepos.map((r) => [r.url, r.stars]),
        prs: mergedPrs.map((p) => p.html_url).sort(),
      })
    )
    .digest('hex')

  return {
    login: user.login,
    githubId: user.id,
    name: user.name,
    avatarUrl: user.avatar_url,
    githubUrl: user.html_url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    website: normalizeWebsite(user.blog),
    followers: user.followers || 0,
    memberSince: user.created_at,
    stats,
    languages,
    topRepos,
    contributions,
    contributionsCapped: mergedPrTotal > mergedPrs.length,
    score,
    tier: getTier(score),
    fingerprint,
    generatedAt: now.toISOString(),
  }
}

export function normalizeWebsite(blog: string | null): string | null {
  if (!blog) return null
  const withScheme = /^https?:\/\//i.test(blog) ? blog : `https://${blog}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

async function githubGet(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PROVN-Builder-Profile',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return fetch(`${GITHUB_API}${path}`, { headers, cache: 'no-store' })
}

type FetchFailure = 'rate_limited' | 'unavailable'

function failureFor(res: Response): FetchFailure {
  return res.status === 403 || res.status === 429 ? 'rate_limited' : 'unavailable'
}

const PAGE_SIZE = 100
const MAX_REPO_PAGES = 30
// GitHub search never returns more than 1,000 results.
const MAX_PR_PAGES = 10

// Pages are fetched together in a stable order; dedupe covers a row that shifts pages mid-fetch.
async function fetchAllRepos(login: string, publicRepos: number): Promise<GithubRepo[] | FetchFailure> {
  const pages = Math.min(MAX_REPO_PAGES, Math.max(1, Math.ceil(publicRepos / PAGE_SIZE)))
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      githubGet(`/users/${login}/repos?per_page=${PAGE_SIZE}&type=owner&sort=full_name&page=${i + 1}`)
    )
  )
  const byName = new Map<string, GithubRepo>()
  for (const res of responses) {
    if (!res.ok) return failureFor(res)
    for (const repo of (await res.json()) as GithubRepo[]) byName.set(repo.full_name, repo)
  }
  return [...byName.values()]
}

async function fetchMergedPrs(
  query: string
): Promise<{ items: GithubMergedPr[]; total: number } | { reason: FetchFailure }> {
  const pageUrl = (page: number) =>
    `/search/issues?q=${query}&per_page=${PAGE_SIZE}&sort=created&order=desc&page=${page}`
  const first = await githubGet(pageUrl(1))
  if (!first.ok) return { reason: failureFor(first) }
  const firstBody = (await first.json()) as { total_count?: number; items?: GithubMergedPr[] }
  const total = firstBody.total_count || 0
  const byUrl = new Map<string, GithubMergedPr>()
  for (const pr of firstBody.items || []) byUrl.set(pr.html_url, pr)

  const pages = Math.min(MAX_PR_PAGES, Math.ceil(total / PAGE_SIZE))
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => githubGet(pageUrl(i + 2))))
  for (const res of rest) {
    if (!res.ok) return { reason: failureFor(res) }
    const body = (await res.json()) as { items?: GithubMergedPr[] }
    for (const pr of body.items || []) byUrl.set(pr.html_url, pr)
  }
  return { items: [...byUrl.values()], total }
}

export async function fetchBuilderProfile(login: string): Promise<ProfileResult> {
  if (!isValidGithubLogin(login)) return { ok: false, reason: 'invalid' }

  try {
    const userRes = await githubGet(`/users/${login}`)
    if (userRes.status === 404) return { ok: false, reason: 'not_found' }
    if (userRes.status === 403 || userRes.status === 429) return { ok: false, reason: 'rate_limited' }
    if (!userRes.ok) return { ok: false, reason: 'unavailable' }
    const user = (await userRes.json()) as GithubUser
    if (user.type && user.type !== 'User') return { ok: false, reason: 'not_found' }

    const query = encodeURIComponent(`author:${user.login} type:pr is:merged is:public -user:${user.login}`)
    const [repos, prs] = await Promise.all([fetchAllRepos(user.login, user.public_repos || 0), fetchMergedPrs(query)])
    // Missing evidence is a failure, never a zero: a wrong score would be cached and ranked.
    if (!Array.isArray(repos)) return { ok: false, reason: repos }
    if ('reason' in prs) return { ok: false, reason: prs.reason }
    const { items: mergedPrs, total: mergedPrTotal } = prs

    return { ok: true, profile: buildProfile(user, repos, mergedPrs, mergedPrTotal) }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
