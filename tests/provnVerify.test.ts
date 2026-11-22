import assert from 'assert'
import { ProvnVerify, evaluateMandate, verifyProvnVerifyReceipt, type AgentMandate } from '../sdk/index'
import { generateMandateDemoReceipt } from '../app/lib/agent/mandateDemo'
import { buildAnchorLink } from '../app/lib/agent/mandate'
import type { AgentReceipt } from '../app/lib/agent/types'

const mandate: AgentMandate = {
  mandateId: 'm-test',
  principal: 'treasury@test',
  spendLimit: { amount: '500.00', currency: 'USDC' },
  allowedActions: ['weather.lookup', 'mcp:search', 'x402.*'],
}
const at = '2026-11-23T00:00:00.000Z'
const pay = (amount: string, extra: Partial<{ currency: string; recipient: string }> = {}) => ({
  kind: 'payment' as const, action: 'x402.pay', amount, currency: extra.currency ?? 'USDC', recipient: extra.recipient ?? 'R1', at,
})

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}
const clone = (r: AgentReceipt): AgentReceipt => JSON.parse(JSON.stringify(r))

async function run() {
  console.log('► Mandate evaluation')
  await test('allows a payment within the limit', () => {
    const r = evaluateMandate(mandate, pay('120.00'))
    assert.strictEqual(r.decision, 'allow')
    assert.strictEqual(r.remainingAfter, '380.00')
  })
  await test('rejects $700 against a $500 mandate', () => {
    const r = evaluateMandate(mandate, pay('700.00'))
    assert.strictEqual(r.decision, 'reject')
    assert.match(r.reasons[0], /exceeds the remaining spend limit of 500.00 USDC/)
    assert.strictEqual(r.remainingAfter, '500.00')
  })
  await test('counts earlier spend against the limit', () => {
    assert.strictEqual(evaluateMandate(mandate, pay('400.00'), '120.00').decision, 'reject')
    assert.strictEqual(evaluateMandate(mandate, pay('380.00'), '120.00').decision, 'allow')
  })
  await test('uses exact decimal math (no float drift)', () => {
    const m = { ...mandate, spendLimit: { amount: '0.3', currency: 'USDC' } }
    assert.strictEqual(evaluateMandate(m, pay('0.1'), '0.2').decision, 'allow')
    assert.strictEqual(evaluateMandate(m, pay('0.000001'), '0.3').decision, 'reject')
  })
  await test('rejects actions, currencies, recipients and times outside the mandate', () => {
    assert.strictEqual(evaluateMandate(mandate, { kind: 'tool', action: 'shell.execute', at }).decision, 'reject')
    assert.strictEqual(evaluateMandate(mandate, { kind: 'tool', action: 'weather.lookup', at }).decision, 'allow')
    assert.strictEqual(evaluateMandate(mandate, pay('1.00', { currency: 'SOL' })).decision, 'reject')
    assert.strictEqual(evaluateMandate({ ...mandate, allowedRecipients: ['R2'] }, pay('1.00')).decision, 'reject')
    assert.strictEqual(evaluateMandate({ ...mandate, expiresAt: '2026-01-01T00:00:00.000Z' }, pay('1.00')).decision, 'reject')
  })
  await test('rejects malformed amounts', () => {
    assert.strictEqual(evaluateMandate(mandate, pay('-5')).decision, 'reject')
    assert.strictEqual(evaluateMandate(mandate, pay('1e3')).decision, 'reject')
  })

  console.log('► SDK receipts')
  let ran = 0
  const pv = await ProvnVerify.start({ intent: 'test', mandate, client: { gatewayUrl: '' } })
  const t = await pv.tool('weather.lookup', { city: 'Lisbon' }, ({ city }) => ({ city, tempC: 19 }))
  const m = await pv.mcp({ callTool: async ({ name }) => ({ ok: name }) }, 'search', { q: 'x402' })
  const ok = await pv.pay({ resource: 'r', payTo: 'R1', amount: '120.00', asset: 'USDC' }, async () => { ran++; return { txSignature: 'sig1' } })
  const over = await pv.pay({ resource: 'r', payTo: 'R1', amount: '700.00', asset: 'USDC' }, async () => { ran++; return { txSignature: 'sig2' } })
  const blocked = await pv.tool('shell.execute', {}, () => { ran += 100 })
  const receipt = await pv.complete()

  await test('runs allowed actions and skips rejected ones', () => {
    assert.deepStrictEqual(t.result, { city: 'Lisbon', tempC: 19 })
    assert.deepStrictEqual(m.result, { ok: 'search' })
    assert.strictEqual(ok.decision, 'allow')
    assert.strictEqual(over.decision, 'reject')
    assert.strictEqual(blocked.decision, 'reject')
    assert.strictEqual(ran, 1)
    assert.strictEqual(pv.spentSoFar, '120.00')
  })
  await test('still receipts the rejected $700 payment', () => {
    const rejected = receipt.events.find((e) => (e.payload as Record<string, unknown>).outcomeType === 'mandate.rejected')
    assert.ok(rejected)
    assert.strictEqual(receipt.events.filter((e) => e.eventType === 'payment.executed').length, 1)
  })
  await test('refuses non-devnet x402 networks', async () => {
    await assert.rejects(
      pv.pay({ resource: 'r', payTo: 'R1', amount: '1.00', asset: 'USDC', network: 'solana' as never }, async () => ({ txSignature: 'x' })),
      /UNSUPPORTED_NETWORK/
    )
  })

  await test('syncs every event to the gateway in order before finalizing', async () => {
    const calls: { url: string; body: { event?: { sequence: number } } }[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    try {
      const synced = await ProvnVerify.start({ intent: 'sync', mandate, client: { gatewayUrl: 'http://gw', apiKey: 'k' } })
      await synced.pay({ resource: 'r', payTo: 'R1', amount: '700.00', asset: 'USDC' }, async () => ({ txSignature: 's' }))
      const r = await synced.complete()
      const urls = calls.map((c) => c.url.replace('http://gw', ''))
      assert.strictEqual(urls[0], '/api/agent/execution')
      assert.strictEqual(urls[urls.length - 1], '/api/agent/finalize')
      const seqs = calls.filter((c) => c.body.event).map((c) => c.body.event!.sequence)
      assert.deepStrictEqual(seqs, r.events.map((e) => e.sequence))
    } finally {
      globalThis.fetch = realFetch
    }
  })

  await test('reserves budget so overlapping payments cannot overspend', async () => {
    const par = await ProvnVerify.start({ intent: 'parallel', mandate, client: { gatewayUrl: '' } })
    let calls = 0
    const slowPay = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return { txSignature: 's' } }
    const [a, b] = await Promise.all([
      par.pay({ resource: 'r', payTo: 'R1', amount: '300.00', asset: 'USDC' }, slowPay),
      par.pay({ resource: 'r', payTo: 'R1', amount: '300.00', asset: 'USDC' }, slowPay),
    ])
    assert.deepStrictEqual([a.decision, b.decision].sort(), ['allow', 'reject'])
    assert.strictEqual(calls, 1)
  })
  await test('receipts a payer failure and releases its budget', async () => {
    const f = await ProvnVerify.start({ intent: 'fail', mandate, client: { gatewayUrl: '' } })
    await assert.rejects(f.pay({ resource: 'r', payTo: 'R1', amount: '400.00', asset: 'USDC' }, async () => { throw new Error('declined') }), /declined/)
    assert.strictEqual(f.spentSoFar, '0.00')
    const report = verifyProvnVerifyReceipt(await f.complete())
    assert.strictEqual(report.verified, true, report.problems.join('\n'))
  })
  await test('verifies a rejection caused by a reservation that later failed', async () => {
    const r = await ProvnVerify.start({ intent: 'overlap', mandate, client: { gatewayUrl: '' } })
    const failing = async () => { await new Promise((res) => setTimeout(res, 10)); throw new Error('declined: bad secret token') }
    const [first, second] = await Promise.allSettled([
      r.pay({ resource: 'r', payTo: 'R1', amount: '400.00', asset: 'USDC' }, failing),
      r.pay({ resource: 'r', payTo: 'R1', amount: '200.00', asset: 'USDC' }, async () => ({ txSignature: 's' })),
    ])
    assert.strictEqual(first.status, 'rejected')
    assert.strictEqual(second.status === 'fulfilled' && second.value.decision, 'reject')
    const report = verifyProvnVerifyReceipt(await r.complete())
    assert.strictEqual(report.verified, true, report.problems.join('\n'))
    const row = report.actions.find((a) => a.amount === '200.00')!
    assert.strictEqual(row.recomputedDecision, 'reject')
    assert.ok(row.reasons.some((x) => /spend limit/.test(x)))
  })
  await test('flags a rejection that claims budget no pending payment held', async () => {
    const bad = await ProvnVerify.start({ intent: 'forged hold', mandate, client: { gatewayUrl: '' } })
    const exec = (bad as unknown as { execution: { action: (p: unknown) => Promise<{ payloadHash: string }> } }).execution
    await exec.action({
      type: 'payment.intent',
      metadata: { provnVerify: { actionId: 'f1', mandateHash: bad.mandateHash, request: pay('100.00'), decision: 'reject', reasons: ['held'], spentBefore: '450.00' } },
    })
    await exec.action({ type: 'outcome.attestation', metadata: { outcomeType: 'mandate.rejected', success: false, provnVerify: { actionId: 'f1', resultHash: null, evidenceHash: 'x' } } })
    const report = verifyProvnVerifyReceipt(await bad.complete())
    assert.strictEqual(report.checks.mandate, 'fail')
    assert.ok(report.problems.some((p) => /Recorded decision "reject"/.test(p)))
  })
  await test('completes with the default summary for a short intent', async () => {
    const r = await ProvnVerify.start({ intent: 'Rotate API keys', mandate, client: { gatewayUrl: '' } })
    assert.strictEqual(verifyProvnVerifyReceipt(await r.complete()).verified, true)
  })
  await test('rejects secrets in start metadata', async () => {
    await assert.rejects(ProvnVerify.start({ intent: 'x', mandate, metadata: { note: 'Bearer abcdefghijklmnopqrstuvwxyz' }, client: { gatewayUrl: '' } }), /SENSITIVE_DATA_DETECTED/)
  })

  console.log('► Receipt verification')
  await test('verifies a valid receipt end to end', () => {
    const report = verifyProvnVerifyReceipt(receipt)
    assert.strictEqual(report.verified, true, report.problems.join('\n'))
    assert.deepStrictEqual(report.checks, { signatures: 'pass', eventHashes: 'pass', hashChain: 'pass', merkleRoot: 'pass', mandate: 'pass', evidence: 'pass' })
    assert.strictEqual(report.actions.length, 5)
    assert.strictEqual(report.totalSpent, '120.00')
    const overAction = report.actions.find((a) => a.amount === '700.00')!
    assert.strictEqual(overAction.recomputedDecision, 'reject')
    assert.strictEqual(overAction.executed, false)
  })
  await test('verifies the server-generated demo receipt', async () => {
    assert.strictEqual(verifyProvnVerifyReceipt(await generateMandateDemoReceipt()).verified, true)
  })
  await test('detects a tampered mandate', () => {
    const r = clone(receipt)
    const meta = (r.events[0].payload as unknown as { metadata: { provnVerify: { mandate: AgentMandate } } }).metadata
    meta.provnVerify.mandate.spendLimit.amount = '5000.00'
    const report = verifyProvnVerifyReceipt(r)
    assert.strictEqual(report.verified, false)
    assert.strictEqual(report.checks.eventHashes, 'fail')
    assert.strictEqual(report.checks.mandate, 'fail')
  })
  await test('detects a tampered evidence hash', () => {
    const r = clone(receipt)
    const ev = r.events.find((e) => e.eventType === 'payment.executed')!
    ;(ev.payload as unknown as { provnVerify: { evidenceHash: string } }).provnVerify.evidenceHash = 'f'.repeat(64)
    const report = verifyProvnVerifyReceipt(r)
    assert.strictEqual(report.verified, false)
    assert.strictEqual(report.checks.evidence, 'fail')
  })
  await test('detects a broken signature', () => {
    const r = clone(receipt)
    r.events[2].signature = r.events[3].signature
    assert.strictEqual(verifyProvnVerifyReceipt(r).checks.signatures, 'fail')
  })
  await test('flags a mandate violation even when the agent signs it', async () => {
    // A dishonest agent records "allow" for an over-limit payment and signs it with its own key.
    const bad = await ProvnVerify.start({ intent: 'cheat', mandate, client: { gatewayUrl: '' } })
    const exec = (bad as unknown as { execution: { action: (p: unknown) => Promise<{ payloadHash: string }> } }).execution
    await exec.action({
      type: 'payment.intent',
      metadata: { provnVerify: { actionId: 'a1', mandateHash: bad.mandateHash, request: pay('700.00'), decision: 'allow', reasons: [], spentBefore: '0.00' } },
    })
    await exec.action({ type: 'payment.executed', metadata: { provnVerify: { actionId: 'a1', resultHash: null, evidenceHash: 'x' } } })
    const report = verifyProvnVerifyReceipt(await bad.complete())
    assert.strictEqual(report.checks.signatures, 'pass')
    assert.strictEqual(report.checks.mandate, 'fail')
    assert.ok(report.problems.some((p) => /rejected action was executed/.test(p)))
  })
  await test('flags executed payment terms that differ from the approved request', async () => {
    const bad = await ProvnVerify.start({ intent: 'swap', mandate, client: { gatewayUrl: '' } })
    const exec = (bad as unknown as { execution: { action: (p: unknown) => Promise<{ payloadHash: string }> } }).execution
    await exec.action({
      type: 'payment.intent',
      metadata: { provnVerify: { actionId: 'a1', mandateHash: bad.mandateHash, request: pay('10.00'), decision: 'allow', reasons: [], spentBefore: '0.00' } },
    })
    await exec.action({ type: 'payment.executed', metadata: { recipient: 'R1', amount: '450.00', asset: 'USDC', provnVerify: { actionId: 'a1', resultHash: null, evidenceHash: 'x' } } })
    const report = verifyProvnVerifyReceipt(await bad.complete())
    assert.strictEqual(report.checks.mandate, 'fail')
    assert.ok(report.problems.some((p) => /payment terms/.test(p)))
  })
  await test('flags mandate events whose payload was stripped', () => {
    const r = clone(receipt)
    const ev = r.events.find((e) => e.eventType === 'payment.intent')!
    delete (ev as { payload?: unknown }).payload
    const report = verifyProvnVerifyReceipt(r)
    assert.strictEqual(report.verified, false)
    assert.strictEqual(report.checks.mandate, 'fail')
  })
  await test('reports malformed events instead of throwing', () => {
    assert.strictEqual(verifyProvnVerifyReceipt({ events: { a: 1 } } as unknown as AgentReceipt).verified, false)
    assert.strictEqual(verifyProvnVerifyReceipt({ events: [null] } as unknown as AgentReceipt).verified, false)
  })
  await test('handles receipts without a mandate and garbage input', () => {
    assert.strictEqual(verifyProvnVerifyReceipt({} as AgentReceipt).verified, false)
    assert.strictEqual(verifyProvnVerifyReceipt({} as AgentReceipt).checks.mandate, 'absent')
  })
  await test('builds devnet explorer links for anchors', () => {
    const link = buildAnchorLink({ solana: { network: 'devnet', pda: 'Pda1', signature: 'Sig1' } } as AgentReceipt)!
    assert.strictEqual(link.accountUrl, 'https://explorer.solana.com/address/Pda1?cluster=devnet')
    assert.strictEqual(link.txUrl, 'https://explorer.solana.com/tx/Sig1?cluster=devnet')
    assert.strictEqual(buildAnchorLink({ solana: null } as AgentReceipt), null)
  })

  console.log(`\nPROVN Verify: ${passed} tests passed`)
}

run().catch((err) => {
  console.error('PROVN Verify test failure:', err)
  process.exit(1)
})
