import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { execution } = body

    if (!execution || !execution.executionId || !execution.agentPublicKey) {
      return NextResponse.json({ error: 'Missing required execution fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('agent_executions')
      .insert({
        execution_id: execution.executionId,
        agent_public_key: execution.agentPublicKey,
        status: execution.status,
        started_at: execution.startedAt,
        protocol_version: execution.protocolVersion || 'agent/1'
      })

    if (error) {
      console.error('Supabase Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, executionId: execution.executionId })
  } catch (err: unknown) {
    console.error('Agent Execution API Error:', (err as Error).message || String(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
