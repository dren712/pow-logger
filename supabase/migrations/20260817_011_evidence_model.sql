-- Migration: 011 Evidence Type & Provenance Model
-- Objective: Add source-aware evidence layers (GitHub PR/Commit)

-- Add evidence_type
ALTER TABLE logs ADD COLUMN evidence_type TEXT NOT NULL DEFAULT 'self_attested';
ALTER TABLE logs ADD CONSTRAINT valid_evidence_type CHECK (evidence_type IN ('self_attested', 'github_pr', 'github_commit', 'github_release', 'public_url'));

-- Add provenance_level
ALTER TABLE logs ADD COLUMN provenance_level TEXT NOT NULL DEFAULT 'self_attested';
ALTER TABLE logs ADD CONSTRAINT valid_provenance_level CHECK (provenance_level IN ('self_attested', 'source_linked', 'source_verified', 'partner_attested'));

-- Add source tracking
ALTER TABLE logs ADD COLUMN source_provider TEXT;
ALTER TABLE logs ADD COLUMN source_metadata JSONB;

-- Add verification status
ALTER TABLE logs ADD COLUMN source_verification_status TEXT DEFAULT 'not_verified';
ALTER TABLE logs ADD CONSTRAINT valid_source_verification_status CHECK (source_verification_status IN ('not_verified', 'verified', 'failed', 'unavailable'));

-- Add verification timestamp
ALTER TABLE logs ADD COLUMN source_verified_at TIMESTAMPTZ;

-- Recreate atomic_insert_log with new parameters
DROP FUNCTION IF EXISTS public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID);

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
    p_source_verified_at TIMESTAMPTZ DEFAULT NULL
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
        p_challenge_id,
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

REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) FROM public;
REVOKE ALL ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_insert_log(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) TO service_role;
