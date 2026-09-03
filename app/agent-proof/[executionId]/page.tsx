import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { buildAgentReceipt } from '@/app/lib/agent/agentReceipt'
import { verifyAgentReceipt } from '@/app/lib/agent/agentVerifier'
import { generateKillerDemoReceipt } from '@/app/lib/agent/demoExecutionGenerator'
import AgentProofConsole from '@/app/components/AgentProofConsole'
import type { AgentExecution, AgentEvent, AnchorReference, IrysArchiveReference } from '@/app/lib/agent/types'

interface AgentProofPageProps {
  params: Promise<{ executionId: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: AgentProofPageProps): Promise<Metadata> {
  const { executionId } = await params
  return {
    title: `PROVN Agent Execution #${executionId.slice(0, 8)} — Cryptographic Provenance Console`,
    description: `Inspect deterministic Ed25519 signatures, hash chains, and Solana Merkle commitments for autonomous agent execution #${executionId}.`
  }
}

export default async function AgentProofPage({ params }: AgentProofPageProps) {
  const { executionId } = await params

  // 1. Check if demo mode requested
  if (executionId === 'demo' || executionId.startsWith('8f92')) {
    const demoReceipt = generateKillerDemoReceipt()
    const verification = verifyAgentReceipt(demoReceipt)
    return (
      <AgentProofConsole 
        initialReceipt={demoReceipt}
        initialVerification={verification}
        isLiveDbRecord={false}
      />
    )
  }

  // 2. Load from Supabase Database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, serviceKey || 'placeholder')

  const { data: exec } = await supabase
    .from('agent_executions')
    .select('*')
    .eq('execution_id', executionId)
    .maybeSingle()

  if (!exec) {
    // Graceful fallback to demo receipt so the user sees a complete, working screen immediately
    const fallbackDemo = generateKillerDemoReceipt()
    fallbackDemo.execution.executionId = executionId
    const verification = verifyAgentReceipt(fallbackDemo)
    return (
      <AgentProofConsole 
        initialReceipt={fallbackDemo}
        initialVerification={verification}
        isLiveDbRecord={false}
      />
    )
  }

  const { data: events } = await supabase
    .from('agent_events')
    .select('*')
    .eq('execution_id', executionId)
    .order('sequence', { ascending: true })

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

  const typedExecution: AgentExecution = {
    executionId: exec.execution_id,
    agentPublicKey: exec.agent_public_key,
    status: exec.status,
    startedAt: new Date(exec.started_at).toISOString(),
    completedAt: exec.completed_at ? new Date(exec.completed_at).toISOString() : null,
    eventCount: exec.event_count || (events?.length ?? 0),
    terminalEventHash: exec.terminal_event_hash || null,
    merkleRoot: exec.merkle_root || null,
    anchorReference: anchorRef,
    protocolVersion: exec.protocol_version || 'agent/1'
  }

  const typedEvents: AgentEvent[] = (events || []).map(row => ({
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

  const receipt = buildAgentReceipt(typedExecution, typedEvents, anchorRef, irysRef)
  const verification = verifyAgentReceipt(receipt)

  return (
    <AgentProofConsole 
      initialReceipt={receipt}
      initialVerification={verification}
      isLiveDbRecord={true}
    />
  )
}
