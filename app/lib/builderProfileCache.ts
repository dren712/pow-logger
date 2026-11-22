import { unstable_cache } from 'next/cache'
import { fetchBuilderProfile, PROFILE_REVALIDATE_SECONDS, type ProfileResult } from './githubProfile'
import { removeFromLeaderboard, saveToLeaderboard } from './builderLeaderboard'

class TransientProfileError extends Error {
  constructor(public reason: 'rate_limited' | 'unavailable') {
    super(reason)
  }
}

// One GitHub refresh and one leaderboard write per user per day. Temporary failures throw so they are never cached.
const cachedProfile = unstable_cache(
  async (login: string): Promise<ProfileResult> => {
    const result = await fetchBuilderProfile(login)
    if (!result.ok && (result.reason === 'rate_limited' || result.reason === 'unavailable')) {
      throw new TransientProfileError(result.reason)
    }
    if (result.ok) await saveToLeaderboard(result.profile)
    else if (result.reason === 'not_found') await removeFromLeaderboard(login)
    return result
  },
  ['builder-profile-v1'],
  { revalidate: PROFILE_REVALIDATE_SECONDS }
)

export async function loadBuilderProfile(login: string): Promise<ProfileResult> {
  try {
    return await cachedProfile(login.toLowerCase())
  } catch (error) {
    return { ok: false, reason: error instanceof TransientProfileError ? error.reason : 'unavailable' }
  }
}
