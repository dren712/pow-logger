-- 20260819_017_oauth_state_action.sql

ALTER TABLE public.oauth_states ADD COLUMN action TEXT NOT NULL DEFAULT 'Link';
