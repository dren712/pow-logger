-- 20260821_021_private_auth_challenges.sql
CREATE TABLE IF NOT EXISTS public.private_auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proof_id BIGINT NOT NULL,
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    ip_address TEXT,
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
CREATE INDEX IF NOT EXISTS idx_private_auth_challenges_wallet_consumed ON public.private_auth_challenges(wallet_address, consumed_at);
CREATE INDEX IF NOT EXISTS idx_private_auth_challenges_ip_issued ON public.private_auth_challenges(ip_address, issued_at);

CREATE OR REPLACE FUNCTION public.consume_private_auth_nonce(
    p_nonce TEXT,
    p_proof_id BIGINT,
    p_wallet_address TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated boolean;
BEGIN
    UPDATE public.private_auth_challenges
    SET consumed_at = now()
    WHERE nonce = p_nonce
      AND proof_id = p_proof_id
      AND wallet_address = p_wallet_address
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING true INTO v_updated;

    RETURN COALESCE(v_updated, false);
END;
$$;

-- Restrict execution strictly to the service_role
REVOKE EXECUTE ON FUNCTION public.consume_private_auth_nonce(TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_private_auth_nonce(TEXT, BIGINT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_private_auth_nonce(TEXT, BIGINT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_private_auth_nonce(TEXT, BIGINT, TEXT) TO service_role;

