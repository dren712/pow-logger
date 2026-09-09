import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Provn, scanForSensitiveData, DEFAULT_GATEWAY_URL } from '../sdk/index'

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
    // ─── SUITE 1: Provn SDK Ergonomic Lifecycle ─────────────────────────
    console.log('► SUITE 1: Frictionless Developer SDK Lifecycle')
    assert.ok(DEFAULT_GATEWAY_URL, 'DEFAULT_GATEWAY_URL must be defined')
    const provn = new Provn({ agentName: 'autonomous-devops-01', gatewayUrl: '' })
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

    // Action 2: tool_call (maps to tool.request)
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

    // Action 4: outcome (decoupled to outcome.attestation)
    const ev4 = await execution.outcome({
      status: 'success',
      txSignature: '5VERiFiED...s1gNatUrE',
      prUrl: 'https://github.com/dren712/pow-logger/pull/42',
      summary: 'Staging deployment succeeded with 0 pod restarts',
    })
    assert.strictEqual(ev4.eventType, 'outcome.attestation')
    assert.strictEqual(ev4.sequence, 4)

    // Complete execution (emits terminal agent.completed)
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

    // Create tampered copy: mutate DB payload without altering payloadHash
    const tamperedReceipt = JSON.parse(JSON.stringify(receipt))
    tamperedReceipt.events[2].payload = {
      ...tamperedReceipt.events[2].payload,
      output: { podsCreated: 999 }, // Malicious DB alteration
    }
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

    // D. Verify tampered payload fails with exit code 1 and PAYLOAD_HASH_MISMATCH
    let tamperFailed = false
    try {
      execSync(`node bin/provn.js agent verify ${tamperedReceiptPath}`, { encoding: 'utf8' })
    } catch (err: any) {
      tamperFailed = true
      const out = err.stdout || ''
      assert.ok(out.includes('VERDICT: AGENT RECEIPT FAILED VERIFICATION'), 'Must report failed verification')
      assert.ok(out.includes('PAYLOAD_HASH_MISMATCH'), 'Must detect PAYLOAD_HASH_MISMATCH')
    }
    assert.ok(tamperFailed, 'CLI must exit with non-zero on tampered receipt')
    console.log('  ✓ [PASS] Stored payload tampering caught by CLI verifier (PAYLOAD_HASH_MISMATCH)\n')

    // ─── SUITE 3: Sensitive Data Scanner Guardrails ─────────────────────
    console.log('► SUITE 3: Sensitive Data Scanner Guardrails')
    assert.ok(scanForSensitiveData({ api_key: 'sk-1234567890abcdef' }) !== null, 'Should detect api_key')
    assert.ok(scanForSensitiveData({ password: 'supersecretpassword123' }) !== null, 'Should detect password')
    assert.ok(scanForSensitiveData({ safe: 'value', nested: { private_key: 'abc' } }) !== null, 'Should detect nested private_key')
    assert.strictEqual(scanForSensitiveData({ safe: 'value', hash: 'sha256:abc' }), null, 'Should pass safe payload')

    const strictProvn = new Provn({ agentName: 'privacy-guard-bot', gatewayUrl: '' })
    const strictExec = await strictProvn.start({ agent: 'privacy-guard-bot', intent: 'Privacy guardrail test' })

    let blocked = false
    try {
      await strictExec.action({
        type: 'tool.request',
        tool: 'api.caller',
        input: { api_key: 'sk-ant-live-secret-key-12345678' }
      })
    } catch (err: any) {
      blocked = true
      assert.ok(err.message.includes('SENSITIVE_DATA_DETECTED'), 'Must throw SENSITIVE_DATA_DETECTED')
    }
    assert.ok(blocked, 'Must block sensitive secret by default')

    // Allowed when allowRawSecrets is true
    const permissiveProvn = new Provn({ agentName: 'permissive-bot', gatewayUrl: '', allowRawSecrets: true })
    const permissiveExec = await permissiveProvn.start({ agent: 'permissive-bot', intent: 'Permissive test' })
    const allowedEvent = await permissiveExec.action({
      type: 'tool.request',
      tool: 'api.caller',
      input: { api_key: 'sk-permitted-secret' }
    })
    assert.strictEqual(allowedEvent.eventType, 'tool.request')
    console.log('  ✓ [PASS] Sensitive data scanner blocks secrets by default & allows when explicitly configured\n')

    // ─── SUITE 4: Multi-Agent Delegation & Execution Metadata ───────────
    console.log('► SUITE 4: Multi-Agent Delegation & Context Metadata')
    const delegatedProvn = new Provn({ agentName: 'sub-worker-agent', gatewayUrl: '' })
    const parentId = 'exec-parent-coordinator-999'
    const delegatedExec = await delegatedProvn.start({
      agent: 'sub-worker-agent',
      intent: 'Perform sub-task delegated by coordinator',
      parentExecutionId: parentId,
      metadata: { role: 'compiler', runId: 42 }
    })

    const delegatedReceipt = await delegatedExec.complete('Sub-task finished')
    assert.strictEqual(delegatedReceipt.execution.parentExecutionId, parentId, 'parentExecutionId must be set on execution')
    assert.strictEqual(delegatedReceipt.events[0].payload?.parentExecutionId, parentId, 'parentExecutionId must be committed in genesis event')
    assert.strictEqual((delegatedReceipt.execution.metadata as any)?.role, 'compiler', 'Metadata role must match')
    console.log('  ✓ [PASS] Multi-agent parentExecutionId and metadata forwarded and committed cleanly\n')

    // ─── SUITE 5: 11 Typed Action Helper Methods ────────────────────────
    console.log('► SUITE 5: Comprehensive 11 Typed Action Helper Methods')
    const typedProvn = new Provn({ agentName: 'typed-helpers-agent', gatewayUrl: '' })
    const tx = await typedProvn.start({ agent: 'typed-helpers-agent', intent: 'Test all 11 typed helper methods' })

    const h1 = await tx.toolRequest({ tool: 'sql.query', input: { query: 'SELECT 1' } })
    assert.strictEqual(h1.eventType, 'tool.request')
    assert.strictEqual(h1.sequence, 1)

    const h2 = await tx.toolResponse({ tool: 'sql.query', output: { rows: [1] }, durationMs: 15 })
    assert.strictEqual(h2.eventType, 'tool.response')
    assert.strictEqual(h2.sequence, 2)

    const h3 = await tx.fileRead({ path: 'src/main.ts', sizeBytes: 2048 })
    assert.strictEqual(h3.eventType, 'file.read')
    assert.strictEqual(h3.sequence, 3)

    const h4 = await tx.fileWrite({ path: 'src/main.ts', sizeBytes: 2100 })
    assert.strictEqual(h4.eventType, 'file.write')
    assert.strictEqual(h4.sequence, 4)

    const h5 = await tx.shell({ command: 'cargo build --release', exitCode: 0 })
    assert.strictEqual(h5.eventType, 'shell.execute')
    assert.strictEqual(h5.sequence, 5)

    const h6 = await tx.git({ operation: 'commit', commitHash: 'abcdef1234567890' })
    assert.strictEqual(h6.eventType, 'git.operation')
    assert.strictEqual(h6.sequence, 6)

    const h7 = await tx.deploymentRequest({ environment: 'production', releaseVersion: 'v2.1' })
    assert.strictEqual(h7.eventType, 'deployment.request')
    assert.strictEqual(h7.sequence, 7)

    const h8 = await tx.deploymentResult({ environment: 'production', status: 'success', deploymentUrl: 'https://app.provn.io' })
    assert.strictEqual(h8.eventType, 'deployment.result')
    assert.strictEqual(h8.sequence, 8)

    const h9 = await tx.paymentIntent({ recipient: 'SolanaWalletAddress1111111111111111', amount: '1000' })
    assert.strictEqual(h9.eventType, 'payment.intent')
    assert.strictEqual(h9.sequence, 9)

    const h10 = await tx.paymentExecuted({ recipient: 'SolanaWalletAddress1111111111111111', amount: '1000', txSignature: '5TxSigSample' })
    assert.strictEqual(h10.eventType, 'payment.executed')
    assert.strictEqual(h10.sequence, 10)

    const h11 = await tx.contractInteraction({ programId: 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx', instruction: 'anchor_batch' })
    assert.strictEqual(h11.eventType, 'contract.interaction')
    assert.strictEqual(h11.sequence, 11)

    const typedReceipt = await tx.complete('All 11 typed helper methods verified')
    assert.strictEqual(typedReceipt.events.length, 13) // agent.started + 11 helpers + agent.completed
    console.log('  ✓ [PASS] All 11 typed action helpers recorded correct event types and unbroken sequences\n')

    console.log('═══════════════════════════════════════════════════════════════')
    console.log('   ALL PROVN v2.1 SDK & CLI TESTS PASSED (5/5 SUITES)           ')
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
