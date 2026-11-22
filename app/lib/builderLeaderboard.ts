import { createClient } from '@supabase/supabase-js'
import { isConfiguredSupabaseUrl } from './canonicalMessage'
import type { BuilderProfile } from './githubProfile'

export interface LeaderboardRow {
  login: string
  name: string | null
  avatar_url: string | null
  score: number
  tier: string
  merged_external_prs: number
  external_repos: number
  stars: number
  top_language: string | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export function toLeaderboardRow(profile: BuilderProfile) {
  return {
    github_id: profile.githubId,
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatarUrl,
    score: profile.score,
    tier: profile.tier,
    merged_external_prs: profile.stats.mergedExternalPrs,
    external_repos: profile.stats.externalRepos,
    stars: profile.stats.stars,
    top_language: profile.languages[0]?.name || null,
    fingerprint: profile.fingerprint,
    updated_at: profile.generatedAt,
  }
}

// Best effort: the profile page must still render when the table or key is missing.
export async function saveToLeaderboard(profile: BuilderProfile): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !isConfiguredSupabaseUrl(supabaseUrl)) return false
  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    // A login can move to another account; drop the old holder's row so the unique login index accepts this one.
    await supabase.from('builder_profiles').delete().ilike('login', profile.login).neq('github_id', profile.githubId)
    const { error } = await supabase.from('builder_profiles').upsert(toLeaderboardRow(profile), { onConflict: 'github_id' })
    return !error
  } catch {
    return false
  }
}

// Called when GitHub no longer resolves a login, so a retired account does not stay ranked.
export async function removeFromLeaderboard(login: string): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !isConfiguredSupabaseUrl(supabaseUrl)) return false
  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { error } = await supabase.from('builder_profiles').delete().ilike('login', login)
    return !error
  } catch {
    return false
  }
}

export async function fetchLeaderboard(limit = 100): Promise<LeaderboardRow[] | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key || !isConfiguredSupabaseUrl(supabaseUrl)) return null
  try {
    const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('builder_profiles')
      .select('login,name,avatar_url,score,tier,merged_external_prs,external_repos,stars,top_language')
      .order('score', { ascending: false })
      .order('merged_external_prs', { ascending: false })
      .limit(limit)
    if (error) return null
    return (data || []) as LeaderboardRow[]
  } catch {
    return null
  }
}
