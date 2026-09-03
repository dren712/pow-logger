/**
 * @provn/sdk — Official TypeScript / JavaScript Client ($0 Free-Tier)
 *
 * Provides pure programmatic query & client-side cryptographic verification
 * for PROVN Proof-of-Work Protocol on Solana.
 */

import { verifyLogCryptographically, evaluateProofValidity, computeCanonicalProofHash } from '../app/lib/canonicalMessage'
import { evaluateEligibility } from '../app/lib/policyEngine'
import {
  deriveProofAnchorPda,
  buildAnchorProofInstruction,
  decodeProofAnchorAccount,
  PROVN_PROGRAM_ID,
  AnchorProofParams,
  DecodedProofAnchor,
} from '../app/lib/solanaAnchor'
import {
  BuilderReputation,
  PassportExport,
  ProofDetail,
  ProofPacket,
  EvidencePolicy,
  EligibilityEvaluation,
  ProofValidityReport,
} from '../app/lib/types'

export {
  deriveProofAnchorPda,
  buildAnchorProofInstruction,
  decodeProofAnchorAccount,
  PROVN_PROGRAM_ID,
  computeCanonicalProofHash,
}
export type { AnchorProofParams, DecodedProofAnchor }

// ─── Track B: Agent Protocol Exports ─────────────────────────────────────────

export { ProvnAgent, ProvnAgentSession } from '../app/lib/agent/provnClient'
export { ProvnAgentRuntime } from '../app/lib/agent/agentSdk'
export { verifyAgentReceipt, formatVerificationReport } from '../app/lib/agent/agentVerifier'
export { buildAgentReceipt, serializeReceipt, deserializeReceipt } from '../app/lib/agent/agentReceipt'
export { deriveAgentBatchAnchorPda, buildAnchorAgentBatchInstruction, buildAnchorReference } from '../app/lib/agent/solanaAgentAnchor'
export { buildMerkleTree, verifyMerkleProof, recomputeMerkleRoot } from '../app/lib/agent/merkleBatch'
export { createSignedEvent, verifyEventSignature, sha256, generateId } from '../app/lib/agent/agentEvents'
export { verifyHashChain } from '../app/lib/agent/hashChain'
export {
  AGENT_PROTOCOL_VERSION,
  DOMAIN_SEPARATION,
  AGENT_EVENT_TYPES,
} from '../app/lib/agent/types'
export type {
  AgentEvent,
  AgentExecution,
  AgentBatch,
  AgentReceipt,
  MerkleTree,
  MerkleInclusionProof,
  VerificationResult,
  TamperFailure,
  PayloadCommitment,
  AnchorReference,
  IrysArchiveReference,
} from '../app/lib/agent/types'

export interface ProvnClientOptions {
  baseUrl?: string
}

export class ProvnClient {
  private baseUrl: string

  constructor(options?: ProvnClientOptions) {
    this.baseUrl = options?.baseUrl || 'https://provn-sol.vercel.app'
  }

  /**
   * Fetches the complete Builder Passport for a Solana wallet.
   */
  async getPassport(wallet: string): Promise<PassportExport> {
    const res = await fetch(`${this.baseUrl}/api/passport/${wallet}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch passport for ${wallet}: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Fetches deterministic builder reputation metrics.
   */
  async getReputation(wallet: string): Promise<BuilderReputation> {
    const passport = await this.getPassport(wallet)
    return passport.reputation
  }

  /**
   * Fetches a single proof-of-work record by ID.
   */
  async getProof(proofId: number): Promise<ProofDetail> {
    const res = await fetch(`${this.baseUrl}/api/proof/${proofId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch proof #${proofId}: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Evaluates evidence policy eligibility via serverless API.
   */
  async checkEligibility(wallet: string, policy: EvidencePolicy): Promise<EligibilityEvaluation> {
    const res = await fetch(`${this.baseUrl}/api/eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, policy }),
    })
    if (!res.ok) {
      throw new Error(`Failed to evaluate eligibility for ${wallet}: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Generates a portable Proof Packet from a builder's Passport.
   */
  async getProofPacket(wallet: string): Promise<ProofPacket> {
    const passport = await this.getPassport(wallet)
    return ProvnClient.generateProofPacket(passport)
  }

  /**
   * Pure deterministic helper to construct a portable ProofPacket from a PassportExport.
   */
  static generateProofPacket(passport: PassportExport): ProofPacket {
    const { wallet, reputation, proofs } = passport
    const walletShort = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    
    // Select verified proofs with highest evidence quality
    const verifiedProofs = proofs.filter((p) => p.isCryptographicallyVerified)
    const sorted = [...verifiedProofs].sort((a, b) => {
      const aScore = (a.githubUrl ? 2 : 0) + ((a.archivalState === 'receipt_obtained' || a.archivalState === 'finalized') ? 2 : 0)
      const bScore = (b.githubUrl ? 2 : 0) + ((b.archivalState === 'receipt_obtained' || b.archivalState === 'finalized') ? 2 : 0)
      return bScore - aScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return {
      protocol: 'PROVN',
      version: '1.0',
      generatedAt: new Date().toISOString(),
      wallet,
      walletShort,
      reputationSummary: {
        verifiedProofs: reputation.verifiedProofs,
        recentVerifiedProofs: reputation.recentVerifiedProofs,
        currentStreak: reputation.currentStreak,
        builderLevel: `Level ${reputation.builderLevel.level} (${reputation.builderLevel.title})`,
        topSkills: reputation.skills.slice(0, 5).map((s) => s.name),
        topProtocols: reputation.protocols.slice(0, 5).map((p) => p.name),
      },
      proofs: sorted.slice(0, 10),
      verificationUrl: `https://provn-sol.vercel.app/u/${wallet}`,
      verificationInstructions: 'Verify each proof signature independently using TweetNaCl Ed25519 or via https://provn-sol.vercel.app/proof/<id>.',
    }
  }

  /**
   * Local deterministic policy evaluator without network call.
   */
  static evaluatePolicyLocally(reputation: BuilderReputation, policy: EvidencePolicy): EligibilityEvaluation {
    return evaluateEligibility(reputation, policy)
  }

  /**
   * Cryptographically verifies an Ed25519 proof signature locally in the browser/node environment.
   */
  static verifyProofLocally(proof: {
    walletAddress: string
    signature: string
    nonce: string
    timestamp: string
    content: string
    domain?: string
    githubUrl?: string
    evidenceUrl?: string
  }): boolean {
    return verifyLogCryptographically({
      wallet_address: proof.walletAddress,
      signature: proof.signature,
      nonce: proof.nonce,
      domain: proof.domain,
      created_at: proof.timestamp,
      content: proof.content,
      github_url: proof.githubUrl,
      evidence_url: proof.evidenceUrl,
    })
  }

  /**
   * Evaluates the complete 4-layer proof verification breakdown locally.
   */
  static evaluateProofValidityLocally(proof: {
    walletAddress: string
    signature?: string | null
    nonce?: string | null
    challenge?: string | null
    timestamp: string
    content: string
    domain?: string | null
    githubUrl?: string | null
    evidenceUrl?: string | null
    protocolVersion?: number
    provenanceLevel?: string | null
    archivalState?: string | null
    irysTxId?: string | null
  }): ProofValidityReport {
    return evaluateProofValidity({
      wallet_address: proof.walletAddress,
      signature: proof.signature,
      nonce: proof.nonce,
      challenge: proof.challenge,
      domain: proof.domain,
      created_at: proof.timestamp,
      content: proof.content,
      github_url: proof.githubUrl,
      evidence_url: proof.evidenceUrl,
      protocol_version: proof.protocolVersion,
      provenance_level: proof.provenanceLevel,
      archival_state: proof.archivalState,
      irys_tx_id: proof.irysTxId,
    })
  }
}
