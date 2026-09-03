-- supabase/migrations/20260903_couple_leap_month.sql
-- 윤달 플래그 컬럼 추가.
--
-- 왜: 20260901_couple_results.sql 에 윤달 플래그가 없었다. 그런데 자체입력 경로는
-- 윤달을 반영해 원국을 만들고(lib/self-input.ts:84), 결제 시 재계산은 그 정보를 알 수 없어
-- 평달로 계산했다. 결과가 둘로 갈린다:
--   ① 윤달생 상대 → 평달 원국으로 계산한 **조용히 틀린 리포트**를 판다.
--   ② 윤달생 본인 → teaser(윤달 반영)와 결제 시 재계산(평달)의 판정이 달라져
--      결제 전 판정 게이트가 **정당한 결제를 영원히 튕긴다**(재시도해도 결정론적으로 동일).
-- 코드리뷰에서 발견. 기존 row 는 전부 평달(false)이 맞다 — 윤달 입력을 받은 적이 없다.

alter table public.couple_results
  add column if not exists is_leap_month boolean default false,
  add column if not exists partner_is_leap_month boolean default false;

comment on column public.couple_results.is_leap_month is
  '본인 음력 윤달 여부. 빠지면 결제 시 재계산이 평달로 갈라져 판정 게이트가 정당한 결제를 튕긴다.';
comment on column public.couple_results.partner_is_leap_month is
  '상대 음력 윤달 여부. 빠지면 윤달생 상대를 평달 원국으로 계산한 리포트가 나간다.';
