/**
 * PROVN Protocol — Wallet Quota & VIP Limits Engine
 *
 * Manages daily log quota limits per wallet address.
 * • Default limit: 3 logs/day
 * • Custom VIP limits: Configured via process.env.VIP_WALLET_QUOTAS
 *   Format: "walletAddress1:limit1,walletAddress2:limit2"
 *   Example: "FqDWkZazJro7sQ4c5omrbyqzuWipC7QEPdjgCEp3ucAs:10,5K...:50"
 */

export const DEFAULT_DAILY_LIMIT = 3

/**
 * Returns the maximum allowed daily log quota for a given wallet address.
 */
export function getWalletDailyLimit(walletAddress: string): number {
  if (!walletAddress) return DEFAULT_DAILY_LIMIT

  const vipConfig = process.env.VIP_WALLET_QUOTAS || process.env.NEXT_PUBLIC_VIP_WALLET_QUOTAS
  if (!vipConfig) return DEFAULT_DAILY_LIMIT

  try {
    const pairs = vipConfig.split(',')
    for (const pair of pairs) {
      const [wallet, limitStr] = pair.split(':').map((s) => s.trim())
      if (wallet === walletAddress && limitStr) {
        const parsedLimit = parseInt(limitStr, 10)
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          return parsedLimit
        }
      }
    }
  } catch (err) {
    console.warn('[PROVN Quota Engine] Failed to parse VIP_WALLET_QUOTAS:', err)
  }

  return DEFAULT_DAILY_LIMIT
}
