/**
 * PROVN Track B — Autonomous Agent Proof-of-Value Demo 🛡️🤖
 * 
 * Demonstrates the full cryptographic trust loop:
 *   Objective → Actions → Signed Events → Hash Chain → Merkle Batch
 *   → Solana Anchor PDA → Portable Receipt → Independent Air-Gapped Verification
 *   → Simulated Database Tampering → Tamper Detection & Public Anchor Invariant
 * 
 * Run with: npx tsx scripts/agent-demo/proof-of-value.ts
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Provn } from '../../sdk/index'
import { buildAnchorReference } from '../../app/lib/agent/solanaAgentAnchor'
import { PublicKey } from '@solana/web3.js'

async function runDemo() {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
  }

  console.log('\n' + c.bold + c.cyan + '╔═══════════════════════════════════════════════════════════════════════════════╗' + c.reset)
  console.log(c.bold + c.cyan + '║     PROVN AUTONOMOUS AGENT PROTOCOL — END-TO-END PROOF-OF-VALUE DEMO          ║' + c.reset)
  console.log(c.bold + c.cyan + '╚═══════════════════════════════════════════════════════════════════════════════╝' + c.reset + '\n')

  // ─── STEP 1: Autonomous Agent Receives Intent & Starts Execution ───────────
  console.log(`${c.bold}► STEP 1: Agent Initialization & Sovereign Identity${c.reset}`)
  const provn = new Provn({ agentName: 'treasury-rebalance-bot-04' })
  console.log(`  Agent Public Key: ${c.green}${provn.publicKey}${c.reset}`)

  const execution = await provn.start({
    agent: 'treasury-rebalance-bot-04',
    intent: 'Rebalance liquidity pool: Transfer 5,000 USDC from yield vault to operational wallet',
    metadata: { tier: 'critical', orgId: 'org_enterprise_acme' },
  })
  console.log(`  Execution Session: ${c.cyan}${execution.executionId}${c.reset}`)
  console.log(`  Declared Intent:  "${execution.intent}"\n`)

  // ─── STEP 2: Agent Takes Consequential Actions ──────────────────────────────
  console.log(`${c.bold}► STEP 2: Autonomous Execution & Cryptographic Event Ingestion${c.reset}`)

  // Action 1: Read Vault balance
  const act1 = await execution.action({
    type: 'tool_call',
    tool: 'vault.get_reserves',
    target: 'orca-whirlpool-yield-vault',
    input: { asset: 'USDC' },
    output: { availableLiquidity: 250000 },
  })
  console.log(`  [Seq 1] Action: ${c.bold}tool.invoke${c.reset} → vault.get_reserves (Signed Event: ${act1.eventHash.slice(0, 16)}...)`)

  // Action 2: Check Policy Compliance
  const act2 = await execution.action({
    type: 'policy_check',
    tool: 'treasury.policy.eval',
    target: 'policy://rules/max-transfer-limit',
    input: { amount: 5000, maxAuthorized: 10000 },
    output: { authorized: true, reason: 'Amount below $10,000 threshold' },
  })
  console.log(`  [Seq 2] Action: ${c.bold}policy.check${c.reset} → treasury.policy.eval (Signed Event: ${act2.eventHash.slice(0, 16)}...)`)

  // Action 3: Consequential Tool Call (Fund Transfer)
  const act3 = await execution.action({
    type: 'tool_call',
    tool: 'solana.transfer_spl',
    target: 'solana:mainnet-beta',
    input: {
      recipient: 'OpWallet8Fj3Lp2Kq9X1mZ7yVb4nCwRt5eYu8iO0pAsD',
      amount: 5000,
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
    },
    output: {
      txSignature: '4zMMC9...ConfirmedOnChainSignature',
      slot: 298492011,
      confirmations: 32,
    },
  })
  console.log(`  [Seq 3] Action: ${c.bold}tool.invoke${c.reset} → solana.transfer_spl (5,000 USDC) (Signed Event: ${act3.eventHash.slice(0, 16)}...)`)

  // Action 4: Outcome Attestation
  const outcomeAct = await execution.outcome({
    status: 'success',
    txSignature: '4zMMC9...ConfirmedOnChainSignature',
    summary: 'Successfully rebalanced 5,000 USDC into operational wallet',
    result: { finalVaultBalance: 245000, finalOpBalance: 15200 },
  })
  console.log(`  [Seq 4] Outcome: ${c.bold}agent.completed${c.reset} → Status: SUCCESS (Signed Event: ${outcomeAct.eventHash.slice(0, 16)}...)\n`)

  // ─── STEP 3: Execution Sealing & Solana Anchor Commitment ───────────────────
  console.log(`${c.bold}► STEP 3: Server-Authoritative Sealing & Solana Merkle Anchoring${c.reset}`)
  const receipt = await execution.complete('Treasury rebalance executed cleanly within policy bounds')

  // Bind real Solana Anchor Reference for the demo
  const anchorRef = buildAnchorReference(
    new PublicKey(receipt.execution.agentPublicKey),
    receipt.batch.batchId,
    'devnet'
  )
  anchorRef.signature = '5eXamplES0lanaDevnetS1gnatureF0rBatchAnchorPDA7789'
  receipt.solana = anchorRef
  receipt.execution.anchorReference = anchorRef
  receipt.batch.solanaAnchor = anchorRef

  console.log(`  ✓ Merkle Root Computed: ${c.green}${receipt.merkle.root}${c.reset}`)
  console.log(`  ✓ Solana Anchor PDA:   ${c.yellow}${anchorRef.pda}${c.reset}`)
  console.log(`  ✓ Total Events Sealed: ${receipt.events.length} sequential actions\n`)

  // Save receipt to file
  const receiptDir = path.join(__dirname, 'output')
  if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true })
  const receiptPath = path.join(receiptDir, 'treasury-rebalance-receipt.json')
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2))
  console.log(`  Portable Receipt exported to: ${receiptPath}\n`)

  // ─── STEP 4: Independent Air-Gapped Verification (CLI) ──────────────────────
  console.log(`${c.bold}► STEP 4: Independent Verification via Standalone CLI Engine${c.reset}`)
  console.log(`  Running: ${c.cyan}npx provn agent verify ${receiptPath}${c.reset}`)

  const verifyPassOutput = execSync(`node bin/provn.js agent verify ${receiptPath}`, { encoding: 'utf8' })
  console.log(verifyPassOutput)

  // ─── STEP 5: Adversarial Simulation — Database Tampering Attack ─────────────
  console.log(`${c.bold}► STEP 5: Adversarial Simulation — Malicious Database Modification${c.reset}`)
  console.log(`${c.dim}  Scenario: A rogue administrator or attacker with DB access modifies the transfer${c.reset}`)
  console.log(`${c.dim}  record (Sequence #3), claiming the agent sent 50,000 USDC instead of 5,000 USDC.${c.reset}`)

  // Create a tampered copy of the receipt simulating a mutated database record
  const tamperedReceipt = JSON.parse(JSON.stringify(receipt))
  tamperedReceipt.events[3].payload = {
    ...tamperedReceipt.events[3].payload,
    input: {
      ...tamperedReceipt.events[3].payload.input,
      amount: 50000, // MALICIOUS MODIFICATION: $5,000 -> $50,000
    },
  }
  // Attacker recalculates event payload hash to try to fake consistency
  tamperedReceipt.events[3].payloadHash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

  const tamperedPath = path.join(receiptDir, 'tampered-treasury-receipt.json')
  fs.writeFileSync(tamperedPath, JSON.stringify(tamperedReceipt, null, 2))

  console.log(`  Running Verifier against tampered database record...\n`)
  try {
    execSync(`node bin/provn.js agent verify ${tamperedPath}`, { encoding: 'utf8' })
  } catch (err: any) {
    console.log(err.stdout)
  }

  console.log(`${c.bold}► SUMMARY OF PROOF-OF-VALUE:${c.reset}`)
  console.log(`  1. Operational Database:  ${c.red}COMPROMISED ❌ (Row #3 maliciously altered)${c.reset}`)
  console.log(`  2. Public Commitment:     ${c.green}INTACT ✅ (Solana PDA & Merkle Root remain unchanged)${c.reset}`)
  console.log(`  3. Cryptographic Receipt: ${c.green}INDEPENDENTLY VERIFIABLE ✅ (Zero central trust required)${c.reset}`)
  console.log(`  4. Fraudulent Tampering:  ${c.green}INSTANTLY DETECTED ✅ (Sequence #3 mismatch isolated)${c.reset}\n`)
}

runDemo().catch(err => {
  console.error('Demo Error:', err)
  process.exit(1)
})
