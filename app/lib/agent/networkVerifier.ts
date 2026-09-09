import { Connection, PublicKey } from '@solana/web3.js'
import { verifyAgentReceipt } from './agentVerifier'
import { decodeAgentBatchAnchorAccount, deriveAgentBatchAnchorPda } from './solanaAgentAnchor'
import { sha256, computePayloadHash, recomputeEventHash, verifyEventSignature } from './agentEvents'
import { buildMerkleTree } from './merkleBatch'
import type { AgentReceipt, VerificationResult } from './types'

/**
 * Authoritative PROVN Agent Anchor program IDs pinned per network.
 */
export const AUTHORITATIVE_PROGRAM_IDS: Record<string, string> = {
  devnet: 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
  'mainnet-beta': 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
}

/**
 * Resolves the authoritative Solana program ID for a given network.
 * Defaults to devnet program ID if unconfigured or unrecognized.
 */
export function getAuthoritativeProgramId(network?: string): string {
  if (network && AUTHORITATIVE_PROGRAM_IDS[network]) {
    return AUTHORITATIVE_PROGRAM_IDS[network]
  }
  return AUTHORITATIVE_PROGRAM_IDS.devnet
}

/**
 * Authoritative Irys gateway base URLs pinned per network.
 * Untrusted URLs in receipts are strictly ignored to prevent SSRF attacks.
 */
export const AUTHORITATIVE_IRYS_GATEWAYS: Record<string, string> = {
  devnet: 'https://devnet.irys.xyz',
  'mainnet-beta': 'https://gateway.irys.xyz',
}

/**
 * Resolves the authoritative Irys gateway base URL for a given network.
 * Defaults to devnet gateway if unconfigured or unrecognized.
 */
export function getAuthoritativeIrysGateway(network?: string): string {
  if (network && AUTHORITATIVE_IRYS_GATEWAYS[network]) {
    return AUTHORITATIVE_IRYS_GATEWAYS[network]
  }
  return AUTHORITATIVE_IRYS_GATEWAYS.devnet
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

  let solanaOnChainRoot: string | null = null

  // 2. Network Phase: Deep Solana Anchor Verification
  if (receipt.solana) {
    try {
      const networkKey = receipt.solana.network || 'devnet'
      const authoritativeProgramIdStr = getAuthoritativeProgramId(networkKey)
      const expectedProgramId = new PublicKey(authoritativeProgramIdStr)

      // Security Invariant: The selected network strictly determines the authoritative program ID.
      // A receipt-provided programId must NEVER override this authoritative value.
      // If the receipt specifies a conflicting program ID, fail verification immediately.
      if (receipt.solana.programId && receipt.solana.programId !== authoritativeProgramIdStr) {
        result.layers.solanaAnchor = 'MISMATCH'
        result.failures.push({
          type: 'SOLANA_PROGRAM_ID_MISMATCH',
          eventSequence: null,
          eventId: null,
          message: `Solana program ID in receipt (${receipt.solana.programId}) does not match authoritative program ID (${authoritativeProgramIdStr}) for network '${networkKey}'`,
          expected: authoritativeProgramIdStr,
          computed: receipt.solana.programId,
        })
        result.verified = false
        return result
      }

      if (
        receipt.batch?.solanaAnchor?.programId &&
        receipt.batch.solanaAnchor.programId !== authoritativeProgramIdStr
      ) {
        result.layers.solanaAnchor = 'MISMATCH'
        result.failures.push({
          type: 'SOLANA_PROGRAM_ID_MISMATCH',
          eventSequence: null,
          eventId: null,
          message: `Solana program ID in batch anchor (${receipt.batch.solanaAnchor.programId}) does not match authoritative program ID (${authoritativeProgramIdStr}) for network '${networkKey}'`,
          expected: authoritativeProgramIdStr,
          computed: receipt.batch.solanaAnchor.programId,
        })
        result.verified = false
        return result
      }

      const declaredPda = new PublicKey(receipt.solana.pda)
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
      solanaOnChainRoot = decoded.merkleRoot
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
      if (!receipt.irys.txId || typeof receipt.irys.txId !== 'string') {
        result.layers.irysArchive = 'UNAVAILABLE'
        result.failures.push({
          type: 'IRYS_ARCHIVE_UNAVAILABLE',
          eventSequence: null,
          eventId: null,
          message: 'Irys archive reference missing valid txId',
        })
        result.verified = false
        return result
      }

      // Security Invariant (SSRF Prevention): receipt.irys.url is display metadata ONLY.
      // The server-side fetch destination is derived exclusively from the authoritative network gateway.
      const networkKey = receipt.solana?.network || receipt.batch?.solanaAnchor?.network || 'devnet'
      const gateway = getAuthoritativeIrysGateway(networkKey)
      const targetUrl = `${gateway}/${encodeURIComponent(receipt.irys.txId)}`

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
        if (!data || !data.events || !Array.isArray(data.events)) {
          result.layers.irysArchive = 'CONTENT_MISMATCH'
          result.failures.push({
            type: 'IRYS_ARCHIVE_UNAVAILABLE',
            eventSequence: null,
            eventId: null,
            message: `Irys archive payload is missing valid events array`,
          })
          result.verified = false
        } else {
          let irysEventsValid = true
          const archivedEventHashes: string[] = []

          // Independently verify each archived event
          for (const ev of data.events) {
            // Check payload integrity if payload object is present
            if (ev.payload) {
              const computedPHash = computePayloadHash(ev.payload)
              if (computedPHash !== ev.payloadHash) {
                irysEventsValid = false
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

            // Recompute canonical event hash
            const recomputedEHash = recomputeEventHash(ev)
            if (recomputedEHash !== ev.eventHash) {
              irysEventsValid = false
              result.layers.irysArchive = 'CONTENT_MISMATCH'
              result.failures.push({
                type: 'EVENT_HASH_MISMATCH',
                eventSequence: ev.sequence,
                eventId: ev.eventId,
                message: `Irys archived event sequence ${ev.sequence} canonical hash mismatch`,
                expected: ev.eventHash,
                computed: recomputedEHash,
              })
              result.verified = false
            }

            // Verify Ed25519 signature of archived event
            const isSigValid = verifyEventSignature(ev.eventHash, ev.signature, receipt.execution.agentPublicKey)
            if (!isSigValid) {
              irysEventsValid = false
              result.layers.irysArchive = 'CONTENT_MISMATCH'
              result.failures.push({
                type: 'SIGNATURE_INVALID',
                eventSequence: ev.sequence,
                eventId: ev.eventId,
                message: `Irys archived event sequence ${ev.sequence} Ed25519 signature invalid`,
              })
              result.verified = false
            }

            archivedEventHashes.push(ev.eventHash)
          }

          // Independently reconstruct Merkle root from downloaded events
          const reconstructedTree = buildMerkleTree(archivedEventHashes)
          const reconstructedRoot = reconstructedTree.root

          if (reconstructedRoot !== receipt.merkle.root) {
            irysEventsValid = false
            result.layers.irysArchive = 'CONTENT_MISMATCH'
            result.failures.push({
              type: 'MERKLE_ROOT_MISMATCH',
              eventSequence: null,
              eventId: null,
              message: `Irys reconstructed Merkle root does not match receipt Merkle root`,
              expected: receipt.merkle.root,
              computed: reconstructedRoot,
            })
            result.verified = false
          }

          // Cross-layer verification: Irys reconstructed root vs on-chain Solana PDA root
          if (solanaOnChainRoot && reconstructedRoot !== solanaOnChainRoot) {
            irysEventsValid = false
            result.layers.irysArchive = 'CONTENT_MISMATCH'
            result.failures.push({
              type: 'SOLANA_ANCHOR_MISMATCH',
              eventSequence: null,
              eventId: null,
              message: `Irys reconstructed Merkle root does not match on-chain Solana PDA root`,
              expected: solanaOnChainRoot,
              computed: reconstructedRoot,
            })
            result.verified = false
          }

          if (irysEventsValid && result.layers.irysArchive !== 'CONTENT_MISMATCH') {
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
