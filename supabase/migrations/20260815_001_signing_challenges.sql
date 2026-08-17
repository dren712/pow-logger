-- 20260815_001_signing_challenges.sql
CREATE TABLE IF NOT EXISTS public.signing_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    challenge TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    ip_address TEXT
);

ALTER TABLE public.signing_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.signing_challenges
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_signing_challenges_challenge ON public.signing_challenges(challenge);
CREATE INDEX IF NOT EXISTS idx_signing_challenges_wallet_consumed ON public.signing_challenges(wallet_address, consumed_at);

CREATE OR REPLACE FUNCTION public.delete_expired_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.signing_challenges
    WHERE expires_at < now() - interval '1 hour';
END;
$$;
