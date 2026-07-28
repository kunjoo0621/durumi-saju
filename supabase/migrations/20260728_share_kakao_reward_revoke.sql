-- ============================================================
-- 2026-07-28: 공유 보상 v2 — 권한 회수 (defense-in-depth)
-- ============================================================
-- WHY:
--   신규 테이블 3종은 RLS만 켜 뒀고, 신규 RPC 2종은 Supabase 기본 EXECUTE 권한
--   때문에 PostgREST의 /rpc 로 anon·authenticated가 호출할 수 있는 상태다.
--
--   지금은 RPC가 SECURITY DEFINER가 아니라(invoker 권한) 내부 INSERT가 RLS에
--   막혀 전체 롤백되므로 실지급은 불가능하다. 하지만 방벽이 "RLS 정책이 없다"
--   하나뿐이다 — 훗날 누가 편의로 정책 한 줄을 추가하면 그대로 뚫린다.
--
--   기존 코인 테이블(20260527_rls_coin_tables.sql)도 RLS + REVOKE 이중으로
--   잠갔다. 같은 기준을 신규 자산에도 적용한다.
--
--   서버는 service_role 키로 접근하므로 이 회수의 영향을 받지 않는다.
-- ============================================================

REVOKE ALL ON TABLE public.share_reward_grants     FROM anon, authenticated;
REVOKE ALL ON TABLE public.share_kakao_nonces      FROM anon, authenticated;
REVOKE ALL ON TABLE public.share_kakao_webhook_log FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.grant_share_reward_v2(UUID, TEXT)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_share_nonce_and_grant(TEXT)    FROM anon, authenticated;

-- 확인용:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name IN ('share_reward_grants','share_kakao_nonces','share_kakao_webhook_log');
--   → anon·authenticated 행이 없어야 한다.
