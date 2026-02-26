-- saju_battles 통합 마이그레이션
-- 테이블이 없으면 생성, 있으면 컬럼 추가
-- Supabase 대시보드 SQL Editor에서 실행

-- 1. 테이블 생성 (user_id nullable, guest 컬럼 포함)
CREATE TABLE IF NOT EXISTS public.saju_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  player_a_name TEXT NOT NULL,
  player_b_name TEXT NOT NULL,
  player_a_grade TEXT NOT NULL,
  player_b_grade TEXT NOT NULL,
  overall_winner TEXT NOT NULL,
  overall_intensity TEXT NOT NULL,
  wins_a INTEGER NOT NULL DEFAULT 0,
  wins_b INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  relationship_type TEXT NOT NULL,
  full_result JSONB NOT NULL,
  guest_token_hash TEXT,
  guest_token_expires_at TIMESTAMPTZ,
  order_id TEXT,
  scoring_version INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 테이블이 이미 있는 경우 누락 컬럼 추가
ALTER TABLE public.saju_battles
  ADD COLUMN IF NOT EXISTS guest_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS guest_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS scoring_version INT NOT NULL DEFAULT 6;

-- 3. user_id nullable로 변경 (이미 NOT NULL이면 해제)
ALTER TABLE public.saju_battles
  ALTER COLUMN user_id DROP NOT NULL;

-- 4. 무주인 방지 CHECK (이미 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_owner_check'
  ) THEN
    ALTER TABLE public.saju_battles
      ADD CONSTRAINT battle_owner_check CHECK (
        user_id IS NOT NULL OR guest_token_hash IS NOT NULL
      );
  END IF;
END $$;

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS saju_battles_user_idx
  ON public.saju_battles (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_battles_guest_token
  ON public.saju_battles (guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;
