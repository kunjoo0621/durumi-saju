create table if not exists public.prepayment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  input_hash text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'consumed')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists prepayment_sessions_user_status_idx
  on public.prepayment_sessions (user_id, status, created_at desc);

create index if not exists prepayment_sessions_expires_idx
  on public.prepayment_sessions (expires_at);
