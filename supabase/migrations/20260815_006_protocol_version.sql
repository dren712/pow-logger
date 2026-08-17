-- 20260815_006_protocol_version.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs' AND column_name = 'protocol_version') THEN
        ALTER TABLE public.logs ADD COLUMN protocol_version INTEGER NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs' AND column_name = 'challenge_id') THEN
        ALTER TABLE public.logs ADD COLUMN challenge_id UUID;
    END IF;
END $$;

COMMENT ON COLUMN public.logs.protocol_version IS 'New v2 submissions will set protocol_version = 2 and reference a challenge_id';
