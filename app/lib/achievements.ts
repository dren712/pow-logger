/**
 * PROVN Protocol — Builder Achievements System ($0 Free-Tier)
 *
 * All achievements are evaluated deterministically from verified wallet logs.
 * Zero on-chain fees, zero RPC calls, zero NFT costs required during pre-grant phase.
 */

import { Achievement, WalletLog } from './types'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  criteria: string
  icon: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  evaluate: (logs: WalletLog[], currentStreak: number, longestStreak: number) => { earned: boolean; earnedAt?: string }
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'FIRST_PROOF',
    name: 'Genesis Proof',
    description: 'Cryptographically signed your first work attestation on Solana',
    criteria: 'Submit 1 verified proof',
    icon: '⚡',
    rarity: 'Common',
    evaluate: (logs) => {
      if (logs.length >= 1) {
        const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        return { earned: true, earnedAt: sorted[0].created_at }
      }
      return { earned: false }
    },
  },
  {
    id: '7_DAY_STREAK',
    name: '7-Day Builder',
    description: 'Maintained a verified 7-day daily building streak',
    criteria: 'Achieve a 7-day streak',
    icon: '🔥',
    rarity: 'Common',
    evaluate: (_, currentStreak, longestStreak) => {
      const best = Math.max(currentStreak, longestStreak)
      return { earned: best >= 7 }
    },
  },
  {
    id: '30_DAY_STREAK',
    name: '30-Day Builder',
    description: 'Maintained a verified 30-day daily building streak',
    criteria: 'Achieve a 30-day streak',
    icon: '🛡️',
    rarity: 'Rare',
    evaluate: (_, currentStreak, longestStreak) => {
      const best = Math.max(currentStreak, longestStreak)
      return { earned: best >= 30 }
    },
  },
  {
    id: '100_DAY_LEGEND',
    name: '100-Day Builder',
    description: 'Maintained a verified 100-day daily building streak',
    criteria: 'Achieve a 100-day streak',
    icon: '👑',
    rarity: 'Epic',
    evaluate: (_, currentStreak, longestStreak) => {
      const best = Math.max(currentStreak, longestStreak)
      return { earned: best >= 100 }
    },
  },
  {
    id: 'SOLANA_SPECIALIST',
    name: 'Solana Contributor',
    description: 'Logged 10+ proofs classified with Solana ecosystem protocols',
    criteria: '10+ Solana protocol proofs (regex-classified)',
    icon: '🟣',
    rarity: 'Rare',
    evaluate: (logs) => {
      const solanaLogs = logs.filter((l) =>
        l.protocols?.some((p) => /solana|spl|anchor|metaplex|helius/i.test(p))
      )
      return { earned: solanaLogs.length >= 10 }
    },
  },
  {
    id: 'OPEN_SOURCE_BUILDER',
    name: 'Open Source Contributor',
    description: 'Attached GitHub pull requests or repository commits to 5+ proofs',
    criteria: '5+ proofs with valid GitHub PR/commit evidence',
    icon: '🐙',
    rarity: 'Rare',
    evaluate: (logs) => {
      const ghLogs = logs.filter((l) => Boolean(l.github_url))
      return { earned: ghLogs.length >= 5 }
    },
  },
  {
    id: 'ARWEAVE_ARCHIVED',
    name: 'Permanent Provenance',
    description: 'Permanently immutabilized 10+ work proofs onto Arweave via Irys',
    criteria: '10+ Arweave-archived proofs',
    icon: '📦',
    rarity: 'Rare',
    evaluate: (logs) => {
      const archivedLogs = logs.filter((l) => l.archival_state === 'receipt_obtained' || l.archival_state === 'finalized' || Boolean(l.irys_tx_id))
      return { earned: archivedLogs.length >= 10 }
    },
  },
  {
    id: 'GRAND_LEGEND',
    name: 'Protocol Master',
    description: 'Reached the highest tier of PROVN builder reputation (365+ proofs)',
    criteria: 'Log 365+ total verified proofs',
    icon: '💎',
    rarity: 'Legendary',
    evaluate: (logs) => {
      return { earned: logs.length >= 365 }
    },
  },
]

export function evaluateAchievements(
  logs: WalletLog[],
  currentStreak: number,
  longestStreak: number
): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const result = def.evaluate(logs, currentStreak, longestStreak)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      criteria: def.criteria,
      icon: def.icon,
      rarity: def.rarity,
      earned: result.earned,
      earnedAt: result.earnedAt,
      mintable: true,
    }
  })
}
