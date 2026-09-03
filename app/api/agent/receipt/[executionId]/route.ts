import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAgentReceipt } from '@/app/lib/agent/agentReceipt'
import type { AgentExecution, AgentEvent, AnchorReference, IrysArchiveReference } from '@/app/lib/agent/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params

    if (!executionId) {
      return NextResponse.json({ error: 'executionId is required' }, { status: 400 })
    }

    // 1. Fetch Execution
    const { data: exec, error: execErr } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('execution_id', executionId)
      .single()

    if (execErr || !exec) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    // 2. Fetch Events
    const { data: events, error: eventsErr } = await supabase
      .from('agent_events')
      .select('*')
      .eq('execution_id', executionId)
      .order('sequence', { ascending: true })

    if (eventsErr || !events) {
      return NextResponse.json({ error: 'Failed to fetch execution events' }, { status: 500 })
    }

    // 3. Fetch Latest Batch
    const { data: batch } = await supabase
      .from('agent_batches')
      .select('*')
      .eq('batch_id', executionId)
      .maybeSingle()

    let anchorRef: AnchorReference | null = null
    if (batch?.solana_pda) {
      anchorRef = {
        network: 'devnet',
        programId: process.env.NEXT_PUBLIC_PROVN_PROGRAM_ID || 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx',
        pda: batch.solana_pda,
        signature: batch.solana_signature || null
      }
    }

    // 4. Map DB records to Agent Types
    const execution: AgentExecution = {
      executionId: exec.execution_id,
      agentPublicKey: exec.agent_public_key,
      status: exec.status,
      startedAt: new Date(exec.started_at).toISOString(),
      completedAt: exec.completed_at ? new Date(exec.completed_at).toISOString() : null,
      eventCount: exec.event_count || events.length,
      terminalEventHash: exec.terminal_event_hash || null,
      merkleRoot: exec.merkle_root || null,
      anchorReference: anchorRef,
      protocolVersion: exec.protocol_version || 'agent/1'
    }

    const typedEvents: AgentEvent[] = events.map(row => ({
      eventId: row.event_id,
      executionId: row.execution_id,
      sequence: row.sequence,
      agentPublicKey: row.agent_public_key,
      eventType: row.event_type,
      timestamp: new Date(row.timestamp).toISOString(),
      parentEventId: row.parent_event_id,
      previousEventHash: row.previous_event_hash,
      payload: { type: row.event_type, ...((row.payload as Record<string, unknown>) || {}) },
      payloadHash: row.payload_hash,
      eventHash: row.event_hash,
      signature: row.signature,
      protocolVersion: row.protocol_version || 'agent/1'
    }))

    let irysRef: IrysArchiveReference | null = null
    if (batch?.irys_tx_id) {
      irysRef = {
        txId: batch.irys_tx_id,
        timestamp: batch.created_at || new Date().toISOString(),
        url: `https://devnet.irys.xyz/${batch.irys_tx_id}`
      }
    }

    const receipt = buildAgentReceipt(execution, typedEvents, anchorRef, irysRef)

    return NextResponse.json(receipt, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (err: unknown) {
    console.error('Receipt API Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
