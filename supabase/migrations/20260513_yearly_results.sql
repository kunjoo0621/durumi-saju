-- 올해의 운세(세운) 결과 테이블
-- 개인사주(saju_results)와 별도 테이블로 분리한 이유:
-- 1) 같은 사람이 매년 다시 분석해야 함 → (user_id, input_hash, target_year) 유니크 정책 필요
-- 2) saju_results.input_hash 기반 unique 정책과 충돌
-- 3) full_json 구조가 다르고 결과 페이지 라우트가 분리됨

create table if not exists public.yearly_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  -- 원국 출처 추적: 어떤 개인사주 row를 기반으로 산출했는지(없으면 즉석 입력)
  source_result_id uuid references public.saju_results(id) on delete set null,
  -- 개인사주 buildInputHash 결과를 그대로 사용 (target_year는 별도 컬럼으로 보관)
  input_hash text not null,
  target_year smallint not null,
  -- 입력 스냅샷: saju_results와 동일 컬럼 (계산식이 input 시그니처 바뀌면 여기도 따라감)
  name text,
  birth_date date,
  birth_time text,
  region text,
  gender text,
  relationship_status text,
  employment_status text,
  calendar_type text,
  core_fear_axis text,
  -- 사주 캐시 + 세운 메타
  saju_text text,
  yearly_pillar text,                -- 예: "丙午"
  teaser_json jsonb,
  full_json jsonb,
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 회원: 같은 입력×같은 해 결과는 1건만
create unique index if not exists yearly_results_user_input_year_unique
  on public.yearly_results (user_id, input_hash, target_year)
  where user_id is not null;

-- upsert ON CONFLICT 지원용 full unique constraint (Supabase JS upsert는 partial index 인식 못 함)
alter table public.yearly_results
  drop constraint if exists yearly_results_user_input_year_uq;
alter table public.yearly_results
  add constraint yearly_results_user_input_year_uq
  unique (user_id, input_hash, target_year);

-- 게스트: 같은 input×해×토큰 1건
create unique index if not exists yearly_results_guest_input_year_unique
  on public.yearly_results (guest_token_hash, input_hash, target_year)
  where guest_token_hash is not null;

create index if not exists yearly_results_input_hash_idx
  on public.yearly_results (input_hash);

create index if not exists yearly_results_target_year_idx
  on public.yearly_results (target_year);

-- 결제(코인 차감) 잠금 테이블 — result_unlocks 미러
create table if not exists public.yearly_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.yearly_results(id) on delete cascade,
  input_hash text not null,
  target_year smallint not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists yearly_result_unlocks_user_input_year_unique
  on public.yearly_result_unlocks (user_id, input_hash, target_year);

create unique index if not exists yearly_result_unlocks_order_unique
  on public.yearly_result_unlocks (order_id);

create index if not exists yearly_result_unlocks_result_idx
  on public.yearly_result_unlocks (result_id);

-- 무주인 방지 CHECK (saju_results와 동일 패턴: user_id OR guest_token_hash)
alter table public.yearly_results
  drop constraint if exists yearly_results_owner_check;
alter table public.yearly_results
  add constraint yearly_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

-- RLS 활성화 — service role(supabaseAdmin)만 access. anon/auth key는 모두 거부.
-- 우리 API는 전부 supabaseAdmin 사용이라 정상 동작.
alter table public.yearly_results enable row level security;
alter table public.yearly_result_unlocks enable row level security;
