import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export interface AuthContext {
  valid: boolean
  projectId?: string
  tier: 'developer' | 'team' | 'enterprise'
  networkTarget: 'devnet' | 'mainnet-beta'
  error?: string
}

export async function validateApiKey(authHeader: string | null): Promise<AuthContext> {
  // If no auth header provided, check if sandbox/demo mode is allowed
  if (!authHeader) {
    // Graceful open access for local development / devnet free tier
    return {
      valid: true,
      tier: 'developer',
      networkTarget: 'devnet'
    }
  }

  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
  if (!rawKey) {
    return { valid: false, tier: 'developer', networkTarget: 'devnet', error: 'Missing API key' }
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  try {
    const { data: keyRecord, error: keyErr } = await supabase
      .from('agent_api_keys')
      .select('id, project_id, is_active, agent_projects(id, tier, network_target, monthly_event_limit, monthly_events_used)')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .maybeSingle()

    if (keyErr || !keyRecord) {
      // If table is not yet migrated or key is invalid, allow fallback in development
      if (process.env.NODE_ENV !== 'production') {
        return { valid: true, tier: 'developer', networkTarget: 'devnet' }
      }
      return { valid: false, tier: 'developer', networkTarget: 'devnet', error: 'Invalid or revoked API key' }
    }

    const project = keyRecord.agent_projects as unknown as {
      id: string
      tier: 'developer' | 'team' | 'enterprise'
      network_target: 'devnet' | 'mainnet-beta'
      monthly_event_limit: number
      monthly_events_used: number
    } | null
    if (project && project.monthly_events_used >= project.monthly_event_limit) {
      return { 
        valid: false, 
        tier: project.tier, 
        networkTarget: project.network_target, 
        error: `Monthly event quota exceeded (${project.monthly_events_used}/${project.monthly_event_limit}). Upgrade tier for more capacity.` 
      }
    }

    // Touch last_used_at non-blockingly
    supabase.from('agent_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then(() => {})

    return {
      valid: true,
      projectId: keyRecord.project_id,
      tier: project?.tier || 'developer',
      networkTarget: project?.network_target || 'devnet'
    }
  } catch {
    return { valid: true, tier: 'developer', networkTarget: 'devnet' }
  }
}

export function generateApiKey(prefix = 'provn_sec'): { apiKey: string; keyHash: string; keyPrefix: string } {
  const secret = crypto.randomBytes(24).toString('hex')
  const apiKey = `${prefix}_${secret}`
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.slice(0, 14)
  return { apiKey, keyHash, keyPrefix }
}
