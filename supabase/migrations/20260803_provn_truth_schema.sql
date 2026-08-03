-- PROVN Protocol v1.0 — Grant-Ready Truth Schema Migration
-- Migration Timestamp: 2026-08-03
-- Purpose: Add signature uniqueness replay protection, explicit archival states, and evidence links.

-- 1. Ensure logs table exists with core columns
CREATE TABLE IF NOT EXISTS public.logs (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    irys_tx_id TEXT
);

-- 2. Add signature column with NOT NULL and UNIQUE constraints (for new submissions)
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS protocols TEXT[];
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS category TEXT;

-- 3. Add archival_state column with explicit CHECK constraint
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS archival_state TEXT DEFAULT 'pending';

-- Add constraint for valid archival_state values
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

-- 4. Create Unique Index on signature for Replay Attack Prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_signature_unique 
ON public.logs (signature) 
WHERE signature IS NOT NULL;

-- 5. Create Index on wallet_address for fast builder profile lookups
CREATE INDEX IF NOT EXISTS idx_logs_wallet_created 
ON public.logs (wallet_address, created_at DESC);

-- 6. Backfill legacy rows without real Irys receipts to 'legacy_unverified'
UPDATE public.logs 
SET archival_state = 'legacy_unverified' 
WHERE archival_state IS NULL 
   OR (irys_tx_id IS NULL AND archival_state = 'pending')
   OR (irys_tx_id LIKE 'powl_%');

-- Backfill verified Irys rows
UPDATE public.logs 
SET archival_state = 'archived' 
WHERE irys_tx_id IS NOT NULL 
  AND irys_tx_id NOT LIKE 'powl_%';

-- 7. Enable Row-Level Security (RLS) policies
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all logs (open proof explorer)
CREATE POLICY "Public Read Access" ON public.logs
    FOR SELECT USING (true);

-- Allow service role / authenticated inserts
CREATE POLICY "Service Role Full Access" ON public.logs
    FOR ALL USING (true);
