-- ============================================================
-- 2026-05-27: coin_packages · coin_transactions · profiles RLS 활성화
-- ============================================================
-- 사고/배경:
--   Supabase 보안 린트가 위 3개 테이블 `rls_disabled_in_public` 경고.
--   anon 키(NEXT_PUBLIC_SUPABASE_ANON_KEY)는 클라이언트에 노출되는데
--   RLS·정책 없이 GRANT만 깔려있어 PostgREST로 누구나 read/write 가능했음.
--   특히 위험했던 케이스:
--     - coin_transactions: 가짜 charge INSERT → 무한 알 획득
--     - coin_packages: 가격 변조 (1만원 → 1원)
--     - profiles: 모든 사용자 알 잔액·프로필 read·변조
--
-- 검증:
--   앱 전 영역(lib/, app/, scripts/)에서 supabaseAdmin(service_role)만 사용.
--   anon 키 직접 호출 0건. 따라서 RLS 활성 + 정책 없음 = 앱 영향 0.
--
-- 적용 정책:
--   1) ENABLE ROW LEVEL SECURITY — 정책 없으면 anon·authenticated 모두 차단,
--      service_role은 우회 (앱 서버는 정상 동작).
--   2) REVOKE ALL — defense-in-depth. 실수로 정책 1줄 추가돼도
--      GRANT 자체가 없으면 통과 불가.
--
-- 검증 결과 (production 적용 후 2026-05-27 확인):
--   - anon: 3 테이블 모두 42501 permission denied
--   - service_role: profiles 816 / coin_packages 3 / coin_transactions 1954 rows ✓
--   - /api/coins/balance, /api/coins/history 401 (정상, 5xx 없음)
--
-- 운영 DB에는 이미 수동 적용됨. 이 마이그레이션 파일은 변경 이력 보존 +
-- 다른 환경(staging·dev) 동기화 용도.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.coin_packages FROM anon, authenticated;
REVOKE ALL ON public.coin_transactions FROM anon, authenticated;
