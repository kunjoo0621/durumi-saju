-- ============================================================
-- 2026-05-18: charge_coins RPC 멱등성 가드
-- ============================================================
-- 문제: 같은 order_id로 /api/coins/charge가 N번 호출되면
--       알이 N번 지급되어 과지급이 발생.
--       (장혜진 b058 1회 결제 → 7회 중복 charge 확인)
--
-- 수정:
--   1) advisory_xact_lock을 패키지 조회 직후로 이동
--      (race condition 차단을 first_only/멱등 가드 위에서 보장)
--   2) p_order_id가 NULL이 아니고 동일 reference_id + type='charge'가
--      이미 존재하면 잔액만 반환하고 종료
--   3) 멱등 가드를 first_only 검사보다 위에 배치
--      (멱등 재호출이 'first_charge_already_used' 에러로 떨어지는 것 방지)
--
-- 반환 시그니처 동일: (new_balance, charged, bonus)
-- 멱등 재호출 시 (현재 잔액, 0, 0) 반환 — route.ts에서 charged===0 && bonus===0
-- 이면 alreadyCharged 플래그를 응답에 실어 UI 토스트 분기.
--
-- 부가 작업:
--   - coin_transactions(reference_id) WHERE type='charge' 부분 인덱스 추가.
--     멱등 가드의 EXISTS 쿼리 풀스캔 방지. UNIQUE 아님 — 기존 중복 데이터
--     보존하면서 새 호출만 가드. UNIQUE 승격은 데이터 보정 PR(Phase 2) 이후.
-- ============================================================

CREATE INDEX IF NOT EXISTS coin_transactions_charge_reference_idx
ON coin_transactions(reference_id)
WHERE type = 'charge' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION charge_coins(
  p_user_id UUID,
  p_package_id TEXT,
  p_order_id TEXT DEFAULT NULL
)
RETURNS TABLE(new_balance INTEGER, charged INTEGER, bonus INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pkg RECORD;
  v_has_charge BOOLEAN;
  v_balance INTEGER;
BEGIN
  -- 패키지 검증
  SELECT * INTO v_pkg FROM coin_packages WHERE id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_package: %', p_package_id;
  END IF;

  -- advisory lock (user_id 기반) — 멱등/first_only 검사 전에 직렬화
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- ★ 멱등 가드: 동일 order_id로 이미 charge 행이 있으면 잔액만 반환
  IF p_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM coin_transactions
    WHERE reference_id = p_order_id AND type = 'charge'
  ) THEN
    SELECT coin_balance INTO v_balance
    FROM profiles
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT COALESCE(v_balance, 0), 0, 0;
    RETURN;
  END IF;

  -- 첫충전 패키지 검증 (멱등 가드 통과 이후에 검사)
  IF v_pkg.is_first_only THEN
    SELECT EXISTS(
      SELECT 1 FROM coin_transactions
      WHERE user_id = p_user_id AND type = 'charge'
    ) INTO v_has_charge;

    IF v_has_charge THEN
      RAISE EXCEPTION 'first_charge_already_used';
    END IF;
  END IF;

  -- 잔액 업데이트
  UPDATE profiles
  SET coin_balance = coin_balance + v_pkg.coin_amount + v_pkg.bonus_amount
  WHERE user_id = p_user_id
  RETURNING coin_balance INTO v_balance;

  IF NOT FOUND THEN
    INSERT INTO profiles (user_id, coin_balance)
    VALUES (p_user_id, v_pkg.coin_amount + v_pkg.bonus_amount)
    RETURNING coin_balance INTO v_balance;
  END IF;

  -- charge 트랜잭션 기록
  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id, package_id)
  VALUES (p_user_id, 'charge', v_pkg.coin_amount, v_balance - v_pkg.bonus_amount, p_order_id, p_package_id);

  -- bonus 트랜잭션 기록 (보너스가 있을 때만)
  IF v_pkg.bonus_amount > 0 THEN
    INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id, package_id)
    VALUES (p_user_id, 'bonus', v_pkg.bonus_amount, v_balance, p_order_id, p_package_id);
  END IF;

  RETURN QUERY SELECT v_balance, v_pkg.coin_amount, v_pkg.bonus_amount;
END;
$$;
