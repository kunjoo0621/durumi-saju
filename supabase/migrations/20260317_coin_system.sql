-- ============================================================
-- 알 충전 시스템: coin_packages + coin_transactions + RPCs
-- ============================================================

-- 1. coin_packages 테이블
CREATE TABLE IF NOT EXISTS coin_packages (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  coin_amount INTEGER NOT NULL,
  bonus_amount INTEGER NOT NULL DEFAULT 0,
  total_eggs INTEGER GENERATED ALWAYS AS (coin_amount + bonus_amount) STORED,
  is_first_only BOOLEAN NOT NULL DEFAULT FALSE,
  highlight BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4개 패키지 INSERT
INSERT INTO coin_packages (id, label, emoji, price, coin_amount, bonus_amount, is_first_only, highlight)
VALUES
  ('first',   '첫 충전', '🌱', 1000,  10,  2,  TRUE,  FALSE),
  ('basic',   '기본',    '⭐', 3000,  30,  3,  FALSE, FALSE),
  ('popular', '인기',    '🔥', 5000,  50,  8,  FALSE, TRUE),
  ('value',   '알뜰',   '💎', 10000, 100, 20, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. coin_transactions 테이블
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'spend', 'bonus', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_id TEXT,         -- sessionId, orderId 등 참조
  package_id TEXT REFERENCES coin_packages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created
  ON coin_transactions (user_id, created_at DESC);

-- 3. profiles 테이블 (coin_balance 포함)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  coin_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles 테이블이 이미 존재하지만 coin_balance 컬럼이 없는 경우
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'coin_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN coin_balance INTEGER NOT NULL DEFAULT 0;
  END IF;
END
$$;

-- 4. charge_coins RPC
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

  -- 첫충전 패키지 검증
  IF v_pkg.is_first_only THEN
    SELECT EXISTS(
      SELECT 1 FROM coin_transactions
      WHERE user_id = p_user_id AND type = 'charge'
    ) INTO v_has_charge;

    IF v_has_charge THEN
      RAISE EXCEPTION 'first_charge_already_used';
    END IF;
  END IF;

  -- advisory lock (user_id 기반)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

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

-- 5. spend_coins RPC
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
  -- advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- 현재 잔액 조회
  SELECT coin_balance INTO v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_balance := 0;
  END IF;

  -- 잔액 부족
  IF v_balance < p_amount THEN
    RETURN QUERY SELECT v_balance, FALSE;
    RETURN;
  END IF;

  -- 차감
  UPDATE profiles
  SET coin_balance = coin_balance - p_amount
  WHERE user_id = p_user_id
  RETURNING coin_balance INTO v_balance;

  -- spend 트랜잭션 기록
  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'spend', -p_amount, v_balance, p_reference_id);

  RETURN QUERY SELECT v_balance, TRUE;
END;
$$;
