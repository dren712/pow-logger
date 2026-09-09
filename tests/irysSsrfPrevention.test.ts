/**
 * PROVN Agent Protocol — Irys SSRF Prevention & Network Gateway Test Suite
 *
 * Verifies that:
 * 1. Untrusted `receipt.irys.url` is NEVER used as a server-side fetch target.
 * 2. Gateway base URLs are derived exclusively from the authoritative network configuration.
 * 3. SSRF vectors (AWS metadata, localhost, internal IPs, attacker C2 domains) are strictly blocked.
 * 4. `receipt.irys.txId` is sanitized with encodeURIComponent to prevent path traversal.
 * 5. Missing or invalid `txId` fails closed without issuing any network request.
 * 6. Legitimate archive validation succeeds through the authoritative gateway.
 *
 * RUN: npx tsx tests/irysSsrfPrevention.test.ts
 */

import assert from 'node:assert'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Connection } from '@solana/web3.js'
import { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'
import {
  verifyAgentReceiptNetwork,
  AUTHORITATIVE_IRYS_GATEWAYS,
  getAuthoritativeIrysGateway,
} from '../app/lib/agent/networkVerifier'
import { sha256 } from '../app/lib/agent/agentEvents'
import type { AgentReceipt, IrysArchiveReference } from '../app/lib/agent/types'

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN TRACK B: IRYS SSRF VULNERABILITY PREVENTION TEST SUITE  ║')
console.log('╚═══════════════════════════════════════════════════════════════╝\n')

let passed = 0
let failed = 0

function assertPass(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${label}`)
    passed++
  } else {
    console.log(`  ✗ [FAIL] ${label}`)
    failed++
  }
}

/**
 * Creates a valid, cryptographically self-consistent base receipt for testing.
 */
function createBaseTestReceipt(): AgentReceipt {
  const agentKeypair = nacl.sign.keyPair()
  const runtime = new ProvnAgentRuntime(agentKeypair)

  const executionState = runtime.startExecution({
    taskDescription: 'SSRF Boundary Verification Execution',
    agentName: 'ssrf-guard-agent',
  })

  runtime.logAction(executionState, 'file.read', {
    path: 'safe/config.json',
    sizeBytes: 128,
    contentHash: sha256('{"safe": true}'),
  })

  const receipt = runtime.finalizeExecution(
    executionState,
    'SSRF Boundary Execution Finalized',
    null // no solana anchor required for pure Irys SSRF tests
  )

  return receipt
}

async function runSsrfPreventionTests() {
  const dummyConnection = {} as Connection // Receipt has no solana anchor, so connection is not invoked

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Authoritative Gateway Mapping Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log('► SUITE 1: Authoritative Network Gateway Resolution')

  assertPass(
    AUTHORITATIVE_IRYS_GATEWAYS.devnet === 'https://devnet.irys.xyz',
    'AUTHORITATIVE_IRYS_GATEWAYS.devnet is pinned to https://devnet.irys.xyz'
  )
  assertPass(
    AUTHORITATIVE_IRYS_GATEWAYS['mainnet-beta'] === 'https://gateway.irys.xyz',
    'AUTHORITATIVE_IRYS_GATEWAYS[mainnet-beta] is pinned to https://gateway.irys.xyz'
  )
  assertPass(
    getAuthoritativeIrysGateway('devnet') === 'https://devnet.irys.xyz',
    'getAuthoritativeIrysGateway("devnet") returns devnet gateway'
  )
  assertPass(
    getAuthoritativeIrysGateway('mainnet-beta') === 'https://gateway.irys.xyz',
    'getAuthoritativeIrysGateway("mainnet-beta") returns mainnet gateway'
  )
  assertPass(
    getAuthoritativeIrysGateway('unknown-net') === 'https://devnet.irys.xyz',
    'Unknown network safely falls back to devnet gateway'
  )
  assertPass(
    getAuthoritativeIrysGateway(undefined) === 'https://devnet.irys.xyz',
    'Undefined network safely falls back to devnet gateway'
  )

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: SSRF Attack Vectors via receipt.irys.url are Defeated
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 2: SSRF Prevention (Untrusted receipt.irys.url Ignored)')

  const originalFetch = globalThis.fetch

  // Test vector 1: AWS Instance Metadata Endpoint
  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: 'validIrysTx1234567890',
      timestamp: new Date().toISOString(),
      url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    }

    await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      !fetchedUrls.some((u) => u.includes('169.254.169.254')),
      'AWS metadata service (169.254.169.254) in receipt.irys.url was NEVER fetched'
    )
    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://devnet.irys.xyz/validIrysTx1234567890',
      `Fetch destination derived strictly from authoritative gateway: ${fetchedUrls[0]}`
    )
  }

  // Test vector 2: Localhost and Loopback Services
  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: 'tx-local-test-abc',
      timestamp: new Date().toISOString(),
      url: 'http://127.0.0.1:5432/internal-admin-query',
    }

    await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      !fetchedUrls.some((u) => u.includes('127.0.0.1') || u.includes('localhost')),
      'Localhost / loopback destination in receipt.irys.url was NEVER fetched'
    )
    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://devnet.irys.xyz/tx-local-test-abc',
      `Target URL strictly routed to devnet gateway: ${fetchedUrls[0]}`
    )
  }

  // Test vector 3: Attacker C2 Data Exfiltration Domain
  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: 'tx-c2-test-def',
      timestamp: new Date().toISOString(),
      url: 'https://attacker-controlled-c2.evil.com/exfiltrate-tokens',
    }

    await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      !fetchedUrls.some((u) => u.includes('attacker-controlled-c2.evil.com')),
      'Attacker C2 domain in receipt.irys.url was NEVER fetched'
    )
    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://devnet.irys.xyz/tx-c2-test-def',
      `Target URL routed exclusively to pinned gateway: ${fetchedUrls[0]}`
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Authoritative Gateway Network Derivation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 3: Network-Aware Gateway Selection')

  // Mainnet-beta selection via receipt.solana.network
  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.solana = {
      network: 'mainnet-beta',
      pda: '7xMockPdaForMainnetBeta11111111111111111111111',
      programId: 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
      signature: null,
    }
    receipt.irys = {
      txId: 'mainnetTx999',
      timestamp: new Date().toISOString(),
      url: 'https://evil.com/spoofed',
    }

    // Mock solana connection getAccountInfo returning null (anchor not found) to allow testing
    const mockSolanaConnection = {
      getAccountInfo: async () => null,
    } as unknown as Connection

    await verifyAgentReceiptNetwork(receipt, mockSolanaConnection)

    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://gateway.irys.xyz/mainnetTx999',
      `mainnet-beta network routes fetch to https://gateway.irys.xyz: ${fetchedUrls[0]}`
    )
  }

  // Fallback to receipt.batch.solanaAnchor.network
  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.solana = null
    receipt.batch.solanaAnchor = {
      network: 'mainnet-beta',
      pda: '7xMockPdaForMainnetBeta11111111111111111111111',
      programId: 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
      signature: null,
    }
    receipt.irys = {
      txId: 'mainnetBatchTx444',
      timestamp: new Date().toISOString(),
      url: 'http://internal.service.local:9090',
    }

    await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://gateway.irys.xyz/mainnetBatchTx444',
      `receipt.batch.solanaAnchor network routes fetch to mainnet gateway: ${fetchedUrls[0]}`
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Path Traversal & Identifier Sanitization
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 4: Path Traversal & txId Sanitization')

  {
    const fetchedUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: '../../etc/passwd',
      timestamp: new Date().toISOString(),
      url: 'https://attacker.com',
    }

    await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      fetchedUrls.length === 1 &&
        fetchedUrls[0] === 'https://devnet.irys.xyz/..%2F..%2Fetc%2Fpasswd',
      `txId with path traversal characters is safely encoded with encodeURIComponent: ${fetchedUrls[0]}`
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Missing or Invalid txId Fails Closed
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 5: Missing or Invalid txId Fails Closed')

  {
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response('OK', { status: 200 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: '',
      timestamp: new Date().toISOString(),
      url: 'https://devnet.irys.xyz/empty',
    }

    const result = await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(!fetchCalled, 'fetch is NEVER called when txId is empty string')
    assertPass(result.verified === false, 'Verification fails closed when txId is empty')
    assertPass(
      result.failures.some((f) => f.type === 'IRYS_ARCHIVE_UNAVAILABLE'),
      'Failure diagnostic correctly records IRYS_ARCHIVE_UNAVAILABLE'
    )
  }

  {
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response('OK', { status: 200 })
    }) as typeof fetch

    const receipt = createBaseTestReceipt()
    // Malformed receipt where txId is non-string
    receipt.irys = {
      txId: null as unknown as string,
      timestamp: new Date().toISOString(),
      url: 'https://devnet.irys.xyz/null',
    }

    const result = await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(!fetchCalled, 'fetch is NEVER called when txId is null')
    assertPass(result.verified === false, 'Verification fails closed when txId is null')
    assertPass(
      result.failures.some((f) => f.type === 'IRYS_ARCHIVE_UNAVAILABLE'),
      'Failure diagnostic correctly records IRYS_ARCHIVE_UNAVAILABLE'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: Legitimate End-to-End Archival Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 6: Authentic Archival Verification Flow')

  {
    const receipt = createBaseTestReceipt()
    receipt.irys = {
      txId: 'authenticTx777',
      timestamp: new Date().toISOString(),
      url: 'https://untrusted-display-url.xyz/ignored',
    }

    // Mock fetch returning the authentic events payload from the authoritative gateway
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://devnet.irys.xyz/authenticTx777') {
        return new Response(
          JSON.stringify({
            protocol: 'PROVN',
            version: 'agent/1',
            events: receipt.events,
            merkleRoot: receipt.merkle.root,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not Found', { status: 404 })
    }) as typeof fetch

    const result = await verifyAgentReceiptNetwork(receipt, dummyConnection)

    assertPass(
      result.layers.irysArchive === 'AVAILABLE',
      'Irys archive layer marked AVAILABLE when authoritative gateway returns authentic events'
    )
    assertPass(result.verified === true, 'End-to-end receipt verification passes')
  }

  // Restore original fetch
  globalThis.fetch = originalFetch

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`   IRYS SSRF TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runSsrfPreventionTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
