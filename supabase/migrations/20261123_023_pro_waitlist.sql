create table if not exists public.pro_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  github_username text,
  source text not null,
  created_at timestamptz not null default now()
);

alter table public.pro_waitlist enable row level security;

-- Access goes through the service role only; no public policies are defined.
revoke all on table public.pro_waitlist from anon, authenticated;
