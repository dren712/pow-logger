-- Public leaderboard of GitHub-verified builder profiles (no wallet required).
create table if not exists public.builder_profiles (
  github_id bigint primary key,
  login text not null,
  name text,
  avatar_url text,
  score integer not null default 0,
  tier text not null default 'Starter',
  merged_external_prs integer not null default 0,
  external_repos integer not null default 0,
  stars integer not null default 0,
  top_language text,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists builder_profiles_login_lower_idx on public.builder_profiles (lower(login));
create index if not exists builder_profiles_score_idx on public.builder_profiles (score desc, merged_external_prs desc);

alter table public.builder_profiles enable row level security;

drop policy if exists "builder_profiles_public_read" on public.builder_profiles;
create policy "builder_profiles_public_read" on public.builder_profiles for select using (true);
-- Writes go through the service role only, so no insert/update policy is defined.
