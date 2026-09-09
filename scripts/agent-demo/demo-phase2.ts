/**
 * PROVN Track B (Phase 2) — Real Infrastructure Tamper Demo
 * Protocol Version: agent/1
 *
 * This entrypoint is preserved for backward compatibility with app/agent-proof/page.tsx
 * and docs/GRANT_SCOPE_FREEZE.md. It delegates directly to the unified, truthful demonstration
 * engine in scripts/agent-demo/demo.ts.
 *
 * Run with: npx tsx scripts/agent-demo/demo-phase2.ts
 */

import { runDemonstration } from './demo'

runDemonstration().catch((err) => {
  console.error('Fatal Demo Error:', err)
  process.exit(1)
})
