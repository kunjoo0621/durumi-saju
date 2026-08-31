-- supabase/migrations/20260901_couple_results.sql
-- "우리 결혼해도 되는 사주일까" — 2인(20알) 심층 판정 결과.
-- marriage_results 패턴 미러. 결정적 차이 두 가지:
--   ① 상대(B) 입력 스냅샷 컬럼이 있다. 두 원국을 다 계산하는 상품이라 재현에 필요하다.
--   ② current_year 를 저장한다. ★대운·세운이 연도에 의존하는데, teaser 를 저장해 두고
--      나중에 결제할 때 "판정이 그새 바뀌었나"를 재계산해 대조한다(marriage analyze 게이트
--      미러). 그 재계산이 '오늘'을 읽으면 12/31 teaser → 1/1 analyze 에서 판정이 밀려
--      정당한 결제가 409로 튕긴다. 저장된 연도로 재계산해야 한다.
--      (lib/pair/pair-facts.ts 의 currentYear 주입과 한 쌍이다)
--
-- ★등급 컬럼이 없다. 운영자 확정(§1-0) — 등급은 개인사주에서만 보여준다.
--   저장해 두면 언젠가 화면에 뜬다. 아예 안 만든다.

create table if not exists public.couple_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source_result_id uuid references public.saju_results(id) on delete set null,
  input_hash text not null,

  -- 본인(A) 입력 스냅샷 (saju_results 동일 컬럼)
  name text, birth_date date, birth_time text, region text, gender text,
  calendar_type text,

  -- 상대(B) 입력 스냅샷 — 제3자 정보라 최소 수집
  partner_name text,
  partner_birth_date date,
  partner_birth_time text,
  partner_region text,
  partner_gender text,
  partner_calendar_type text,
  partner_unknown_birth_time boolean default false,

  -- 판정 (서버 결정론 확정값)
  current_year int not null,
  verdict text,                          -- 5단계 종합 판정 라벨
  axis_mind text,                        -- 순/평/역/모름
  axis_life text,
  axis_complement text,
  axis_timing text,
  neutralized_axes text[] default '{}',  -- 시주 미상 등으로 판정에서 뺀 축

  -- 사실 스냅샷 — ★화면은 이것만 그린다(표시 계층 사주 계산 금지, CLAUDE.md)
  pair_facts_json jsonb,
  teaser_json jsonb,
  full_json jsonb,

  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 같은 (본인+상대) 조합 결과 1건. input_hash 는 A입력 + B입력 정규화의 결합 해시다.
create unique index if not exists couple_results_user_input_unique
  on public.couple_results (user_id, input_hash)
  where user_id is not null;

alter table public.couple_results
  drop constraint if exists couple_results_user_input_uq;
alter table public.couple_results
  add constraint couple_results_user_input_uq
  unique (user_id, input_hash);

create unique index if not exists couple_results_guest_input_unique
  on public.couple_results (guest_token_hash, input_hash)
  where guest_token_hash is not null;

create index if not exists couple_results_input_hash_idx
  on public.couple_results (input_hash);

create table if not exists public.couple_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.couple_results(id) on delete cascade,
  input_hash text not null,
  order_id text not null,
  created_at timestamptz default now()
);

-- ★order_id UNIQUE 가 "차감 1회 = 환불 최대 1회" 불변식의 바닥이다.
--   lib/server/report-unlock.ts 의 삭제-승자 판정이 이 유니크를 전제로 동작한다.
create unique index if not exists couple_result_unlocks_user_input_unique
  on public.couple_result_unlocks (user_id, input_hash);
create unique index if not exists couple_result_unlocks_order_unique
  on public.couple_result_unlocks (order_id);
create index if not exists couple_result_unlocks_result_idx
  on public.couple_result_unlocks (result_id);

alter table public.couple_results
  drop constraint if exists couple_results_owner_check;
alter table public.couple_results
  add constraint couple_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

alter table public.couple_results enable row level security;
alter table public.couple_result_unlocks enable row level security;

comment on table public.couple_results is '"우리 결혼해도 되는 사주일까" 2인 심층 판정. 상대 입력 스냅샷 포함.';
comment on column public.couple_results.current_year is
  '판정에 쓴 연도. 결제 전 재계산 게이트가 이 값으로 다시 계산해야 한다 — 오늘 날짜를 읽으면 연말연시에 정당한 결제가 튕긴다.';
comment on column public.couple_results.pair_facts_json is
  '두 원국의 관계 사실 스냅샷(lib/pair/pair-facts.ts). 화면은 이것만 그린다 — 표시 계층에서 사주 재계산 금지.';
comment on column public.couple_results.neutralized_axes is
  '시주 미상 등으로 신뢰도가 떨어져 판정에서 뺀 축. 값이 아니라 "볼 수 없었다"는 사실을 남긴다.';
comment on column public.couple_results.partner_name is
  '제3자 정보. 최소 수집 원칙 — 결과 조회는 요청자 소유 스코프로만 허용한다.';
