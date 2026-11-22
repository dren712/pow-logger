BEGIN;

ALTER TABLE public.agent_projects
ADD COLUMN quota_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());

CREATE OR REPLACE FUNCTION public.consume_agent_event_quota(
    p_project_id UUID,
    p_count INT DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, monthly_events_used INT, monthly_event_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_used INT;
    v_limit INT;
BEGIN
    IF p_count IS NULL OR p_count <= 0 THEN
        RAISE EXCEPTION 'Quota count must be positive';
    END IF;

    UPDATE public.agent_projects AS p
    SET monthly_events_used = CASE WHEN p.quota_period_start < date_trunc('month', now())
            THEN 0 ELSE p.monthly_events_used END + p_count,
        quota_period_start = CASE WHEN p.quota_period_start < date_trunc('month', now())
            THEN date_trunc('month', now()) ELSE p.quota_period_start END,
        updated_at = now()
    WHERE p.id = p_project_id
      AND (CASE WHEN p.quota_period_start < date_trunc('month', now())
            THEN 0 ELSE p.monthly_events_used END)::BIGINT + p_count <= p.monthly_event_limit
    RETURNING p.monthly_events_used, p.monthly_event_limit INTO v_used, v_limit;

    IF FOUND THEN
        RETURN QUERY SELECT true, v_used, v_limit;
    ELSE
        SELECT p.monthly_events_used, p.monthly_event_limit
        INTO v_used, v_limit
        FROM public.agent_projects AS p
        WHERE p.id = p_project_id;

        RETURN QUERY SELECT false, COALESCE(v_used, 0), COALESCE(v_limit, 0);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_agent_execution(UUID, TEXT, TEXT, TEXT, INT, INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_tasks(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_agent_event_quota(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_agent_execution(UUID, TEXT, TEXT, TEXT, INT, INT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_tasks(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_agent_event_quota(UUID, INT) TO service_role;

DROP POLICY IF EXISTS "Public Read agent_executions" ON public.agent_executions;
DROP POLICY IF EXISTS "Public Read agent_events" ON public.agent_events;
DROP POLICY IF EXISTS "Public Read agent_batches" ON public.agent_batches;

COMMIT;
