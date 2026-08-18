-- Migration: 013 GitHub Identities
-- Objective: Create wallet_identities table to cryptographically link Solana wallets to GitHub accounts for provenance escalation

CREATE TABLE IF NOT EXISTS public.wallet_identities (
  wallet_address TEXT PRIMARY KEY,
  github_id TEXT NOT NULL,
  github_username TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verify identities globally
CREATE POLICY "Public profiles are viewable by everyone" ON public.wallet_identities
  FOR SELECT USING (true);

-- Deny all write access via client API (Only Service Role / Server Actions can mutate)
CREATE POLICY "Deny insert from anon/authenticated" ON public.wallet_identities
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny update from anon/authenticated" ON public.wallet_identities
  FOR UPDATE USING (false);

CREATE POLICY "Deny delete from anon/authenticated" ON public.wallet_identities
  FOR DELETE USING (false);
