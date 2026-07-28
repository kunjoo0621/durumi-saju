-- ============================================================
-- 2026-07-28: 공유 보상 v2 — 카카오톡 전송 확인 + 결과지 종류당 1회 5알
-- ============================================================
-- WHY (바꾼 이유):
--   구 방식은 "공유 버튼 클릭(=클립보드 복사 성공)"만으로 5알을 지급했다.
--   실제로 공유가 일어났는지 확인할 방법이 없어, 누구나 버튼만 눌러 받을 수 있었다.
--
--   카카오톡 공유 웹훅은 "메시지가 수신자에게 성공적으로 전달된 시점"에만 발사된다.
--   (공유창 진입 시점 아님. 카카오 공식: /docs/ko/kakaotalk-share/callback)
--   이것이 웹에서 얻을 수 있는 유일한 "실제 전송" 신호다.
--   → 지급 근거를 클릭에서 웹훅으로 옮긴다.
--
--   동시에 보상 단위를 "계정당 평생 1회"에서 "결과지 종류당 1회"로 바꾼다.
--   전 라인이 유료 상품이라 보상은 그 상품을 구매한 사람에게만 가고,
--   확장한 라인마다 공유 유인이 생긴다.
--
-- 적용 순서 (반드시 지킬 것):
--   1) 이 마이그레이션 적용  2) 코드 배포  3) §2 백필 INSERT 1회 재실행
--   (2~3 사이에 구 코드가 지급한 사용자를 grants로 흡수하기 위함. 몇 번 돌려도 안전)
-- ============================================================

-- ------------------------------------------------------------
-- 1) kind별 지급 원장 — PK가 "종류당 1회"의 최종 관문
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_reward_grants (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_kind TEXT NOT NULL CHECK (result_kind IN
    ('result','battle','yearly','pet','wealth','marriage','career')),  -- today 없음(5알 상품에 5알 지급 = 실질 무료화)
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, result_kind)
);

ALTER TABLE public.share_reward_grants ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 전면 차단. 서버(service_role)만 접근.

-- ------------------------------------------------------------
-- 2) 기존 지급자 백필 (grandfather)
--    구 방식 지급은 전부 result 라인에서 발생했다 — 보상이 연결된 공유 버튼이
--    ResultClient(개인사주)에만 있었기 때문. 그래서 'result'로 선점시킨다.
--    이 선점 덕에 기존 수령자가 신 경로로 result를 재수령할 수 없다.
-- ------------------------------------------------------------
INSERT INTO public.share_reward_grants (user_id, result_kind, granted_at)
SELECT user_id, 'result', share_reward_granted_at
FROM public.profiles
WHERE share_reward_granted_at IS NOT NULL
ON CONFLICT (user_id, result_kind) DO NOTHING;

-- profiles.share_reward_granted_at 컬럼은 드랍하지 않는다.
-- 롤백 시 구 RPC가 그대로 동작해야 하는 안전판 + 과거 지급 감사용.

-- ------------------------------------------------------------
-- 3) 1회용 nonce — 발급자에게만 전달되는 시크릿
--    카카오는 웹훅에 HMAC 서명을 주지 않는다. 그래서 위조 방어는
--    (어드민 키 대조) + (추측 불가능한 1회용 nonce) 2중으로 간다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_kakao_nonces (
  nonce TEXT PRIMARY KEY,                       -- base64url(randomBytes(24))
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_kind TEXT NOT NULL CHECK (result_kind IN
    ('result','battle','yearly','pet','wealth','marriage','career')),
  result_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  consumed_at TIMESTAMPTZ,
  last_reject_reason TEXT                        -- 'memo_chat' | 'single_chatroom' | 'open_chat'
);

CREATE INDEX IF NOT EXISTS idx_share_nonces_user
  ON public.share_kakao_nonces (user_id, created_at DESC);

ALTER TABLE public.share_kakao_nonces ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4) 웹훅 수신 전수 로그 (관측·감사·CS 보정 근거)
--    오픈채팅을 허용한 결정을 되돌릴지 판단하려면 chat_type 분포가 필요하다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_kakao_webhook_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nonce TEXT,
  resource_id TEXT,
  chat_type TEXT,
  is_single_chatroom BOOLEAN,
  chat_member_count_range TEXT,
  result_kind TEXT,
  verdict TEXT NOT NULL,   -- granted | already_granted | already_consumed | invalid_nonce
                           -- | expired | rejected_memo_chat | rejected_single_chatroom
                           -- | rejected_open_chat | auth_fail | bad_request | error
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_share_webhook_log_nonce
  ON public.share_kakao_webhook_log (nonce, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_webhook_log_chat_type
  ON public.share_kakao_webhook_log (chat_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_webhook_log_verdict
  ON public.share_kakao_webhook_log (verdict, received_at DESC);

ALTER TABLE public.share_kakao_webhook_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5) 지급 RPC (kind 파라미터 버전)
--    구 grant_share_reward(uuid)는 지우지 않는다 — 롤백 시 되살아나야 한다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_share_reward_v2(p_user_id UUID, p_kind TEXT)
RETURNS TABLE(success BOOLEAN, reward_amount INTEGER, new_balance INTEGER, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_reward CONSTANT INTEGER := 5;
  v_balance INTEGER;
BEGIN
  -- user-level 직렬화 (signup_bonus/spend/charge/구 share_reward와 같은 키)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  INSERT INTO public.profiles (user_id, coin_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 종류당 1회: PK 위반이면 이미 받은 것
  BEGIN
    INSERT INTO public.share_reward_grants (user_id, result_kind)
    VALUES (p_user_id, p_kind);
  EXCEPTION WHEN unique_violation THEN
    SELECT coin_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, 0, COALESCE(v_balance, 0), 'already_granted'::TEXT;
    RETURN;
  END;

  UPDATE public.profiles
    SET coin_balance = coin_balance + v_reward
    WHERE user_id = p_user_id
    RETURNING coin_balance INTO v_balance;

  -- reference_id에 kind를 남겨 원장에서 바로 감사 가능하게 한다
  INSERT INTO public.coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'bonus', v_reward, v_balance, 'share_reward:' || p_kind);

  RETURN QUERY SELECT TRUE, v_reward, v_balance, 'granted'::TEXT;
END;
$$;

-- ------------------------------------------------------------
-- 6) 웹훅 처리 RPC — nonce 소모 + 지급을 한 트랜잭션에서
--    ★ kind는 nonce row에서만 읽는다. 웹훅 페이로드의 어떤 값도 kind로 쓰지 않는다.
--       (kind당 1회가 되면서 "kind를 바꿔 또 받기"가 최대 공격면이 됐기 때문)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_share_nonce_and_grant(p_nonce TEXT)
RETURNS TABLE(verdict TEXT, reward_amount INTEGER, new_balance INTEGER, result_kind TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_nonce public.share_kakao_nonces%ROWTYPE;
  v_success BOOLEAN;
  v_amount INTEGER;
  v_balance INTEGER;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_nonce
  FROM public.share_kakao_nonces
  WHERE nonce = p_nonce
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_nonce'::TEXT, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF v_nonce.consumed_at IS NOT NULL THEN
    -- 웹훅 중복 도착(재시도 등) — 이미 처리됨
    RETURN QUERY SELECT 'already_consumed'::TEXT, 0, 0, v_nonce.result_kind;
    RETURN;
  END IF;

  IF v_nonce.expires_at < NOW() THEN
    RETURN QUERY SELECT 'expired'::TEXT, 0, 0, v_nonce.result_kind;
    RETURN;
  END IF;

  SELECT g.success, g.reward_amount, g.new_balance, g.reason
    INTO v_success, v_amount, v_balance, v_reason
  FROM public.grant_share_reward_v2(v_nonce.user_id, v_nonce.result_kind) AS g;

  -- 전송은 실제로 일어났으므로, 지급 여부와 무관하게 nonce는 소모한다.
  -- (재시도할 이유가 없다. 거부 케이스만 §route에서 미소모로 남긴다)
  UPDATE public.share_kakao_nonces
    SET consumed_at = NOW()
    WHERE nonce = p_nonce;

  IF v_success THEN
    RETURN QUERY SELECT 'granted'::TEXT, v_amount, v_balance, v_nonce.result_kind;
  ELSE
    RETURN QUERY SELECT 'already_granted'::TEXT, 0, COALESCE(v_balance, 0), v_nonce.result_kind;
  END IF;
END;
$$;
