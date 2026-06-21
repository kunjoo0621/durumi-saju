-- ============================================================
-- 2026-06-21: 공유 보상 (결과 공유 1회 → 5알, 멱등)
-- ============================================================
-- WHY: 가입 보너스(무료 10알) 종료와 함께, 결과 화면에서 친구에게 결과를
--      공유하면 1인당 최초 1회에 한해 5알(= 오늘의 운세 1회)을 지급한다.
--      공유 버튼은 풀 결과 화면(ResultClient)에만 있어, 보상은 자연히
--      "결과를 본 사용자"에게만 간다.
--
-- 방식:
--   - profiles.share_reward_granted_at 플래그로 1인당 1회만 보장(멱등).
--   - grant_share_reward RPC: advisory lock + FOR UPDATE로 직렬화, bonus(+5) 저장.
--     coin_transactions는 type='bonus' AND amount>0 (CHECK 충족), reference_id='share_reward'.
--   - 가입 보너스(grant_signup_bonus)와 독립. 호출은 인증 사용자만(API에서 가드).
-- ============================================================

-- 1. profiles.share_reward_granted_at
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_reward_granted_at TIMESTAMPTZ;

-- 2. grant_share_reward RPC (5알, 멱등)
CREATE OR REPLACE FUNCTION grant_share_reward(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, reward_amount INTEGER, new_balance INTEGER, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_reward CONSTANT INTEGER := 5;
  v_balance INTEGER;
  v_granted TIMESTAMPTZ;
BEGIN
  -- user-level 직렬화 (signup_bonus/spend/charge와 같은 키)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- profiles 없으면 생성
  INSERT INTO profiles (user_id, coin_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 이미 받았는지 확인 (멱등)
  SELECT share_reward_granted_at, coin_balance
    INTO v_granted, v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_granted IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, v_balance, 'already_granted'::TEXT;
    RETURN;
  END IF;

  UPDATE profiles
    SET coin_balance = coin_balance + v_reward,
        share_reward_granted_at = NOW()
    WHERE user_id = p_user_id
    RETURNING coin_balance INTO v_balance;

  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'bonus', v_reward, v_balance, 'share_reward');

  RETURN QUERY SELECT TRUE, v_reward, v_balance, 'granted'::TEXT;
END;
$$;
