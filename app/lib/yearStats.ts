import { getTier } from './githubProfile'

export interface YearPr {
  id: number
  mergedAt: string | null
  repo: string
  language: string | null
}

export function computeYearStats(username: string, year: number, prs: YearPr[]) {
  if (!Number.isInteger(year) || year < 2008 || year > 9999) throw new RangeError('Invalid year')
  const unique = new Map(prs.map(pr => [pr.id, pr]))
  const merged = [...unique.values()].filter(pr => {
    const date = new Date(pr.mergedAt || '')
    return Number.isFinite(date.getTime()) && date.getUTCFullYear() === year
  })
  const repos = new Map<string, string | null>()
  const months = Array<number>(12).fill(0)
  for (const pr of merged) {
    repos.set(pr.repo, pr.language)
    months[new Date(pr.mergedAt!).getUTCMonth()]++
  }
  const languages = new Map<string, number>()
  for (const language of repos.values()) {
    if (language) languages.set(language, (languages.get(language) || 0) + 1)
  }
  const score = Math.round(Math.min(100, Math.log10(1 + merged.length) / Math.log10(201) * 100))
  return {
    username, year, mergedPrs: merged.length, repos: repos.size,
    languages: [...languages].map(([name, repos]) => ({ name, repos }))
      .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name)).slice(0, 3),
    bestMonth: merged.length ? { month: months.indexOf(Math.max(...months)) + 1, mergedPrs: Math.max(...months) } : null,
    tier: getTier(score),
  }
}

export function monthName(month: number): string {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
}
