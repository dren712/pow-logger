-- ============================================================================
-- PROVN TRACK B: SECURITY HARDENING, PAYLOAD PRESERVATION & ATOMIC OUTBOX
-- ============================================================================
-- Closes agent trust boundaries:
--   1. Multi-tenant isolation: binds events to project_id and execution ownership
--   2. Safe payload preservation: stores payload JSONB for Layer 3 audit fidelity
--   3. Relational integrity: explicit foreign keys between batches and executions
--   4. Atomic outbox concurrency: SELECT ... FOR UPDATE SKIP LOCKED function
--   5. Strict RLS lockdown: outbox and API keys restricted to service_role
-- ============================================================================

-- 1. Add payload JSONB and project_id to agent_events
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_events' AND column_name = 'payload'
    ) THEN 
        ALTER TABLE public.agent_events ADD COLUMN payload JSONB;
    END IF; 

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_events' AND column_name = 'project_id'
    ) THEN 
        ALTER TABLE public.agent_events ADD COLUMN project_id UUID REFERENCES public.agent_projects(id) ON DELETE CASCADE;
    END IF; 
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_events_project ON public.agent_events(project_id);

-- 2. Link agent_batches and agent_executions explicitly
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_batches' AND column_name = 'execution_id'
    ) THEN 
        ALTER TABLE public.agent_batches ADD COLUMN execution_id UUID REFERENCES public.agent_executions(execution_id) ON DELETE CASCADE;
    END IF; 

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_executions' AND column_name = 'batch_id'
    ) THEN 
        ALTER TABLE public.agent_executions ADD COLUMN batch_id TEXT;
    END IF; 
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_batches_execution ON public.agent_batches(execution_id);

-- 3. Add next_attempt_at to agent_outbox for proper backoff scheduling
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_outbox' AND column_name = 'next_attempt_at'
    ) THEN 
        ALTER TABLE public.agent_outbox ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF; 
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_outbox_schedule 
    ON public.agent_outbox(status, next_attempt_at, claim_expires_at);

-- 4. Atomic Outbox Claim Function with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION claim_outbox_tasks(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 5,
    p_lease_seconds INT DEFAULT 60
)
RETURNS SETOF public.agent_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lease_expiry TIMESTAMPTZ := now() + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH eligible AS (
        SELECT id
        FROM public.agent_outbox
        WHERE (status IN ('PENDING', 'RETRYING') AND next_attempt_at <= now())
           OR (status = 'CLAIMED' AND claim_expires_at < now())
        ORDER BY created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.agent_outbox o
    SET status = 'CLAIMED',
        claimed_by = p_worker_id,
        claim_expires_at = v_lease_expiry,
        attempts = o.attempts + 1,
        updated_at = now()
    FROM eligible
    WHERE o.id = eligible.id
    RETURNING o.*;
END;
$$;

-- 5. Strict RLS Lockdown: Outbox and API Keys are never public
DROP POLICY IF EXISTS "Public read agent outbox" ON public.agent_outbox;
DROP POLICY IF EXISTS "Public read agent projects" ON public.agent_projects;

-- Re-establish secure service role and project scoping
CREATE POLICY "Service role manages outbox strictly"
    ON public.agent_outbox
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages projects strictly"
    ON public.agent_projects
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
