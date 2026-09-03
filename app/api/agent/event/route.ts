import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeEventHash, verifyEventSignature } from '@/app/lib/agent/agentEvents'
import { authenticateAgentRequest } from '@/app/lib/agent/apiKeyAuth'
import type { AgentEvent } from '@/app/lib/agent/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce API-key authentication (Fail-Closed)
    const { auth, response } = await authenticateAgentRequest(req)
    if (response) return response

    const body = await req.json()
    const { event }: { event: AgentEvent } = body

    if (!event || !event.eventId || !event.eventHash || !event.signature || !event.executionId) {
      return NextResponse.json({ error: 'Malformed agent event' }, { status: 400 })
    }

    // 2. Tenant Isolation Check: Verify execution exists and belongs to this project
    const { data: exec, error: execErr } = await supabase
      .from('agent_executions')
      .select('execution_id, project_id')
      .eq('execution_id', event.executionId)
      .maybeSingle()

    if (execErr) {
      console.error('Execution Lookup Error:', execErr)
      return NextResponse.json({ error: 'Database error verifying execution ownership' }, { status: 500 })
    }

    if (!exec) {
      return NextResponse.json({ error: 'EXECUTION_NOT_FOUND' }, { status: 404 })
    }

    if (exec.project_id && auth.projectId && exec.project_id !== auth.projectId) {
      return NextResponse.json(
        { error: 'TENANT_MISMATCH: Execution belongs to a different project' },
        { status: 403 }
      )
    }

    // 3. Server-side Cryptographic Verification (Zero Trust)
    const expectedHash = recomputeEventHash(event)
    if (expectedHash !== event.eventHash) {
      return NextResponse.json({ error: 'EVENT_HASH_MISMATCH' }, { status: 400 })
    }

    const isValidSig = verifyEventSignature(event.eventHash, event.signature, event.agentPublicKey)
    if (!isValidSig) {
      return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 400 })
    }

    // 4. Persist to database — explicitly preserving payload JSONB and project_id
    const { error: insertErr } = await supabase
      .from('agent_events')
      .insert({
        event_id: event.eventId,
        execution_id: event.executionId,
        project_id: auth.projectId || exec.project_id || null,
        sequence: event.sequence,
        agent_public_key: event.agentPublicKey,
        event_type: event.eventType,
        timestamp: event.timestamp,
        parent_event_id: event.parentEventId || null,
        previous_event_hash: event.previousEventHash || null,
        payload_hash: event.payloadHash,
        payload: event.payload || null, // Preserve safe structured metadata for Layer 3 audit!
        event_hash: event.eventHash,
        signature: event.signature,
        protocol_version: event.protocolVersion || 'agent/1',
      })

    if (insertErr) {
      console.error('Supabase Event Insert Error:', insertErr)
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'SEQUENCE_CONFLICT' }, { status: 409 })
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Optionally update execution event_count
    await supabase.rpc('increment_execution_event_count', { exec_id: event.executionId })

    return NextResponse.json({ success: true, eventId: event.eventId })
  } catch (err: unknown) {
    console.error('Agent Event API Error:', (err as Error).message || String(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
