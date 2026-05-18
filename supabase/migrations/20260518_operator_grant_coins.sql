-- ============================================================
-- 2026-05-18: 운영 보정용 operator_grant_coins RPC
-- ============================================================
-- 배경:
--   scripts/grant-coins-to-user.mts 가 profiles.coin_balance 를 직접 UPDATE
--   한 뒤 별도로 coin_transactions INSERT 를 시도했음. 그러나 INSERT 쪽이
--   존재하지 않는 'reason' 컬럼을 사용해 매번 실패했고, profile UPDATE 만
--   commit 되어 ledger 에 안 남는 잔액 증가가 발생.
--
--   동일 패턴의 약점이 grant-test-coins.mts / grant-10-self.mts 에도 있음
--   (두 작업이 별도 트랜잭션이라 한쪽만 실패 가능).
--
-- 수정:
--   - profile 잔액 변경 + ledger 기록을 한 PL/pgSQL 함수에 묶어 atomic 보장
--   - advisory lock 으로 같은 user 동시 호출 직렬화
--   - amount 양수 → 'bonus' / 음수 → 'spend' (coin_transactions amount sign
--     CHECK 준수)
--   - 음수 결과 잔액 차단 (운영자가 실수로 큰 차감 시 보호)
--
-- 일반 사용자 결제 흐름과 완전 분리. service_role_key 보유 도구만 사용.
-- ============================================================

CREATE OR REPLACE FUNCTION operator_grant_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS TABLE(new_balance INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
  v_reference TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'invalid_amount: %', p_amount USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  INSERT INTO profiles (user_id, coin_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
  SET coin_balance = coin_balance + p_amount
  WHERE user_id = p_user_id
  RETURNING coin_balance INTO v_balance;

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'negative_balance_blocked: would_become %', v_balance USING ERRCODE = '22023';
  END IF;

  v_reference := 'operator:' || COALESCE(p_reason, 'manual');

  -- coin_transactions amount sign CHECK:
  --   spend → 음수, charge/bonus/refund → 양수
  IF p_amount > 0 THEN
    INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
    VALUES (p_user_id, 'bonus', p_amount, v_balance, v_reference);
  ELSE
    INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
    VALUES (p_user_id, 'spend', p_amount, v_balance, v_reference);
  END IF;

  RETURN QUERY SELECT v_balance;
END;
$$;
