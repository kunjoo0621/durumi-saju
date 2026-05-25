-- 오늘의 운세 결과 테이블
-- yearly_results 패턴 미러 + target_year → target_date (DATE)
-- 분리 이유:
-- 1) 같은 사람이 매일 다시 분석해야 함 → (user_id, input_hash, target_date) 유니크 정책 필요
-- 2) saju_results.input_hash 기반 unique 정책과 충돌
-- 3) full_json 구조가 다르고 결과 페이지 라우트가 분리됨

create table if not exists public.today_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  -- 원국 출처 추적: 어떤 개인사주 row를 기반으로 산출했는지(없으면 즉석 입력)
  source_result_id uuid references public.saju_results(id) on delete set null,
  -- 개인사주 buildInputHash 결과를 그대로 사용 (target_date는 별도 컬럼)
  input_hash text not null,
  target_date date not null,
  -- 입력 스냅샷: saju_results와 동일 컬럼 (계산식 input 시그니처 바뀌면 여기도 따라감)
  name text,
  birth_date date,
  birth_time text,
  region text,
  gender text,
  relationship_status text,
  employment_status text,
  calendar_type text,
  core_fear_axis text,
  -- 사주 캐시 + 일진 메타
  saju_text text,
  today_pillar text,                 -- 예: "戊戌"
  today_mood text,                   -- 강세/보통/주의/위기
  today_weather_icon text,           -- sun/cloud/rain/thunder
  branch_relation_type text,         -- hap/samhap/banghap/chung/hyung/wonjin/same/none
  stem_relation_label text,          -- "토→수 일진이 본인을 극함" 등
  ten_star text,                     -- 일진 천간 기준 본인 십성 (정관 등)
  teaser_json jsonb,
  full_json jsonb,
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 회원: 같은 입력×같은 날짜 결과는 1건만 (재호출 시 fetch만)
create unique index if not exists today_results_user_input_date_unique
  on public.today_results (user_id, input_hash, target_date)
  where user_id is not null;

-- upsert ON CONFLICT 지원용 full unique constraint (Supabase JS upsert는 partial index 인식 못 함)
alter table public.today_results
  drop constraint if exists today_results_user_input_date_uq;
alter table public.today_results
  add constraint today_results_user_input_date_uq
  unique (user_id, input_hash, target_date);

-- 게스트: 같은 input×날짜×토큰 1건
create unique index if not exists today_results_guest_input_date_unique
  on public.today_results (guest_token_hash, input_hash, target_date)
  where guest_token_hash is not null;

create index if not exists today_results_input_hash_idx
  on public.today_results (input_hash);

create index if not exists today_results_target_date_idx
  on public.today_results (target_date);

-- 결제(코인 차감) 잠금 테이블 — yearly_result_unlocks 미러
create table if not exists public.today_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.today_results(id) on delete cascade,
  input_hash text not null,
  target_date date not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists today_result_unlocks_user_input_date_unique
  on public.today_result_unlocks (user_id, input_hash, target_date);

create unique index if not exists today_result_unlocks_order_unique
  on public.today_result_unlocks (order_id);

create index if not exists today_result_unlocks_result_idx
  on public.today_result_unlocks (result_id);

-- 무주인 방지 CHECK (yearly와 동일 패턴: user_id OR guest_token_hash)
alter table public.today_results
  drop constraint if exists today_results_owner_check;
alter table public.today_results
  add constraint today_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

-- RLS 활성화 — service role(supabaseAdmin)만 access. anon/auth key는 모두 거부.
-- 우리 API는 전부 supabaseAdmin 사용이라 정상 동작.
alter table public.today_results enable row level security;
alter table public.today_result_unlocks enable row level security;

comment on table public.today_results is '오늘의 운세 결과. 매일 분석 (날짜별 row).';
comment on column public.today_results.target_date is '운세 대상 날짜 (사용자가 결과 보는 날, 보통 오늘).';
comment on column public.today_results.today_pillar is '서버 결정 일진 60갑자 한자 (예: 戊戌).';
comment on column public.today_results.today_mood is '서버 결정 mood: 강세/보통/주의/위기.';
comment on column public.today_results.branch_relation_type is '본인 일지 vs 일진 일지 관계 type. master getPairRelation 출력.';
comment on table public.today_result_unlocks is '오늘의 운세 결제(5알) 잠금. result_id + order_id 연결.';
