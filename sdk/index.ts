/**
 * @provn/sdk — Official TypeScript / JavaScript Client ($0 Free-Tier)
 *
 * Provides pure programmatic query & client-side cryptographic verification
 * for PROVN Proof-of-Work Protocol on Solana.
 */

import { verifyLogCryptographically } from '../app/lib/canonicalMessage'
import { BuilderReputation, PassportExport, ProofDetail } from '../app/lib/types'

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
   * Evaluates programmatic eligibility for an ecosystem bounty or grant requirement.
   */
  async checkBountyEligibility(
    wallet: string,
    requirements: {
      minStreak?: number
      minProofs?: number
      requiredSkills?: string[]
      requiredProtocols?: string[]
    }
  ): Promise<{ eligible: boolean; reasons: string[] }> {
    const rep = await this.getReputation(wallet)
    const reasons: string[] = []
    let eligible = true

    if (requirements.minStreak && rep.currentStreak < requirements.minStreak) {
      eligible = false
      reasons.push(`Streak requirement not met: ${rep.currentStreak}/${requirements.minStreak} days`)
    }

    if (requirements.minProofs && rep.totalProofs < requirements.minProofs) {
      eligible = false
      reasons.push(`Proof count requirement not met: ${rep.totalProofs}/${requirements.minProofs} proofs`)
    }

    if (requirements.requiredSkills && requirements.requiredSkills.length > 0) {
      const builderSkills = new Set(rep.skills.map((s) => s.name.toLowerCase()))
      for (const reqSkill of requirements.requiredSkills) {
        if (!builderSkills.has(reqSkill.toLowerCase())) {
          eligible = false
          reasons.push(`Missing required skill: #${reqSkill}`)
        }
      }
    }

    if (requirements.requiredProtocols && requirements.requiredProtocols.length > 0) {
      const builderProtos = new Set(rep.protocols.map((p) => p.name.toLowerCase()))
      for (const reqProto of requirements.requiredProtocols) {
        if (!builderProtos.has(reqProto.toLowerCase())) {
          eligible = false
          reasons.push(`Missing required protocol experience: ${reqProto}`)
        }
      }
    }

    return { eligible, reasons }
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
}
