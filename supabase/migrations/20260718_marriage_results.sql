-- supabase/migrations/20260718_marriage_results.sql
-- 결혼운/애정운 심층 검사 결과. today_results 패턴 미러.
-- 차이: target_date 없음(일회성 심층), marital_status(4분법) 추가.

create table if not exists public.marriage_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source_result_id uuid references public.saju_results(id) on delete set null,
  input_hash text not null,
  marital_status text not null,        -- 솔로/연애중/기혼/다시 혼자
  -- 입력 스냅샷 (saju_results 동일 컬럼)
  name text, birth_date date, birth_time text, region text, gender text,
  relationship_status text, employment_status text, calendar_type text, core_fear_axis text,
  -- 사주 캐시 + 결혼 메타
  saju_text text,
  marriage_grade text,                 -- SS/S/A/B/C (연애운 점수 결정론 매핑)
  spouse_star_type text,               -- 관성/재성
  gwansal_honjap boolean,
  spouse_star_absent boolean,
  spouse_palace_stability text,        -- 안정/보통/불안정 (일지 6합/6충 결정론 산출, lib/marriage-facts.ts)
  teaser_json jsonb,
  full_json jsonb,
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 같은 입력×같은 관계상태 결과 1건 (관계상태 바뀌면 새 리포트 허용)
create unique index if not exists marriage_results_user_input_status_unique
  on public.marriage_results (user_id, input_hash, marital_status)
  where user_id is not null;

alter table public.marriage_results
  drop constraint if exists marriage_results_user_input_status_uq;
alter table public.marriage_results
  add constraint marriage_results_user_input_status_uq
  unique (user_id, input_hash, marital_status);

create unique index if not exists marriage_results_guest_input_status_unique
  on public.marriage_results (guest_token_hash, input_hash, marital_status)
  where guest_token_hash is not null;

create index if not exists marriage_results_input_hash_idx
  on public.marriage_results (input_hash);

create table if not exists public.marriage_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.marriage_results(id) on delete cascade,
  input_hash text not null,
  marital_status text not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists marriage_result_unlocks_user_input_status_unique
  on public.marriage_result_unlocks (user_id, input_hash, marital_status);
create unique index if not exists marriage_result_unlocks_order_unique
  on public.marriage_result_unlocks (order_id);
create index if not exists marriage_result_unlocks_result_idx
  on public.marriage_result_unlocks (result_id);

alter table public.marriage_results
  drop constraint if exists marriage_results_owner_check;
alter table public.marriage_results
  add constraint marriage_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

alter table public.marriage_results enable row level security;
alter table public.marriage_result_unlocks enable row level security;

comment on table public.marriage_results is '결혼운/애정운 심층 검사 결과. 관계상태별 row.';
comment on column public.marriage_results.marital_status is '솔로/연애중/기혼/다시 혼자 (검사 내부 4분법).';
comment on column public.marriage_results.marriage_grade is '연애운 점수 결정론 매핑 등급 SS~C.';
comment on column public.marriage_results.spouse_palace_stability is '배우자궁(일지) 안정도 — 일지 6합/6충 실측 기반 결정론 산출(안정/보통/불안정). prose 키워드 휴리스틱 아님.';
