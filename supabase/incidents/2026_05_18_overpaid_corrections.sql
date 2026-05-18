-- ============================================================
-- 사고: 2026-05-18 /api/coins/charge 멱등성 부재로 인한 중복 충전
-- 적용: Supabase SQL editor 에서 한 번 직접 실행 (마이그레이션 아님).
-- 전제:
--   1) 20260518_charge_coins_idempotent.sql      ← 먼저 적용
--   2) 20260518_operator_grant_coins.sql         ← 먼저 적용
--   3) 이 파일                                     ← 그 다음
--   4) 20260518_charge_reference_unique.sql      ← 마지막 (UNIQUE 승격)
--
-- 사고 요약:
--   장혜진(user 9e8d1e96) 의 b058e3fc 결제 1건이 18번 처리됨.
--   - ledger b058 charge 18행 (정상 1 + 중복 17)
--   - ledger b058 bonus  18행 (정상 1 + 중복 17)
--   - 잔액 = ledger SUM = 602  (정합성 자체는 맞음)
--   - 정상 잔액 = signup10 + popular35 + value62 - spend100 = 7
--   - 과지급 = 595 알
--
-- 정책:
--   - 잔액을 정상값 7알로 보정.
--   - operator_grant_coins(-595) 가 ledger 에 'spend' -595 행을 atomic 하게
--     남김. ledger 와 balance 모두 7로 일치.
--   - 중복 charge/bonus 17행은 audit 보존 차원으로 ledger 에 그대로 유지.
-- ============================================================

BEGIN;

SELECT * FROM operator_grant_coins(
  '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid,
  -595,
  'incident_2026_05_18_overpaid_b058'
);

-- 검증: 보정 후 balance 와 ledger SUM 이 7로 일치해야 함.
DO $$
DECLARE
  v_balance INTEGER;
  v_ledger INTEGER;
BEGIN
  SELECT coin_balance INTO v_balance FROM profiles
  WHERE user_id = '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger FROM coin_transactions
  WHERE user_id = '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid;

  IF v_balance <> 7 OR v_ledger <> 7 THEN
    RAISE EXCEPTION 'reconcile failed: balance=% ledger=% (expected both 7)', v_balance, v_ledger;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 이상윤(+10), 신건주(-10) 의 ±10 옛 데이터 흔적은 별도 검토 후 처리.
-- 운영자 본인(신건주) + signup_bonus_granted_at NULL 인 4월 가입자(이상윤)
-- 만 남아 있어 운영상 영향 미미.
-- ============================================================
