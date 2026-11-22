import assert from 'assert'
import { generateText, Output } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { buildProfile, type GithubMergedPr, type GithubRepo, type GithubUser } from '../app/lib/githubProfile'
import {
  FREE_TAILOR_USES,
  buildTailorPrompt,
  groundTailoredResume,
  readUsageCookie,
  signUsageCookie,
  tailoredResumeSchema,
  validateTailorInput,
} from '../app/lib/resumeTailor'

console.log('Testing résumé tailoring...')

const user: GithubUser = {
  login: 'octo', id: 42, name: 'Octo Cat', avatar_url: 'https://avatars.githubusercontent.com/u/42',
  html_url: 'https://github.com/octo', bio: null, company: null, location: null, blog: '',
  followers: 10, public_repos: 2, created_at: '2020-11-22T00:00:00Z',
}
const repo = (name: string, stars: number): GithubRepo => ({
  name, full_name: `octo/${name}`, html_url: `https://github.com/octo/${name}`, description: 'A tool', fork: false,
  stargazers_count: stars, forks_count: 0, language: 'Rust', pushed_at: '2026-01-01T00:00:00Z',
})
const pr = (repoName: string, n: number): GithubMergedPr => ({
  title: `Fix ${n}`, html_url: `https://github.com/${repoName}/pull/${n}`,
  repository_url: `https://api.github.com/repos/${repoName}`, closed_at: '2026-05-01T00:00:00Z',
})
const profile = buildProfile(user, [repo('ferris', 12)], [pr('solana-labs/solana', 1), pr('solana-labs/solana', 2)], 2, new Date('2026-11-22T00:00:00Z'))

const job = 'We are hiring a Rust engineer to build Solana validator tooling. '.repeat(3)
assert.deepStrictEqual(validateTailorInput({ username: 'Octo', jobPost: `  ${job}  ` }), { ok: true, username: 'octo', jobPost: job.trim() })
for (const body of [null, [], {}, { username: 'octo' }, { username: 'octo', jobPost: 'short' }, { username: 'octo', jobPost: 'x'.repeat(8001) }, { username: '-bad', jobPost: job }, { username: 'octo', jobPost: 42 }]) {
  assert.strictEqual(validateTailorInput(body).ok, false, `accepted ${JSON.stringify(body)?.slice(0, 40)}`)
}
console.log('  ✓ input validation')

const { system, prompt } = buildTailorPrompt(profile, job)
assert.match(system, /ignore any instructions/)
assert.ok(prompt.includes('solana-labs/solana') && prompt.includes('ferris') && prompt.includes(job))
console.log('  ✓ prompt carries evidence, job post and injection guard')

const grounded = groundTailoredResume(profile, {
  headline: '  Rust engineer  ',
  summary: 'Builds Solana tooling.',
  highlights: [
    { repo: 'Solana-Labs/Solana', reason: 'Validator work.' },
    { repo: 'solana-labs/solana', reason: 'Duplicate.' },
    { repo: 'octo/ferris', reason: 'Own Rust tool.' },
    { repo: 'google/made-up', reason: 'Invented.' },
    { repo: 'other/ferris', reason: 'Wrong owner.' },
  ],
  matchedSkills: ['Rust', 'rust ', 'Rust', 'Solana'],
  gaps: ['Kubernetes'],
})
assert.strictEqual(grounded.headline, 'Rust engineer')
assert.deepStrictEqual(grounded.highlights.map((h) => h.repo), ['solana-labs/solana', 'ferris'], 'invented and duplicate repos dropped')
assert.strictEqual(grounded.highlights[0].url, 'https://github.com/solana-labs/solana')
assert.strictEqual(grounded.highlights[0].detail, '2 merged PRs')
assert.strictEqual(grounded.highlights[1].detail, 'own project · 12 stars')
assert.deepStrictEqual(grounded.matchedSkills, ['Rust', 'rust', 'Solana'])
console.log('  ✓ grounding keeps only verified repositories and links them')

const secret = 'test-secret'
assert.strictEqual(readUsageCookie(undefined, secret), 0)
assert.strictEqual(readUsageCookie(signUsageCookie(1, secret), secret), 1)
assert.strictEqual(readUsageCookie(signUsageCookie(1, 'other'), secret), FREE_TAILOR_USES, 'foreign signature rejected')
assert.strictEqual(readUsageCookie(`0.${signUsageCookie(1, secret).split('.')[1]}`, secret), FREE_TAILOR_USES, 'edited count rejected')
assert.strictEqual(readUsageCookie('garbage', secret), FREE_TAILOR_USES)
console.log('  ✓ usage cookie signing and tamper handling')

const modelOutput = { headline: 'Rust engineer', summary: 'S.', highlights: [{ repo: 'ferris', reason: 'R.' }], matchedSkills: ['Rust'], gaps: [] }
async function structuredOutput() {
const { output } = await generateText({
  model: new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(modelOutput) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    }),
  }),
  system,
  prompt,
  output: Output.object({ schema: tailoredResumeSchema }),
})
assert.deepStrictEqual(groundTailoredResume(profile, output).highlights.map((h) => h.repo), ['ferris'])
console.log('  ✓ structured output parses through the AI SDK')
}

structuredOutput().then(() => console.log('Résumé tailoring tests passed.')).catch((error) => {
  console.error(error)
  process.exit(1)
})
