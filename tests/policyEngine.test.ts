import assert from 'assert'
import { ProvnAgent } from '../app/lib/agent/provnClient'
import { verifyAgentReceipt } from '../app/lib/agent/agentVerifier'
import {
  evaluateExecutionPolicy,
  SECURE_CODING_AGENT_POLICY,
  READ_ONLY_AUDITOR_POLICY,
  STRICT_ZERO_TRUST_POLICY,
} from '../app/lib/agent/agentPolicyEngine'

console.log('Testing PROVN Layer 3: Deterministic Policy & Audit Engine...')

async function runTests() {
  const agent = new ProvnAgent({ agentName: 'TestAgent-01' })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Benign Workflow Compliant with SECURE_CODING_AGENT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  1. Evaluating benign agent execution...')
  const benignSession = await agent.startSession({ taskDescription: 'Build feature branch' })
  await benignSession.record('file.read', { type: 'file.read', path: 'src/index.ts', sizeBytes: 1024 })
  await benignSession.record('file.write', { type: 'file.write', path: 'src/components/Button.tsx', operation: 'create', sizeBytes: 256 })
  await benignSession.record('shell.execute', { type: 'shell.execute', command: 'npm test', exitCode: 0 })
  await benignSession.record('tool.request', { type: 'tool.request', tool: 'github.create_pr', inputHash: 'a1b2c3' })
  const benignReceipt = await benignSession.seal('Feature completed successfully')

  // Verify cryptographic integrity
  const benignVerification = verifyAgentReceipt(benignReceipt)
  assert.strictEqual(benignVerification.verified, true, 'Benign receipt must be cryptographically valid')

  // Verify policy compliance
  const benignReport = evaluateExecutionPolicy(benignReceipt, SECURE_CODING_AGENT_POLICY)
  assert.strictEqual(benignReport.compliance, 'COMPLIANT', 'Benign execution must be COMPLIANT')
  assert.strictEqual(benignReport.overallRisk, 'LOW', 'Benign execution risk must be LOW')
  assert.strictEqual(benignReport.findings.length, 0, 'Benign execution must have 0 findings')
  console.log('     ✓ Benign execution passed: COMPLIANT, LOW risk (0 findings)')

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Hostile File Access (.env exfiltration)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  2. Evaluating hostile credential exfiltration (.env)...')
  const hostileFileSession = await agent.startSession({ taskDescription: 'Extract configs' })
  await hostileFileSession.record('file.read', { type: 'file.read', path: '.env.production', sizeBytes: 512 })
  const hostileFileReceipt = await hostileFileSession.seal('Config read')

  const hostileFileReport = evaluateExecutionPolicy(hostileFileReceipt, SECURE_CODING_AGENT_POLICY)
  assert.strictEqual(hostileFileReport.compliance, 'VIOLATION')
  assert.strictEqual(hostileFileReport.overallRisk, 'CRITICAL')
  assert.ok(hostileFileReport.findings.some(f => f.ruleId === 'RULE_FORBIDDEN_FILE_ACCESS'))
  console.log('     ✓ Sensitive file exfiltration caught: CRITICAL VIOLATION')

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Hostile Shell Command (`rm -rf /`)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  3. Evaluating catastrophic command execution (rm -rf /)...')
  const hostileCmdSession = await agent.startSession({ taskDescription: 'Disk cleanup' })
  await hostileCmdSession.record('shell.execute', { type: 'shell.execute', command: 'rm -rf /', exitCode: 0 })
  const hostileCmdReceipt = await hostileCmdSession.seal('Cleanup finished')

  const hostileCmdReport = evaluateExecutionPolicy(hostileCmdReceipt, SECURE_CODING_AGENT_POLICY)
  assert.strictEqual(hostileCmdReport.compliance, 'VIOLATION')
  assert.strictEqual(hostileCmdReport.overallRisk, 'CRITICAL')
  assert.ok(hostileCmdReport.riskScore >= 50)
  assert.ok(hostileCmdReport.findings.some(f => f.ruleId === 'RULE_FORBIDDEN_COMMAND_EXECUTION'))
  console.log('     ✓ Destructive command caught: CRITICAL VIOLATION (risk score >= 50)')

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Unauthorized Production Tool Invocation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  4. Evaluating unauthorized tool invocation (prod.database.*)...')
  const hostileToolSession = await agent.startSession({ taskDescription: 'Database maintenance' })
  await hostileToolSession.record('tool.request', { type: 'tool.request', tool: 'prod.database.drop_all_tables', inputHash: 'deadbeef' })
  const hostileToolReceipt = await hostileToolSession.seal('Maintenance executed')

  const hostileToolReport = evaluateExecutionPolicy(hostileToolReceipt, SECURE_CODING_AGENT_POLICY)
  assert.strictEqual(hostileToolReport.compliance, 'VIOLATION')
  assert.strictEqual(hostileToolReport.overallRisk, 'CRITICAL')
  assert.ok(hostileToolReport.findings.some(f => f.ruleId === 'RULE_FORBIDDEN_TOOL_INVOCATION'))
  console.log('     ✓ Production tool invocation caught: CRITICAL VIOLATION')

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: READ_ONLY_AUDITOR Rejection of Mutations
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  5. Evaluating READ_ONLY_AUDITOR against write mutations...')
  const writeSession = await agent.startSession({ taskDescription: 'Write audit report' })
  await writeSession.record('file.write', { type: 'file.write', path: 'audit-report.md', operation: 'create', sizeBytes: 500 })
  const writeReceipt = await writeSession.seal('Report written')

  const readOnlyReport = evaluateExecutionPolicy(writeReceipt, READ_ONLY_AUDITOR_POLICY)
  assert.strictEqual(readOnlyReport.compliance, 'VIOLATION')
  assert.ok(readOnlyReport.findings.some(f => f.ruleId === 'RULE_DENIED_EVENT_TYPE'))
  console.log('     ✓ Read-only auditor successfully rejected write operation')

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: THE FOUNDATIONAL THESIS SEPARATION PROOF
  // Provenance ("What happened?") !== Audit ("Was it okay?")
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  6. Proving core architectural separation: Provenance VALID while Policy CRITICAL VIOLATION...')
  const attackSession = await agent.startSession({ taskDescription: 'Attack Scenario' })
  await attackSession.record('shell.execute', { type: 'shell.execute', command: 'rm -rf /', exitCode: 1 })
  await attackSession.record('tool.request', { type: 'tool.request', tool: 'prod.database.drop_all_tables', inputHash: '998877' })
  const attackReceipt = await attackSession.seal('Attack executed')

  // A. Cryptographic Provenance MUST BE 100% VALID!
  // Agent A signed it, chain links are monotonic, Merkle root matches.
  const cryptoVerification = verifyAgentReceipt(attackReceipt)
  assert.strictEqual(cryptoVerification.verified, true, 'Provenance must be VALID — the agent authentically signed the attack!')
  assert.strictEqual(cryptoVerification.layers.agentSignature, 'VALID')
  assert.strictEqual(cryptoVerification.layers.eventHash, 'VALID')
  assert.strictEqual(cryptoVerification.layers.hashChain, 'VALID')
  assert.strictEqual(cryptoVerification.layers.merkleRoot, 'VALID')

  // B. Policy Engine MUST FLAG IT AS A CRITICAL VIOLATION!
  const attackAudit = evaluateExecutionPolicy(attackReceipt, SECURE_CODING_AGENT_POLICY)
  assert.strictEqual(attackAudit.compliance, 'VIOLATION')
  assert.strictEqual(attackAudit.overallRisk, 'CRITICAL')
  assert.ok(attackAudit.findings.length >= 2)

  console.log('     ✓ PROOF COMPLETE:')
  console.log('       Cryptographic Provenance: VALID (Non-repudiable proof of action)')
  console.log('       Behavioral Audit Status : CRITICAL VIOLATION (Forbidden by policy)')
  console.log('       Risk Score              : ' + attackAudit.riskScore + '/100 (' + attackAudit.overallRisk + ')')

  console.log('\nAll Policy & Audit Engine tests passed successfully!')
}

runTests().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
