create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid references public.users(id) on delete cascade,
  method text not null,
  amount integer not null,
  status text not null,
  created_at timestamptz default now()
);

create index if not exists payment_transactions_user_idx
  on public.payment_transactions (user_id);
