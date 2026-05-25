// 사주 전문용어 → 일반 사용자용 친화어 매핑
// 메모 방침: 한자/사주 전문용어 UI 노출 최소화 (feedback_durumi_saju_jargon.md)
// 한자는 보조 부제로만 노출하고 메인은 직관적 한글 표현.

import {
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  type ElementType,
} from "./saju";

// 오행 → 일상어 (lib/utils/saju.ts의 ELEMENT_TO_KOREAN은 "목/화/토/금/수" 한자 표기 → 일반어로 대체)
const ELEMENT_TO_FRIENDLY: Record<ElementType, string> = {
  wood: "나무",
  fire: "불",
  earth: "흙",
  metal: "쇠",
  water: "물",
};

// 십성 → 일상어
// (편관 = 시험·압박, 정관 = 책임, 식신 = 여유, 상관 = 표현력 등)
const TEN_STAR_FRIENDLY: Record<string, string> = {
  비견: "동등한 친구",
  겁재: "경쟁자",
  식신: "여유로움",
  상관: "표현력",
  편재: "기회의 재물",
  정재: "안정된 재물",
  편관: "시험과 압박",
  정관: "정해진 책임",
  편인: "다른 시야",
  정인: "보호와 학습",
};

// 12운성 → 일상어
const TWELVE_STAGE_FRIENDLY: Record<string, string> = {
  장생: "시작의 기운",
  목욕: "정화의 시기",
  관대: "성장기",
  건록: "안정된 힘",
  제왕: "절정",
  쇠: "조금 쇠퇴",
  병: "느려지는 때",
  사: "전환점",
  묘: "안으로 가라앉음",
  절: "잠시 멈춤",
  태: "잉태의 기운",
  양: "준비기",
};

/** "편관(偏官)" 또는 "편관" → "시험과 압박" */
export function tenStarFriendly(tenStar: string | null | undefined): string {
  if (!tenStar) return "";
  const clean = tenStar.replace(/\([^)]*\)/g, "").trim();
  return TEN_STAR_FRIENDLY[clean] || tenStar;
}

/** "묘" → "안으로 가라앉음" */
export function twelveStageFriendly(stage: string | null | undefined): string {
  if (!stage) return "";
  return TWELVE_STAGE_FRIENDLY[stage] || stage;
}

/**
 * "己亥" → "흙 위에 물"
 * 천간(stem) + 지지(branch) 두 한자 → 각각 오행 → 친화어 결합
 */
export function dayPillarFriendly(pillar: string | null | undefined): string {
  if (!pillar || pillar.length < 2) return pillar || "";
  const stem = pillar[0];
  const branch = pillar[1];
  const stemEl = getHeavenlyStemElement(stem);
  const branchEl = getEarthlyBranchElement(branch);
  if (stemEl && branchEl) {
    return `${ELEMENT_TO_FRIENDLY[stemEl]} 위에 ${ELEMENT_TO_FRIENDLY[branchEl]}`;
  }
  return pillar;
}
