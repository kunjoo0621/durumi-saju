-- coin_packages를 프론트엔드 기준으로 일치시킴
-- basic: ₩1,000 / 10알 / 보너스 0
-- popular: ₩3,000 / 30알 / 보너스 5 / highlight
-- value: ₩5,000 / 50알 / 보너스 12

-- first 패키지 삭제 (프론트에 없음)
-- FK 참조가 있을 수 있으므로 트랜잭션 기록의 참조를 먼저 해제
UPDATE coin_transactions SET package_id = NULL WHERE package_id = 'first';
DELETE FROM coin_packages WHERE id = 'first';

-- 기존 패키지 업데이트
UPDATE coin_packages SET price = 1000, coin_amount = 10, bonus_amount = 0, highlight = FALSE WHERE id = 'basic';
UPDATE coin_packages SET price = 3000, coin_amount = 30, bonus_amount = 5, highlight = TRUE  WHERE id = 'popular';
UPDATE coin_packages SET price = 5000, coin_amount = 50, bonus_amount = 12, highlight = FALSE WHERE id = 'value';
