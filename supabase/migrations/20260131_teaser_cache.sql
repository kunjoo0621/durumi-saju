create table if not exists public.teaser_cache (
  id uuid primary key default gen_random_uuid(),
  input_hash text not null unique,
  result_json jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  hit_count integer default 0
);

create index if not exists teaser_cache_expires_idx
  on public.teaser_cache (expires_at);
