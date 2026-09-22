-- PROVN Agent Protocol - Phase 2 DB Schema
-- Track B: Verifiable Agent Action Infrastructure

CREATE TABLE IF NOT EXISTS public.agent_executions (
    execution_id UUID PRIMARY KEY,
    agent_public_key TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    event_count INTEGER NOT NULL DEFAULT 0,
    terminal_event_hash TEXT,
    merkle_root TEXT,
    protocol_version TEXT NOT NULL DEFAULT 'agent/1'
);

CREATE TABLE IF NOT EXISTS public.agent_events (
    event_id TEXT PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES public.agent_executions(execution_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    agent_public_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    parent_event_id TEXT,
    previous_event_hash TEXT,
    payload_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    protocol_version TEXT NOT NULL DEFAULT 'agent/1',
    UNIQUE(execution_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.agent_batches (
    batch_id TEXT PRIMARY KEY,
    merkle_root TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    first_sequence INTEGER NOT NULL,
    last_sequence INTEGER NOT NULL,
    solana_signature TEXT,
    solana_pda TEXT,
    irys_tx_id TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_batches ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (Public Read)
CREATE POLICY "Public Read agent_executions" ON public.agent_executions FOR SELECT TO public USING (true);
CREATE POLICY "Public Read agent_events" ON public.agent_events FOR SELECT TO public USING (true);
CREATE POLICY "Public Read agent_batches" ON public.agent_batches FOR SELECT TO public USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_events_execution_sequence ON public.agent_events(execution_id, sequence);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON public.agent_executions(agent_public_key);
