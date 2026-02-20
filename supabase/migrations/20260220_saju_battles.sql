create table if not exists public.saju_battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  player_a_name text not null,
  player_b_name text not null,
  player_a_grade text not null,
  player_b_grade text not null,
  overall_winner text not null,
  overall_intensity text not null,
  wins_a integer not null default 0,
  wins_b integer not null default 0,
  draws integer not null default 0,
  relationship_type text not null,
  full_result jsonb not null,
  created_at timestamptz default now()
);

create index if not exists saju_battles_user_idx
  on public.saju_battles (user_id, created_at desc);
