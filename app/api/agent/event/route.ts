import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeEventHash, verifyEventSignature } from '@/app/lib/agent/agentEvents'
import type { AgentEvent } from '@/app/lib/agent/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event }: { event: AgentEvent } = body

    if (!event || !event.eventId || !event.eventHash || !event.signature) {
      return NextResponse.json({ error: 'Malformed agent event' }, { status: 400 })
    }

    // Server-side Cryptographic Verification (Zero Trust)
    const expectedHash = recomputeEventHash(event)
    if (expectedHash !== event.eventHash) {
      return NextResponse.json({ error: 'EVENT_HASH_MISMATCH' }, { status: 400 })
    }

    const isValidSig = verifyEventSignature(event)
    if (!isValidSig) {
      return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 400 })
    }

    // Persist to database
    const { error } = await supabase
      .from('agent_events')
      .insert({
        event_id: event.eventId,
        execution_id: event.executionId,
        sequence: event.sequence,
        agent_public_key: event.agentPublicKey,
        event_type: event.eventType,
        timestamp: event.timestamp,
        parent_event_id: event.parentEventId,
        previous_event_hash: event.previousEventHash,
        payload_hash: event.payloadHash, // Note: payload must be a pre-computed hash commitment
        event_hash: event.eventHash,
        signature: event.signature,
        protocol_version: 'agent/1'
      })

    if (error) {
      console.error('Supabase Error:', error)
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'SEQUENCE_CONFLICT' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Optionally update execution event_count
    await supabase.rpc('increment_execution_event_count', { exec_id: event.executionId })

    return NextResponse.json({ success: true, eventId: event.eventId })
  } catch (err: any) {
    console.error('Agent Event API Error:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
