-- 20260815_007_atomic_quota.sql
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
    p_challenge_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INT;
    v_new_log public.logs;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.logs
    WHERE wallet_address = p_wallet
      AND created_at::date = (now() AT TIME ZONE 'Asia/Kolkata')::date;

    IF v_count >= 3 THEN
        RAISE EXCEPTION 'DAILY_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;

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
        challenge_id
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
        p_challenge_id
    ) RETURNING * INTO v_new_log;

    RETURN row_to_json(v_new_log)::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID) FROM public;
REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID) TO service_role;
