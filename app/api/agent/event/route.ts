import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeEventHash, verifyEventSignature, computePayloadHash } from '@/app/lib/agent/agentEvents'
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

    // 2. Tenant Isolation & Identity Check: Verify execution exists and belongs to this project
    const { data: exec, error: execErr } = await supabase
      .from('agent_executions')
      .select('execution_id, project_id, agent_public_key')
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

    // Invariant: Event signer must match execution agent identity
    if (exec.agent_public_key && event.agentPublicKey !== exec.agent_public_key) {
      return NextResponse.json(
        {
          error: 'AGENT_PUBLIC_KEY_MISMATCH: Event signer does not match execution agent identity',
          expected: exec.agent_public_key,
          provided: event.agentPublicKey,
        },
        { status: 400 }
      )
    }

    // Atomic quota consumption if project ID is available
    if (auth.projectId) {
      try {
        const { data: quotaRows, error: quotaErr } = await supabase.rpc(
          'consume_agent_event_quota',
          { p_project_id: auth.projectId, p_count: 1 }
        )
        if (!quotaErr && quotaRows && quotaRows[0] && !quotaRows[0].allowed) {
          return NextResponse.json(
            {
              error: `Monthly event quota exceeded (${quotaRows[0].monthly_events_used}/${quotaRows[0].monthly_event_limit}). Upgrade tier for more capacity.`,
            },
            { status: 403 }
          )
        }
      } catch (qErr) {
        console.warn('Atomic quota check warning:', qErr)
      }
    }

    // 3. Server-side Cryptographic Verification (Zero Trust)
    if (event.payload) {
      const computedPayloadHash = computePayloadHash(event.payload)
      if (computedPayloadHash !== event.payloadHash) {
        return NextResponse.json(
          {
            error: 'PAYLOAD_HASH_MISMATCH: Provided payload does not match signed payloadHash',
            expected: event.payloadHash,
            computed: computedPayloadHash,
          },
          { status: 400 }
        )
      }
    }

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
