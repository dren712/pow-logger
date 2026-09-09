/**
 * PROVN Agent Protocol — Solana Program ID Selection & Verification Test Suite
 *
 * Verifies that:
 * 1. The selected network strictly determines the authoritative program ID.
 * 2. A receipt-provided programId can NEVER override the authoritative value.
 * 3. Conflicting / malicious program IDs return `SOLANA_PROGRAM_ID_MISMATCH`.
 * 4. Missing program IDs default to the authoritative program ID and verify cleanly.
 * 5. Correct program IDs pass program ID validation.
 * 6. Account ownership and PDA derivations strictly use the authoritative program ID.
 *
 * RUN: npx tsx tests/solanaProgramIdSelection.test.ts
 */

import assert from 'node:assert'
import crypto from 'node:crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'
import {
  verifyAgentReceiptNetwork,
  AUTHORITATIVE_PROGRAM_IDS,
  getAuthoritativeProgramId,
} from '../app/lib/agent/networkVerifier'
import {
  deriveAgentBatchAnchorPda,
} from '../app/lib/agent/solanaAgentAnchor'
import { sha256 } from '../app/lib/agent/agentEvents'
import type { AgentReceipt, AnchorReference } from '../app/lib/agent/types'

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║ PROVN TRACK B: SOLANA PROGRAM-ID SELECTION & SECURITY SUITE   ║')
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
 * Builds simulated on-chain account data conforming to AgentBatchAnchor binary layout.
 */
function createMockAnchorAccountBuffer(opts: {
  batchId: string
  authority: PublicKey
  merkleRoot: string
  eventCount: number
  bump: number
}): Buffer {
  const discriminator = Buffer.alloc(8) // 8-byte Anchor discriminator
  const batchIdHashBuf = Buffer.from(sha256(opts.batchId), 'hex') // 32 bytes
  const authorityBuf = opts.authority.toBuffer() // 32 bytes
  const merkleRootBuf = Buffer.from(opts.merkleRoot, 'hex') // 32 bytes
  const eventCountBuf = Buffer.alloc(4)
  eventCountBuf.writeUInt32LE(opts.eventCount) // 4 bytes u32 LE
  const timestampBuf = Buffer.alloc(8)
  timestampBuf.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000))) // 8 bytes i64 LE
  const versionBuf = Buffer.from([1]) // 1 byte u8
  const bumpBuf = Buffer.from([opts.bump]) // 1 byte u8

  return Buffer.concat([
    discriminator,
    batchIdHashBuf,
    authorityBuf,
    merkleRootBuf,
    eventCountBuf,
    timestampBuf,
    versionBuf,
    bumpBuf,
  ])
}

/**
 * Creates a valid, cryptographically self-consistent base receipt.
 */
function createBaseTestReceipt(authorityKeypair: Keypair): {
  receipt: AgentReceipt
  pda: PublicKey
  bump: number
  programId: PublicKey
} {
  const agentKeypair = nacl.sign.keyPair()
  const runtime = new ProvnAgentRuntime(agentKeypair)

  const executionState = runtime.startExecution({
    taskDescription: 'Solana Program ID Selection Verification',
    agentName: 'program-id-sentinel-agent',
  })

  runtime.logAction(executionState, 'file.read', {
    path: 'anchor/config.json',
    sizeBytes: 256,
    contentHash: sha256('{"network": "devnet"}'),
  })

  const authoritativeProgramIdStr = AUTHORITATIVE_PROGRAM_IDS.devnet
  const authoritativeProgramId = new PublicKey(authoritativeProgramIdStr)
  const batchId = executionState.execution.executionId

  const [pda, bump] = deriveAgentBatchAnchorPda(
    authorityKeypair.publicKey,
    batchId,
    authoritativeProgramId
  )

  const anchorReference: AnchorReference = {
    network: 'devnet',
    programId: authoritativeProgramIdStr,
    pda: pda.toBase58(),
    signature: '5xMockSolanaSignatureFinalizedInSlot9999999',
  }

  const receipt = runtime.finalizeExecution(
    executionState,
    'Execution Finalized with Anchor Reference',
    anchorReference
  )

  // Explicitly ensure batchId matches
  receipt.batch.batchId = batchId

  return { receipt, pda, bump, programId: authoritativeProgramId }
}

async function runProgramIdTests() {
  const authorityKeypair = Keypair.generate()

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Authoritative Program ID Resolution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('► SUITE 1: Authoritative Program ID Registry Resolution')

  assertPass(
    AUTHORITATIVE_PROGRAM_IDS.devnet === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'AUTHORITATIVE_PROGRAM_IDS.devnet matches expected authoritative program ID'
  )
  assertPass(
    AUTHORITATIVE_PROGRAM_IDS['mainnet-beta'] === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'AUTHORITATIVE_PROGRAM_IDS[mainnet-beta] matches expected authoritative program ID'
  )
  assertPass(
    getAuthoritativeProgramId('devnet') === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'getAuthoritativeProgramId("devnet") resolves correctly'
  )
  assertPass(
    getAuthoritativeProgramId('mainnet-beta') === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'getAuthoritativeProgramId("mainnet-beta") resolves correctly'
  )
  assertPass(
    getAuthoritativeProgramId('unknown-net') === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'Unknown network safely defaults to authoritative devnet program ID'
  )
  assertPass(
    getAuthoritativeProgramId(undefined) === 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
    'Undefined network safely defaults to authoritative devnet program ID'
  )

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Malicious Program ID in receipt.solana.programId Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 2: Malicious Program ID in receipt.solana.programId')

  {
    const { receipt, pda } = createBaseTestReceipt(authorityKeypair)
    const attackerProgramKeypair = Keypair.generate()
    const maliciousProgramId = attackerProgramKeypair.publicKey.toBase58()

    // Attacker injects rogue program ID into receipt.solana
    assert(receipt.solana !== null)
    receipt.solana.programId = maliciousProgramId

    let getAccountInfoCalled = false
    const mockConnection = {
      getAccountInfo: async () => {
        getAccountInfoCalled = true
        return null
      },
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(result.verified === false, 'Verification fails closed on malicious programId')
    assertPass(
      result.layers.solanaAnchor === 'MISMATCH',
      'solanaAnchor layer status marked MISMATCH'
    )
    assertPass(
      result.failures.some((f) => f.type === 'SOLANA_PROGRAM_ID_MISMATCH'),
      'Failure diagnostic contains SOLANA_PROGRAM_ID_MISMATCH'
    )

    const failure = result.failures.find((f) => f.type === 'SOLANA_PROGRAM_ID_MISMATCH')
    assertPass(
      failure?.expected === AUTHORITATIVE_PROGRAM_IDS.devnet,
      `Failure expected program ID matches authoritative value (${failure?.expected})`
    )
    assertPass(
      failure?.computed === maliciousProgramId,
      `Failure computed program ID reflects malicious value (${failure?.computed})`
    )
    assertPass(
      !getAccountInfoCalled,
      'Verifier aborts immediately without querying RPC on program ID mismatch'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Malicious Program ID in receipt.batch.solanaAnchor Rejected
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 3: Malicious Program ID in receipt.batch.solanaAnchor')

  {
    const { receipt } = createBaseTestReceipt(authorityKeypair)
    const attackerProgramKeypair = Keypair.generate()
    const maliciousProgramId = attackerProgramKeypair.publicKey.toBase58()

    // Attacker injects rogue program ID into batch.solanaAnchor
    assert(receipt.batch.solanaAnchor !== null)
    receipt.batch.solanaAnchor.programId = maliciousProgramId

    const mockConnection = {
      getAccountInfo: async () => null,
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(result.verified === false, 'Verification fails closed on batch anchor programId mismatch')
    assertPass(
      result.failures.some((f) => f.type === 'SOLANA_PROGRAM_ID_MISMATCH'),
      'Failure diagnostic contains SOLANA_PROGRAM_ID_MISMATCH for batch anchor'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Missing Program ID in receipt.solana.programId Handled Cleanly
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 4: Missing Program ID (Omitted / Undefined) Handled Cleanly')

  {
    const { receipt, bump } = createBaseTestReceipt(authorityKeypair)

    // Omit programId from receipt.solana
    assert(receipt.solana !== null)
    delete (receipt.solana as Record<string, unknown>).programId
    if (receipt.batch.solanaAnchor) {
      delete (receipt.batch.solanaAnchor as Record<string, unknown>).programId
    }

    const mockAccountBuffer = createMockAnchorAccountBuffer({
      batchId: receipt.batch.batchId,
      authority: authorityKeypair.publicKey,
      merkleRoot: receipt.merkle.root,
      eventCount: receipt.batch.eventCount,
      bump,
    })

    let queriedPda: PublicKey | null = null
    const mockConnection = {
      getAccountInfo: async (pda: PublicKey) => {
        queriedPda = pda
        return {
          data: mockAccountBuffer,
          owner: new PublicKey(AUTHORITATIVE_PROGRAM_IDS.devnet),
          executable: false,
          lamports: 1000000,
        }
      },
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(
      !result.failures.some((f) => f.type === 'SOLANA_PROGRAM_ID_MISMATCH'),
      'Missing programId does NOT trigger SOLANA_PROGRAM_ID_MISMATCH'
    )
    assertPass(
      result.layers.solanaAnchor === 'FOUND',
      'solanaAnchor layer status marked FOUND using authoritative program ID'
    )
    assertPass(result.verified === true, 'End-to-end receipt verification passes with missing programId')
    assertPass(
      queriedPda !== null && queriedPda.toBase58() === receipt.solana.pda,
      'Queried PDA matches declared PDA derived from authoritative program'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Correct Program ID Verifies Successfully
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 5: Correct Program ID Verification Flow')

  {
    const { receipt, bump } = createBaseTestReceipt(authorityKeypair)

    // receipt.solana.programId matches AUTHORITATIVE_PROGRAM_IDS.devnet
    assert(receipt.solana !== null)
    receipt.solana.programId = AUTHORITATIVE_PROGRAM_IDS.devnet

    const mockAccountBuffer = createMockAnchorAccountBuffer({
      batchId: receipt.batch.batchId,
      authority: authorityKeypair.publicKey,
      merkleRoot: receipt.merkle.root,
      eventCount: receipt.batch.eventCount,
      bump,
    })

    const mockConnection = {
      getAccountInfo: async () => ({
        data: mockAccountBuffer,
        owner: new PublicKey(AUTHORITATIVE_PROGRAM_IDS.devnet),
        executable: false,
        lamports: 1000000,
      }),
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(
      !result.failures.some((f) => f.type === 'SOLANA_PROGRAM_ID_MISMATCH'),
      'Correct programId does not produce SOLANA_PROGRAM_ID_MISMATCH'
    )
    assertPass(
      result.layers.solanaAnchor === 'FOUND',
      'solanaAnchor layer verified as FOUND'
    )
    assertPass(result.verified === true, 'Verification passes 100% with correct programId')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: Anti-Spoofing & Account Ownership Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 6: Anti-Spoofing (Account Owned by Rogue Program Rejected)')

  {
    const { receipt, bump } = createBaseTestReceipt(authorityKeypair)
    const attackerProgramKeypair = Keypair.generate()

    const mockAccountBuffer = createMockAnchorAccountBuffer({
      batchId: receipt.batch.batchId,
      authority: authorityKeypair.publicKey,
      merkleRoot: receipt.merkle.root,
      eventCount: receipt.batch.eventCount,
      bump,
    })

    // Account exists on-chain, but is owned by attacker's rogue program
    const mockConnection = {
      getAccountInfo: async () => ({
        data: mockAccountBuffer,
        owner: attackerProgramKeypair.publicKey, // Rogue program owner!
        executable: false,
        lamports: 1000000,
      }),
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(result.verified === false, 'Verification fails when account is owned by rogue program')
    assertPass(
      result.layers.solanaAnchor === 'MISMATCH',
      'solanaAnchor layer marked MISMATCH on account owner conflict'
    )
    assertPass(
      result.failures.some(
        (f) =>
          f.type === 'SOLANA_ANCHOR_MISMATCH' &&
          f.message.includes('Account owner mismatch')
      ),
      'Failure diagnostic specifically identifies Account owner mismatch against authoritative program'
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 7: PDA Derivation Strictly Uses Authoritative Program ID
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n► SUITE 7: PDA Derivation Invariant')

  {
    const { receipt, bump } = createBaseTestReceipt(authorityKeypair)
    const attackerProgramKeypair = Keypair.generate()

    // Attacker derives PDA using their own rogue program ID
    const [roguePda] = deriveAgentBatchAnchorPda(
      authorityKeypair.publicKey,
      receipt.batch.batchId,
      attackerProgramKeypair.publicKey
    )

    // Put rogue PDA into receipt.solana.pda
    assert(receipt.solana !== null)
    receipt.solana.pda = roguePda.toBase58()

    const mockAccountBuffer = createMockAnchorAccountBuffer({
      batchId: receipt.batch.batchId,
      authority: authorityKeypair.publicKey,
      merkleRoot: receipt.merkle.root,
      eventCount: receipt.batch.eventCount,
      bump,
    })

    // Suppose account exists and owner is spoofed to match authoritative
    const mockConnection = {
      getAccountInfo: async () => ({
        data: mockAccountBuffer,
        owner: new PublicKey(AUTHORITATIVE_PROGRAM_IDS.devnet),
        executable: false,
        lamports: 1000000,
      }),
    } as unknown as Connection

    const result = await verifyAgentReceiptNetwork(receipt, mockConnection)

    assertPass(result.verified === false, 'Rogue PDA fails verification')
    assertPass(
      result.failures.some(
        (f) =>
          f.type === 'SOLANA_ANCHOR_MISMATCH' &&
          f.message.includes('PDA derivation mismatch')
      ),
      'Verifier catches PDA derivation mismatch: expected authoritative PDA != declared rogue PDA'
    )
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`   SOLANA PROGRAM-ID SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runProgramIdTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
