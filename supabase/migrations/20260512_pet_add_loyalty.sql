-- 펫 궁합 v0.8: 펫 충성 지수 (loyalty) 컬럼 추가
-- "반려동물이 더 좋아하거나 / 보호자가 더 기대거나" 양방향 정 흐름 시각화용
-- lover(보호자 → 펫)와 대비되는 loyalty(펫 → 보호자) 점수
-- 봉인 상태라 운영 데이터 없음. 안전.

ALTER TABLE public.pet_compat_results
  ADD COLUMN IF NOT EXISTS loyalty_score INT CHECK (loyalty_score IS NULL OR (loyalty_score BETWEEN 0 AND 100));
