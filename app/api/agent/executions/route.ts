import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey } from '@/app/lib/agent/apiKeyAuth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const auth = await validateApiKey(authHeader)

    // In production, execution listing must be authenticated
    if (!auth.valid && process.env.PROVN_DEV_MODE !== 'true') {
      return NextResponse.json(
        { error: auth.error || 'Authentication required to list project executions' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    let query = supabase
      .from('agent_executions')
      .select(`
        execution_id,
        project_id,
        agent_public_key,
        status,
        started_at,
        completed_at,
        event_count,
        merkle_root,
        protocol_version
      `)
      .order('started_at', { ascending: false })
      .limit(limit)

    // Scope to project if authenticated
    if (auth.projectId && auth.projectId !== 'dev-sandbox-project-001') {
      query = query.eq('project_id', auth.projectId)
    }

    const { data: executions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ executions: executions || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
