-- 펫 궁합 v0.7: neutered 컬럼 제거
-- 근거: 사주 명리학적 정당성 약함 (도화살/홍염살 호르몬 매핑은 끼워맞춤).
--      펫 점성술 표준에 없음. 스코어링에 미사용 (LLM 프롬프트만 부착).
--      털색 제거와 동일 맥락.
-- 영향: 봉인 상태라 운영 사용자 데이터 없음. 안전.

ALTER TABLE public.pet_profiles
  DROP COLUMN IF EXISTS neutered;
