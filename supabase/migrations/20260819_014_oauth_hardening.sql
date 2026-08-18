-- Migration: 014 OAuth Hardening
-- Objective: Secure the GitHub OAuth linking flow by adding a unique constraint on github_id
-- and creating an oauth_states table to prevent CSRF and impersonation.

-- 1. Enforce unique github_id
ALTER TABLE public.wallet_identities ADD CONSTRAINT unique_github_id UNIQUE (github_id);

-- 2. Create oauth_states table
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Deny all access from anon/authenticated" ON public.oauth_states
  FOR ALL USING (false) WITH CHECK (false);
