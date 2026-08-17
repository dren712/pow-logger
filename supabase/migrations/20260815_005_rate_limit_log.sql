-- 20260815_005_rate_limit_log.sql
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_identifier_action_created ON public.rate_limit_log(identifier, action, created_at DESC);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.rate_limit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_limit INT,
    p_window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.rate_limit_log
    WHERE identifier = p_identifier
      AND action = p_action
      AND created_at > now() - (p_window_seconds || ' seconds')::interval;
      
    IF v_count >= p_limit THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO public.rate_limit_log (identifier, action) VALUES (p_identifier, p_action);
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.rate_limit_log
    WHERE created_at < now() - interval '1 hour';
END;
$$;
