create extension if not exists "pgcrypto";

create table if not exists public.result_access_tokens (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.saju_results(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

alter table public.saju_results add column if not exists input_hash text;
alter table public.saju_results add column if not exists teaser_json jsonb;
alter table public.saju_results add column if not exists full_json jsonb;
alter table public.saju_results add column if not exists unlocked_at timestamptz;
alter table public.saju_results add column if not exists calendar_type text;
alter table public.saju_results add column if not exists relationship_status text;
alter table public.saju_results add column if not exists employment_status text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saju_results'
      and column_name = 'user_id'
  ) then
    begin
      alter table public.saju_results alter column user_id drop not null;
    exception when others then
      null;
    end;
  end if;
end $$;

create unique index if not exists saju_results_user_input_unique
  on public.saju_results (user_id, input_hash)
  where user_id is not null;

create index if not exists saju_results_input_hash_idx
  on public.saju_results (input_hash);

create index if not exists result_access_tokens_result_idx
  on public.result_access_tokens (result_id);

create index if not exists result_access_tokens_expires_idx
  on public.result_access_tokens (expires_at);
