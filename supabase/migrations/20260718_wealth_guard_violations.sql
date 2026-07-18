-- supabase/migrations/20260718_wealth_guard_violations.sql
-- 재물운 심층 검사 후처리 가드(applyWealthGuards)가 걸러낸 위반 목록을 사후 감사용으로 저장.
-- analyze 라우트가 성공 저장 후 best-effort 로 채운다(비었으면 미기록). 본 리포트 저장과 분리된
-- 별도 UPDATE 라서 이 컬럼 write 실패는 리포트 생성에 영향 없음.
--
-- ⚠️ 적용 순서: 파일명 사전순(g < r)이라 이 파일이 20260718_wealth_results.sql 보다 앞서지만,
--    wealth_results 테이블은 그 마이그레이션에서 생성된다. 수동 적용 시 반드시
--    20260718_wealth_results.sql → 이 파일 순서로 실행할 것.

alter table public.wealth_results
  add column if not exists guard_violations jsonb;

comment on column public.wealth_results.guard_violations is
  '후처리 가드가 제거한 단정예언·재무자문·금지신살 등의 위반 로그(jsonb 배열). 사후 감사용, 비었으면 null.';
