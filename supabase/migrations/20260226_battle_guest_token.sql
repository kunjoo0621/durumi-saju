-- saju_battles에 guest_token 지원 추가
-- Late Login 패턴: saju_results 테이블과 동일한 구조

-- 1. guest_token 컬럼 추가
ALTER TABLE saju_battles
  ADD COLUMN IF NOT EXISTS guest_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS guest_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_id TEXT;

-- 2. user_id를 nullable로 변경 (guest 결제 시 user_id 없음)
ALTER TABLE saju_battles
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. 무주인 방지 CHECK (saju_results와 동일 패턴)
ALTER TABLE saju_battles
  ADD CONSTRAINT battle_owner_check CHECK (
    user_id IS NOT NULL OR guest_token_hash IS NOT NULL
  );

-- 4. guest_token 인덱스 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_battles_guest_token
  ON saju_battles(guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;

-- 5. scoring_version (스코어링 알고리즘 버전 추적)
ALTER TABLE saju_battles
  ADD COLUMN IF NOT EXISTS scoring_version INT NOT NULL DEFAULT 6;
