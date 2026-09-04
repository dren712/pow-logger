-- ============================================================================
-- PROVN TRACK B: ATOMIC EXECUTION FINALIZATION & TRANSACTIONAL OUTBOX
-- ============================================================================
-- Eliminates distributed-systems race conditions during execution sealing.
-- Performs batch creation, execution state sealing, and outbox task enqueueing
-- within a single atomic PostgreSQL transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_agent_execution(
    p_execution_id UUID,
    p_batch_id TEXT,
    p_merkle_root TEXT,
    p_terminal_event_hash TEXT,
    p_event_count INT,
    p_first_sequence INT,
    p_last_sequence INT,
    p_network TEXT DEFAULT 'devnet'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exec RECORD;
BEGIN
    -- 1. Check execution existence and status
    SELECT status, merkle_root, batch_id, terminal_event_hash, event_count
    INTO v_exec
    FROM public.agent_executions
    WHERE execution_id = p_execution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EXECUTION_NOT_FOUND'
        );
    END IF;

    -- Idempotency: If already finalized, return existing state
    IF v_exec.status = 'completed' AND v_exec.merkle_root IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_finalized', true,
            'batch_id', COALESCE(v_exec.batch_id, p_batch_id),
            'merkle_root', v_exec.merkle_root,
            'terminal_event_hash', v_exec.terminal_event_hash,
            'event_count', v_exec.event_count
        );
    END IF;

    -- 2. Insert authoritative batch record
    INSERT INTO public.agent_batches (
        batch_id,
        execution_id,
        merkle_root,
        event_count,
        first_sequence,
        last_sequence,
        network,
        status,
        created_at
    ) VALUES (
        p_batch_id,
        p_execution_id,
        p_merkle_root,
        p_event_count,
        p_first_sequence,
        p_last_sequence,
        p_network,
        'pending_solana',
        now()
    );

    -- 3. Update execution to completed state
    UPDATE public.agent_executions
    SET status = 'completed',
        batch_id = p_batch_id,
        completed_at = now(),
        terminal_event_hash = p_terminal_event_hash,
        merkle_root = p_merkle_root,
        event_count = p_event_count
    WHERE execution_id = p_execution_id;

    -- 4. Enqueue transactional outbox tasks
    INSERT INTO public.agent_outbox (
        batch_id,
        execution_id,
        task_type,
        status,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES 
    (
        p_batch_id,
        p_execution_id,
        'SOLANA_ANCHOR',
        'PENDING',
        'solana:' || p_batch_id,
        now(),
        now()
    ),
    (
        p_batch_id,
        p_execution_id,
        'IRYS_ARCHIVE',
        'PENDING',
        'irys:' || p_batch_id,
        now(),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_finalized', false,
        'batch_id', p_batch_id,
        'execution_id', p_execution_id,
        'merkle_root', p_merkle_root,
        'terminal_event_hash', p_terminal_event_hash,
        'event_count', p_event_count,
        'outbox_enqueued', true
    );
END;
$$;

-- Grant execution to service_role
GRANT EXECUTE ON FUNCTION public.finalize_agent_execution(UUID, TEXT, TEXT, TEXT, INT, INT, INT, TEXT) TO service_role;
