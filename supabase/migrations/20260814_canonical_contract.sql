-- PROVN Protocol — Canonical Database Contract & Forward-Only Migration
-- Migration Timestamp: 2026-08-14
-- Purpose: Unified single source of truth for public.logs, idempotent RLS policies, backward-compatibility view, and daily quota RPC.

-- 1. Ensure logs table exists with ALL canonical fields
CREATE TABLE IF NOT EXISTS public.logs (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    irys_tx_id TEXT,
    signature TEXT,
    evidence_url TEXT,
    github_url TEXT,
    skills TEXT[],
    protocols TEXT[],
    category TEXT,
    archival_state TEXT DEFAULT 'pending',
    nonce TEXT,
    domain TEXT
);

-- Ensure all columns exist if table already existed previously
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS irys_tx_id TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS protocols TEXT[];
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS archival_state TEXT DEFAULT 'pending';
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS nonce TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS domain TEXT;

-- 2. Archival State Check Constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_archival_state'
    ) THEN
        ALTER TABLE public.logs 
        ADD CONSTRAINT check_archival_state 
        CHECK (archival_state IN ('pending', 'archived', 'failed', 'legacy_unverified'));
    END IF;
END $$;

-- 3. Unique Index on signature for Anti-Replay Protection
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_signature_unique 
ON public.logs (signature) 
WHERE signature IS NOT NULL;

-- 4. Composite index for fast builder passport queries
CREATE INDEX IF NOT EXISTS idx_logs_wallet_created 
ON public.logs (wallet_address, created_at DESC);

-- 5. Backward-Compatibility View: wallet_logs -> logs
CREATE OR REPLACE VIEW public.wallet_logs AS 
SELECT * FROM public.logs;

-- 6. Clean Row-Level Security (RLS) Configuration
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Drop all legacy or conflicting policies
DROP POLICY IF EXISTS "Public Read Access" ON public.logs;
DROP POLICY IF EXISTS "Service Role Full Access" ON public.logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.logs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.logs;
DROP POLICY IF EXISTS "Allow log submissions" ON public.logs;
DROP POLICY IF EXISTS "Validated Log Submissions" ON public.logs;

-- PUBLIC READ ONLY POLICY: Anyone can read logs
CREATE POLICY "Public Read Access" ON public.logs
    FOR SELECT TO public
    USING (true);

-- SERVICE ROLE FULL ACCESS POLICY: Only server-side service role key can insert/update
CREATE POLICY "Service Role Full Access" ON public.logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. Server-Enforced Daily Log Quota RPC
CREATE OR REPLACE FUNCTION public.get_daily_log_count(
    p_wallet TEXT,
    p_start_time TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.logs
    WHERE wallet_address = p_wallet
      AND created_at >= p_start_time;
      
    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_log_count(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_log_count(TEXT, TIMESTAMPTZ) TO service_role;
