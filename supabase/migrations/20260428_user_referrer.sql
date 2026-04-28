-- 채널/유입 추적용 컬럼 추가 (가입 시점의 referrer 정보 기록)
-- 신규 사용자만 적용, 기존 사용자는 NULL 유지
-- 적용 사유: PostHog 통합이 작동 안 해 자체 추적 시작

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS landing_path TEXT;

-- 채널별 통계 쿼리를 빠르게 하기 위한 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_users_utm_source ON users (utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users (referrer) WHERE referrer IS NOT NULL;

COMMENT ON COLUMN users.referrer IS '첫 진입 referer 헤더 (예: instagram.com, google.com)';
COMMENT ON COLUMN users.utm_source IS 'UTM source 파라미터 (예: naver_blog)';
COMMENT ON COLUMN users.utm_medium IS 'UTM medium 파라미터 (예: social, cpc)';
COMMENT ON COLUMN users.utm_campaign IS 'UTM campaign 파라미터';
COMMENT ON COLUMN users.landing_path IS '첫 진입 경로 (예: /, /teaser)';
