/**
 * PROVN Protocol — Pure Deterministic Reputation Engine
 *
 * Computes builder reputation, skill frequency, protocol distribution,
 * builder level, streaks, and achievements from verified logs without database mutation.
 *
 * Determinism Guarantee:
 * Same wallet logs in -> Identical BuilderReputation out.
 */

import { BuilderReputation, WalletLog } from './types'
import {
  calculateStreak,
  calculateLongestStreak,
  getBuilderLevel,
  getEarnedMilestones,
  toLocalDateString,
  PROTOCOL_TIMEZONE,
} from './milestones'
import { evaluateAchievements } from './achievements'
import { verifyLogCryptographically } from './canonicalMessage'

export function calculateReputation(wallet: string, logs: WalletLog[]): BuilderReputation {
  const safeLogs = logs || []
  
  // Total raw records in database
  const totalRecords = safeLogs.length

  // Strict Protocol Invariant: PROVN Reputation is derived EXCLUSIVELY from cryptographically verified proofs
  const verifiedLogs = safeLogs.filter((l) => verifyLogCryptographically(l))
  const verifiedProofs = verifiedLogs.length
  const totalProofs = verifiedProofs // Invariant alias
  
  // Explicit categorization of historical & unverified records
  const legacyRecords = safeLogs.filter((l) => !l.nonce && l.protocol_version !== 2).length
  const unverifiedRecords = safeLogs.filter((l) => (l.nonce || l.protocol_version === 2) && !verifyLogCryptographically(l)).length
  
  // Archived verified proofs (Irys / Arweave confirmed)
  const archivedVerifiedProofs = verifiedLogs.filter(
    (l) => l.archival_state === 'receipt_obtained' || l.archival_state === 'finalized' || (Boolean(l.irys_tx_id) && !l.irys_tx_id?.startsWith('powl_'))
  ).length
  const archivedProofs = archivedVerifiedProofs

  // Recent verified proofs (created within the last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentVerifiedProofs = verifiedLogs.filter((l) => {
    const time = new Date(l.created_at).getTime()
    return !isNaN(time) && time >= thirtyDaysAgo
  }).length

  // Evidence density
  const proofsWithGithubEvidence = verifiedLogs.filter((l) => Boolean(l.github_url && l.github_url.trim())).length
  const sourceVerifiedProofs = verifiedLogs.filter((l) => l.provenance_level === 'source_verified').length
  const proofsWithOtherEvidence = verifiedLogs.filter((l) => Boolean(l.evidence_url && l.evidence_url.trim())).length

  // Extract timestamps ONLY from cryptographically verified proofs
  const createdAts = verifiedLogs.map((l) => l.created_at).filter(Boolean)
  const currentStreak = calculateStreak(createdAts, PROTOCOL_TIMEZONE)
  const longestStreak = calculateLongestStreak(createdAts, PROTOCOL_TIMEZONE)

  // Builder Level derived strictly from verified proof count
  const levelInfo = getBuilderLevel(totalProofs)
  const builderLevel = {
    level: levelInfo.level,
    title: levelInfo.title,
    emoji: levelInfo.emoji,
    color: levelInfo.color,
  }

  // Aggregate Skills with frequency counts ONLY from verified proofs
  const skillCounts: Record<string, number> = {}
  verifiedLogs.forEach((l) => {
    if (Array.isArray(l.skills)) {
      l.skills.forEach((s) => {
        if (typeof s === 'string' && s.trim()) {
          const key = s.trim()
          skillCounts[key] = (skillCounts[key] || 0) + 1
        }
      })
    }
  })
  const skills = Object.entries(skillCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Aggregate Protocols with frequency counts ONLY from verified proofs
  const protocolCounts: Record<string, number> = {}
  verifiedLogs.forEach((l) => {
    if (Array.isArray(l.protocols)) {
      l.protocols.forEach((p) => {
        if (typeof p === 'string' && p.trim()) {
          const key = p.trim()
          protocolCounts[key] = (protocolCounts[key] || 0) + 1
        }
      })
    }
  })
  const protocols = Object.entries(protocolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Aggregate Categories ONLY from verified proofs
  const categoryCounts: Record<string, number> = {}
  verifiedLogs.forEach((l) => {
    if (typeof l.category === 'string' && l.category.trim()) {
      const key = l.category.trim()
      categoryCounts[key] = (categoryCounts[key] || 0) + 1
    }
  })
  const categories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Earned Milestones & Achievements evaluated ONLY on verified proofs
  const milestones = getEarnedMilestones(currentStreak, longestStreak).map((m) => m.title)
  const achievements = evaluateAchievements(verifiedLogs, currentStreak, longestStreak)

  // Archival Success Rate computed on verified proofs
  const archivalSuccessRate = totalProofs > 0 ? Math.round((archivedVerifiedProofs / totalProofs) * 100) : 0

  // Date Extents & Active Days computed ONLY from verified proofs
  const sortedDates = [...createdAts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  const firstProofAt = sortedDates.length > 0 ? sortedDates[0] : undefined
  const latestProofAt = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined

  const uniqueDays = new Set(
    createdAts
      .map((d) => toLocalDateString(d, PROTOCOL_TIMEZONE))
      .filter((s) => s !== '1970-01-01')
  )
  const activeDaysCount = uniqueDays.size

  return {
    wallet,
    totalRecords,
    totalProofs,
    verifiedProofs,
    sourceVerifiedProofs,
    legacyRecords,
    unverifiedRecords,
    archivedProofs,
    archivedVerifiedProofs,
    recentVerifiedProofs,
    proofsWithGithubEvidence,
    proofsWithOtherEvidence,
    currentStreak,
    longestStreak,
    builderLevel,
    skills,
    protocols,
    categories,
    milestones,
    achievements,
    archivalSuccessRate,
    firstProofAt,
    latestProofAt,
    activeDaysCount,
  }
}
