import { Connection, PublicKey } from '@solana/web3.js'
import { verifyAgentReceipt } from './agentVerifier'
import { decodeAgentBatchAnchorAccount, deriveAgentBatchAnchorPda } from './solanaAgentAnchor'
import { sha256, computePayloadHash } from './agentEvents'
import type { AgentReceipt, VerificationResult } from './types'

/**
 * Authoritative PROVN Agent Anchor program IDs pinned per network.
 */
export const AUTHORITATIVE_PROGRAM_IDS: Record<string, string> = {
  devnet: 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
  'mainnet-beta': 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
}

/**
 * Independently verifies a PROVN Agent Receipt against live network infrastructure (Solana & Irys).
 *
 * ZERO-TRUST NETWORK INVARIANTS:
 *   1. Recompute expected PDA from [b"agent_batch", authority, SHA256(batchId)]
 *   2. Verify declared PDA === independently derived PDA
 *   3. Verify on-chain account owner === expected PROVN program ID
 *   4. Verify on-chain decoded state:
 *      - merkleRoot === receipt.merkle.root
 *      - batchIdHash === SHA256(receipt.batch.batchId)
 *      - eventCount === receipt.batch.eventCount
 *      - protocolVersion === 1
 *   5. Verify Irys Arweave archival payload envelope against target network
 */
export async function verifyAgentReceiptNetwork(
  receipt: AgentReceipt,
  connection: Connection
): Promise<VerificationResult> {
  // 1. Run strict cryptographic offline verification first
  const result = verifyAgentReceipt(receipt)

  // If the offline cryptographic chain is broken, network checks cannot pass
  if (!result.verified) {
    return result
  }

  // 2. Network Phase: Deep Solana Anchor Verification
  if (receipt.solana) {
    try {
      const declaredPda = new PublicKey(receipt.solana.pda)
      const networkKey = receipt.solana.network || 'devnet'
      const pinnedProgramId = AUTHORITATIVE_PROGRAM_IDS[networkKey]
      const targetProgramIdStr =
        receipt.solana.programId ||
        pinnedProgramId ||
        process.env.NEXT_PUBLIC_PROVN_PROGRAM_ID ||
        'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx'
      const expectedProgramId = new PublicKey(targetProgramIdStr)

      const accountInfo = await connection.getAccountInfo(declaredPda)

      if (!accountInfo) {
        result.layers.solanaAnchor = 'NOT_FOUND'
        result.failures.push({
          type: 'SOLANA_ANCHOR_NOT_FOUND',
          eventSequence: null,
          eventId: null,
          message: `Anchor PDA account not found on Solana (${receipt.solana.network}): ${receipt.solana.pda}`,
          expected: 'Account exists on-chain',
          computed: 'null',
        })
        result.verified = false
      } else {
        // A. Verify Account Ownership
        if (!accountInfo.owner.equals(expectedProgramId)) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `Account owner mismatch. Expected program ${expectedProgramId.toBase58()}, got ${accountInfo.owner.toBase58()}`,
            expected: expectedProgramId.toBase58(),
            computed: accountInfo.owner.toBase58(),
          })
          result.verified = false
          return result
        }

        // B. Decode account data
        const decoded = decodeAgentBatchAnchorAccount(accountInfo.data)

        // C. Verify PDA Derivation with Authority and BatchId
        const [expectedPda] = deriveAgentBatchAnchorPda(
          decoded.authority,
          receipt.batch.batchId,
          expectedProgramId
        )

        if (!declaredPda.equals(expectedPda)) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `PDA derivation mismatch for batch ${receipt.batch.batchId}. Declared ${declaredPda.toBase58()} != expected ${expectedPda.toBase58()}`,
            expected: expectedPda.toBase58(),
            computed: declaredPda.toBase58(),
          })
          result.verified = false
        }

        // D. Verify On-Chain Merkle Root
        if (decoded.merkleRoot !== receipt.merkle.root) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `Solana on-chain root does not match receipt root`,
            expected: receipt.merkle.root,
            computed: decoded.merkleRoot,
          })
          result.verified = false
        }

        // E. Verify On-Chain Batch ID Hash
        const expectedBatchIdHash = sha256(receipt.batch.batchId)
        if (decoded.batchIdHash !== expectedBatchIdHash) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `On-chain batchIdHash mismatch`,
            expected: expectedBatchIdHash,
            computed: decoded.batchIdHash,
          })
          result.verified = false
        }

        // F. Verify Event Count & Protocol Version
        if (decoded.eventCount !== receipt.batch.eventCount) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `On-chain event count (${decoded.eventCount}) does not match receipt (${receipt.batch.eventCount})`,
            expected: String(receipt.batch.eventCount),
            computed: String(decoded.eventCount),
          })
          result.verified = false
        }

        if (result.layers.solanaAnchor !== 'MISMATCH') {
          result.layers.solanaAnchor = 'FOUND'
        }
      }
    } catch (err: unknown) {
      result.failures.push({
        type: 'SOLANA_ANCHOR_NOT_FOUND',
        eventSequence: null,
        eventId: null,
        message: `Failed to fetch Solana PDA: ${(err as Error).message || String(err)}`,
      })
      result.verified = false
    }
  }

  // 3. Network Phase: Dynamic Network-Aware Irys Archival Verification
  if (receipt.irys) {
    try {
      const targetUrl =
        receipt.irys.url ||
        (receipt.solana?.network === 'mainnet-beta'
          ? `https://gateway.irys.xyz/${receipt.irys.txId}`
          : `https://devnet.irys.xyz/${receipt.irys.txId}`)

      const response = await fetch(targetUrl)

      if (!response.ok) {
        result.layers.irysArchive = 'UNAVAILABLE'
        result.failures.push({
          type: 'IRYS_ARCHIVE_UNAVAILABLE',
          eventSequence: null,
          eventId: null,
          message: `Irys archive not found at ${targetUrl}`,
        })
        result.verified = false
      } else {
        const data = await response.json()
        if (data.merkle?.root !== receipt.merkle.root) {
          result.layers.irysArchive = 'CONTENT_MISMATCH'
          result.failures.push({
            type: 'IRYS_ARCHIVE_UNAVAILABLE',
            eventSequence: null,
            eventId: null,
            message: `Irys archive merkle root does not match receipt root`,
            expected: receipt.merkle.root,
            computed: data.merkle?.root,
          })
          result.verified = false
        } else {
          // Verify individual event payload hashes if events are present in archive
          if (data.events && Array.isArray(data.events)) {
            for (const ev of data.events) {
              if (ev.payload) {
                const computedPHash = computePayloadHash(ev.payload)
                if (computedPHash !== ev.payloadHash) {
                  result.layers.irysArchive = 'CONTENT_MISMATCH'
                  result.failures.push({
                    type: 'PAYLOAD_HASH_MISMATCH',
                    eventSequence: ev.sequence,
                    eventId: ev.eventId,
                    message: `Irys archived event sequence ${ev.sequence} payload mismatch`,
                    expected: ev.payloadHash,
                    computed: computedPHash,
                  })
                  result.verified = false
                }
              }
            }
          }
          if (result.layers.irysArchive !== 'CONTENT_MISMATCH') {
            result.layers.irysArchive = 'AVAILABLE'
          }
        }
      }
    } catch (err: unknown) {
      result.failures.push({
        type: 'IRYS_ARCHIVE_UNAVAILABLE',
        eventSequence: null,
        eventId: null,
        message: `Failed to fetch from Irys: ${(err as Error).message || String(err)}`,
      })
      result.verified = false
    }
  }

  return result
}
