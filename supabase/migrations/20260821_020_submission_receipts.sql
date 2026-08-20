-- Migration 020: Submission Receipts

ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS submission_receipt TEXT DEFAULT NULL;
