-- 20260821_021_private_auth_challenges.sql
CREATE TABLE IF NOT EXISTS public.private_auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proof_id BIGINT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

ALTER TABLE public.private_auth_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.private_auth_challenges
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_private_auth_challenges_nonce ON public.private_auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS idx_private_auth_challenges_proof_id ON public.private_auth_challenges(proof_id);

CREATE OR REPLACE FUNCTION public.consume_private_auth_nonce(p_nonce TEXT, p_proof_id BIGINT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated boolean;
BEGIN
    UPDATE public.private_auth_challenges
    SET consumed_at = now()
    WHERE nonce = p_nonce
      AND proof_id = p_proof_id
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING true INTO v_updated;

    RETURN COALESCE(v_updated, false);
END;
$$;
