"use strict";
/**
 * PROVN Protocol — Metaplex Compressed NFT (cNFT) Achievement Engine ($0 Free-Tier Architecture)
 *
 * Implements:
 * 1. Deterministic cNFT eligibility evaluation from builder reputation.
 * 2. Metaplex-compliant off-chain JSON metadata generation.
 * 3. AchievementMinter abstraction with LocalTestMinter ($0 free development)
 *    and MetaplexMinter (feature-flagged disabled until grant funding).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaplexMinter = exports.LocalTestMinter = void 0;
exports.checkCNFTEligibility = checkCNFTEligibility;
exports.generateAchievementMetadata = generateAchievementMetadata;
/**
 * Evaluates whether a builder is eligible to mint a specific achievement cNFT.
 */
function checkCNFTEligibility(achievementId, reputation) {
    const achievement = reputation.achievements.find((a) => a.id === achievementId);
    if (!achievement) {
        return {
            eligible: false,
            achievementId,
            achievementName: 'Unknown Achievement',
            reason: `Achievement "${achievementId}" is not recognized by the protocol.`,
        };
    }
    if (!achievement.earned) {
        return {
            eligible: false,
            achievementId,
            achievementName: achievement.name,
            reason: `Criteria not yet met: ${achievement.criteria}`,
        };
    }
    return {
        eligible: true,
        achievementId: achievement.id,
        achievementName: achievement.name,
        reason: `Builder met criteria: ${achievement.criteria}`,
        earnedAt: achievement.earnedAt,
    };
}
/**
 * Generates Metaplex-standard JSON metadata for an achievement cNFT.
 */
function generateAchievementMetadata(achievement, reputation) {
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
    };
}
/**
 * $0 Free Development Minter (simulates minting locally with zero SOL or RPC costs)
 */
class LocalTestMinter {
    async mintAchievement(wallet, achievement, reputation) {
        const eligibility = checkCNFTEligibility(achievement.id, reputation);
        if (!eligibility.eligible) {
            return {
                success: false,
                error: eligibility.reason,
                isMock: true,
            };
        }
        const mockAssetId = `mock_cnft_${achievement.id.toLowerCase()}_${wallet.slice(0, 8)}`;
        const mockTx = `mock_sig_${Date.now().toString(36)}`;
        return {
            success: true,
            assetId: mockAssetId,
            txSignature: mockTx,
            isMock: true,
        };
    }
}
exports.LocalTestMinter = LocalTestMinter;
/**
 * Production Metaplex Bubblegum Minter (Disabled until grant funding activates NEXT_PUBLIC_CNFT_ENABLED=true)
 */
class MetaplexMinter {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mintAchievement(_wallet, _achievement, _reputation) {
        const isEnabled = process.env.NEXT_PUBLIC_CNFT_ENABLED === 'true';
        if (!isEnabled) {
            return {
                success: false,
                error: 'cNFT minting is disabled during pre-grant free phase. Will be activated upon Superteam grant funding.',
                isMock: false,
            };
        }
        return {
            success: false,
            error: 'Merkle tree not yet initialized with grant payer.',
            isMock: false,
        };
    }
}
exports.MetaplexMinter = MetaplexMinter;
