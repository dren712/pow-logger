-- 20260815_004_archival_status.sql
ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS check_archival_state;

UPDATE public.logs SET archival_state = 'legacy_unverified' WHERE nonce IS NULL AND archival_state IS NOT NULL;
UPDATE public.logs SET archival_state = 'receipt_obtained' WHERE archival_state = 'archived' AND irys_tx_id IS NOT NULL;
UPDATE public.logs SET archival_state = 'not_requested' WHERE archival_state = 'archived' AND irys_tx_id IS NULL;
UPDATE public.logs SET archival_state = 'not_requested' WHERE archival_state = 'pending' AND irys_tx_id IS NULL;

ALTER TABLE public.logs ALTER COLUMN archival_state SET DEFAULT 'not_requested';

ALTER TABLE public.logs ADD CONSTRAINT check_archival_state CHECK (archival_state IN ('not_requested', 'pending', 'receipt_obtained', 'finalized', 'failed', 'legacy_unverified'));
