-- supabase/migrations/20260718_marriage_guard_violations.sql
-- 결혼운 심층 검사 후처리 가드(applyMarriageGuards)가 걸러낸 위반 목록을 사후 감사용으로 저장.
-- analyze 라우트가 성공 저장 후 best-effort 로 채운다(비었으면 미기록). 본 리포트 저장과 분리된
-- 별도 UPDATE 라서 이 컬럼 write 실패는 리포트 생성에 영향 없음.

alter table public.marriage_results
  add column if not exists guard_violations jsonb;

comment on column public.marriage_results.guard_violations is
  '후처리 가드가 제거한 단정예언·금지신살·근거없는조언 등의 위반 로그(jsonb 배열). 사후 감사용, 비었으면 null.';
