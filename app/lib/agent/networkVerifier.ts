import { Connection, PublicKey } from '@solana/web3.js'
import { verifyAgentReceipt } from './agentVerifier'
import { decodeAgentBatchAnchorAccount } from './solanaAgentAnchor'
import type { AgentReceipt, VerificationResult } from './types'

export async function verifyAgentReceiptNetwork(
  receipt: AgentReceipt,
  connection: Connection
): Promise<VerificationResult> {
  // 1. Run strict cryptographic offline verification first
  const result = verifyAgentReceipt(receipt)
  
  // If the basic crypto is broken, no point checking the network
  if (!result.verified) {
    return result
  }

  // 2. Network Phase: Solana Anchor
  if (receipt.solana) {
    try {
      const pda = new PublicKey(receipt.solana.pda)
      const accountInfo = await connection.getAccountInfo(pda)
      
      if (!accountInfo) {
        result.layers.solanaAnchor = 'NOT_FOUND'
        result.failures.push({
          type: 'SOLANA_ANCHOR_NOT_FOUND',
          eventSequence: null,
          eventId: null,
          message: `Anchor PDA account not found on Solana Devnet: ${receipt.solana.pda}`,
          expected: 'Account exists',
          computed: 'null'
        })
        result.verified = false
      } else {
        const decoded = decodeAgentBatchAnchorAccount(accountInfo.data)
        if (decoded.merkleRoot !== receipt.merkle.root) {
          result.layers.solanaAnchor = 'MISMATCH'
          result.failures.push({
            type: 'SOLANA_ANCHOR_MISMATCH',
            eventSequence: null,
            eventId: null,
            message: `Solana anchor root does not match receipt root`,
            expected: receipt.merkle.root,
            computed: decoded.merkleRoot
          })
          result.verified = false
        } else {
          // Officially verified on the blockchain
          result.layers.solanaAnchor = 'FOUND'
        }
      }
    } catch (err: unknown) {
      result.failures.push({
        type: 'SOLANA_ANCHOR_NOT_FOUND',
        eventSequence: null,
        eventId: null,
        message: `Failed to fetch Solana PDA: ${(err as Error).message || String(err)}`
      })
      result.verified = false
    }
  }

  // 3. Network Phase: Irys Archive
  if (receipt.irys) {
    try {
      const url = `https://devnet.irys.xyz/${receipt.irys.txId}`
      const response = await fetch(url)
      
      if (!response.ok) {
        result.layers.irysArchive = 'UNAVAILABLE'
        result.failures.push({
          type: 'IRYS_ARCHIVE_UNAVAILABLE',
          eventSequence: null,
          eventId: null,
          message: `Irys archive not found at ${url}`
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
            computed: data.merkle?.root
          })
          result.verified = false
        } else {
          result.layers.irysArchive = 'AVAILABLE'
        }
      }
    } catch (err: unknown) {
      result.failures.push({
        type: 'IRYS_ARCHIVE_UNAVAILABLE',
        eventSequence: null,
        eventId: null,
        message: `Failed to fetch from Irys: ${(err as Error).message || String(err)}`
      })
      result.verified = false
    }
  }

  return result
}
