/**
 * PROVN Protocol — Feature Flags ($0/month Free Tier Configuration)
 *
 * All paid, scale-dependent, or future infrastructure features are disabled by default.
 * The core PROVN protocol remains 100% functional on the $0 free-tier stack.
 */

export const FEATURE_FLAGS = {
  // On-chain Compressed NFT minting (Metaplex Bubblegum on Solana Mainnet)
  CNFT_ENABLED: process.env.NEXT_PUBLIC_ENABLE_CNFT === 'true',

  // High-throughput Helius DAS RPC & Webhook Indexer
  HELIUS_ENABLED: process.env.NEXT_PUBLIC_ENABLE_HELIUS === 'true',

  // Distributed multi-region Redis / Upstash Rate Limiting
  REDIS_ENABLED: process.env.ENABLE_REDIS === 'true',

  // Dedicated Enterprise Solana RPC Cluster
  DEDICATED_RPC_ENABLED: process.env.ENABLE_DEDICATED_RPC === 'true',

  // Ecosystem Webhook Event Dispatchers
  WEBHOOKS_ENABLED: process.env.ENABLE_WEBHOOKS === 'true',

  // Asynchronous Background Queue Workers (BullMQ / Inngest)
  BACKGROUND_WORKERS_ENABLED: process.env.ENABLE_BACKGROUND_WORKERS === 'true',
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key] || false
}
