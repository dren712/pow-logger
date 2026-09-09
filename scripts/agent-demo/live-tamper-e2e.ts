/**
 * PROVN Track B — Autonomous Agent Live E2E & 4-Way Database Tampering Demo 🛡️🤖
 * Protocol Version: agent/1
 *
 * This entrypoint is preserved for backward compatibility with docs/GRANT_SCOPE_FREEZE.md.
 * It delegates directly to the unified, truthful demonstration engine in scripts/agent-demo/demo.ts.
 *
 * Run with: npx tsx scripts/agent-demo/live-tamper-e2e.ts
 */

import { runDemonstration } from './demo'

runDemonstration().catch((err) => {
  console.error('Fatal Demo Error:', err)
  process.exit(1)
})
