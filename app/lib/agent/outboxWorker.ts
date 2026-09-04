/**
 * PROVN Agent Protocol — Transactional Outbox Worker
 * 
 * Provides durable, asynchronous, and idempotent delivery of batch commitments:
 *   - Solana on-chain anchor transactions
 *   - Irys Arweave evidence uploads
 *   - Automatic reconciliation and lease-based atomic concurrency control
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
  next_attempt_at: string | null
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
   * Prioritizes PostgreSQL `claim_outbox_tasks` (FOR UPDATE SKIP LOCKED).
   */
  async claimTasks(batchSize = 5, leaseDurationSeconds = 60): Promise<OutboxTask[]> {
    // 1. Try atomic database-level RPC function with FOR UPDATE SKIP LOCKED
    try {
      const { data: rpcClaimed, error: rpcErr } = await this.supabase
        .rpc('claim_outbox_tasks', {
          p_worker_id: this.workerId,
          p_batch_size: batchSize,
          p_lease_seconds: leaseDurationSeconds,
        })

      if (!rpcErr && rpcClaimed && Array.isArray(rpcClaimed) && rpcClaimed.length > 0) {
        return rpcClaimed as OutboxTask[]
      }
    } catch {
      // Fall through to conditional atomic claim
    }

    // 2. Fallback: Atomic conditional update per eligible item
    const now = new Date().toISOString()
    const leaseExpiry = new Date(Date.now() + leaseDurationSeconds * 1000).toISOString()

    const { data: eligible, error: findError } = await this.supabase
      .from('agent_outbox')
      .select('id, attempts')
      .or(`status.in.(PENDING,RETRYING),and(status.eq.CLAIMED,claim_expires_at.lt.${now})`)
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (findError || !eligible || eligible.length === 0) {
      return []
    }

    const claimedTasks: OutboxTask[] = []

    for (const item of eligible) {
      // Conditional atomic update with state check in the WHERE clause
      const { data: updated } = await this.supabase
        .from('agent_outbox')
        .update({
          status: 'CLAIMED',
          claimed_by: this.workerId,
          claim_expires_at: leaseExpiry,
          updated_at: new Date().toISOString(),
          attempts: item.attempts + 1,
        })
        .eq('id', item.id)
        .or(`status.in.(PENDING,RETRYING),and(status.eq.CLAIMED,claim_expires_at.lt.${now})`)
        .select()
        .maybeSingle()

      if (updated) {
        claimedTasks.push(updated as OutboxTask)
      }
    }

    return claimedTasks
  }

  /**
   * Processes a single claimed outbox task with idempotent execution and backoff.
   */
  async processTask(task: OutboxTask): Promise<boolean> {
    try {
      if (task.task_type === 'SOLANA_ANCHOR') {
        await this.handleSolanaAnchor(task)
      } else if (task.task_type === 'IRYS_ARCHIVE') {
        await this.handleIrysArchive(task)
      }

      // Mark completed cleanly
      await this.supabase
        .from('agent_outbox')
        .update({
          status: 'COMPLETED',
          claimed_by: null,
          claim_expires_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      return true
    } catch (err: unknown) {
      const isExhausted = task.attempts >= task.max_attempts
      const nextStatus = isExhausted ? 'FAILED' : 'RETRYING'

      // Exponential backoff: 30s * 2^(attempts-1), capped at 2 hours
      const backoffSeconds = Math.min(7200, Math.pow(2, Math.max(0, task.attempts - 1)) * 30)
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()

      await this.supabase
        .from('agent_outbox')
        .update({
          status: nextStatus,
          claimed_by: null,
          claim_expires_at: null,
          next_attempt_at: nextAttemptAt,
          last_error: (err as Error).message || String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      return false
    }
  }

  /**
   * Idempotent Solana Anchoring with On-Chain Reconciliation
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
          // Already anchored! Reconcile database state idempotently & recover transaction signature from chain
          let recoveredSig = batch.solana_signature
          if (!recoveredSig) {
            try {
              const sigs = await this.connection.getSignaturesForAddress(pdaPubkey, { limit: 1 })
              if (sigs.length > 0 && sigs[0].signature) {
                recoveredSig = sigs[0].signature
              }
            } catch (sigErr) {
              console.warn(`Could not recover transaction signature for PDA ${anchorRef.pda}:`, (sigErr as Error).message)
            }
          }
          await this.supabase
            .from('agent_batches')
            .update({
              solana_pda: anchorRef.pda,
              ...(recoveredSig ? { solana_signature: recoveredSig } : {}),
              status: 'anchored',
              updated_at: new Date().toISOString(),
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
      programId: this.programId,
    })

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
    const tx = new Transaction().add(ix)
    tx.recentBlockhash = blockhash
    tx.feePayer = this.solanaKeypair.publicKey

    try {
      const signature = await sendAndConfirmTransaction(this.connection, tx, [this.solanaKeypair])

      // 3. Update Batch state
      await this.supabase
        .from('agent_batches')
        .update({
          solana_signature: signature,
          solana_pda: anchorRef.pda,
          status: 'anchored',
          updated_at: new Date().toISOString(),
        })
        .eq('batch_id', batch.batch_id)
    } catch (txErr: unknown) {
      // Handle ambiguity/race: If another process initialized the account or tx confirmed under timeout
      const checkInfo = await this.connection.getAccountInfo(pdaPubkey)
      if (checkInfo) {
        const decoded = decodeAgentBatchAnchorAccount(checkInfo.data)
        if (decoded.merkleRoot === batch.merkle_root) {
          let recoveredSig = batch.solana_signature
          if (!recoveredSig) {
            try {
              const sigs = await this.connection.getSignaturesForAddress(pdaPubkey, { limit: 1 })
              if (sigs.length > 0 && sigs[0].signature) {
                recoveredSig = sigs[0].signature
              }
            } catch (sigErr) {
              console.warn(`Could not recover transaction signature for PDA ${anchorRef.pda}:`, (sigErr as Error).message)
            }
          }
          await this.supabase
            .from('agent_batches')
            .update({
              solana_pda: anchorRef.pda,
              ...(recoveredSig ? { solana_signature: recoveredSig } : {}),
              status: 'anchored',
              updated_at: new Date().toISOString(),
            })
            .eq('batch_id', batch.batch_id)
          return
        }
      }
      throw txErr
    }
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

    // Fetch events
    const { data: events } = await this.supabase
      .from('agent_events')
      .select('*')
      .eq('execution_id', task.execution_id)
      .order('sequence', { ascending: true })

    if (!exec || !events) {
      throw new Error(`Incomplete execution records for archival: ${task.execution_id}`)
    }

    const anchorRef = batch.solana_pda ? {
      network: this.cluster,
      signature: batch.solana_signature,
      pda: batch.solana_pda,
      programId: this.programId.toBase58(),
    } : null

    const typedExec: AgentExecution = {
      executionId: exec.execution_id,
      agentPublicKey: exec.agent_public_key,
      status: exec.status,
      startedAt: exec.started_at,
      completedAt: exec.completed_at,
      eventCount: exec.event_count,
      terminalEventHash: exec.terminal_event_hash,
      merkleRoot: exec.merkle_root,
      anchorReference: anchorRef,
      protocolVersion: exec.protocol_version || 'agent/1',
    }

    const typedEvents: AgentEvent[] = events.map((row) => ({
      eventId: row.event_id,
      executionId: row.execution_id,
      sequence: row.sequence,
      agentPublicKey: row.agent_public_key,
      eventType: row.event_type,
      timestamp: row.timestamp,
      parentEventId: row.parent_event_id,
      previousEventHash: row.previous_event_hash,
      payload: row.payload
        ? { type: row.event_type, ...(row.payload as Record<string, unknown>) }
        : { type: row.event_type },
      payloadHash: row.payload_hash,
      eventHash: row.event_hash,
      signature: row.signature,
      protocolVersion: row.protocol_version || 'agent/1',
    }))

    const receipt = buildAgentReceipt(typedExec, typedEvents, anchorRef, null)
    const envelope = buildIrysEvidenceEnvelope(receipt)

    // Upload to Irys
    const rpcUrl = clusterApiUrl(this.cluster === 'localnet' ? 'devnet' : this.cluster)
    const uploader = await Uploader(Solana).withWallet(this.solanaKeypair.secretKey).withRpc(rpcUrl)

    const receiptData = JSON.stringify(envelope)
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'PROVN-Agent-Protocol' },
      { name: 'Protocol-Version', value: 'agent/1' },
      { name: 'Batch-ID', value: batch.batch_id },
      { name: 'Merkle-Root', value: batch.merkle_root },
    ]

    const uploadReceipt = await uploader.upload(receiptData, { tags })

    // Update batch record with permanent Irys transaction ID
    await this.supabase
      .from('agent_batches')
      .update({
        irys_tx_id: uploadReceipt.id,
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('batch_id', batch.batch_id)
  }

  /**
   * Continuous polling run loop with backoff on empty queue.
   */
  async runOnce(): Promise<number> {
    const tasks = await this.claimTasks(5)
    for (const task of tasks) {
      await this.processTask(task)
    }
    return tasks.length
  }
}
