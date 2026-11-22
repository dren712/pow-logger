import type { BuilderProfile } from './githubProfile'

export const SITE = 'https://provn-sol.vercel.app'

export const PROFILE_ERRORS: Record<string, { title: string; body: string }> = {
  invalid: { title: 'That is not a GitHub username', body: 'Usernames use letters, numbers and single hyphens, like torvalds.' },
  not_found: { title: 'No GitHub user with that name', body: 'Check the spelling. Organization accounts do not get profiles.' },
  rate_limited: { title: 'GitHub is busy right now', body: 'GitHub is limiting requests. Try again in a few minutes.' },
  unavailable: { title: 'GitHub could not be reached', body: 'Nothing was saved. Try again shortly.' },
}

export function formatMonth(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

// One factual sentence for the top of the résumé, built only from counted evidence.
export function profileSummary(p: BuilderProfile): string {
  const parts: string[] = []
  if (p.stats.mergedExternalPrs > 0) {
    parts.push(
      `${plural(p.stats.mergedExternalPrs, 'pull request')} merged into ${plural(p.stats.externalRepos, 'project')}${p.contributionsCapped ? ' or more' : ''} maintained by other people`
    )
  }
  if (p.stats.ownRepos > 0) {
    parts.push(
      `${plural(p.stats.ownRepos, 'public repository', 'public repositories')}${p.stats.stars > 0 ? ` with ${plural(p.stats.stars, 'star')}` : ''}`
    )
  }
  const since = `On GitHub since ${new Date(p.memberSince).getUTCFullYear()}.`
  if (parts.length === 0) return since
  const langs = p.languages.slice(0, 3).map((l) => l.name)
  const sentence = `${parts.join(', and ')}.`
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}${langs.length ? ` Works mostly in ${langs.join(', ')}.` : ''} ${since}`
}

const LANGUAGE_COLORS = ['#2ee59d', '#6cc4ff', '#c4a5ff', '#f5c451', '#ff8f6b', '#5eead4', '#f472b6', '#94a3b8']
export function languageColor(index: number): string {
  return LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]
}
