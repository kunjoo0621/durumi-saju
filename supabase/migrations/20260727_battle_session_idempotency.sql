-- ============================================================
-- 2026-07-27: 배틀 멱등성 — 한 결제(prepayment_session)당 배틀 1건
-- ============================================================
-- 문제(실측): app/api/battle/analyze 가 body.sessionId 를 받아놓고 쓰지 않아
--   더블탭/재시도/화면복귀마다 Gemini 재호출 + saju_battles row 중복 생성.
--   정윤하(5ee54439) 실측 = 배틀 17판 / -20알 결제 11건 → 6판 무과금.
--   증거: row 가 6초 간격 쌍으로 붙고, order_id 는 전부 null.
--
-- 조치: session_id 컬럼 + UNIQUE 부분인덱스.
--   - 게스트 배틀은 session_id NULL → 부분인덱스 대상 밖이라 서로 충돌하지 않음
--     (기존 게스트 동작 그대로 유지).
--   - 기존 row 는 전부 NULL 이므로 인덱스 생성이 실패하지 않음.
--
-- ⚠️ Supabase SQL Editor 실행 시 "Run without RLS" 로 실행할 것.
--    "Run and enable RLS" 버튼이 SQL 을 변형시킨 전례 있음(펫 마이그레이션 사고).
-- ============================================================

ALTER TABLE public.saju_battles
  ADD COLUMN IF NOT EXISTS session_id TEXT;

COMMENT ON COLUMN public.saju_battles.session_id IS
  '이 배틀을 만든 prepayment_sessions.id (멱등키). 게스트 배틀은 NULL.';

-- 한 결제 세션 = 배틀 1건. 동시 더블탭까지 DB 레벨에서 원천 차단.
CREATE UNIQUE INDEX IF NOT EXISTS saju_battles_session_id_uniq
  ON public.saju_battles (session_id)
  WHERE session_id IS NOT NULL;
