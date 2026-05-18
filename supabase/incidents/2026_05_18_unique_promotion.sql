-- ============================================================
-- 사고: 2026-05-18 중복 충전 정리 + UNIQUE 승격
-- 적용: Supabase SQL editor 에서 직접 실행.
-- 전제: 20260518_charge_coins_idempotent.sql 적용 완료
--       2026_05_18_overpaid_corrections.sql 적용 완료 (장혜진 602→7)
-- 목적:
--   - ledger 의 가짜 중복 charge/bonus 행 정리 → 분석/대시보드 정합 확보
--   - UNIQUE INDEX 승격 → DB 레벨 중복 충전 차단 (RPC 가드 이중 안전망)
--
-- audit 보존:
--   - 사고 내역은 git commit 20310c7 + 이 incidents 폴더 SQL 에 영구 기록
--   - ledger 의 가짜 행 자체는 중복 기록이라 정리 가능
-- ============================================================

BEGIN;

-- 1) 장혜진 b058e3fc: 정상 첫 행만 남기고 중복 17 charge + 17 bonus DELETE
--    각 type 별로 created_at 이 가장 빠른 1행 보존, 나머지 DELETE
DELETE FROM coin_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY reference_id, type ORDER BY created_at) AS rn
    FROM coin_transactions
    WHERE user_id = '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid
      AND reference_id = 'b058e3fc-8fad-448c-8af2-2238992119c4'
      AND type IN ('charge', 'bonus')
  ) ranked
  WHERE rn > 1
);

-- 2) 장혜진 보정 spend 행 (-595) DELETE
--    이전 보정은 가짜 행이 살아있을 때의 차감. 가짜 행을 지웠으므로 의미 없음.
DELETE FROM coin_transactions
WHERE user_id = '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid
  AND type = 'spend'
  AND amount = -595
  AND reference_id = 'operator:incident_2026_05_18_overpaid_b058';

-- 3) 도현우 1847d46e: 정상 첫 행만 남기고 중복 1 charge DELETE
DELETE FROM coin_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY reference_id, type ORDER BY created_at) AS rn
    FROM coin_transactions
    WHERE user_id = '6a6af090-c00c-4d6e-8abf-0ab9fd7703a8'::uuid
      AND reference_id = '1847d46e-bad9-43e1-82d3-e92e89a75ab6'
      AND type = 'charge'
  ) ranked
  WHERE rn > 1
);

-- 4) 도현우 정합 audit 행:
--    가짜 +10 charge 가 사라져 ledger -10 이 됨. 회수 불가분(잔액 0) 만큼
--    'refund' +10 행을 추가해 ledger 0 = balance 0 정합.
INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
VALUES (
  '6a6af090-c00c-4d6e-8abf-0ab9fd7703a8'::uuid,
  'refund',
  10,
  0,
  'reconcile_2026_05_18:overpaid_writeoff_unrecoverable'
);

-- 5) 정합 검증: 두 user 모두 balance == ledger 여야 함
DO $$
DECLARE
  v_uid UUID;
  v_balance INTEGER;
  v_ledger INTEGER;
  v_uids UUID[] := ARRAY[
    '9e8d1e96-784c-4f5b-a40e-e1606ecdbd81'::uuid,
    '6a6af090-c00c-4d6e-8abf-0ab9fd7703a8'::uuid
  ];
BEGIN
  FOREACH v_uid IN ARRAY v_uids LOOP
    SELECT coin_balance INTO v_balance FROM profiles WHERE user_id = v_uid;
    SELECT COALESCE(SUM(amount), 0) INTO v_ledger FROM coin_transactions WHERE user_id = v_uid;
    IF v_balance IS DISTINCT FROM v_ledger THEN
      RAISE EXCEPTION 'reconcile failed: user=% balance=% ledger=%', v_uid, v_balance, v_ledger;
    END IF;
  END LOOP;
END $$;

-- 6) partial index → UNIQUE 승격
DROP INDEX IF EXISTS coin_transactions_charge_reference_idx;

CREATE UNIQUE INDEX coin_transactions_charge_reference_uniq
ON coin_transactions(reference_id)
WHERE type = 'charge' AND reference_id IS NOT NULL;

COMMIT;
