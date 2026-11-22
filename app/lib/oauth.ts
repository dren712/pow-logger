import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_TIMESTAMP_AGE_MS = 15 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 60 * 1000

export function isOAuthTimestampFresh(timestamp: string, now = Date.now()): boolean {
  const timestampMs = new Date(timestamp).getTime()
  return Number.isFinite(timestampMs) &&
    timestampMs <= now + MAX_FUTURE_SKEW_MS &&
    now - timestampMs <= MAX_TIMESTAMP_AGE_MS
}

export async function consumeSigningChallenge(
  supabase: SupabaseClient,
  challenge: string,
  walletAddress: string,
  now = new Date().toISOString()
): Promise<boolean> {
  const { data, error } = await supabase
    .from('signing_challenges')
    .update({ consumed_at: now })
    .eq('challenge', challenge)
    .eq('wallet_address', walletAddress)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('id')
    .maybeSingle()

  return !error && Boolean(data)
}
