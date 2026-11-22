import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { buildAgentReceipt } from '@/app/lib/agent/agentReceipt'
import { verifyAgentReceipt } from '@/app/lib/agent/agentVerifier'
import { generateHostileAgentReceipt, generateKillerDemoReceipt } from '@/app/lib/agent/demoExecutionGenerator'
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
    title: `Agent execution ${executionId.slice(0, 8)} — PROVN agent console`,
    description: `Signatures, hash chain, Merkle commitments and policy audit for agent execution ${executionId}.`
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
        hostileReceipt={generateHostileAgentReceipt()}
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
    // Not found: show the generated example, unmodified so it still verifies, with a notice naming the requested id
    const fallbackDemo = generateKillerDemoReceipt()
    const verification = verifyAgentReceipt(fallbackDemo)
    return (
      <AgentProofConsole 
        initialReceipt={fallbackDemo}
        initialVerification={verification}
        hostileReceipt={generateHostileAgentReceipt()}
        isLiveDbRecord={false}
        missingExecutionId={executionId}
      />
    )
  }

  const { data: events } = await supabase
    .from('agent_events')
    .select('*')
    .eq('execution_id', executionId)
    .order('sequence', { ascending: true })

  let batchQuery = supabase.from('agent_batches').select('*')
  if (exec.batch_id) {
    batchQuery = batchQuery.eq('batch_id', exec.batch_id)
  } else {
    batchQuery = batchQuery.eq('execution_id', executionId)
  }
  const { data: batch } = await batchQuery.maybeSingle()

  let anchorRef: AnchorReference | null = null
  if (batch?.solana_pda) {
    const solanaNetwork = (batch?.network as 'devnet' | 'mainnet-beta') || (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet'
    anchorRef = {
      network: solanaNetwork,
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
      hostileReceipt={generateHostileAgentReceipt()}
      isLiveDbRecord={true}
    />
  )
}
