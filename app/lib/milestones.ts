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

/**
 * Normalizes a Date or ISO string to a UTC Date object at midnight UTC (00:00:00.000).
 */
export function toUTCDay(dateInput: string | Date): Date {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return new Date(0)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Calculates current active streak from an array of ISO date strings or Date objects.
 * Single source of truth for streak calculation, globally standardized to UTC midnight.
 */
export function calculateStreak(createdAts: (string | Date)[]): number {
  if (!createdAts || createdAts.length === 0) return 0

  const today = toUTCDay(new Date())

  // Extract unique UTC days sorted in descending order
  const uniqueUtcDays = Array.from(
    new Set(
      createdAts
        .map((d) => toUTCDay(d).getTime())
        .filter((t) => t > 0)
    )
  ).sort((a, b) => b - a)

  if (uniqueUtcDays.length === 0) return 0

  // If most recent log is older than yesterday UTC, streak is broken
  const mostRecent = uniqueUtcDays[0]
  const daysDiffFromToday = Math.round((today.getTime() - mostRecent) / 86400000)
  if (daysDiffFromToday > 1) {
    return 0 // Streak broken
  }

  let streak = 1
  let checkTime = mostRecent

  for (let i = 1; i < uniqueUtcDays.length; i++) {
    const dayTime = uniqueUtcDays[i]
    const diff = Math.round((checkTime - dayTime) / 86400000)
    if (diff === 0) {
      continue
    } else if (diff === 1) {
      streak++
      checkTime = dayTime
    } else {
      break
    }
  }

  return streak
}

/**
 * Calculates the longest streak achieved in days.
 * Standardized on global UTC midnight boundaries.
 */
export function calculateLongestStreak(createdAts: (string | Date)[]): number {
  if (!createdAts || createdAts.length === 0) return 0

  const uniqueUtcDays = Array.from(
    new Set(
      createdAts
        .map((d) => toUTCDay(d).getTime())
        .filter((t) => t > 0)
    )
  ).sort((a, b) => a - b) // Ascending order

  if (uniqueUtcDays.length === 0) return 0

  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < uniqueUtcDays.length; i++) {
    const prev = uniqueUtcDays[i - 1]
    const curr = uniqueUtcDays[i]
    const diffDays = Math.round((curr - prev) / 86400000)

    if (diffDays === 1) {
      currentStreak++
      if (currentStreak > maxStreak) maxStreak = currentStreak
    } else if (diffDays > 1) {
      currentStreak = 1
    }
  }

  return maxStreak
}

// ─── Tier 3: LeetCode / Codeforces Style Skill & Specialization Badges ─────────

export interface SkillBadge {
  id: string
  title: string
  emoji: string
  color: string
  category: 'skill' | 'quality' | 'volume'
  description: string
  checkUnlocked: (logs: Array<{ skills?: string[]; category?: string; evidence_url?: string | null; github_url?: string | null; irys_tx_id?: string | null }>) => boolean
}

export const SKILL_BADGES: SkillBadge[] = [
  {
    id: 'rust_anchor',
    title: 'Anchor Specialist',
    emoji: '⚓',
    color: '#ff0055',
    category: 'skill',
    description: 'Logged 3+ Solana Smart Contract / Anchor work logs',
    checkUnlocked: (logs) =>
      logs.filter((l) =>
        (l.skills || []).some(
          (s) => s.toLowerCase().includes('anchor') || s.toLowerCase().includes('rust') || s.toLowerCase().includes('solana')
        )
      ).length >= 3,
  },
  {
    id: 'security_auditor',
    title: 'Security Auditor',
    emoji: '🛡️',
    color: '#ff4444',
    category: 'skill',
    description: 'Logged 2+ Security or Authentication work logs',
    checkUnlocked: (logs) =>
      logs.filter(
        (l) =>
          (l.category || '').toLowerCase().includes('security') ||
          (l.skills || []).some((s) => s.toLowerCase().includes('security') || s.toLowerCase().includes('auth'))
      ).length >= 2,
  },
  {
    id: 'open_source',
    title: 'Open Source Builder',
    emoji: '🐙',
    color: '#ab9ff2',
    category: 'quality',
    description: 'Attached 3+ verified GitHub PR/Commit links',
    checkUnlocked: (logs) => logs.filter((l) => l.github_url && l.github_url.includes('github.com')).length >= 3,
  },
  {
    id: 'permanent_archivist',
    title: 'Arweave Archivist',
    emoji: '📜',
    color: '#00e5ff',
    category: 'quality',
    description: 'Archived 5+ logs permanently to Arweave',
    checkUnlocked: (logs) => logs.filter((l) => l.irys_tx_id && !l.irys_tx_id.startsWith('powl_')).length >= 5,
  },
  {
    id: 'century_builder',
    title: 'Century Club',
    emoji: '💯',
    color: '#ff00ff',
    category: 'volume',
    description: 'Submitted 100+ verified proof logs',
    checkUnlocked: (logs) => logs.length >= 100,
  },
]

export function getEarnedSkillBadges(
  logs: Array<{ skills?: string[]; category?: string; evidence_url?: string | null; github_url?: string | null; irys_tx_id?: string | null }>
): SkillBadge[] {
  if (!logs || !Array.isArray(logs)) return []
  return SKILL_BADGES.filter((b) => b.checkUnlocked(logs))
}

// ─── Combined Badge Summary ──────────────────────────────────────────────────

export interface BadgeSummary {
  level: BuilderLevel
  nextLevel: { next: BuilderLevel; logsRemaining: number } | null
  levelProgress: number
  currentStreak: number
  longestStreak: number
  earnedMilestones: StreakMilestone[]
  earnedSkillBadges: SkillBadge[]
  nextMilestone: { milestone: StreakMilestone; daysRemaining: number } | null
  totalLogs: number
}

export function computeBadgeSummary(
  totalLogs: number,
  currentStreak: number,
  longestStreak: number,
  logs: Array<{ skills?: string[]; category?: string; evidence_url?: string | null; github_url?: string | null; irys_tx_id?: string | null }> = []
): BadgeSummary {
  return {
    level: getBuilderLevel(totalLogs),
    nextLevel: getNextLevel(totalLogs),
    levelProgress: getLevelProgress(totalLogs),
    currentStreak,
    longestStreak,
    earnedMilestones: getEarnedMilestones(currentStreak, longestStreak),
    earnedSkillBadges: getEarnedSkillBadges(logs),
    nextMilestone: getNextMilestone(currentStreak),
    totalLogs,
  }
}
