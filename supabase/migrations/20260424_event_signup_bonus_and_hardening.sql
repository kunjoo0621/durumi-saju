-- ============================================================
-- 2026-04-24: 이벤트 가입 보너스 + 보안 하드닝
-- ============================================================
-- 1. users.email 컬럼 추가 (카카오 이메일 수집)
-- 2. profiles.signup_bonus_granted_at 컬럼 추가 (멱등성)
-- 3. coin_transactions.amount 부호 규칙 CHECK
--    spend = 음수, charge/bonus/refund = 양수 (기존 관행 유지)
-- 4. grant_signup_bonus RPC (ATOMIC, 10알, 멱등)
-- 5. spend_coins RPC 음수 amount 가드 추가
-- ============================================================

-- 1. users.email
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email) WHERE email IS NOT NULL;

-- 2. profiles.signup_bonus_granted_at
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_bonus_granted_at TIMESTAMPTZ;

-- 3. coin_transactions.amount 부호 규칙 CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coin_transactions_amount_sign'
  ) THEN
    ALTER TABLE coin_transactions
      ADD CONSTRAINT coin_transactions_amount_sign CHECK (
        (type = 'spend' AND amount < 0) OR
        (type IN ('charge', 'bonus', 'refund') AND amount > 0)
      );
  END IF;
END
$$;

-- 4. grant_signup_bonus RPC (bonus = 양수 저장)
CREATE OR REPLACE FUNCTION grant_signup_bonus(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, bonus_amount INTEGER, new_balance INTEGER, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_bonus CONSTANT INTEGER := 10;
  v_balance INTEGER;
  v_granted TIMESTAMPTZ;
BEGIN
  -- user-level 직렬화 (spend_coins/charge_coins와 같은 키 사용)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- profiles 없으면 생성
  INSERT INTO profiles (user_id, coin_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 이미 지급받았는지 확인
  SELECT signup_bonus_granted_at, coin_balance
    INTO v_granted, v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_granted IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, v_balance, 'already_granted'::TEXT;
    RETURN;
  END IF;

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

-- 5. spend_coins RPC 음수 가드 (spend = 음수로 저장, 기존 관행 유지)
CREATE OR REPLACE FUNCTION spend_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(new_balance INTEGER, success BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- 음수/0 차단 (최우선 가드 — 코인 민팅 공격 방어)
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount: %', p_amount USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT coin_balance INTO v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_balance := 0;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT v_balance, FALSE;
    RETURN;
  END IF;

  UPDATE profiles
    SET coin_balance = coin_balance - p_amount
    WHERE user_id = p_user_id
    RETURNING coin_balance INTO v_balance;

  -- 기존 관행 유지: spend는 음수로 저장
  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'spend', -p_amount, v_balance, p_reference_id);

  RETURN QUERY SELECT v_balance, TRUE;
END;
$$;
