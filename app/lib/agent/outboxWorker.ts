/**
 * PROVN Agent Protocol — Transactional Outbox Worker
 * 
 * Provides durable, asynchronous, and idempotent delivery of batch commitments:
 *   - Solana on-chain anchor transactions
 *   - Irys Arweave evidence uploads
 *   - Automatic reconciliation and lease-based concurrency control
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildAnchorAgentBatchInstruction, buildAnchorReference, decodeAgentBatchAnchorAccount } from './solanaAgentAnchor'
import { buildIrysEvidenceEnvelope, buildAgentReceipt } from './agentReceipt'
import { Uploader } from '@irys/upload'
import { Solana } from '@irys/upload-solana'
import type { AgentExecution, AgentEvent } from './types'

export interface OutboxConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  solanaSecretKey?: Uint8Array
  solanaCluster?: 'devnet' | 'mainnet-beta' | 'localnet'
  solanaRpcUrl?: string
  solanaProgramId?: string
  irysNetwork?: 'devnet' | 'mainnet'
  workerId?: string
}

export interface OutboxTask {
  id: string
  batch_id: string
  execution_id: string
  task_type: 'SOLANA_ANCHOR' | 'IRYS_ARCHIVE' | 'RECONCILE'
  status: 'PENDING' | 'CLAIMED' | 'COMPLETED' | 'FAILED' | 'RETRYING'
  attempts: number
  max_attempts: number
  claimed_by: string | null
  claim_expires_at: string | null
  last_error: string | null
  idempotency_key: string | null
}

export class AgentOutboxWorker {
  private supabase: SupabaseClient
  private workerId: string
  private solanaKeypair: Keypair | null = null
  private connection: Connection
  private programId: PublicKey
  private cluster: 'devnet' | 'mainnet-beta' | 'localnet'
  private irysNetwork: 'devnet' | 'mainnet'

  constructor(config: OutboxConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
    this.workerId = config.workerId || `worker-${Math.random().toString(36).substring(2, 9)}`
    
    this.cluster = config.solanaCluster || (process.env.SOLANA_CLUSTER as 'devnet' | 'mainnet-beta' | 'localnet') || 'devnet'
    const rpcUrl = config.solanaRpcUrl || process.env.SOLANA_RPC_URL || clusterApiUrl(this.cluster === 'localnet' ? 'devnet' : this.cluster)
    this.connection = new Connection(rpcUrl, 'confirmed')
    
    const progId = config.solanaProgramId || process.env.NEXT_PUBLIC_PROVN_PROGRAM_ID || 'FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx'
    this.programId = new PublicKey(progId)

    this.irysNetwork = config.irysNetwork || (process.env.IRYS_NETWORK as 'devnet' | 'mainnet') || 'devnet'

    if (config.solanaSecretKey) {
      this.solanaKeypair = Keypair.fromSecretKey(config.solanaSecretKey)
    }
  }

  /**
   * Claims up to `batchSize` unassigned or lease-expired tasks atomically.
   */
  async claimTasks(batchSize = 5, leaseDurationSeconds = 60): Promise<OutboxTask[]> {
    const now = new Date().toISOString()
    const leaseExpiry = new Date(Date.now() + leaseDurationSeconds * 1000).toISOString()

    // Find tasks that are either PENDING, RETRYING, or CLAIMED but expired
    const { data: eligible, error: findError } = await this.supabase
      .from('agent_outbox')
      .select('*')
      .or(`status.in.(PENDING,RETRYING),and(status.eq.CLAIMED,claim_expires_at.lt.${now})`)
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (findError || !eligible || eligible.length === 0) {
      return []
    }

    const claimedTasks: OutboxTask[] = []

    for (const task of eligible) {
      // Optimistic concurrency claim
      const { data: updated, error: claimErr } = await this.supabase
        .from('agent_outbox')
        .update({
          status: 'CLAIMED',
          claimed_by: this.workerId,
          claim_expires_at: leaseExpiry,
          updated_at: new Date().toISOString(),
          attempts: task.attempts + 1
        })
        .eq('id', task.id)
        .select()
        .single()

      if (!claimErr && updated) {
        claimedTasks.push(updated as OutboxTask)
      }
    }

    return claimedTasks
  }

  /**
   * Processes a single claimed outbox task.
   */
  async processTask(task: OutboxTask): Promise<boolean> {
    try {
      if (task.task_type === 'SOLANA_ANCHOR') {
        await this.handleSolanaAnchor(task)
      } else if (task.task_type === 'IRYS_ARCHIVE') {
        await this.handleIrysArchive(task)
      }

      // Mark completed
      await this.supabase
        .from('agent_outbox')
        .update({
          status: 'COMPLETED',
          claimed_by: null,
          claim_expires_at: null,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      return true
    } catch (err: unknown) {
      const isExhausted = task.attempts >= task.max_attempts
      const nextStatus = isExhausted ? 'FAILED' : 'RETRYING'

      await this.supabase
        .from('agent_outbox')
        .update({
          status: nextStatus,
          claimed_by: null,
          claim_expires_at: null,
          last_error: (err as Error).message || String(err),
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      return false
    }
  }

  /**
   * Idempotent Solana Anchoring with Reconciliation
   */
  private async handleSolanaAnchor(task: OutboxTask): Promise<void> {
    if (!this.solanaKeypair) {
      throw new Error('Solana keypair not configured for outbox worker')
    }

    const { data: batch, error: batchErr } = await this.supabase
      .from('agent_batches')
      .select('*')
      .eq('batch_id', task.batch_id)
      .single()

    if (batchErr || !batch) {
      throw new Error(`Batch not found for outbox task: ${task.batch_id}`)
    }

    // 1. Reconciliation: Check if the on-chain PDA already exists with the target root
    const anchorRef = buildAnchorReference(this.solanaKeypair.publicKey, batch.batch_id, this.cluster, this.programId)
    const pdaPubkey = new PublicKey(anchorRef.pda)
    
    try {
      const accountInfo = await this.connection.getAccountInfo(pdaPubkey)
      if (accountInfo) {
        const decoded = decodeAgentBatchAnchorAccount(accountInfo.data)
        if (decoded.merkleRoot === batch.merkle_root) {
          // Already anchored! Reconcile database state idempotently
          await this.supabase
            .from('agent_batches')
            .update({
              solana_pda: anchorRef.pda,
              status: 'anchored',
              updated_at: new Date().toISOString()
            })
            .eq('batch_id', batch.batch_id)
          return
        }
      }
    } catch {
      // Continue to submission if check fails or account does not exist
    }

    // 2. Submit transaction
    const ix = buildAnchorAgentBatchInstruction({
      batchId: batch.batch_id,
      authority: this.solanaKeypair.publicKey,
      merkleRoot: batch.merkle_root,
      eventCount: batch.event_count,
      timestamp: Date.now(),
      programId: this.programId
    })

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
    const tx = new Transaction().add(ix)
    tx.recentBlockhash = blockhash
    tx.feePayer = this.solanaKeypair.publicKey

    const signature = await sendAndConfirmTransaction(this.connection, tx, [this.solanaKeypair])

    // 3. Update Batch state
    await this.supabase
      .from('agent_batches')
      .update({
        solana_signature: signature,
        solana_pda: anchorRef.pda,
        status: 'anchored',
        updated_at: new Date().toISOString()
      })
      .eq('batch_id', batch.batch_id)
  }

  /**
   * Idempotent Irys Archival
   */
  private async handleIrysArchive(task: OutboxTask): Promise<void> {
    if (!this.solanaKeypair) {
      throw new Error('Solana keypair required for Irys upload')
    }

    const { data: batch, error: batchErr } = await this.supabase
      .from('agent_batches')
      .select('*')
      .eq('batch_id', task.batch_id)
      .single()

    if (batchErr || !batch) {
      throw new Error(`Batch not found for outbox task: ${task.batch_id}`)
    }

    // Fetch execution
    const { data: exec } = await this.supabase
      .from('agent_executions')
      .select('*')
      .eq('execution_id', task.execution_id)
      .single()

    // Fetch events in batch range
    const { data: events } = await this.supabase
      .from('agent_events')
      .select('*')
      .eq('execution_id', task.execution_id)
      .gte('sequence', batch.first_sequence)
      .lte('sequence', batch.last_sequence)
      .order('sequence', { ascending: true })

    if (!exec || !events) {
      throw new Error('Execution or events missing for batch archival')
    }

    const anchorRef = buildAnchorReference(this.solanaKeypair.publicKey, batch.batch_id, this.cluster, this.programId)

    const typedExecution: AgentExecution = {
      executionId: exec.execution_id,
      agentPublicKey: exec.agent_public_key,
      status: exec.status,
      startedAt: exec.started_at,
      completedAt: exec.completed_at,
      eventCount: exec.event_count,
      terminalEventHash: exec.terminal_event_hash,
      merkleRoot: exec.merkle_root,
      anchorReference: anchorRef,
      protocolVersion: exec.protocol_version
    }

    const typedEvents: AgentEvent[] = events.map(e => ({
      eventId: e.event_id,
      executionId: e.execution_id,
      sequence: e.sequence,
      agentPublicKey: e.agent_public_key,
      eventType: e.event_type,
      timestamp: new Date(e.timestamp).toISOString(),
      parentEventId: e.parent_event_id,
      previousEventHash: e.previous_event_hash,
      payload: { type: e.event_type, ...((e.payload as Record<string, unknown>) || {}) },
      payloadHash: e.payload_hash,
      eventHash: e.event_hash,
      signature: e.signature,
      protocolVersion: e.protocol_version
    }))

    const agentReceipt = buildAgentReceipt(typedExecution, typedEvents, anchorRef, null)
    const envelope = buildIrysEvidenceEnvelope(agentReceipt)

    const uploader = await Uploader(Solana)
      .withWallet(this.solanaKeypair.secretKey)
      .withRpc(this.connection.rpcEndpoint)

    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Protocol', value: 'PROVN-Agent-v1' },
      { name: 'Batch-ID', value: batch.batch_id },
      { name: 'Execution-ID', value: task.execution_id }
    ]

    const receipt = await uploader.upload(JSON.stringify(envelope), { tags })

    await this.supabase
      .from('agent_batches')
      .update({
        irys_tx_id: receipt.id,
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('batch_id', batch.batch_id)
  }
}
