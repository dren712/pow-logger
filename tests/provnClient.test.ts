import assert from 'assert'
import { ProvnAgent } from '../app/lib/agent/provnClient'
import { verifyAgentReceipt } from '../app/lib/agent/agentVerifier'

console.log('Testing High-Level ProvnAgent Client...')

async function runTest() {
  const agent = new ProvnAgent({
    agentName: 'Claude 3.5 Sonnet'
  })

  assert.ok(agent.publicKey, 'Agent public key must be defined')
  assert.strictEqual(typeof agent.publicKey, 'string')

  const session = await agent.startSession({
    taskDescription: 'Run test pipeline'
  })

  assert.ok(session.executionId, 'Execution ID must be generated')
  assert.strictEqual(session.agentPublicKey, agent.publicKey)

  // Record actions
  const ev1 = await session.record('tool.request', {
    type: 'tool.request',
    tool: 'github.read',
    repo: 'test/repo',
    path: 'index.ts'
  })
  assert.strictEqual(ev1.sequence, 1)

  const ev2 = await session.record('shell.execute', {
    type: 'shell.execute',
    command: 'npm test',
    exitCode: 0
  })
  assert.strictEqual(ev2.sequence, 2)

  // Seal session
  const receiptWithUrl = await session.seal('All tests passed')
  assert.ok(receiptWithUrl.proofUrl.includes(receiptWithUrl.execution.executionId))
  assert.strictEqual(receiptWithUrl.events.length, 4) // agent.started + 2 actions + agent.completed
  assert.strictEqual(receiptWithUrl.version, 'agent/1')
  assert.strictEqual(receiptWithUrl.protocol, 'PROVN')

  // Independent verification
  const verification = verifyAgentReceipt(receiptWithUrl)
  assert.strictEqual(verification.verified, true, 'Receipt must be cryptographically verified')
  assert.strictEqual(verification.failures.length, 0)
  assert.strictEqual(verification.layers.agentSignature, 'VALID')
  assert.strictEqual(verification.layers.eventHash, 'VALID')
  assert.strictEqual(verification.layers.hashChain, 'VALID')
  assert.strictEqual(verification.layers.merkleRoot, 'VALID')

  console.log('✅ ProvnAgent client test passed: 100% cryptographically verified!')
}

runTest().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
