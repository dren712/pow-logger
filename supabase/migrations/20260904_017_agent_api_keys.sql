-- ============================================================================
-- PROVN TRACK B: PROJECTS, API KEYS & USAGE METERING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'developer' CHECK (tier IN ('developer', 'team', 'enterprise')),
    network_target TEXT NOT NULL DEFAULT 'devnet' CHECK (network_target IN ('devnet', 'mainnet-beta')),
    monthly_event_limit INT NOT NULL DEFAULT 100000,
    monthly_events_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.agent_projects(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default Key',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON public.agent_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_project ON public.agent_api_keys(project_id);

-- Add optional project_id to agent_executions for tenant scoping
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_executions' AND column_name = 'project_id'
    ) THEN 
        ALTER TABLE public.agent_executions ADD COLUMN project_id UUID REFERENCES public.agent_projects(id) ON DELETE SET NULL;
    END IF; 
END $$;

-- RLS
ALTER TABLE public.agent_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read agent projects" ON public.agent_projects FOR SELECT USING (true);
CREATE POLICY "Service role manages agent projects" ON public.agent_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages agent keys" ON public.agent_api_keys FOR ALL USING (auth.role() = 'service_role');
