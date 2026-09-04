import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { authenticateAgentRequest } from '@/app/lib/agent/apiKeyAuth'
import { recomputeEventHash, verifyEventSignature, computePayloadHash } from '@/app/lib/agent/agentEvents'
import { verifyHashChain } from '@/app/lib/agent/hashChain'
import { buildMerkleTree } from '@/app/lib/agent/merkleBatch'
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
    const { executionId, batchId: clientBatchId, expectedMerkleRoot } = body

    if (!executionId) {
      return NextResponse.json({ error: 'executionId is required' }, { status: 400 })
    }

    // 2. Fetch execution and verify tenant ownership
    const { data: exec, error: execErr } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('execution_id', executionId)
      .maybeSingle()

    if (execErr) {
      console.error('Execution Query Error:', execErr)
      return NextResponse.json({ error: 'Database error fetching execution' }, { status: 500 })
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

    // Idempotency check: If execution has already been finalized and sealed, return existing batch/roots
    if (exec.status === 'completed' && exec.merkle_root) {
      let existingBatchId = exec.batch_id
      if (!existingBatchId) {
        const { data: b } = await supabase
          .from('agent_batches')
          .select('batch_id')
          .eq('execution_id', executionId)
          .maybeSingle()
        existingBatchId = b?.batch_id || null
      }
      return NextResponse.json({
        success: true,
        batchId: existingBatchId,
        merkleRoot: exec.merkle_root,
        terminalEventHash: exec.terminal_event_hash,
        eventCount: exec.event_count,
        verified: true,
        alreadyFinalized: true,
      })
    }

    // 3. Fetch all events for this execution from the database
    const { data: dbEvents, error: eventsErr } = await supabase
      .from('agent_events')
      .select('*')
      .eq('execution_id', executionId)
      .order('sequence', { ascending: true })

    if (eventsErr) {
      console.error('Events Query Error:', eventsErr)
      return NextResponse.json({ error: 'Database error fetching execution events' }, { status: 500 })
    }

    if (!dbEvents || dbEvents.length === 0) {
      return NextResponse.json({ error: 'CANNOT_FINALIZE_EMPTY_EXECUTION: Zero events found' }, { status: 400 })
    }

    // 4. Map to typed AgentEvents for cryptographic verification
    const typedEvents: AgentEvent[] = dbEvents.map((row) => ({
      eventId: row.event_id,
      executionId: row.execution_id,
      sequence: row.sequence,
      agentPublicKey: row.agent_public_key,
      eventType: row.event_type,
      timestamp: new Date(row.timestamp).toISOString(),
      parentEventId: row.parent_event_id,
      previousEventHash: row.previous_event_hash,
      payloadHash: row.payload_hash,
      payload: row.payload ? (row.payload as Record<string, unknown> & { type: typeof row.event_type }) : undefined,
      eventHash: row.event_hash,
      signature: row.signature,
      protocolVersion: row.protocol_version || 'agent/1',
    }))

    // 5. Server-Authoritative Cryptographic Verification
    // A. Verify every single event hash, payload integrity, and signature independently
    for (const ev of typedEvents) {
      if (ev.payload) {
        const computedPayloadHash = computePayloadHash(ev.payload)
        if (computedPayloadHash !== ev.payloadHash) {
          return NextResponse.json(
            {
              error: 'PAYLOAD_HASH_CORRUPTED_IN_DB',
              sequence: ev.sequence,
              expected: ev.payloadHash,
              actual: computedPayloadHash,
            },
            { status: 400 }
          )
        }
      }

      const computedHash = recomputeEventHash(ev)
      if (computedHash !== ev.eventHash) {
        return NextResponse.json(
          {
            error: 'EVENT_HASH_CORRUPTED_IN_DB',
            sequence: ev.sequence,
            expected: computedHash,
            actual: ev.eventHash,
          },
          { status: 400 }
        )
      }

      const isSigValid = verifyEventSignature(ev.eventHash, ev.signature, exec.agent_public_key)
      if (!isSigValid) {
        return NextResponse.json(
          {
            error: 'SIGNATURE_INVALID_IN_DB',
            sequence: ev.sequence,
          },
          { status: 400 }
        )
      }
    }

    // B. Verify monotonic hash chain continuity
    const chainVerification = verifyHashChain(typedEvents)
    if (!chainVerification.valid) {
      return NextResponse.json(
        {
          error: 'HASH_CHAIN_INTEGRITY_FAILURE',
          failures: chainVerification.failures,
        },
        { status: 400 }
      )
    }

    // 6. Server-Authoritative Merkle Tree & Root Computation
    const eventHashes = typedEvents.map((e) => e.eventHash)
    const merkleTree = buildMerkleTree(eventHashes)
    const authoritativeMerkleRoot = merkleTree.root
    const authoritativeTerminalHash = typedEvents[typedEvents.length - 1].eventHash
    const authoritativeEventCount = typedEvents.length

    // If client provided an expected root, verify it matches the server computation
    if (expectedMerkleRoot && expectedMerkleRoot !== authoritativeMerkleRoot) {
      return NextResponse.json(
        {
          error: 'MERKLE_ROOT_MISMATCH: Client supplied root diverges from server-computed tree',
          computed: authoritativeMerkleRoot,
          provided: expectedMerkleRoot,
        },
        { status: 400 }
      )
    }

    // 7. Insert authoritative batch record (linking execution_id explicitly!)
    // 7. Atomic Server-Authoritative Finalization via RPC (Transactional)
    const finalBatchId = clientBatchId || crypto.randomUUID()
    const batchNetwork = auth.networkTarget || (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet'

    const { data: rpcData, error: rpcErr } = await supabase.rpc('finalize_agent_execution', {
      p_execution_id: executionId,
      p_batch_id: finalBatchId,
      p_merkle_root: authoritativeMerkleRoot,
      p_terminal_event_hash: authoritativeTerminalHash,
      p_event_count: authoritativeEventCount,
      p_first_sequence: typedEvents[0].sequence,
      p_last_sequence: typedEvents[typedEvents.length - 1].sequence,
      p_network: batchNetwork,
    })

    if (rpcErr || !rpcData || !rpcData.success) {
      console.error('finalize_agent_execution RPC error:', rpcErr || rpcData?.error)
      return NextResponse.json(
        {
          error: 'FINALIZATION_UNAVAILABLE',
          message: 'Atomic execution finalization could not be completed. Non-atomic fallback is disabled to guarantee transactional consistency.',
          details: rpcErr?.message || rpcData?.error,
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      batchId: rpcData.batch_id || finalBatchId,
      merkleRoot: authoritativeMerkleRoot,
      terminalEventHash: authoritativeTerminalHash,
      eventCount: authoritativeEventCount,
      verified: true,
      outboxEnqueued: true,
      alreadyFinalized: rpcData.already_finalized || false,
    })
  } catch (err: unknown) {
    console.error('Agent Finalize API Error:', (err as Error).message || String(err))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
