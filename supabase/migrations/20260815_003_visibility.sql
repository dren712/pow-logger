-- 20260815_003_visibility.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs' AND column_name = 'visibility') THEN
        ALTER TABLE public.logs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
    END IF;
END $$;

ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS valid_visibility;
ALTER TABLE public.logs ADD CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'public'));

-- Drop the old 'Public Read Access' RLS policy
DROP POLICY IF EXISTS "Public Read Access" ON public.logs;

-- Create new policy
CREATE POLICY "Public Read Access" ON public.logs
    FOR SELECT
    TO public
    USING (visibility = 'public');
