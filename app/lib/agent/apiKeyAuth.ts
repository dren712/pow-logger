import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export interface AuthContext {
  valid: boolean
  projectId?: string
  tier: 'developer' | 'team' | 'enterprise'
  networkTarget: 'devnet' | 'mainnet-beta'
  error?: string
  statusCode?: number
}

/**
 * Validates an incoming API key against agent_api_keys and agent_projects.
 *
 * SECURITY INVARIANTS:
 *   - Strictly fails closed. Database errors or missing headers return valid: false.
 *   - Development bypass is ONLY allowed when PROVN_DEV_MODE='true' AND NODE_ENV !== 'production'.
 *   - Enforces per-project monthly event limits.
 */
export async function validateApiKey(authHeader: string | null): Promise<AuthContext> {
  const isDevModeAllowed = process.env.PROVN_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production'

  // If no auth header provided, fail closed unless explicit dev mode is enabled
  if (!authHeader) {
    if (isDevModeAllowed) {
      return {
        valid: true,
        projectId: 'dev-sandbox-project-001',
        tier: 'developer',
        networkTarget: 'devnet',
      }
    }
    return {
      valid: false,
      tier: 'developer',
      networkTarget: 'devnet',
      error: 'Missing Authorization header with Bearer API key',
      statusCode: 401,
    }
  }

  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
  if (!rawKey) {
    return {
      valid: false,
      tier: 'developer',
      networkTarget: 'devnet',
      error: 'Malformed or empty Bearer token',
      statusCode: 401,
    }
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
      if (isDevModeAllowed) {
        return {
          valid: true,
          projectId: 'dev-sandbox-project-001',
          tier: 'developer',
          networkTarget: 'devnet',
        }
      }
      return {
        valid: false,
        tier: 'developer',
        networkTarget: 'devnet',
        error: 'Invalid or revoked API key',
        statusCode: 401,
      }
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
        projectId: keyRecord.project_id,
        tier: project.tier,
        networkTarget: project.network_target,
        error: `Monthly event quota exceeded (${project.monthly_events_used}/${project.monthly_event_limit}). Upgrade tier for more capacity.`,
        statusCode: 403,
      }
    }

    // Touch last_used_at non-blockingly
    supabase.from('agent_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then(() => {})

    return {
      valid: true,
      projectId: keyRecord.project_id,
      tier: project?.tier || 'developer',
      networkTarget: project?.network_target || 'devnet',
    }
  } catch (err: unknown) {
    console.error('API Key Auth Database Error:', err)
    if (isDevModeAllowed) {
      return {
        valid: true,
        projectId: 'dev-sandbox-project-001',
        tier: 'developer',
        networkTarget: 'devnet',
      }
    }
    // Fail closed! Database failure does NOT grant authentication
    return {
      valid: false,
      tier: 'developer',
      networkTarget: 'devnet',
      error: 'Authentication service temporarily unavailable',
      statusCode: 503,
    }
  }
}

/**
 * Standardized route helper to enforce authentication on NextRequest.
 */
export async function authenticateAgentRequest(
  req: Request
): Promise<{ auth: AuthContext; response?: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  const auth = await validateApiKey(authHeader)

  if (!auth.valid) {
    return {
      auth,
      response: NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      ),
    }
  }

  return { auth }
}

export function generateApiKey(prefix = 'provn_sec'): { apiKey: string; keyHash: string; keyPrefix: string } {
  const secret = crypto.randomBytes(24).toString('hex')
  const apiKey = `${prefix}_${secret}`
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.slice(0, 14)
  return { apiKey, keyHash, keyPrefix }
}
