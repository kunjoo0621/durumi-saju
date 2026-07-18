-- 펫 궁합 v0.6: coat_color 컬럼 제거
-- 근거: 사주 명리학적 정당성 약함, 펫 점성술 표준에 없음 (kokoro-uranai 등 0건),
--      입력 마찰만 추가하고 분석 가치 낮음. 운영자 결정으로 제거.
-- 영향: 봉인 상태라 운영 사용자 데이터 없음. 안전.

ALTER TABLE public.pet_profiles
  DROP COLUMN IF EXISTS coat_color;
