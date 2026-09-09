-- ============================================================================
-- PROVN TRACK B: TRANSACTIONAL OUTBOX FOR AGENT BATCHES
-- ============================================================================
-- Ensures asynchronous, durable, and idempotent delivery of batches to:
--   1. Irys (Arweave Evidence Archival)
--   2. Solana (On-Chain Merkle Root Commitment)
--
-- Features:
--   - Lease-based concurrency control (claimed_by, claim_expires_at)
--   - Exponential backoff & retry tracking
--   - Reconciliation & dead-letter logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT NOT NULL REFERENCES public.agent_batches(batch_id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES public.agent_executions(execution_id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN ('SOLANA_ANCHOR', 'IRYS_ARCHIVE', 'RECONCILE')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'RETRYING')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    claimed_by TEXT,
    claim_expires_at TIMESTAMPTZ,
    last_error TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_outbox_queue 
    ON public.agent_outbox(status, claim_expires_at);

CREATE INDEX IF NOT EXISTS idx_agent_outbox_batch 
    ON public.agent_outbox(batch_id, task_type);

-- RLS
ALTER TABLE public.agent_outbox ENABLE ROW LEVEL SECURITY;

-- Public can read outbox task status for transparency
CREATE POLICY "Public read agent outbox"
    ON public.agent_outbox
    FOR SELECT
    USING (true);

-- Service role can manage outbox jobs
CREATE POLICY "Service role manages agent outbox"
    ON public.agent_outbox
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
