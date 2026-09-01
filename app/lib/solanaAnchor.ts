import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import crypto from 'crypto'

export const PROVN_PROGRAM_ID = new PublicKey('FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx')

/**
 * Derives the deterministic PDA for a PROVN Proof Anchor on Solana.
 * Seeds: [b"proof", authority.toBuffer(), proof_id.to_le_bytes(8)]
 */
export function deriveProofAnchorPda(
  authority: PublicKey,
  proofId: number | bigint,
  programId: PublicKey = PROVN_PROGRAM_ID
): [PublicKey, number] {
  const proofIdBuf = Buffer.alloc(8)
  proofIdBuf.writeBigUInt64LE(BigInt(proofId))

  return PublicKey.findProgramAddressSync(
    [Buffer.from('proof'), authority.toBuffer(), proofIdBuf],
    programId
  )
}

/**
 * Computes 8-byte Anchor instruction discriminator:
 * sha256("global:<ix_name>")[0..8]
 */
export function getAnchorInstructionDiscriminator(ixName: string): Buffer {
  const hash = crypto.createHash('sha256').update(`global:${ixName}`).digest()
  return hash.subarray(0, 8)
}

export interface AnchorProofParams {
  proofId: number | bigint
  authority: PublicKey
  payloadHash: string | Uint8Array // 32-byte hex string or bytes
  timestamp: string | number | Date
  protocolVersion?: number
  archiveTxId?: string | null
  programId?: PublicKey
}

/**
 * Builds a raw Solana TransactionInstruction to anchor a PROVN proof on-chain.
 */
export function buildAnchorProofInstruction(params: AnchorProofParams): TransactionInstruction {
  const {
    proofId,
    authority,
    payloadHash,
    timestamp,
    protocolVersion = 2,
    archiveTxId = null,
    programId = PROVN_PROGRAM_ID,
  } = params

  const [pda] = deriveProofAnchorPda(authority, proofId, programId)
  const discriminator = getAnchorInstructionDiscriminator('anchor_proof')

  // Convert payloadHash to 32 bytes
  let hashBytes: Buffer
  if (typeof payloadHash === 'string') {
    // If hex or base58 or string
    if (payloadHash.length === 64) {
      hashBytes = Buffer.from(payloadHash, 'hex')
    } else {
      hashBytes = Buffer.from(crypto.createHash('sha256').update(payloadHash).digest())
    }
  } else {
    hashBytes = Buffer.from(payloadHash)
  }

  if (hashBytes.length !== 32) {
    throw new Error(`payloadHash must be exactly 32 bytes (got ${hashBytes.length})`)
  }

  const proofIdBuf = Buffer.alloc(8)
  proofIdBuf.writeBigUInt64LE(BigInt(proofId))

  const timestampMs = new Date(timestamp).getTime()
  const timestampBuf = Buffer.alloc(8)
  timestampBuf.writeBigInt64LE(BigInt(Math.floor(timestampMs / 1000)))

  const versionBuf = Buffer.from([protocolVersion])

  // Optional string encoding: 1 byte (0 or 1) + 4 bytes len + string bytes
  let archiveBuf: Buffer
  if (archiveTxId) {
    const strBytes = Buffer.from(archiveTxId.trim(), 'utf-8')
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32LE(strBytes.length)
    archiveBuf = Buffer.concat([Buffer.from([1]), lenBuf, strBytes])
  } else {
    archiveBuf = Buffer.from([0])
  }

  const data = Buffer.concat([
    discriminator,
    proofIdBuf,
    hashBytes,
    timestampBuf,
    versionBuf,
    archiveBuf,
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

export interface DecodedProofAnchor {
  proofId: bigint
  authority: PublicKey
  payloadHash: string
  timestamp: number
  protocolVersion: number
  archiveTxId: string | null
  bump: number
}

/**
 * Decodes on-chain ProofAnchor account data.
 */
export function decodeProofAnchorAccount(data: Buffer | Uint8Array): DecodedProofAnchor {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (buf.length < 8 + 8 + 32 + 32 + 8 + 1 + 43 + 1) {
    throw new Error('Invalid account data length for ProofAnchor')
  }

  // Skip 8-byte discriminator
  let offset = 8
  const proofId = buf.readBigUInt64LE(offset)
  offset += 8

  const authority = new PublicKey(buf.subarray(offset, offset + 32))
  offset += 32

  const payloadHash = buf.subarray(offset, offset + 32).toString('hex')
  offset += 32

  const timestamp = Number(buf.readBigInt64LE(offset))
  offset += 8

  const protocolVersion = buf.readUInt8(offset)
  offset += 1

  const rawTxBytes = buf.subarray(offset, offset + 43)
  const nullIdx = rawTxBytes.indexOf(0)
  const end = nullIdx >= 0 ? nullIdx : 43
  const archiveTxId = end > 0 ? rawTxBytes.subarray(0, end).toString('utf-8') : null
  offset += 43

  const bump = buf.readUInt8(offset)

  return {
    proofId,
    authority,
    payloadHash,
    timestamp,
    protocolVersion,
    archiveTxId,
    bump,
  }
}
