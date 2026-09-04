import assert from 'assert'
import crypto from 'crypto'
import { canonicalize } from '../app/lib/agent/canonicalize'
import { computePayloadHash, buildCanonicalEventString, sha256 } from '../app/lib/agent/agentEvents'
import { DOMAIN_SEPARATION } from '../app/lib/agent/types'

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN PROTOCOL: CANONICALIZATION & TEST VECTOR CONFORMANCE    ║')
console.log('╚═══════════════════════════════════════════════════════════════╝\n')

interface VectorTestCase {
  name: string
  input: unknown
  expectedCanonical: string
  expectedSha256: string
}

function runCanonicalizationVectors() {
  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Primitive Canonicalization Test Vectors
  // ───────────────────────────────────────────────────────────────────────────
  console.log('► SUITE 1: Primitives & Numbers')

  const primitiveVectors: VectorTestCase[] = [
    {
      name: 'Null literal',
      input: null,
      expectedCanonical: 'null',
      expectedSha256: crypto.createHash('sha256').update('null', 'utf-8').digest('hex'),
    },
    {
      name: 'Boolean true',
      input: true,
      expectedCanonical: 'true',
      expectedSha256: crypto.createHash('sha256').update('true', 'utf-8').digest('hex'),
    },
    {
      name: 'Boolean false',
      input: false,
      expectedCanonical: 'false',
      expectedSha256: crypto.createHash('sha256').update('false', 'utf-8').digest('hex'),
    },
    {
      name: 'Integer zero',
      input: 0,
      expectedCanonical: '0',
      expectedSha256: crypto.createHash('sha256').update('0', 'utf-8').digest('hex'),
    },
    {
      name: 'Negative zero normalized to zero',
      input: -0,
      expectedCanonical: '0',
      expectedSha256: crypto.createHash('sha256').update('0', 'utf-8').digest('hex'),
    },
    {
      name: 'Positive integer',
      input: 42,
      expectedCanonical: '42',
      expectedSha256: crypto.createHash('sha256').update('42', 'utf-8').digest('hex'),
    },
    {
      name: 'Negative integer',
      input: -1337,
      expectedCanonical: '-1337',
      expectedSha256: crypto.createHash('sha256').update('-1337', 'utf-8').digest('hex'),
    },
    {
      name: 'Floating point number',
      input: 3.14159,
      expectedCanonical: '3.14159',
      expectedSha256: crypto.createHash('sha256').update('3.14159', 'utf-8').digest('hex'),
    },
  ]

  for (const vec of primitiveVectors) {
    const canonical = canonicalize(vec.input)
    assert.strictEqual(canonical, vec.expectedCanonical, `Canonical mismatch for ${vec.name}`)
    const hash = crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')
    assert.strictEqual(hash, vec.expectedSha256, `SHA-256 mismatch for ${vec.name}`)
    console.log(`  ✓ [PASS] ${vec.name}: ${canonical} → ${hash.slice(0, 16)}...`)
  }

  // Non-finite number rejection
  assert.throws(() => canonicalize(NaN), /Non-finite numbers/, 'NaN must throw')
  assert.throws(() => canonicalize(Infinity), /Non-finite numbers/, 'Infinity must throw')
  assert.throws(() => canonicalize(-Infinity), /Non-finite numbers/, '-Infinity must throw')
  console.log('  ✓ [PASS] Non-finite numbers (NaN, Infinity, -Infinity) strictly rejected')

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Strings, Escapes & UTF-8 Unicode
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 2: Strings, Escapes & Unicode')

  const stringVectors: VectorTestCase[] = [
    {
      name: 'Empty string',
      input: '',
      expectedCanonical: '""',
      expectedSha256: crypto.createHash('sha256').update('""', 'utf-8').digest('hex'),
    },
    {
      name: 'Simple ASCII',
      input: 'PROVN Agent Protocol v1',
      expectedCanonical: '"PROVN Agent Protocol v1"',
      expectedSha256: crypto.createHash('sha256').update('"PROVN Agent Protocol v1"', 'utf-8').digest('hex'),
    },
    {
      name: 'Control escapes (newline, tab, quote, backslash)',
      input: 'Line 1\nLine 2\t"quoted"\\path',
      expectedCanonical: '"Line 1\\nLine 2\\t\\"quoted\\"\\\\path"',
      expectedSha256: crypto.createHash('sha256').update('"Line 1\\nLine 2\\t\\"quoted\\"\\\\path"', 'utf-8').digest('hex'),
    },
    {
      name: 'Multilingual UTF-8 Unicode (Japanese, Arabic, Mathematical)',
      input: '検証済み • مُعتَمَد • ∑(x) = ∫ydx',
      expectedCanonical: '"検証済み • مُعتَمَد • ∑(x) = ∫ydx"',
      expectedSha256: crypto.createHash('sha256').update('"検証済み • مُعتَمَد • ∑(x) = ∫ydx"', 'utf-8').digest('hex'),
    },
    {
      name: 'Emojis (4-byte UTF-8 sequences)',
      input: '🤖⚡️🔐 Solana Agent',
      expectedCanonical: '"🤖⚡️🔐 Solana Agent"',
      expectedSha256: crypto.createHash('sha256').update('"🤖⚡️🔐 Solana Agent"', 'utf-8').digest('hex'),
    },
  ]

  for (const vec of stringVectors) {
    const canonical = canonicalize(vec.input)
    assert.strictEqual(canonical, vec.expectedCanonical, `Canonical mismatch for ${vec.name}`)
    const hash = crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')
    assert.strictEqual(hash, vec.expectedSha256, `SHA-256 mismatch for ${vec.name}`)
    console.log(`  ✓ [PASS] ${vec.name} → ${hash.slice(0, 16)}...`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Arrays & Nested Structures
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 3: Arrays & Nested Structures')

  const arrayVectors: VectorTestCase[] = [
    {
      name: 'Empty array',
      input: [],
      expectedCanonical: '[]',
      expectedSha256: crypto.createHash('sha256').update('[]', 'utf-8').digest('hex'),
    },
    {
      name: 'Mixed primitive array',
      input: [1, 'two', true, null, false],
      expectedCanonical: '[1,"two",true,null,false]',
      expectedSha256: crypto.createHash('sha256').update('[1,"two",true,null,false]', 'utf-8').digest('hex'),
    },
    {
      name: 'Array with undefined normalization to null',
      input: [1, undefined, 3],
      expectedCanonical: '[1,null,3]',
      expectedSha256: crypto.createHash('sha256').update('[1,null,3]', 'utf-8').digest('hex'),
    },
    {
      name: 'Nested array',
      input: [[1, 2], [3, [4, 5]]],
      expectedCanonical: '[[1,2],[3,[4,5]]]',
      expectedSha256: crypto.createHash('sha256').update('[[1,2],[3,[4,5]]]', 'utf-8').digest('hex'),
    },
  ]

  for (const vec of arrayVectors) {
    const canonical = canonicalize(vec.input)
    assert.strictEqual(canonical, vec.expectedCanonical, `Canonical mismatch for ${vec.name}`)
    const hash = crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex')
    assert.strictEqual(hash, vec.expectedSha256, `SHA-256 mismatch for ${vec.name}`)
    console.log(`  ✓ [PASS] ${vec.name} → ${canonical}`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Object Lexicographical Key Sorting Invariant
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 4: Object Lexicographical Sorting & Omissions')

  // Regardless of property insertion order, canonical string and hash must match identically
  const objAlpha = {
    zebra: 'last',
    alpha: 'first',
    middle: { z: 99, a: 11 },
    count: 10,
  }

  const objBravo = {
    count: 10,
    middle: { a: 11, z: 99 },
    alpha: 'first',
    zebra: 'last',
  }

  const canAlpha = canonicalize(objAlpha)
  const canBravo = canonicalize(objBravo)
  assert.strictEqual(canAlpha, '{"alpha":"first","count":10,"middle":{"a":11,"z":99},"zebra":"last"}')
  assert.strictEqual(canAlpha, canBravo, 'Key insertion order must not alter canonical serialization')

  const hashAlpha = crypto.createHash('sha256').update(canAlpha, 'utf-8').digest('hex')
  const hashBravo = crypto.createHash('sha256').update(canBravo, 'utf-8').digest('hex')
  assert.strictEqual(hashAlpha, hashBravo, 'Key insertion order must not alter SHA-256 hash')

  console.log(`  ✓ [PASS] Key sorting invariant: different insertion orders produce identical canonical output`)
  console.log(`    ${canAlpha}`)
  console.log(`    Hash: ${hashAlpha}`)

  // Omission of undefined properties in objects
  const objWithUndef = { a: 'kept', b: undefined, c: null }
  assert.strictEqual(canonicalize(objWithUndef), '{"a":"kept","c":null}')
  console.log('  ✓ [PASS] Undefined object properties are omitted from canonical output')

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Realistic Action Payload Vectors
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 5: Realistic Action Payloads')

  const actionPayload = {
    type: 'shell.execute' as const,
    command: 'git commit -m "feat(agent): verify proof"',
    exitCode: 0,
    stdoutHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  }

  const expectedPayloadCanonical =
    '{"command":"git commit -m \\"feat(agent): verify proof\\"","exitCode":0,"stdoutHash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","type":"shell.execute"}'
  
  const payloadCanonical = canonicalize(actionPayload)
  assert.strictEqual(payloadCanonical, expectedPayloadCanonical)
  
  const computedPayloadHash = computePayloadHash(actionPayload)
  const expectedHash = crypto.createHash('sha256').update(expectedPayloadCanonical, 'utf-8').digest('hex')
  assert.strictEqual(computedPayloadHash, expectedHash)
  console.log(`  ✓ [PASS] Real shell.execute payload canonicalized and hashed`)
  console.log(`    Hash: ${computedPayloadHash}`)

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: Line-Oriented Canonical Event String Specification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 6: 9-Line Canonical Event String')

  const eventParams = {
    executionId: '8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c',
    sequence: 0,
    agentPublicKey: '7hGWMUzXK5ELEmJutDw3B5yhtkWkcGkoXpeTdmSfNbVu',
    eventType: 'agent.started' as const,
    timestamp: '2026-09-04T12:00:00.000Z',
    parentEventId: null,
    previousEventHash: null,
    payloadHash: computedPayloadHash,
  }

  const canonicalEventString = buildCanonicalEventString(eventParams)
  const lines = canonicalEventString.split('\n')

  assert.strictEqual(lines.length, 9, 'Canonical event string must have exactly 9 lines')
  assert.strictEqual(lines[0], DOMAIN_SEPARATION.EVENT, 'Line 1 must be DOMAIN_SEPARATION.EVENT')
  assert.strictEqual(lines[1], `execution:${eventParams.executionId}`, 'Line 2 must be executionId')
  assert.strictEqual(lines[2], `sequence:${eventParams.sequence}`, 'Line 3 must be sequence')
  assert.strictEqual(lines[3], `agent:${eventParams.agentPublicKey}`, 'Line 4 must be agentPublicKey')
  assert.strictEqual(lines[4], `event_type:${eventParams.eventType}`, 'Line 5 must be eventType')
  assert.strictEqual(lines[5], `timestamp:${eventParams.timestamp}`, 'Line 6 must be timestamp')
  assert.strictEqual(lines[6], 'parent_event:none', 'Line 7 must be parent_event:none for null')
  assert.strictEqual(lines[7], 'previous_event_hash:none', 'Line 8 must be previous_event_hash:none for null')
  assert.strictEqual(lines[8], `payload_hash:${eventParams.payloadHash}`, 'Line 9 must be payload_hash')

  // Ensure no line has trailing whitespace
  for (let i = 0; i < lines.length; i++) {
    assert.strictEqual(lines[i], lines[i].trimEnd(), `Line ${i + 1} has trailing whitespace`)
  }

  const eventDigest = sha256(canonicalEventString)
  assert.strictEqual(eventDigest.length, 64, 'Event hash must be 64-char hex')
  console.log(`  ✓ [PASS] Exactly 9 lines without trailing whitespace`)
  console.log(`  ✓ [PASS] Event Hash: ${eventDigest}`)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('   CANONICALIZATION TEST VECTORS COMPLETE: ALL SUITES PASSED    ')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

runCanonicalizationVectors()
