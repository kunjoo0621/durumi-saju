-- 반려동물 궁합 기능 v0.4
-- 펫 프로필 + 궁합 분석 결과 테이블 신설
-- 컨셉: 보호자 사주 + 펫 사주 → 4지표(호흡/집안실세/랜선집사/사주어긋남) + 5등급 라벨
-- 명리학적 근거: 세종의소리 칼럼 (동물 사주 매트릭스)
-- 인증: NextAuth + supabaseAdmin(service_role) 패턴 — RLS 미사용 (다른 테이블 일관성)
-- 결제: 코인 시스템 도입 후 회원 전용

-- ──────────────────────────────────────────────
-- 1. pet_profiles — 한 보호자가 여러 펫 등록 가능 (재사용)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 기본 정보
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat')),     -- v0.4: 강아지·고양이만
  breed TEXT,                                                    -- 품종 (선택, 없으면 mixed 처리)
  gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'unknown')),

  -- 생일 4티어 시스템 (정확도)
  -- tier 1: 정확한 생일+시 / tier 2: 생일만 / tier 3: 추정 월·년 / tier 4: 가족 된 날 대체
  birth_tier SMALLINT NOT NULL CHECK (birth_tier BETWEEN 1 AND 4),
  birth_date DATE,                                               -- tier 1·2일 때
  birth_time TIME,                                               -- tier 1일 때만
  birth_year_estimated SMALLINT,                                 -- tier 3 (추정 년)
  birth_month_estimated SMALLINT CHECK (birth_month_estimated IS NULL OR birth_month_estimated BETWEEN 1 AND 12),
  adoption_date DATE,                                            -- tier 4 (가족 된 날)
  calendar_type TEXT CHECK (calendar_type IS NULL OR calendar_type IN ('solar', 'lunar')),

  -- 입양 경로 (fallback 분기 + 데이터 분석용)
  adoption_route TEXT CHECK (adoption_route IS NULL OR adoption_route IN ('purchase', 'rescue', 'gift', 'unknown')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_profiles_user_idx ON public.pet_profiles (user_id, created_at DESC);

-- 생일 데이터 일관성 (tier별 필수 필드 검증) — idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pet_birth_data_consistency'
  ) THEN
    ALTER TABLE public.pet_profiles
      ADD CONSTRAINT pet_birth_data_consistency CHECK (
        (birth_tier = 1 AND birth_date IS NOT NULL AND birth_time IS NOT NULL) OR
        (birth_tier = 2 AND birth_date IS NOT NULL) OR
        (birth_tier = 3 AND birth_year_estimated IS NOT NULL) OR
        (birth_tier = 4 AND adoption_date IS NOT NULL)
      );
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 2. pet_compat_results — 궁합 분석 결과
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pet_compat_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,

  -- 등급 + 라벨
  label_grade TEXT NOT NULL CHECK (label_grade IN ('S', 'A', 'B', 'C', 'D')),
  label_text TEXT NOT NULL,                                      -- 예: "집안 실세와 월급 없는 운영진"
  composite_score INT NOT NULL CHECK (composite_score BETWEEN 0 AND 100),

  -- 4지표 (한국 MZ 펫 SNS 톤)
  sync_score INT NOT NULL CHECK (sync_score BETWEEN 0 AND 100),         -- 🐾 호흡 지수
  ruler_score INT NOT NULL CHECK (ruler_score BETWEEN 0 AND 100),       -- 👑 집안 실세 지수
  lover_score INT NOT NULL CHECK (lover_score BETWEEN 0 AND 100),       -- 🐶 랜선집사 지수
  conflict_score INT NOT NULL CHECK (conflict_score BETWEEN 0 AND 100), -- ⚡ 사주 어긋남 지수

  -- 결과 시각화 일러스트 (사전 생성 풀에서 매칭)
  illustration_key TEXT,                                         -- 예: "S_dog_v1", "C_cat_v2"
  illustration_url TEXT,

  -- 전체 결과 (LLM 생성 본문 + 사용설명서 + 시뮬레이션 등)
  full_result JSONB NOT NULL,

  -- 결제·버전 추적
  order_id TEXT,
  scoring_version INT NOT NULL DEFAULT 1,                         -- pet_compat_scoring v1

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_compat_user_idx
  ON public.pet_compat_results (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pet_compat_pet_idx
  ON public.pet_compat_results (pet_id, created_at DESC);

-- RLS 정책 미설정: 다른 테이블(saju_results, saju_battles 등) 일관성 유지.
-- 모든 접근은 서버 API의 supabaseAdmin (service_role) 통해서만 처리.
-- NextAuth 세션 → getSupabaseUserId(session) → user_id 매칭 검증.
