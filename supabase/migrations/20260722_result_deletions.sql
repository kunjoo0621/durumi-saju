-- 사주 결과 삭제 감사 로그 (append-only).
-- 목적: 유료 결과가 사라졌을 때 "본인 삭제"인지 "시스템 손실"인지 구분.
-- DELETE /api/results/[id] 가 하드 삭제 직후 여기에 한 줄 남긴다.
-- FK/cascade 를 일부러 걸지 않는다 — 원본(saju_results)·유저가 사라져도 감사 로그는 보존돼야 함.

create table if not exists public.result_deletions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,            -- 삭제한(=소유) 유저. FK 없음(보존 목적)
  result_id     uuid not null,   -- 삭제된 saju_results.id. FK 없음(원본은 이미 사라짐)
  input_hash    text,
  name          text,
  birth_date    text,
  was_delivered boolean,         -- 삭제 시점에 정상 full_json(전달완료)였는지
  deleted_at    timestamptz not null default now()
);

create index if not exists result_deletions_user_idx
  on public.result_deletions (user_id);

create index if not exists result_deletions_deleted_at_idx
  on public.result_deletions (deleted_at);

-- 서버(service-role) 전용. 클라이언트 직접 접근 없음 → 정책 없이 RLS만 켠다.
alter table public.result_deletions enable row level security;
