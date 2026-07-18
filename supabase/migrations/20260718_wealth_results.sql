-- supabase/migrations/20260718_wealth_results.sql
-- 재물운 심층 검사 결과. marriage_results 패턴 미러.
-- 차이: marital_status(4분법) 대신 interest(관심사 4분법) + 재물운 전용 메타 컬럼.

create table if not exists public.wealth_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source_result_id uuid references public.saju_results(id) on delete set null,
  input_hash text not null,
  interest text not null,              -- 목돈·노후 준비/투자로 불리기/사업·수입 키우기/지출·빚 관리
  -- 입력 스냅샷 (saju_results 동일 컬럼)
  name text, birth_date date, birth_time text, region text, gender text,
  relationship_status text, employment_status text, calendar_type text, core_fear_axis text,
  -- 사주 캐시 + 재물운 메타
  saju_text text,
  wealth_grade text,                   -- SS/S/A/B/C (재물운 점수 결정론 매핑)
  jaeseong_type text,                  -- 정재우세/편재우세/재성혼재/무재
  jaeda_shinyak boolean,
  sikssang_saengjae boolean,
  gunggeob_jaengjae boolean,
  jae_grip text,                       -- 그릇(신왕재왕/신왕재쇠/재다신약/신약재소) 2차원 4상한
  teaser_json jsonb,
  full_json jsonb,
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 같은 입력×같은 관심사 결과 1건 (관심사 바뀌면 새 리포트 허용)
create unique index if not exists wealth_results_user_input_interest_unique
  on public.wealth_results (user_id, input_hash, interest)
  where user_id is not null;

alter table public.wealth_results
  drop constraint if exists wealth_results_user_input_interest_uq;
alter table public.wealth_results
  add constraint wealth_results_user_input_interest_uq
  unique (user_id, input_hash, interest);

create unique index if not exists wealth_results_guest_input_interest_unique
  on public.wealth_results (guest_token_hash, input_hash, interest)
  where guest_token_hash is not null;

create index if not exists wealth_results_input_hash_idx
  on public.wealth_results (input_hash);

create table if not exists public.wealth_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.wealth_results(id) on delete cascade,
  input_hash text not null,
  interest text not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists wealth_result_unlocks_user_input_interest_unique
  on public.wealth_result_unlocks (user_id, input_hash, interest);
create unique index if not exists wealth_result_unlocks_order_unique
  on public.wealth_result_unlocks (order_id);
create index if not exists wealth_result_unlocks_result_idx
  on public.wealth_result_unlocks (result_id);

alter table public.wealth_results
  drop constraint if exists wealth_results_owner_check;
alter table public.wealth_results
  add constraint wealth_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

alter table public.wealth_results enable row level security;
alter table public.wealth_result_unlocks enable row level security;

comment on table public.wealth_results is '재물운 심층 검사 결과. 관심사별 row.';
comment on column public.wealth_results.interest is '목돈·노후 준비/투자로 불리기/사업·수입 키우기/지출·빚 관리 (검사 내부 4분법).';
comment on column public.wealth_results.wealth_grade is '재물운 점수 결정론 매핑 등급 SS~C.';
comment on column public.wealth_results.jae_grip is '그릇(재를 감당하는 능력) — (신강/신약)×(weighted 재성 강/약) 2차원 4상한(신왕재왕/신왕재쇠/재다신약/신약재소). lib/wealth-facts.ts 결정론 산출.';
