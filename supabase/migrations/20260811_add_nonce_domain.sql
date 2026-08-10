-- PROVN Protocol — Nonce and Domain Schema Migration
-- Migration Timestamp: 2026-08-11
-- Purpose: Add nonce and domain columns to logs table to enable deterministic off-chain cryptographic signature re-verification.

ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS nonce TEXT;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS domain TEXT;
