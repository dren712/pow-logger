-- ============================================================================
-- PROVN TRACK B: AGENT PROTOCOL v2.1 HARDENING MIGRATION
-- ============================================================================
-- Remediates critical correctness and integrity invariants:
--   1. Ensures agent_outbox.execution_id is strictly typed as UUID
--   2. Adds network column to agent_batches to avoid hardcoded devnet/mainnet
--   3. Enforces execution identity binding: agent_events must match execution identity
--   4. Provides atomic quota consumption function to eliminate concurrency races
-- ============================================================================

-- 1. Ensure execution_id in agent_outbox is UUID
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_outbox' AND column_name = 'execution_id' AND data_type = 'text'
    ) THEN 
        ALTER TABLE public.agent_outbox ALTER COLUMN execution_id TYPE UUID USING execution_id::UUID;
    END IF; 
END $$;

-- 2. Add network column to agent_batches (devnet | mainnet-beta)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_batches' AND column_name = 'network'
    ) THEN 
        ALTER TABLE public.agent_batches ADD COLUMN network TEXT NOT NULL DEFAULT 'devnet';
    END IF; 
END $$;

-- 3. Invariant: Bind event agent_public_key strictly to execution agent_public_key
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_agent_executions_identity'
    ) THEN 
        ALTER TABLE public.agent_executions ADD CONSTRAINT uq_agent_executions_identity UNIQUE (execution_id, agent_public_key);
    END IF; 

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_agent_events_identity'
    ) THEN 
        ALTER TABLE public.agent_events 
        ADD CONSTRAINT fk_agent_events_identity 
        FOREIGN KEY (execution_id, agent_public_key) 
        REFERENCES public.agent_executions(execution_id, agent_public_key) 
        ON DELETE CASCADE;
    END IF; 
END $$;

-- 4. Atomic quota consumption function
CREATE OR REPLACE FUNCTION public.consume_agent_event_quota(
    p_project_id UUID,
    p_count INT DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    monthly_events_used INT,
    monthly_event_limit INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_used INT;
    v_limit INT;
BEGIN
    -- Atomic quota check & increment
    UPDATE public.agent_projects
    SET monthly_events_used = monthly_events_used + p_count,
        updated_at = now()
    WHERE id = p_project_id
      AND (monthly_events_used + p_count) <= monthly_event_limit
    RETURNING monthly_events_used, monthly_event_limit INTO v_used, v_limit;

    IF FOUND THEN
        RETURN QUERY SELECT true, v_used, v_limit;
    ELSE
        SELECT p.monthly_events_used, p.monthly_event_limit
        INTO v_used, v_limit
        FROM public.agent_projects p
        WHERE p.id = p_project_id;

        RETURN QUERY SELECT false, COALESCE(v_used, 0), COALESCE(v_limit, 0);
    END IF;
END;
$$;

-- Grant execution to service_role
GRANT EXECUTE ON FUNCTION public.consume_agent_event_quota(UUID, INT) TO service_role;
