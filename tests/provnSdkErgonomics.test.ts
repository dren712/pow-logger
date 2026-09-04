import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Provn } from '../sdk/index'

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║ PROVN v2.1 — DEVELOPER SDK & CLI CONFORMANCE SUITE           ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  const tempDir = path.join(__dirname, '../scratch-test-receipts')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const receiptPath = path.join(tempDir, 'valid-receipt.json')
  const tamperedReceiptPath = path.join(tempDir, 'tampered-receipt.json')

  try {
    // ─── SUITE 1: Provn SDK 4-Method Ergonomic Lifecycle ─────────────────
    console.log('► SUITE 1: Frictionless Developer SDK Lifecycle')
    const provn = new Provn({ agentName: 'autonomous-devops-01' })
    assert.ok(provn.publicKey, 'Provn instance must have public key')
    console.log(`  ✓ Agent Public Key: ${provn.publicKey}`)

    const execution = await provn.start({
      agent: 'autonomous-devops-01',
      intent: 'Deploy release v2.1.0 to staging and update config',
      metadata: { env: 'staging', priority: 'P1' },
    })

    assert.ok(execution.executionId, 'Execution must have executionId')
    assert.strictEqual(execution.intent, 'Deploy release v2.1.0 to staging and update config')
    console.log(`  ✓ Execution started: ${execution.executionId}`)

    // Action 1: file.read
    const ev1 = await execution.action({
      type: 'file_read',
      target: 'config/staging.json',
      metadata: { size: 1024 },
    })
    assert.strictEqual(ev1.eventType, 'file.read')
    assert.strictEqual(ev1.sequence, 1)

    // Action 2: tool_call (maps to tool.invoke)
    const ev2 = await execution.action({
      type: 'tool_call',
      tool: 'kubernetes.apply',
      target: 'staging-cluster-01',
      input: { manifest: 'k8s/deployment.yaml' },
      output: { podsCreated: 3 },
    })
    assert.strictEqual(ev2.eventType, 'tool.request')
    assert.strictEqual(ev2.sequence, 2)

    // Action 3: shell_exec (maps to shell.execute)
    const ev3 = await execution.action({
      type: 'shell_exec',
      tool: 'bash',
      target: 'staging-server',
      input: { command: 'kubectl rollout status deployment/web' },
      output: { exitCode: 0 },
    })
    assert.strictEqual(ev3.eventType, 'shell.execute')
    assert.strictEqual(ev3.sequence, 3)

    // Action 4: outcome
    const ev4 = await execution.outcome({
      status: 'success',
      txSignature: '5VERiFiED...s1gNatUrE',
      prUrl: 'https://github.com/dren712/pow-logger/pull/42',
      summary: 'Staging deployment succeeded with 0 pod restarts',
    })
    assert.strictEqual(ev4.eventType, 'agent.completed')
    assert.strictEqual(ev4.sequence, 4)

    // Complete execution
    const receipt = await execution.complete('Release v2.1.0 verification complete')
    assert.strictEqual(receipt.protocol, 'PROVN')
    assert.strictEqual(receipt.version, 'agent/1')
    assert.strictEqual(receipt.execution.status, 'completed')
    assert.strictEqual(receipt.events.length, 6) // agent.started + 4 actions + terminal agent.completed
    assert.ok(receipt.merkle.root, 'Receipt must have Merkle root')
    assert.strictEqual(receipt.merkle.proofs.length, 6)
    console.log(`  ✓ Execution sealed: Merkle Root = ${receipt.merkle.root.slice(0, 16)}...`)

    // Save receipts
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2))

    // Create tampered copy (tampering sequence #2 target)
    const tamperedReceipt = JSON.parse(JSON.stringify(receipt))
    tamperedReceipt.events[2].payloadHash = '0000000000000000000000000000000000000000000000000000000000000000'
    fs.writeFileSync(tamperedReceiptPath, JSON.stringify(tamperedReceipt, null, 2))

    console.log('  ✓ [PASS] SDK Lifecycle & Receipt Serialization\n')

    // ─── SUITE 2: Standalone CLI Verifier Execution ──────────────────────
    console.log('► SUITE 2: CLI Verifier (Air-Gapped)')

    // A. Verify valid receipt via CLI
    const verifyOutput = execSync(`node bin/provn.js agent verify ${receiptPath}`, { encoding: 'utf8' })
    assert.ok(verifyOutput.includes('VERDICT: AGENT RECEIPT CRYPTOGRAPHICALLY AUTHENTIC'), 'CLI must report authentic')
    assert.ok(verifyOutput.includes('[PASS ✓]'), 'Must pass verification layers')
    console.log('  ✓ [PASS] Valid receipt verified successfully via CLI')

    // B. Inspect valid receipt via CLI
    const inspectOutput = execSync(`node bin/provn.js agent inspect ${receiptPath}`, { encoding: 'utf8' })
    assert.ok(inspectOutput.includes('EXECUTION EVENT TIMELINE'), 'CLI must output timeline')
    assert.ok(inspectOutput.includes('kubernetes.apply'), 'CLI timeline must include recorded tool')
    console.log('  ✓ [PASS] Valid receipt inspected successfully via CLI')

    // C. Verify auto-detection with `provn verify <receiptPath>`
    const autoOutput = execSync(`node bin/provn.js verify ${receiptPath}`, { encoding: 'utf8' })
    assert.ok(autoOutput.includes('VERDICT: AGENT RECEIPT CRYPTOGRAPHICALLY AUTHENTIC'), 'Auto-detect must verify agent receipt')
    console.log('  ✓ [PASS] Polymorphic `provn verify <receipt.json>` auto-detected and passed')

    // D. Verify tampered receipt fails with exit code 1
    let tamperFailed = false
    try {
      execSync(`node bin/provn.js agent verify ${tamperedReceiptPath}`, { encoding: 'utf8' })
    } catch (err: any) {
      tamperFailed = true
      const out = err.stdout || ''
      assert.ok(out.includes('VERDICT: AGENT RECEIPT FAILED VERIFICATION'), 'Must report failed verification')
      assert.ok(out.includes('hash mismatch'), 'Must detect hash mismatch')
    }
    assert.ok(tamperFailed, 'CLI must exit with non-zero on tampered receipt')
    console.log('  ✓ [PASS] Tampered receipt caught by CLI verifier')

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('   ALL PROVN v2.1 SDK & CLI TESTS PASSED (2/2 SUITES)           ')
    console.log('═══════════════════════════════════════════════════════════════\n')
  } finally {
    // Cleanup scratch test files
    if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath)
    if (fs.existsSync(tamperedReceiptPath)) fs.unlinkSync(tamperedReceiptPath)
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
  }
}

runTests().catch(err => {
  console.error('Test Suite Failure:', err)
  process.exit(1)
})
