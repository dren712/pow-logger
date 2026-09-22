/**
 * PROVN Track B — Autonomous Agent Proof-of-Value Demo
 * Protocol Version: agent/1
 *
 * This entrypoint is preserved for backward compatibility.
 * It delegates directly to the unified, truthful demonstration engine in scripts/agent-demo/demo.ts.
 *
 * Run with: npx tsx scripts/agent-demo/proof-of-value.ts
 */

import { runDemonstration } from './demo'

runDemonstration().catch((err) => {
  console.error('Fatal Demo Error:', err)
  process.exit(1)
})
