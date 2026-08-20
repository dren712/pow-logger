-- 20260819_018_transactional_challenge_and_pkce.sql

-- 1. Add code_verifier to oauth_states
ALTER TABLE public.oauth_states ADD COLUMN IF NOT EXISTS code_verifier TEXT;

-- 2. Add expires_at index on signing_challenges
CREATE INDEX IF NOT EXISTS idx_signing_challenges_expires_at ON public.signing_challenges(expires_at);

-- 3. Drop old atomic_insert_log signatures
DROP FUNCTION IF EXISTS public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT);

-- 4. Recreate atomic_insert_log with transactional challenge consumption
CREATE OR REPLACE FUNCTION public.atomic_insert_log(
    p_content TEXT,
    p_wallet TEXT,
    p_signature TEXT,
    p_created_at TIMESTAMPTZ,
    p_nonce TEXT,
    p_domain TEXT,
    p_evidence_url TEXT DEFAULT NULL,
    p_github_url TEXT DEFAULT NULL,
    p_skills TEXT[] DEFAULT '{}',
    p_protocols TEXT[] DEFAULT '{}',
    p_category TEXT DEFAULT 'General',
    p_archival_state TEXT DEFAULT 'not_requested',
    p_visibility TEXT DEFAULT 'private',
    p_protocol_version INT DEFAULT 2,
    p_challenge_id UUID DEFAULT NULL,
    p_evidence_type TEXT DEFAULT 'self_attested',
    p_provenance_level TEXT DEFAULT 'self_attested',
    p_source_provider TEXT DEFAULT NULL,
    p_source_metadata JSONB DEFAULT NULL,
    p_source_verification_status TEXT DEFAULT 'not_verified',
    p_source_verified_at TIMESTAMPTZ DEFAULT NULL,
    p_challenge TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_count INT;
    v_quota_date DATE;
    v_new_log public.logs;
    v_consumed_challenge_id UUID := p_challenge_id;
BEGIN
    -- 1. Atomically consume challenge if challenge string is provided
    IF p_challenge IS NOT NULL AND p_challenge != '' THEN
        UPDATE public.signing_challenges
        SET consumed_at = now()
        WHERE challenge = p_challenge
          AND wallet_address = p_wallet
          AND consumed_at IS NULL
          AND expires_at > now()
        RETURNING id INTO v_consumed_challenge_id;

        IF v_consumed_challenge_id IS NULL THEN
            RAISE EXCEPTION 'CHALLENGE_INVALID_OR_CONSUMED' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- 2. Determine the current quota date in the protocol timezone
    v_quota_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;

    -- 3. Atomically increment the quota counter.
    INSERT INTO public.daily_quotas (wallet_address, quota_date, log_count)
    VALUES (p_wallet, v_quota_date, 1)
    ON CONFLICT (wallet_address, quota_date)
    DO UPDATE SET log_count = public.daily_quotas.log_count + 1
    RETURNING log_count INTO v_new_count;

    -- If the increment pushed it over the limit, abort the transaction.
    IF v_new_count > 3 THEN
        RAISE EXCEPTION 'DAILY_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Insert the log record
    INSERT INTO public.logs (
        content,
        wallet_address,
        signature,
        created_at,
        nonce,
        domain,
        evidence_url,
        github_url,
        skills,
        protocols,
        category,
        archival_state,
        visibility,
        protocol_version,
        challenge_id,
        evidence_type,
        provenance_level,
        source_provider,
        source_metadata,
        source_verification_status,
        source_verified_at
    ) VALUES (
        p_content,
        p_wallet,
        p_signature,
        p_created_at,
        p_nonce,
        p_domain,
        p_evidence_url,
        p_github_url,
        p_skills,
        p_protocols,
        p_category,
        p_archival_state,
        p_visibility,
        p_protocol_version,
        v_consumed_challenge_id,
        p_evidence_type,
        p_provenance_level,
        p_source_provider,
        p_source_metadata,
        p_source_verification_status,
        p_source_verified_at
    ) RETURNING * INTO v_new_log;

    RETURN row_to_json(v_new_log)::jsonb;
END;
$$;

-- Grant permissions for the service role
REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
