/**
 * PROVN Agent Protocol — Solana Agent Batch Anchor Client
 * Protocol Version: agent/1
 *
 * Extends the existing PROVN Solana Anchor program architecture for
 * agent batch commitments. Uses a separate PDA namespace ("agent_batch")
 * to avoid collision with existing human proof anchors ("proof").
 *
 * PDA SEEDS: [b"agent_batch", authority.toBuffer(), batch_id_bytes(32)]
 *
 * The Solana commitment represents the Merkle root of a batch of agent events.
 * An independent verifier can obtain the on-chain PDA and compare the locally
 * reconstructed Merkle root against the committed value.
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import crypto from 'crypto'
import { PROVN_PROGRAM_ID } from '../solanaAnchor'
import type { AnchorReference } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives the deterministic PDA for a PROVN Agent Batch Anchor.
 * Seeds: [b"agent_batch", authority.toBuffer(), batch_id_sha256(32)]
 *
 * The batchId is hashed to a fixed 32-byte seed to ensure consistent
 * PDA derivation regardless of batchId string length.
 *
 * @param authority - The Solana public key of the anchor authority
 * @param batchId - The batch identifier string (UUID)
 * @param programId - The PROVN program ID (defaults to production)
 * @returns [PDA PublicKey, bump seed]
 */
export function deriveAgentBatchAnchorPda(
  authority: PublicKey,
  batchId: string,
  programId: PublicKey = PROVN_PROGRAM_ID
): [PublicKey, number] {
  // Hash batchId to a fixed 32-byte seed
  const batchIdSeed = crypto.createHash('sha256').update(batchId).digest()

  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent_batch'), authority.toBuffer(), batchIdSeed],
    programId
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentBatchAnchorParams {
  batchId: string
  authority: PublicKey
  merkleRoot: string        // 64-char hex string (32 bytes)
  eventCount: number
  timestamp: string | number | Date
  protocolVersion?: number
  programId?: PublicKey
}

/**
 * Computes the 8-byte Anchor instruction discriminator for a given instruction name.
 * discriminator = SHA256("global:<ix_name>")[0..8]
 */
function getDiscriminator(ixName: string): Buffer {
  return crypto.createHash('sha256').update(`global:${ixName}`).digest().subarray(0, 8)
}

/**
 * Builds a raw Solana TransactionInstruction to anchor an agent batch on-chain.
 *
 * This commits the Merkle root of a batch of agent events to Solana,
 * creating an immutable public reference that independent verifiers
 * can check against their locally reconstructed Merkle roots.
 */
export function buildAnchorAgentBatchInstruction(params: AgentBatchAnchorParams): TransactionInstruction {
  const {
    batchId,
    authority,
    merkleRoot,
    eventCount,
    timestamp,
    protocolVersion = 1,
    programId = PROVN_PROGRAM_ID,
  } = params

  const [pda] = deriveAgentBatchAnchorPda(authority, batchId, programId)
  const discriminator = getDiscriminator('anchor_agent_batch')

  // Encode batchId as 32-byte SHA256 hash
  const batchIdBytes = crypto.createHash('sha256').update(batchId).digest()

  // Encode merkleRoot as 32 bytes
  if (merkleRoot.length !== 64) {
    throw new Error(`merkleRoot must be a 64-character hex string (got ${merkleRoot.length})`)
  }
  const merkleRootBytes = Buffer.from(merkleRoot, 'hex')

  // Encode eventCount as u32 LE
  const eventCountBuf = Buffer.alloc(4)
  eventCountBuf.writeUInt32LE(eventCount)

  // Encode timestamp as i64 LE (Unix seconds)
  const timestampMs = new Date(timestamp).getTime()
  const timestampBuf = Buffer.alloc(8)
  timestampBuf.writeBigInt64LE(BigInt(Math.floor(timestampMs / 1000)))

  // Protocol version as u8
  const versionBuf = Buffer.from([protocolVersion])

  const data = Buffer.concat([
    discriminator,
    batchIdBytes,
    merkleRootBytes,
    eventCountBuf,
    timestampBuf,
    versionBuf,
  ])

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Decoding
// ─────────────────────────────────────────────────────────────────────────────

export interface DecodedAgentBatchAnchor {
  batchIdHash: string       // 32-byte hex (SHA256 of batchId)
  authority: PublicKey
  merkleRoot: string        // 32-byte hex
  eventCount: number
  timestamp: number         // Unix seconds
  protocolVersion: number
  bump: number
}

/**
 * Decodes on-chain AgentBatchAnchor account data.
 *
 * Account layout (after 8-byte discriminator):
 *   batch_id:         [u8; 32]   (32 bytes)
 *   authority:        Pubkey     (32 bytes)
 *   merkle_root:      [u8; 32]   (32 bytes)
 *   event_count:      u32        (4 bytes)
 *   timestamp:        i64        (8 bytes)
 *   protocol_version: u8         (1 byte)
 *   bump:             u8         (1 byte)
 *   Total: 8 + 32 + 32 + 32 + 4 + 8 + 1 + 1 = 118 bytes
 */
export function decodeAgentBatchAnchorAccount(data: Buffer | Uint8Array): DecodedAgentBatchAnchor {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const minLen = 8 + 32 + 32 + 32 + 4 + 8 + 1 + 1
  if (buf.length < minLen) {
    throw new Error(`Invalid account data length for AgentBatchAnchor: expected at least ${minLen}, got ${buf.length}`)
  }

  let offset = 8 // Skip discriminator

  const batchIdHash = buf.subarray(offset, offset + 32).toString('hex')
  offset += 32

  const authority = new PublicKey(buf.subarray(offset, offset + 32))
  offset += 32

  const merkleRoot = buf.subarray(offset, offset + 32).toString('hex')
  offset += 32

  const eventCount = buf.readUInt32LE(offset)
  offset += 4

  const timestamp = Number(buf.readBigInt64LE(offset))
  offset += 8

  const protocolVersion = buf.readUInt8(offset)
  offset += 1

  const bump = buf.readUInt8(offset)

  return {
    batchIdHash,
    authority,
    merkleRoot,
    eventCount,
    timestamp,
    protocolVersion,
    bump,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build AnchorReference from PDA derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an AnchorReference object for inclusion in receipts and batches.
 */
export function buildAnchorReference(
  authority: PublicKey,
  batchId: string,
  network: 'mainnet-beta' | 'devnet' | 'localnet' = 'devnet',
  programId: PublicKey = PROVN_PROGRAM_ID
): AnchorReference {
  const [pda] = deriveAgentBatchAnchorPda(authority, batchId, programId)

  return {
    network,
    signature: null, // Populated after actual Solana transaction
    pda: pda.toBase58(),
    programId: programId.toBase58(),
  }
}
