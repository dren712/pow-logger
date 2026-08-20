-- 20260821_019_atomic_oauth_consumption.sql
-- Migration 019: Atomic OAuth State Consumption
-- Adds consumed_at to oauth_states table to prevent state reuse, race conditions, and replay attacks.

ALTER TABLE public.oauth_states ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_states_consumed_at ON public.oauth_states(consumed_at);
