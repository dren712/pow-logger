/**
 * PROVN Protocol — Policy & Eligibility Evaluation Engine ($0 Free Tier)
 *
 * Evaluates whether a Solana wallet's cryptographically verified evidence satisfies
 * a community's, DAO's, grant committee's, or bounty platform's declared policy requirements.
 *
 * Invariant: PROVN does not decide who is "good". Communities supply the policy, PROVN evaluates the evidence.
 */

import { BuilderReputation, EvidencePolicy, EligibilityEvaluation, PolicyCheckResult } from './types'

export const STANDARD_POLICY_PRESETS: Record<string, EvidencePolicy> = {
  SUPERTEAM_BOUNTY: {
    name: 'Superteam Bounty Contributor Gating',
    minVerifiedProofs: 3,
    minRecentProofs: 1,
    minStreak: 3,
    requiredProtocols: ['Solana'],
    requireGithubSource: true,
  },
  GRANT_EVALUATION: {
    name: 'Solana Foundation / Ecosystem Grant Review',
    minVerifiedProofs: 7,
    minRecentProofs: 2,
    minStreak: 7,
    requiredProtocols: ['Solana'],
    requireVerifiedGithubAttribution: true,
    requireArchivedProof: true,
  },
  CORE_ENGINEERING: {
    name: 'Protocol Engineering Attestation',
    minVerifiedProofs: 10,
    minRecentProofs: 3,
    requiredSkills: ['Rust', 'Solana'],
    requireVerifiedGithubAttribution: true,
    requireArchivedProof: true,
  },
  LIGHTWEIGHT_BUILDER: {
    name: 'Active Ecosystem Contributor',
    minVerifiedProofs: 1,
    minRecentProofs: 1,
  },
}

export function evaluateEligibility(
  reputation: BuilderReputation,
  policy: EvidencePolicy
): EligibilityEvaluation {
  const checks: PolicyCheckResult[] = []
  const policyName = policy.name || 'Custom Evidence Policy'

  // 1. Min Verified Proofs Check
  if (typeof policy.minVerifiedProofs === 'number' && policy.minVerifiedProofs > 0) {
    const passed = reputation.verifiedProofs >= policy.minVerifiedProofs
    checks.push({
      id: 'min_verified_proofs',
      label: 'Minimum Verified Proofs',
      required: policy.minVerifiedProofs,
      actual: reputation.verifiedProofs,
      passed,
      description: `Requires at least ${policy.minVerifiedProofs} cryptographically verified proof-of-work records.`,
    })
  }

  // 1B. Min Source Verified Proofs Check
  if (typeof policy.minSourceVerifiedProofs === 'number' && policy.minSourceVerifiedProofs > 0) {
    const passed = reputation.sourceVerifiedProofs >= policy.minSourceVerifiedProofs
    checks.push({
      id: 'min_source_verified_proofs',
      label: 'Minimum Source-Verified Proofs',
      required: policy.minSourceVerifiedProofs,
      actual: reputation.sourceVerifiedProofs,
      passed,
      description: `Requires at least ${policy.minSourceVerifiedProofs} proofs with GitHub API source verification.`,
    })
  }

  // 2. Min Recent Proofs Check (Last 30 days)
  if (typeof policy.minRecentProofs === 'number' && policy.minRecentProofs > 0) {
    const passed = reputation.recentVerifiedProofs >= policy.minRecentProofs
    checks.push({
      id: 'min_recent_proofs',
      label: 'Recent 30-Day Activity',
      required: policy.minRecentProofs,
      actual: reputation.recentVerifiedProofs,
      passed,
      description: `Requires at least ${policy.minRecentProofs} verified proofs logged in the last 30 days.`,
    })
  }

  // 3. Min Streak Check
  if (typeof policy.minStreak === 'number' && policy.minStreak > 0) {
    const bestStreak = Math.max(reputation.currentStreak, reputation.longestStreak)
    const passed = bestStreak >= policy.minStreak
    checks.push({
      id: 'min_streak',
      label: 'Daily Building Streak',
      required: `${policy.minStreak} days`,
      actual: `${bestStreak} days (current: ${reputation.currentStreak}d)`,
      passed,
      description: `Requires an active or historical streak of at least ${policy.minStreak} consecutive days.`,
    })
  }

  // 4. Required Protocols Check
  if (Array.isArray(policy.requiredProtocols) && policy.requiredProtocols.length > 0) {
    const builderProtos = new Set(reputation.protocols.map((p) => p.name.toLowerCase()))
    const missingProtos = policy.requiredProtocols.filter((p) => !builderProtos.has(p.toLowerCase()))
    const passed = missingProtos.length === 0
    checks.push({
      id: 'required_protocols',
      label: 'Required Protocol Experience',
      required: policy.requiredProtocols,
      actual: reputation.protocols.map((p) => p.name),
      passed,
      description: passed
        ? 'Declared Protocol Experience matches requirements.'
        : `Missing declared proofs for: ${missingProtos.join(', ')}`,
    })
  }

  // 5. Required Skills Check
  if (Array.isArray(policy.requiredSkills) && policy.requiredSkills.length > 0) {
    const builderSkills = new Set(reputation.skills.map((s) => s.name.toLowerCase()))
    const missingSkills = policy.requiredSkills.filter((s) => !builderSkills.has(s.toLowerCase()))
    const passed = missingSkills.length === 0
    checks.push({
      id: 'required_skills',
      label: 'Required Technical Skills',
      required: policy.requiredSkills,
      actual: reputation.skills.map((s) => s.name),
      passed,
      description: passed
        ? 'Declared Skills match requirements.'
        : `Missing declared proofs for: ${missingSkills.join(', ')}`,
    })
  }

  // 6A. GitHub Source Requirement (Weak Policy / Legacy alias)
  if (policy.requireGithubSource || policy.requireGithubEvidence) {
    const passed = reputation.proofsWithGithubEvidence >= 1
    checks.push({
      id: 'require_github_source',
      label: 'GitHub Evidence Linked',
      required: 'At least 1 GitHub PR/commit link',
      actual: `${reputation.proofsWithGithubEvidence} proofs with GitHub links`,
      passed,
      description: 'Requires at least one proof linked to a verified, existing public GitHub PR or commit.',
    })
  }

  // 6B. Verified GitHub Attribution Requirement (Strong Policy)
  if (policy.requireVerifiedGithubAttribution) {
    const passed = reputation.sourceVerifiedProofs >= 1
    checks.push({
      id: 'require_verified_github_attribution',
      label: 'Verified GitHub Attribution',
      required: 'At least 1 author-attributed GitHub proof',
      actual: `${reputation.sourceVerifiedProofs} proofs with verified identity attribution`,
      passed,
      description: 'Requires at least one proof where the GitHub contribution is cryptographically attributed to the linked GitHub identity of this wallet.',
    })
  }

  // 7. Arweave Permanent Archival Requirement
  if (policy.requireArchivedProof) {
    const passed = reputation.archivedVerifiedProofs >= 1
    checks.push({
      id: 'require_archived_proof',
      label: 'Permanent Arweave Provenance',
      required: 'At least 1 Arweave-archived proof',
      actual: `${reputation.archivedVerifiedProofs} archived verified proofs`,
      passed,
      description: 'Requires at least one proof with confirmed Arweave L1 storage via Irys.',
    })
  }

  // Summary calculation
  const totalChecks = checks.length
  const passedCount = checks.filter((c) => c.passed).length
  const eligible = totalChecks > 0 ? passedCount === totalChecks : true

  return {
    eligible,
    wallet: reputation.wallet,
    policyName,
    evaluatedAt: new Date().toISOString(),
    checks,
    summary: {
      passedCount,
      totalChecks,
    },
    protocolVersion: '1.0',
  }
}
