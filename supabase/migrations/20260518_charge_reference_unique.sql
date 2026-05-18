-- ============================================================
-- 2026-05-18: charge reference_id UNIQUE 승격 (DB-레벨 멱등 보장)
-- ============================================================
-- 전제: 이 마이그레이션은 다음 두 가지가 끝난 다음에 적용해야 합니다.
--   1) 20260518_charge_coins_idempotent.sql (RPC 멱등 가드 + partial index)
--   2) coin_transactions 중복 행 보정 SQL (도현우/장혜진 등)
--      — 기존 중복 행이 있으면 UNIQUE 인덱스 생성 단계에서 즉시 실패합니다.
--
-- 의도: RPC 멱등 가드 + DB UNIQUE 이중 방어.
--   advisory_lock 안의 EXISTS 가드가 어떤 이유로 풀리더라도(코드 변조,
--   race window 등) INSERT 자체가 unique violation으로 거부됩니다.
--
-- 사이드이펙트:
--   - 정상 충전 흐름: 같은 order_id로 두 번째 INSERT가 일어날 일이 없음(가드).
--     이론적으로 동시 다발 race가 있어도 한쪽만 통과, 다른 쪽은 unique
--     violation으로 RPC가 EXCEPTION. route.ts는 일반 한국어 메시지로 응답.
--   - bonus 행은 reference_id가 같지만 type='charge' 가 아니므로 영향 없음.
-- ============================================================

-- partial index 가 이미 있다면 같은 자리에 UNIQUE 로 재정의
DROP INDEX IF EXISTS coin_transactions_charge_reference_idx;

CREATE UNIQUE INDEX coin_transactions_charge_reference_uniq
ON coin_transactions(reference_id)
WHERE type = 'charge' AND reference_id IS NOT NULL;
