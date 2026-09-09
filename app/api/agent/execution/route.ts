import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateAgentRequest } from '@/app/lib/agent/apiKeyAuth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce API-key authentication (Fail-Closed)
    const { auth, response } = await authenticateAgentRequest(req)
    if (response) return response

    const body = await req.json()
    const { execution } = body

    if (!execution || !execution.executionId || !execution.agentPublicKey) {
      return NextResponse.json({ error: 'Missing required execution fields' }, { status: 400 })
    }

    // 2. Insert with project_id derived exclusively from authenticated context
    const { error } = await supabase
      .from('agent_executions')
      .insert({
        execution_id: execution.executionId,
        project_id: auth.projectId || null,
        agent_public_key: execution.agentPublicKey,
        status: execution.status || 'running',
        started_at: execution.startedAt || new Date().toISOString(),
        protocol_version: execution.protocolVersion || 'agent/1',
      })

    if (error) {
      console.error('Supabase Execution Insert Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, executionId: execution.executionId })
  } catch (err: unknown) {
    console.error('Agent Execution API Error:', (err as Error).message || String(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
