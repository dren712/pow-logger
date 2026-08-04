-- PROVN Protocol — Security Hardening & RLS Overhaul Migration
-- Migration Timestamp: 2026-08-03
-- Purpose: Lock RLS policies against anonymous client mutations, enforce signature uniqueness, and add atomic daily quota RPC.

-- 1. Ensure logs table has all necessary columns
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
    archival_state TEXT DEFAULT 'pending'
);

-- 2. Add constraint for archival_state
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

-- 3. Unique Index on signature for Replay Attack Prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_signature_unique 
ON public.logs (signature) 
WHERE signature IS NOT NULL;

-- 4. Fast Profile Index
CREATE INDEX IF NOT EXISTS idx_logs_wallet_created 
ON public.logs (wallet_address, created_at DESC);

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Drop any unsafe existing policies
DROP POLICY IF EXISTS "Public Read Access" ON public.logs;
DROP POLICY IF EXISTS "Service Role Full Access" ON public.logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.logs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.logs;
DROP POLICY IF EXISTS "Public Insert Access" ON public.logs;
DROP POLICY IF EXISTS "Allow public log submissions" ON public.logs;

-- PUBLIC READ-ONLY POLICY: Public/anon users can ONLY read logs
CREATE POLICY "Public Read Access" ON public.logs
    FOR SELECT TO public
    USING (true);

-- NOTE: Direct INSERT, UPDATE, DELETE policies for anon/public are EXPLICITLY DENIED.
-- API routes use the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS safely.

-- 6. Atomic Daily Log Quota RPC
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
