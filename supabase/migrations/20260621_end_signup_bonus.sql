-- ============================================================
-- 2026-06-21: 가입 보너스 이벤트 종료 (무료 10알 → 0알)
-- ============================================================
-- WHY: 가입 보너스 이벤트(2026-04-24~)를 2026-06-21 23:59 KST부로 종료.
--      종료 후 신규 가입(첫 로그인) 보너스 0알로 전환한다.
--
-- 방식: grant_signup_bonus RPC에 종료 시각 게이트를 넣는다.
--   - 종료 시각 v_event_end = '2026-06-21 15:00:00+00' (= 2026-06-22 00:00 KST).
--     components/EventSignupBanner.tsx 의 EVENT_END_TS(Date.UTC(2026,5,21,15,0,0))와 정확히 동일.
--   - 이 마이그레이션을 종료 시각 전에 적용해도, NOW() < v_event_end 인 동안은 기존대로 10알 지급.
--     NOW() >= v_event_end 가 되는 순간(자정) 자동으로 0알 전환된다. (자정 수동작업 불필요)
--   - 종료 후 경로: 코인 미지급 + 멱등 마킹(signup_bonus_granted_at)만. profiles 행 생성은 유지.
--     coin_transactions INSERT는 생략한다 — type='bonus' AND amount>0 CHECK(coin_transactions_amount_sign)
--     위반을 피하기 위함(0알 bonus row를 만들지 않는다).
--   - 멱등/직렬화/충전(charge_coins) 경로는 기존과 동일하게 보존.
-- ============================================================

CREATE OR REPLACE FUNCTION grant_signup_bonus(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, bonus_amount INTEGER, new_balance INTEGER, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_bonus     CONSTANT INTEGER     := 10;
  v_event_end CONSTANT TIMESTAMPTZ := '2026-06-21 15:00:00+00';  -- 2026-06-22 00:00 KST (배너 EVENT_END_TS와 동일)
  v_balance INTEGER;
  v_granted TIMESTAMPTZ;
BEGIN
  -- user-level 직렬화 (spend_coins/charge_coins와 같은 키 사용)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- profiles 없으면 생성 (잔고 0)
  INSERT INTO profiles (user_id, coin_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 이미 처리됐는지 확인 (멱등)
  SELECT signup_bonus_granted_at, coin_balance
    INTO v_granted, v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_granted IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, v_balance, 'already_granted'::TEXT;
    RETURN;
  END IF;

  -- 이벤트 종료: 0알. 멱등 마킹만 하고 코인/트랜잭션은 만들지 않는다.
  IF NOW() >= v_event_end THEN
    UPDATE profiles
      SET signup_bonus_granted_at = NOW()
      WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, 0, v_balance, 'event_ended'::TEXT;
    RETURN;
  END IF;

  -- 이벤트 진행 중: 기존대로 10알 지급
  UPDATE profiles
    SET coin_balance = coin_balance + v_bonus,
        signup_bonus_granted_at = NOW()
    WHERE user_id = p_user_id
    RETURNING coin_balance INTO v_balance;

  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'bonus', v_bonus, v_balance, 'signup_bonus');

  RETURN QUERY SELECT TRUE, v_bonus, v_balance, 'granted'::TEXT;
END;
$$;
