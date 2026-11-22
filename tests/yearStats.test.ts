import assert from 'assert'
import { computeYearStats, monthName, type YearPr } from '../app/lib/yearStats'

console.log('Testing year stats...')
const pr = (id: number, mergedAt: string | null, repo = 'owner/a', language: string | null = 'TypeScript'): YearPr => ({ id, mergedAt, repo, language })
const stats = computeYearStats('octo', 2026, [
  pr(1, '2026-01-01T00:00:00Z'), pr(1, '2026-01-01T00:00:00Z'),
  pr(2, '2026-01-31T23:59:59Z'), pr(3, '2026-12-31T23:59:59Z', 'owner/b', 'Rust'),
  pr(4, '2025-12-31T23:59:59Z'), pr(5, '2027-01-01T00:00:00Z'), pr(6, null), pr(7, 'bad date'),
])
assert.strictEqual(stats.username, 'octo')
assert.strictEqual(stats.year, 2026)
assert.strictEqual(stats.mergedPrs, 3)
assert.strictEqual(stats.repos, 2)
assert.deepStrictEqual(stats.languages, [{ name: 'Rust', repos: 1 }, { name: 'TypeScript', repos: 1 }])
assert.deepStrictEqual(stats.bestMonth, { month: 1, mergedPrs: 2 })
assert.strictEqual(monthName(1), 'January')
const tied = computeYearStats('octo', 2026, [pr(1, '2026-04-01Z'), pr(2, '2026-02-01Z')])
assert.strictEqual(tied.bestMonth?.month, 2)
console.log('  ✓ year boundaries, deduplication, repository languages and best-month ties')
assert.deepStrictEqual(computeYearStats('octo', 2026, []), {
  username: 'octo', year: 2026, mergedPrs: 0, repos: 0, languages: [], bestMonth: null, tier: 'Starter',
})
assert.deepStrictEqual(computeYearStats('octo', 2026, [pr(1, null), pr(2, 'invalid')]).bestMonth, null)
assert.deepStrictEqual(computeYearStats('octo', 2026, [pr(1, '2026-01-01Z', 'a/b', null)]).languages, [])
assert.throws(() => computeYearStats('octo', NaN, []), RangeError)
assert.throws(() => computeYearStats('octo', 2026.5, []), RangeError)
assert.throws(() => computeYearStats('octo', 2000, []), RangeError)
assert.strictEqual(computeYearStats('octo', 2026, Array.from({ length: 200 }, (_, i) => pr(i, '2026-01-01Z'))).tier, 'Legend')
console.log('  ✓ empty evidence, missing languages, invalid years and tier')
console.log('Year stats tests passed.')
