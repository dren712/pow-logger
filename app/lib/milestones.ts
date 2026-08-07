/**
 * PROVN Protocol — Builder Level & Milestone System
 *
 * Dual-Tier Badge Architecture:
 * • Tier 1: Dynamic Evolving Builder Level (1 per builder, auto-levels up)
 * • Tier 2: Streak Milestone Trophies (earned at 7, 30, 100 day streaks)
 *
 * This module is the single source of truth for all badge/level calculations.
 * It is designed to be consumed by both client (UI) and server (API) code.
 *
 * Future: When Merkle Tree & Helius RPC are configured, these levels/milestones
 * will trigger on-chain cNFT minting via app/lib/cnft.ts.
 */

// ─── Tier 1: Dynamic Evolving Builder Levels ─────────────────────────────────

export interface BuilderLevel {
  level: number
  title: string
  emoji: string
  color: string
  minLogs: number
  /** Glow color for UI effects */
  glow: string
}

export const BUILDER_LEVELS: BuilderLevel[] = [
  { level: 1, title: 'Apprentice Builder', emoji: '🔧', color: '#888888', minLogs: 0,   glow: 'rgba(136,136,136,0.15)' },
  { level: 2, title: 'Verified Craftsman', emoji: '⚒️',  color: '#00e5ff', minLogs: 7,   glow: 'rgba(0,229,255,0.15)' },
  { level: 3, title: 'Senior Architect',   emoji: '🏗️',  color: '#ffb800', minLogs: 30,  glow: 'rgba(255,184,0,0.15)' },
  { level: 4, title: 'Protocol Master',    emoji: '💎', color: '#ff00ff', minLogs: 100, glow: 'rgba(255,0,255,0.15)' },
  { level: 5, title: 'Grand Legend',        emoji: '👑', color: '#ff4400', minLogs: 365, glow: 'rgba(255,68,0,0.2)' },
]

export function getBuilderLevel(totalLogs: number): BuilderLevel {
  let current = BUILDER_LEVELS[0]
  for (const level of BUILDER_LEVELS) {
    if (totalLogs >= level.minLogs) {
      current = level
    } else {
      break
    }
  }
  return current
}

export function getNextLevel(totalLogs: number): { next: BuilderLevel; logsRemaining: number } | null {
  const currentLevel = getBuilderLevel(totalLogs)
  const nextIdx = BUILDER_LEVELS.findIndex((l) => l.level === currentLevel.level) + 1
  if (nextIdx >= BUILDER_LEVELS.length) return null
  const next = BUILDER_LEVELS[nextIdx]
  return { next, logsRemaining: next.minLogs - totalLogs }
}

export function getLevelProgress(totalLogs: number): number {
  const current = getBuilderLevel(totalLogs)
  const nextInfo = getNextLevel(totalLogs)
  if (!nextInfo) return 100 // Max level reached
  const rangeTotal = nextInfo.next.minLogs - current.minLogs
  const rangeProgress = totalLogs - current.minLogs
  return Math.min(100, Math.round((rangeProgress / rangeTotal) * 100))
}

// ─── Tier 2: Streak Milestone Trophies ───────────────────────────────────────

export interface StreakMilestone {
  days: number
  title: string
  emoji: string
  color: string
  description: string
  /** When Merkle tree is deployed, this milestone triggers a cNFT mint */
  mintable: boolean
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7,   title: '7-Day Streak',     emoji: '🔥', color: '#ff6600', description: 'Logged work for 7 consecutive days',   mintable: true },
  { days: 14,  title: '14-Day Streak',    emoji: '⚡', color: '#ffb800', description: 'Logged work for 14 consecutive days',  mintable: true },
  { days: 30,  title: '30-Day Ironclad',  emoji: '🛡️',  color: '#00e5ff', description: 'Logged work for 30 consecutive days',  mintable: true },
  { days: 60,  title: '60-Day Titan',     emoji: '⚔️',  color: '#ab9ff2', description: 'Logged work for 60 consecutive days',  mintable: true },
  { days: 100, title: '100-Day Legend',   emoji: '💎', color: '#ff00ff', description: 'Logged work for 100 consecutive days', mintable: true },
  { days: 365, title: '365-Day Eternal',  emoji: '👑', color: '#ff4400', description: 'Logged work for 365 consecutive days', mintable: true },
]

export function getEarnedMilestones(currentStreak: number, longestStreak: number): StreakMilestone[] {
  const bestStreak = Math.max(currentStreak, longestStreak)
  return STREAK_MILESTONES.filter((m) => bestStreak >= m.days)
}

export function getNextMilestone(currentStreak: number): { milestone: StreakMilestone; daysRemaining: number } | null {
  for (const m of STREAK_MILESTONES) {
    if (currentStreak < m.days) {
      return { milestone: m, daysRemaining: m.days - currentStreak }
    }
  }
  return null // All milestones achieved
}

/**
 * Check if a new milestone was JUST reached (for triggering mint/notification).
 * Call after incrementing streak.
 */
export function checkNewMilestoneReached(previousStreak: number, newStreak: number): StreakMilestone | null {
  for (const m of STREAK_MILESTONES) {
    if (previousStreak < m.days && newStreak >= m.days) {
      return m
    }
  }
  return null
}

// ─── Combined Badge Summary ──────────────────────────────────────────────────

export interface BadgeSummary {
  level: BuilderLevel
  nextLevel: { next: BuilderLevel; logsRemaining: number } | null
  levelProgress: number
  currentStreak: number
  longestStreak: number
  earnedMilestones: StreakMilestone[]
  nextMilestone: { milestone: StreakMilestone; daysRemaining: number } | null
  totalLogs: number
}

export function computeBadgeSummary(totalLogs: number, currentStreak: number, longestStreak: number): BadgeSummary {
  return {
    level: getBuilderLevel(totalLogs),
    nextLevel: getNextLevel(totalLogs),
    levelProgress: getLevelProgress(totalLogs),
    currentStreak,
    longestStreak,
    earnedMilestones: getEarnedMilestones(currentStreak, longestStreak),
    nextMilestone: getNextMilestone(currentStreak),
    totalLogs,
  }
}
