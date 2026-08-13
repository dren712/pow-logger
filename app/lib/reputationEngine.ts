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
  
  // Strict Protocol Invariant: PROVN Reputation is derived EXCLUSIVELY from cryptographically verified proofs
  const verifiedLogs = safeLogs.filter((l) => verifyLogCryptographically(l))
  const totalProofs = verifiedLogs.length
  const verifiedProofs = verifiedLogs.length
  const archivedProofs = verifiedLogs.filter((l) => l.archival_state === 'archived' || Boolean(l.irys_tx_id)).length

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
  const archivalSuccessRate = totalProofs > 0 ? Math.round((archivedProofs / totalProofs) * 100) : 0

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
    totalProofs,
    verifiedProofs,
    archivedProofs,
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
