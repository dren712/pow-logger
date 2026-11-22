import assert from 'assert'
import {
  buildProfile,
  getTier,
  isValidGithubLogin,
  normalizeWebsite,
  scoreProfile,
  type GithubMergedPr,
  type GithubRepo,
  type GithubUser,
} from '../app/lib/githubProfile'
import { toLeaderboardRow } from '../app/lib/builderLeaderboard'

console.log('Testing GitHub builder profile...')

const now = new Date('2026-11-22T00:00:00Z')
const user: GithubUser = {
  login: 'octo', id: 42, name: 'Octo Cat', avatar_url: 'https://avatars.githubusercontent.com/u/42',
  html_url: 'https://github.com/octo', bio: null, company: null, location: null, blog: 'octo.dev',
  followers: 120, public_repos: 3, created_at: '2020-11-22T00:00:00Z',
}
const repo = (name: string, stars: number, language: string | null, fork = false): GithubRepo => ({
  name, full_name: `octo/${name}`, html_url: `https://github.com/octo/${name}`, description: null, fork,
  stargazers_count: stars, forks_count: 1, language, pushed_at: '2026-01-01T00:00:00Z',
})
const pr = (repoName: string, n: number): GithubMergedPr => ({
  title: `Fix ${n}`, html_url: `https://github.com/${repoName}/pull/${n}`,
  repository_url: `https://api.github.com/repos/${repoName}`, closed_at: '2026-05-01T00:00:00Z',
})
const repos = [repo('a', 50, 'Rust'), repo('b', 5, 'TypeScript'), repo('c', 900, 'Rust', true), repo('d', 0, 'TypeScript'), repo('e', 1, 'TypeScript')]
const prs = [pr('solana-labs/solana', 1), pr('solana-labs/solana', 2), pr('vercel/next.js', 3)]

const profile = buildProfile(user, repos, prs, 7, now)

assert.strictEqual(profile.stats.ownRepos, 4, 'forks are not counted as own repos')
assert.strictEqual(profile.stats.stars, 56, 'stars on forks are not counted')
assert.strictEqual(profile.stats.mergedExternalPrs, 7, 'uses the search total when it exceeds the page')
assert.strictEqual(profile.stats.externalRepos, 2)
assert.ok(profile.stats.accountYears >= 5.9 && profile.stats.accountYears <= 6)
assert.deepStrictEqual(profile.contributions.map((c) => [c.repo, c.mergedPrs]), [['solana-labs/solana', 2], ['vercel/next.js', 1]])
assert.strictEqual(profile.contributions[0].repoUrl, 'https://github.com/solana-labs/solana')
assert.deepStrictEqual(profile.languages[0], { name: 'TypeScript', repos: 3 })
assert.strictEqual(profile.topRepos[0].name, 'a')
assert.strictEqual(profile.website, 'https://octo.dev/')
assert.ok(profile.score > 0 && profile.score <= 100)
assert.strictEqual(profile.tier, getTier(profile.score))
assert.match(profile.fingerprint, /^[0-9a-f]{64}$/)
console.log('  ✓ profile aggregation')

assert.strictEqual(buildProfile(user, repos, [...prs].reverse(), 7, now).fingerprint, profile.fingerprint, 'fingerprint ignores PR order')
assert.notStrictEqual(buildProfile(user, repos, prs.slice(1), 7, now).fingerprint, profile.fingerprint, 'fingerprint changes with evidence')
console.log('  ✓ fingerprint is deterministic and evidence-bound')

const empty = { ownRepos: 0, stars: 0, forks: 0, mergedExternalPrs: 0, externalRepos: 0, accountYears: 0 }
assert.strictEqual(scoreProfile(empty, 0), 0)
assert.strictEqual(scoreProfile({ ...empty, stars: 10_000_000 }, 0), 25, 'one metric cannot exceed its share')
assert.strictEqual(scoreProfile({ ownRepos: 1e6, stars: 1e9, forks: 0, mergedExternalPrs: 1e6, externalRepos: 1e6, accountYears: 99 }, 1e9), 100)
assert.ok(scoreProfile({ ...empty, mergedExternalPrs: 20 }, 0) > scoreProfile({ ...empty, mergedExternalPrs: 2 }, 0))
assert.deepStrictEqual([0, 20, 40, 60, 80].map(getTier), ['Starter', 'Builder', 'Shipper', 'Veteran', 'Legend'])
console.log('  ✓ scoring bounds and tiers')

for (const ok of ['a', 'octo-cat', 'A1', 'a'.repeat(39)]) assert.ok(isValidGithubLogin(ok), ok)
for (const bad of ['', '-a', 'a-', 'a--b', 'a/b', '../x', 'a b', 'a'.repeat(40), 'a?q=1']) assert.ok(!isValidGithubLogin(bad), bad)
assert.strictEqual(normalizeWebsite('javascript:alert(1)'), null)
assert.strictEqual(normalizeWebsite(''), null)
assert.strictEqual(normalizeWebsite('http://x.io'), 'http://x.io/')
console.log('  ✓ input validation')

const row = toLeaderboardRow(profile)
assert.strictEqual(row.github_id, 42)
assert.strictEqual(row.top_language, 'TypeScript')
assert.strictEqual(row.merged_external_prs, 7)
console.log('  ✓ leaderboard row mapping')

console.log('GitHub builder profile tests passed.')
