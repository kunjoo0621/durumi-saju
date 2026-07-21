-- supabase/migrations/20260721_career_results.sql
-- 커리어운 심층 검사 결과. wealth_results 패턴 미러.
-- 차이: interest(재물 관심사) 대신 situation(상황 4분법) + 커리어 전용 메타 컬럼.
-- ★guard_violations 컬럼을 처음부터 포함한다(wealth는 별도 파일이라 사전순 적용 순서 함정이
--   있었음 — 20260718_wealth_guard_violations.sql 주석 참조. 커리어는 단일 파일로 원천 회피).

create table if not exists public.career_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source_result_id uuid references public.saju_results(id) on delete set null,
  input_hash text not null,
  situation text not null,             -- 진로 탐색/현직 성장/이직 고민/독립·사업
  -- 입력 스냅샷 (saju_results 동일 컬럼)
  name text, birth_date date, birth_time text, region text, gender text,
  relationship_status text, employment_status text, calendar_type text, core_fear_axis text,
  -- 사주 캐시 + 커리어운 메타
  saju_text text,
  career_grade text,                   -- SS/S/A/B/C (직장운 점수 결정론 매핑)
  gwanseong_type text,                 -- 정관우세/편관우세/관살혼잡/무관
  gwanda_sinyak boolean,
  gwanin_sangsaeng boolean,
  sanggwan_gyeongwan boolean,
  career_grip text,                    -- 그릇(신왕관왕/신왕관쇠/관다신약/신약관소) 2차원 4상한
  teaser_json jsonb,
  full_json jsonb,
  guard_violations jsonb,              -- 후처리 가드가 제거한 위반 로그(사후 감사용, 비면 null)
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 같은 입력×같은 상황 결과 1건 (상황 바뀌면 새 리포트 허용)
create unique index if not exists career_results_user_input_situation_unique
  on public.career_results (user_id, input_hash, situation)
  where user_id is not null;

alter table public.career_results
  drop constraint if exists career_results_user_input_situation_uq;
alter table public.career_results
  add constraint career_results_user_input_situation_uq
  unique (user_id, input_hash, situation);

create unique index if not exists career_results_guest_input_situation_unique
  on public.career_results (guest_token_hash, input_hash, situation)
  where guest_token_hash is not null;

create index if not exists career_results_input_hash_idx
  on public.career_results (input_hash);

create table if not exists public.career_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.career_results(id) on delete cascade,
  input_hash text not null,
  situation text not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists career_result_unlocks_user_input_situation_unique
  on public.career_result_unlocks (user_id, input_hash, situation);
create unique index if not exists career_result_unlocks_order_unique
  on public.career_result_unlocks (order_id);
create index if not exists career_result_unlocks_result_idx
  on public.career_result_unlocks (result_id);

alter table public.career_results
  drop constraint if exists career_results_owner_check;
alter table public.career_results
  add constraint career_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

alter table public.career_results enable row level security;
alter table public.career_result_unlocks enable row level security;

comment on table public.career_results is '커리어운 심층 검사 결과. 상황(situation)별 row.';
comment on column public.career_results.situation is '진로 탐색/현직 성장/이직 고민/독립·사업 (검사 내부 4분법).';
comment on column public.career_results.career_grade is '직장운 점수 결정론 매핑 등급 SS~C.';
comment on column public.career_results.career_grip is '그릇(책임·자리를 감당하는 능력) — (신강/신약)×(weighted 관성 강/약) 2차원 4상한(신왕관왕/신왕관쇠/관다신약/신약관소). lib/career-facts.ts 결정론 산출.';
comment on column public.career_results.guard_violations is '후처리 가드가 제거한 단정예언·실행단정·금지신살 등의 위반 로그(jsonb 배열). 사후 감사용, 비면 null.';
