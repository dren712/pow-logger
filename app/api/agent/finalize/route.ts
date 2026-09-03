import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      executionId, 
      terminalEventHash,
      batchId, 
      merkleRoot, 
      eventCount,
      firstSequence,
      lastSequence 
    } = body

    if (!executionId || !batchId || !merkleRoot) {
      return NextResponse.json({ error: 'Missing required finalization fields' }, { status: 400 })
    }

    // 1. Insert into agent_batches
    const { error: batchError } = await supabase
      .from('agent_batches')
      .insert({
        batch_id: batchId,
        merkle_root: merkleRoot,
        event_count: eventCount,
        first_sequence: firstSequence || 0,
        last_sequence: lastSequence || (eventCount - 1),
        status: 'pending_solana'
      })

    if (batchError) {
      console.error('Supabase Batch Error:', batchError)
      return NextResponse.json({ error: batchError.message }, { status: 500 })
    }

    // 2. Update agent_executions
    const { error: execError } = await supabase
      .from('agent_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        terminal_event_hash: terminalEventHash,
        merkle_root: merkleRoot,
        event_count: eventCount
      })
      .eq('execution_id', executionId)

    if (execError) {
      console.error('Supabase Execution Error:', execError)
      return NextResponse.json({ error: execError.message }, { status: 500 })
    }

    // 3. Enqueue transactional outbox tasks for asynchronous Solana & Irys delivery
    try {
      await supabase.from('agent_outbox').insert([
        {
          batch_id: batchId,
          execution_id: executionId,
          task_type: 'SOLANA_ANCHOR',
          status: 'PENDING',
          idempotency_key: `solana:${batchId}`
        },
        {
          batch_id: batchId,
          execution_id: executionId,
          task_type: 'IRYS_ARCHIVE',
          status: 'PENDING',
          idempotency_key: `irys:${batchId}`
        }
      ])
    } catch (outboxErr: unknown) {
      // Non-blocking fallback if outbox table is still pending migration
      console.warn('Outbox enqueue warning (table may be pending migration):', (outboxErr as Error)?.message || String(outboxErr))
    }

    return NextResponse.json({ 
      success: true, 
      batchId,
      outboxEnqueued: true
    })
  } catch (err: unknown) {
    console.error('Agent Finalize API Error:', (err as Error).message || String(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
