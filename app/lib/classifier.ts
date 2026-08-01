/**
 * Rule-Based Log Classifier
 *
 * Zero-cost, zero-API-call classification of builder work logs.
 * Detects skills, protocols, and work category from log content
 * using keyword matching. Runs on every submission.
 *
 * Upgrade path: Swap this function with an AI classifier later
 * without changing the data schema or API contract.
 */

export interface LogClassification {
  skills: string[]
  protocols: string[]
  category: string
}

const SKILL_PATTERNS: [RegExp, string][] = [
  [/\b(typescript|\.tsx?|\.ts)\b/i, 'TypeScript'],
  [/\b(javascript|\.jsx?|\.js|node\.?js)\b/i, 'JavaScript'],
  [/\b(rust|cargo|anchor)\b/i, 'Rust'],
  [/\b(python|\.py|django|flask|fastapi)\b/i, 'Python'],
  [/\b(react|next\.?js|nextjs|vite)\b/i, 'React/Next.js'],
  [/\b(vue|nuxt)\b/i, 'Vue'],
  [/\b(svelte|sveltekit)\b/i, 'Svelte'],
  [/\b(sql|supabase|postgres|prisma|drizzle|database|db)\b/i, 'Database'],
  [/\b(css|tailwind|styling|sass|scss)\b/i, 'CSS'],
  [/\b(docker|kubernetes|k8s|ci\/cd|github.actions|devops)\b/i, 'DevOps'],
  [/\b(graphql|rest.api|api.route|endpoint)\b/i, 'API'],
  [/\b(solidity|evm|hardhat|foundry)\b/i, 'Solidity'],
  [/\b(move)\b/i, 'Move'],
  [/\b(swift|swiftui|ios)\b/i, 'Swift/iOS'],
  [/\b(kotlin|android)\b/i, 'Kotlin/Android'],
  [/\b(go|golang)\b/i, 'Go'],
]

const PROTOCOL_PATTERNS: [RegExp, string][] = [
  [/\b(bubblegum|cnft|compressed.nft)\b/i, 'Bubblegum'],
  [/\b(irys|arweave|bundlr)\b/i, 'Irys'],
  [/\b(jupiter|jup)\b/i, 'Jupiter'],
  [/\b(metaplex|candy.machine|umi)\b/i, 'Metaplex'],
  [/\b(solana|spl|sol)\b/i, 'Solana'],
  [/\b(ethereum|eth|erc)\b/i, 'Ethereum'],
  [/\b(ipfs|filecoin)\b/i, 'IPFS'],
  [/\b(superteam)\b/i, 'Superteam'],
  [/\b(raydium)\b/i, 'Raydium'],
  [/\b(marinade)\b/i, 'Marinade'],
  [/\b(orca)\b/i, 'Orca'],
  [/\b(phantom|backpack|solflare)\b/i, 'Wallet'],
  [/\b(helius)\b/i, 'Helius'],
  [/\b(tensor|magic.eden)\b/i, 'NFT Marketplace'],
]

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/\b(bug|fix|debug|patch|hotfix|error|issue|crash)\b/i, 'Debugging'],
  [/\b(deploy|ship|release|launch|publish|production|vercel|netlify)\b/i, 'Deployment'],
  [/\b(design|ui|ux|figma|wireframe|mockup|layout|responsive)\b/i, 'Design'],
  [/\b(research|study|learn|read|paper|docs|documentation)\b/i, 'Research'],
  [/\b(test|testing|jest|vitest|cypress|e2e|unit.test|spec)\b/i, 'Testing'],
  [/\b(refactor|clean.?up|optimize|perf|performance|improve)\b/i, 'Refactoring'],
  [/\b(security|auth|signature|encrypt|verify|audit)\b/i, 'Security'],
  [/\b(meeting|sync|standup|review|pr|code.review)\b/i, 'Collaboration'],
  [/\b(write|blog|article|content|tweet|thread)\b/i, 'Content'],
  [/\b(setup|config|install|init|scaffold|boilerplate)\b/i, 'Setup'],
]

/**
 * Classify a log entry by analyzing its content against known patterns.
 * Returns detected skills, protocols, and a single work category.
 */
export function classifyLog(content: string): LogClassification {
  const skills: string[] = []
  const protocols: string[] = []
  let category = 'Development' // default fallback

  for (const [pattern, label] of SKILL_PATTERNS) {
    if (pattern.test(content) && !skills.includes(label)) {
      skills.push(label)
    }
  }

  for (const [pattern, label] of PROTOCOL_PATTERNS) {
    if (pattern.test(content) && !protocols.includes(label)) {
      protocols.push(label)
    }
  }

  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(content)) {
      category = cat
      break // first match wins (patterns are priority-ordered)
    }
  }

  return { skills, protocols, category }
}
