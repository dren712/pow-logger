/**
 * PROVN Protocol — Metaplex Compressed NFT (cNFT) Achievement Engine ($0 Free-Tier Architecture)
 *
 * Implements:
 * 1. Deterministic cNFT eligibility evaluation from builder reputation.
 * 2. Metaplex-compliant off-chain JSON metadata generation.
 * 3. AchievementMinter abstraction with LocalTestMinter ($0 free development)
 *    and MetaplexMinter (feature-flagged disabled until grant funding).
 */

import { BuilderReputation, AchievementEligibility, Achievement } from './types'

export interface MetaplexNFTAttribute {
  trait_type: string
  value: string | number
}

export interface MetaplexNFTMetadata {
  name: string
  symbol: string
  description: string
  image: string
  external_url: string
  attributes: MetaplexNFTAttribute[]
  properties: {
    category: string
    creators: { address: string; share: number }[]
  }
}

export interface MintResult {
  success: boolean
  assetId?: string
  txSignature?: string
  error?: string
  isMock: boolean
}

export interface AchievementMinter {
  mintAchievement(wallet: string, achievement: Achievement, reputation: BuilderReputation): Promise<MintResult>
}

/**
 * Evaluates whether a builder is eligible to mint a specific achievement cNFT.
 */
export function checkCNFTEligibility(
  achievementId: string,
  reputation: BuilderReputation
): AchievementEligibility {
  const achievement = reputation.achievements.find((a) => a.id === achievementId)

  if (!achievement) {
    return {
      eligible: false,
      achievementId,
      achievementName: 'Unknown Achievement',
      reason: `Achievement "${achievementId}" is not recognized by the protocol.`,
    }
  }

  if (!achievement.earned) {
    return {
      eligible: false,
      achievementId,
      achievementName: achievement.name,
      reason: `Criteria not yet met: ${achievement.criteria}`,
    }
  }

  return {
    eligible: true,
    achievementId: achievement.id,
    achievementName: achievement.name,
    reason: `Builder met criteria: ${achievement.criteria}`,
    earnedAt: achievement.earnedAt,
  }
}

/**
 * Generates Metaplex-standard JSON metadata for an achievement cNFT.
 */
export function generateAchievementMetadata(
  achievement: Achievement,
  reputation: BuilderReputation
): MetaplexNFTMetadata {
  return {
    name: `PROVN — ${achievement.name}`,
    symbol: 'PROVN',
    description: `${achievement.description}. Cryptographically proven builder achievement on Solana.`,
    image: `https://provn-sol.vercel.app/api/badge/${reputation.wallet}?achievement=${achievement.id}`,
    external_url: `https://provn-sol.vercel.app/u/${reputation.wallet}`,
    attributes: [
      { trait_type: 'Protocol', value: 'PROVN' },
      { trait_type: 'Achievement', value: achievement.name },
      { trait_type: 'Rarity', value: achievement.rarity },
      { trait_type: 'Builder Level', value: reputation.builderLevel.title },
      { trait_type: 'Total Proofs', value: reputation.totalProofs },
      { trait_type: 'Current Streak', value: `${reputation.currentStreak} Days` },
      { trait_type: 'Longest Streak', value: `${reputation.longestStreak} Days` },
      { trait_type: 'Wallet', value: reputation.wallet },
    ],
    properties: {
      category: 'image',
      creators: [
        {
          address: reputation.wallet,
          share: 100,
        },
      ],
    },
  }
}

/**
 * $0 Free Development Minter (simulates minting locally with zero SOL or RPC costs)
 */
export class LocalTestMinter implements AchievementMinter {
  async mintAchievement(
    wallet: string,
    achievement: Achievement,
    reputation: BuilderReputation
  ): Promise<MintResult> {
    const eligibility = checkCNFTEligibility(achievement.id, reputation)
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason,
        isMock: true,
      }
    }

    const mockAssetId = `mock_cnft_${achievement.id.toLowerCase()}_${wallet.slice(0, 8)}`
    const mockTx = `mock_sig_${Date.now().toString(36)}`

    return {
      success: true,
      assetId: mockAssetId,
      txSignature: mockTx,
      isMock: true,
    }
  }
}

/**
 * Production Metaplex Bubblegum Minter (Disabled until grant funding activates NEXT_PUBLIC_CNFT_ENABLED=true)
 */
export class MetaplexMinter implements AchievementMinter {
  async mintAchievement(
    _wallet: string,
    _achievement: Achievement,
    _reputation: BuilderReputation
  ): Promise<MintResult> {
    const isEnabled = process.env.NEXT_PUBLIC_CNFT_ENABLED === 'true'
    if (!isEnabled) {
      return {
        success: false,
        error: 'cNFT minting is disabled during pre-grant free phase. Will be activated upon Superteam grant funding.',
        isMock: false,
      }
    }

    return {
      success: false,
      error: 'Merkle tree not yet initialized with grant payer.',
      isMock: false,
    }
  }
}
