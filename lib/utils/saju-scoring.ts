import {
  COMPOSITE_GRADE_CUTOFFS,
  GRADE_MAX,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  type GradeLabel,
  type ConfidenceLevel,
} from "@/lib/gradeSystem";
import { STEM_ELEMENT, BRANCH_INFO, type EnrichedSajuData } from "./saju-enrichment";

/** 스코어링 로직 버전. 알고리즘 변경 시 반드시 올려야 DB 캐시 무효화됨. */
export const SCORING_VERSION = 7;

export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

export type ServerScores = Record<CategoryKey, number>;

export type TierResult = {
  grade: GradeLabel;
  composite: number;
  percentileRank: number;
  topPercent: number;
  confidence: ConfidenceLevel;
};

export type ScoringInput = {
  elementDist: Record<string, number>;
  strength: "신강" | "신약" | "추정 신강" | "추정 신약" | undefined;
  tenStars: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: string[];
  shinsalBadCount: number;
  isTimeUnknown: boolean;
  hasManselyeok: boolean;
  // v5 가점 관련
  has건록제왕: boolean;          // 12운성 중 건록 or 제왕 존재
  hasYongshinInStems: boolean;   // 용신 투출 (천간에 용신 오행)
  goodShinsalCount: number;      // 길신살 (type=good) 개수
  hasYongshinMonthRoot: boolean; // 용신이 월지에 뿌리 (월지 오행 === 용신)
  hasSamhap: boolean;            // 삼합 존재 여부
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseScoringInput(enriched: EnrichedSajuData | null | undefined): ScoringInput {
  if (!enriched) {
    return {
      elementDist: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
      strength: undefined,
      tenStars: [],
      relationships: { hap: [], chung: [], hyung: [] },
      shinsal: [],
      shinsalBadCount: 0,
      isTimeUnknown: true,
      hasManselyeok: false,
      has건록제왕: false,
      hasYongshinInStems: false,
      goodShinsalCount: 0,
      hasYongshinMonthRoot: false,
      hasSamhap: false,
    };
  }

  // ── v5 가점 필드 계산 ──
  const stages = enriched.twelveStages;
  const stageNames = stages
    ? [stages.year?.korean, stages.month?.korean, stages.day?.korean, stages.hour?.korean].filter(Boolean)
    : [];
  const has건록제왕 = stageNames.some((s) => s === "건록" || s === "제왕");

  const yongshinElem = enriched.yongshin?.eokbu ?? null;
  let hasYongshinInStems = false;
  if (yongshinElem && enriched.pillars) {
    const stems = [
      enriched.pillars.year?.[0], enriched.pillars.month?.[0],
      enriched.pillars.day?.[0], enriched.pillars.hour?.[0],
    ].filter(Boolean) as string[];
    hasYongshinInStems = stems.some((s) => STEM_ELEMENT[s]?.element === yongshinElem);
  }

  const goodShinsalCount = Array.isArray(enriched.shinsal)
    ? 0  // 구버전 string[] → type 정보 없음
    : enriched.shinsal?.matches?.filter((m) => m.type === "good").length ?? 0;

  let hasYongshinMonthRoot = false;
  if (yongshinElem && enriched.pillars?.month) {
    const monthBranch = enriched.pillars.month[1];
    hasYongshinMonthRoot = BRANCH_INFO[monthBranch]?.element === yongshinElem;
  }

  const hasSamhap = (enriched.relationships?.hap || []).some((h) => String(h).includes("삼합"));

  return {
    elementDist: enriched.elementDist as unknown as Record<string, number>,
    strength: ((enriched.strength as unknown as Record<string, unknown>)?.legacy ?? enriched.strength?.result) as ScoringInput["strength"],
    tenStars: Array.isArray(enriched.tenStars) ? enriched.tenStars : [],
    relationships: enriched.relationships || { hap: [], chung: [], hyung: [] },
    shinsal: Array.isArray(enriched.shinsal)
      ? enriched.shinsal                              // 구버전 string[] 캐시 대응
      : enriched.shinsal?.labels ?? [],
    shinsalBadCount: Array.isArray(enriched.shinsal)
      // 구버전 string[] 캐시 → label 기반 fallback (bad 3종: 양인/겁살/현침)
      ? (enriched.shinsal as string[]).filter((s) =>
          ["양인", "겁살", "현침"].some((k) => String(s).includes(k))
        ).length
      // 신규 ShinsalResult → type === "bad" 카운트
      : enriched.shinsal?.matches?.filter((m) => m.type === "bad").length ?? 0,
    isTimeUnknown: Boolean(enriched.isTimeUnknown),
    hasManselyeok: true,
    has건록제왕,
    hasYongshinInStems,
    goodShinsalCount,
    hasYongshinMonthRoot,
    hasSamhap,
  };
}

export function hasStar(stars: string[], keyword: string): boolean {
  return (stars || []).some((s) => String(s).includes(keyword));
}

function countStar(stars: string[], keyword: string): number {
  return (stars || []).filter((s) => String(s).includes(keyword)).length;
}

function countDeficientElements(dist: Record<string, number>): number {
  return Object.values(dist || {}).filter((v) => v === 0).length;
}

export function getElementAnalysis(dist: Record<string, number>) {
  const values = Object.values(dist || {});
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const hasDeficiency = values.includes(0);
  const hasDominance = max >= 4;
  const isBalanced = values.filter((v) => v >= 1).length >= 4;
  return { max, min, diff: max - min, hasDeficiency, hasDominance, isBalanced };
}

function countDataTypes(input: ScoringInput) {
  const hasElements = Object.values(input.elementDist || {}).some((v) => v > 0);
  const hasTenStars = Array.isArray(input.tenStars) && input.tenStars.length > 0;
  const hasStrength = typeof input.strength === "string" && input.strength.length > 0;
  const hasRelations =
    (input.relationships?.chung?.length || 0) > 0 ||
    (input.relationships?.hyung?.length || 0) > 0 ||
    (input.relationships?.hap?.length || 0) > 0;

  return [hasElements, hasTenStars, hasStrength, hasRelations].filter(Boolean).length;
}

export function calculateScores(input: ScoringInput): ServerScores {
  const elem = getElementAnalysis(input.elementDist);
  const hasChung = (input.relationships?.chung?.length || 0) > 0;
  const hasHyung = (input.relationships?.hyung?.length || 0) > 0;
  const hasChungOrHyung = hasChung || hasHyung;
  const hasHap = (input.relationships?.hap?.length || 0) > 0;
  const hapCount = input.relationships?.hap?.length || 0;
  const chungHyungCount = (input.relationships?.chung?.length || 0) + (input.relationships?.hyung?.length || 0);

  const isSingang = input.strength === "신강" || input.strength === "추정 신강";
  const isSinyak = input.strength === "신약" || input.strength === "추정 신약";

  const bigyeobCount = countStar(input.tenStars, "비견") + countStar(input.tenStars, "겁재");
  const hasBigyeobOverload = bigyeobCount >= 3;

  const hasSikSang = hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "상관");
  const hasJaeSung = hasStar(input.tenStars, "정재") || hasStar(input.tenStars, "편재");
  const hasGwanSung = hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관");
  const hasInSung = hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성");

  const deficientCount = countDeficientElements(input.elementDist);

  const base = COMPOSITE_GRADE_CUTOFFS.C; // 58

  // ── 재물운 (35~95) ──
  let 재물운 = base;
  if (hasStar(input.tenStars, "정재")) 재물운 += 8;
  if (hasStar(input.tenStars, "편재")) 재물운 += 6;
  if (hasStar(input.tenStars, "식신")) 재물운 += 4;
  if (hasStar(input.tenStars, "상관")) 재물운 += 2;
  if (hasSikSang && hasJaeSung) 재물운 += 6; // 식상생재
  if (elem.isBalanced) 재물운 += 4;
  if (isSingang) 재물운 += 3;
  if (hasHap) 재물운 += 2;
  if (hasStar(input.tenStars, "비견")) 재물운 -= 6;
  if (hasStar(input.tenStars, "겁재")) 재물운 -= 7;
  if (hasBigyeobOverload) 재물운 -= 5;
  // v6: 충+형 동시인 경우에만 재물운 감점 복원
  if (hasChung && hasHyung) 재물운 -= 3;
  // v6: 오행결핍 2개 이상인 경우에만 재물운 감점 복원
  if (deficientCount >= 2) 재물운 -= 3;
  if (elem.hasDominance) 재물운 -= 2; // 오행편중: -4 → -2
  if (isSinyak) 재물운 -= 2;

  // ── 연애운 (35~90) ──
  let 연애운 = base;
  if ((input.shinsal || []).some((s) => String(s).includes("도화"))) 연애운 += 8;
  if ((input.shinsal || []).some((s) => String(s).includes("홍염"))) 연애운 += 6;
  if (hasStar(input.tenStars, "정관")) 연애운 += 5;
  if (hasStar(input.tenStars, "정재")) 연애운 += 3;
  if (hasHap) 연애운 += 7;
  if (hapCount >= 2) 연애운 += 4;
  if (elem.isBalanced) 연애운 += 3;
  if ((input.shinsal || []).some((s) => String(s).includes("천을귀인"))) 연애운 += 3;
  if (countStar(input.tenStars, "비견") >= 2) 연애운 -= 5; // A-2: 비견 2개 이상만 감점
  if (hasStar(input.tenStars, "겁재")) 연애운 -= 6;
  if (hasBigyeobOverload) 연애운 -= 4;
  if (hasChung) 연애운 -= 4; // A-4: -6 → -4
  if (hasHyung) 연애운 -= 2; // A-1: -5 → -2 (형살은 연애 특화 아님)
  if (hasChung && hasHyung) 연애운 -= 3;
  if (hasStar(input.tenStars, "상관")) 연애운 -= 4;
  if (elem.hasDeficiency) 연애운 -= 1; // A-3: -3 → -1 (건강운에서 이미 감점)
  if (elem.hasDominance) 연애운 -= 3;
  if (input.shinsalBadCount >= 2) 연애운 -= 3;

  // ── 직장운 (35~90) ──
  let 직장운 = base;
  if (hasStar(input.tenStars, "정관")) 직장운 += 8;
  if (hasStar(input.tenStars, "편관")) 직장운 += 5;
  if (hasInSung) 직장운 += 4;
  if (hasGwanSung && hasInSung) 직장운 += 7; // 관인상생
  if (hasStar(input.tenStars, "식신")) 직장운 += 3;
  if (isSingang) 직장운 += 3;
  if (hasHap) 직장운 += 2;
  if (elem.isBalanced) 직장운 += 3;
  if (hasStar(input.tenStars, "상관")) 직장운 -= 5;
  if (hasStar(input.tenStars, "상관") && hasGwanSung) 직장운 -= 5; // 상관견관
  if (hasBigyeobOverload) 직장운 -= 5;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 직장운 -= 4;
  if (hasChung) 직장운 -= 2;  // 충: -4 → -2 (v5 카테고리 특화)
  if (hasHyung) 직장운 -= 2; // 형살: -4 → -2 (v5 카테고리 특화)
  // v6: 오행결핍 2개 이상인 경우에만 직장운 감점 복원
  if (deficientCount >= 2) 직장운 -= 3;
  if (isSinyak) 직장운 -= 3;

  // ── 건강운 (35~88) ──
  let 건강운 = base;
  if (elem.isBalanced) 건강운 += 10;
  if (elem.isBalanced && elem.diff <= 1 && !elem.hasDeficiency) 건강운 += 5; // 극균형
  if (hasStar(input.tenStars, "식신")) 건강운 += 5;
  if (hasInSung) 건강운 += 3;
  if (isSingang) 건강운 += 3;
  if (hasHap) 건강운 += 2;
  if ((input.shinsal || []).some((s) => String(s).includes("천을귀인"))) 건강운 += 2;
  건강운 -= deficientCount * 6; // 결핍 원소별 -6
  if (elem.max >= 4) 건강운 -= 6; // 편중
  if (elem.max >= 5) 건강운 -= 5; // 극편중 추가
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 건강운 -= 5;
  if (hasHyung) 건강운 -= 4; // 형살: -3 → -4, 충: 건강운 제거 (v5 카테고리 특화)
  if (isSinyak) 건강운 -= 4;
  if (input.shinsalBadCount >= 2) 건강운 -= 3;

  // ── 대인운 (35~90) ──
  let 대인운 = base;
  if (hasInSung) 대인운 += 4;
  if (hasStar(input.tenStars, "정관")) 대인운 += 4;
  if (hasStar(input.tenStars, "식신")) 대인운 += 3;
  if (hasStar(input.tenStars, "상관")) 대인운 += 2;
  if (bigyeobCount >= 1 && bigyeobCount <= 2) 대인운 += 5; // 비겁 적절
  if (hasBigyeobOverload) 대인운 -= 8; // 비겁 과다 (적절 대체 — net: 적절 안 줌)
  if (hasHap) 대인운 += 5;
  if (hapCount >= 2) 대인운 += 3;
  if ((input.shinsal || []).some((s) => String(s).includes("천을귀인"))) 대인운 += 5;
  if ((input.shinsal || []).some((s) => String(s).includes("문창"))) 대인운 += 3;
  if (elem.isBalanced) 대인운 += 3;
  if (hasStar(input.tenStars, "겁재") && !hasBigyeobOverload) 대인운 -= 6;
  if (hasStar(input.tenStars, "상관") && hasGwanSung) 대인운 -= 4; // 상관견관
  if (hasChung) 대인운 -= 5;
  if (hasHyung) 대인운 -= 5;
  if (chungHyungCount >= 3) 대인운 -= 4;
  if (elem.hasDeficiency) 대인운 -= 2; // -3 → -2 (v5 카테고리 특화)
  if (elem.hasDominance) 대인운 -= 2;  // -3 → -2 (v5 카테고리 특화)

  // ── 신규 신살 스코어링 ──
  const ss = input.shinsal || [];
  const hasShinsal = (keyword: string) => ss.some((s) => String(s).includes(keyword));

  // 장성 → 직장운 +4
  if (hasShinsal("장성")) 직장운 += 4;
  // 괴강 → 직장운 +3, 대인운 -3
  if (hasShinsal("괴강")) { 직장운 += 3; 대인운 -= 3; }
  // 천덕/월덕 → 건강운 +3
  if (hasShinsal("천덕") || hasShinsal("월덕")) 건강운 += 3;
  // 학당 → 직장운 +3
  if (hasShinsal("학당")) 직장운 += 3;
  // 백호 → 건강운 -4
  if (hasShinsal("백호")) 건강운 -= 4;
  // 재살 → 건강운 -2
  if (hasShinsal("재살")) 건강운 -= 2;
  // 공망 위치별 차등 감점
  if (hasShinsal("공망") && hasShinsal("년지")) 대인운 -= 3;
  if (hasShinsal("공망") && hasShinsal("월지")) 직장운 -= 3;
  if (hasShinsal("공망") && hasShinsal("시지")) 연애운 -= 3;

  // ── confidence clamp ──
  const confidence = determineConfidence(input);

  const scores: ServerScores = { 재물운, 연애운, 직장운, 건강운, 대인운 };
  if (confidence === "low") {
    (Object.keys(scores) as CategoryKey[]).forEach((key) => {
      scores[key] = COMPOSITE_GRADE_CUTOFFS.C;
    });
  } else if (confidence === "medium") {
    (Object.keys(scores) as CategoryKey[]).forEach((key) => {
      scores[key] = clampInt(scores[key], 40, 85);
    });
  } else {
    // high confidence: 카테고리별 개별 범위
    scores.재물운 = clampInt(scores.재물운, 35, 95);
    scores.연애운 = clampInt(scores.연애운, 35, 90);
    scores.직장운 = clampInt(scores.직장운, 35, 90);
    scores.건강운 = clampInt(scores.건강운, 35, 88);
    scores.대인운 = clampInt(scores.대인운, 35, 90);
  }

  return scores;
}

function gradeFromCompositeSafe(composite: number): GradeLabel {
  const c = clampInt(composite, 0, 100);
  if (c >= COMPOSITE_GRADE_CUTOFFS.S) return "S";
  if (c >= COMPOSITE_GRADE_CUTOFFS.A) return "A";
  if (c >= COMPOSITE_GRADE_CUTOFFS.B) return "B";
  if (c >= COMPOSITE_GRADE_CUTOFFS.C) return "C";
  return "D";
}

function calculateAxes(input: ScoringInput) {
  const elem = getElementAnalysis(input.elementDist);
  const hasChungOrHyung =
    (input.relationships?.chung?.length || 0) > 0 || (input.relationships?.hyung?.length || 0) > 0;
  const hasHap = (input.relationships?.hap?.length || 0) > 0;
  const bigyeobCount = countStar(input.tenStars, "비견") + countStar(input.tenStars, "겁재");

  let potential = 50;
  if (hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관")) potential += 7;
  if (hasStar(input.tenStars, "정재") || hasStar(input.tenStars, "편재")) potential += 7;
  if (hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "상관")) potential += 6;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    potential += 4;
  if (input.strength === "신강" || input.strength === "추정 신강") potential += 4;
  if (elem.isBalanced) potential += 3;
  if (hasHap) potential += 3;
  if (bigyeobCount >= 3) potential -= 6;
  if (elem.hasDeficiency) potential -= 4;
  if (elem.hasDominance) potential -= 3;
  if (Object.values(input.elementDist || {}).every((v) => v === 0)) potential -= 6;
  // ── v5 potential 가점 ──
  if (input.has건록제왕) potential += 4;
  if (input.hasYongshinInStems) potential += 5;
  if (input.goodShinsalCount >= 3) potential += 3;
  potential = clampInt(potential, 30, 90);

  let stability = 50;
  if (elem.diff <= 2 && !Object.values(input.elementDist || {}).every((v) => v === 0)) stability += 8;
  if (hasHap) stability += 6;
  if (hasStar(input.tenStars, "정관")) stability += 4;
  if (hasStar(input.tenStars, "정재")) stability += 3;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    stability += 3;
  if (elem.hasDominance) stability -= 10;
  if (elem.hasDeficiency) stability -= 8;
  if (hasChungOrHyung) stability -= 6;
  if (bigyeobCount >= 3) stability -= 5;
  if (input.strength === "신약" || input.strength === "추정 신약") stability -= 4;
  if (Object.values(input.elementDist || {}).every((v) => v === 0)) stability -= 6;
  // ── v5 stability 가점 ──
  if (input.hasYongshinMonthRoot) stability += 5;
  if (input.hasSamhap) stability += 4;
  if (input.shinsalBadCount === 0) stability += 3;
  stability = clampInt(stability, 30, 90);

  let risk = 45;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) risk += 8;
  if (bigyeobCount >= 3) risk += 5;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) risk += 7;
  if (hasStar(input.tenStars, "상관") && (hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관")))
    risk += 6;
  if (hasChungOrHyung) risk += 6;
  if (input.shinsalBadCount >= 2) risk += 3;
  if (elem.hasDeficiency) risk += 3;
  if (elem.hasDominance) risk += 3;
  if (Object.values(input.elementDist || {}).every((v) => v === 0)) risk -= 4;
  risk = clampInt(risk, 30, 90);

  return { potential, stability, risk };
}

function determineConfidence(input: ScoringInput): ConfidenceLevel {
  const dataTypes = countDataTypes(input);
  if (!input.hasManselyeok || dataTypes < 2) return "low";
  if (input.isTimeUnknown || dataTypes < 3) return "medium";
  return "high";
}

const GRADE_ORDER: GradeLabel[] = ["D", "C", "B", "A", "S"];

/** grade를 cap 이하로 제한 */
function capGrade(current: GradeLabel, cap: GradeLabel): GradeLabel {
  return GRADE_ORDER.indexOf(current) > GRADE_ORDER.indexOf(cap) ? cap : current;
}

function isAbove(grade: GradeLabel, threshold: GradeLabel): boolean {
  return GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(threshold);
}

function lowerGrade(grade: GradeLabel): GradeLabel {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx > 0 ? GRADE_ORDER[idx - 1] : grade;
}

/** composite를 grade 범위 내로 clamp */
function clampCompositeToGrade(composite: number, grade: GradeLabel): number {
  const min = COMPOSITE_GRADE_CUTOFFS[grade];
  const max = grade === "S" ? 95 : GRADE_MAX[grade]; // 사주학 이론적 천장 95
  return clampInt(composite, min, max);
}

export function calculateTier(input: ScoringInput, scores: ServerScores): TierResult {
  const confidence = determineConfidence(input);

  // enriched=null → neutral C + low confidence
  if (confidence === "low") {
    const composite = COMPOSITE_GRADE_CUTOFFS.C;
    const percentileRank = percentileRankFromComposite(composite);
    const topPercent = topPercentFromPercentileRank(percentileRank);
    return { grade: "C", composite, percentileRank, topPercent, confidence };
  }

  const { potential, stability, risk } = calculateAxes(input);

  // 방식 D: 카테고리 가중평균 기반 + 3축 보정
  const catAvg = Math.round(
    0.25 * scores.재물운 + 0.20 * scores.연애운 + 0.25 * scores.직장운 +
    0.15 * scores.건강운 + 0.15 * scores.대인운
  );
  const rawAdj = Math.round(0.25 * (potential - 50) + 0.20 * (stability - 50) - 0.15 * (risk - 50));
  // v6: 양수 유지 (+16), 음수 30% 증폭 (-20) — 나쁜 사주 바닥 복원
  const axisAdj = rawAdj >= 0
    ? clampInt(rawAdj, 0, 16)
    : clampInt(Math.round(rawAdj * 1.3), -20, 0);
  let composite = clampInt(catAvg + axisAdj, 0, 95); // 사주학 이론적 천장 95

  // 단조성: composite와 catAvg 차이 15 이내 강제
  if (Math.abs(composite - catAvg) > 15) {
    composite = Math.round((composite + catAvg) / 2);
  }

  // 시간 미상 감점
  if (input.isTimeUnknown) composite -= 1;

  let grade = gradeFromCompositeSafe(composite);

  const scoreValues = Object.values(scores);

  // 게이트 1: D 카테고리 수 기반 상한 (B-1: 3+→캡C, 5→캡D)
  const dCount = scoreValues.filter((v) => v <= GRADE_MAX.D).length;
  if (dCount >= 5) { grade = capGrade(grade, "D"); }
  else if (dCount >= 3) { grade = capGrade(grade, "C"); }

  // 게이트 2: risk 상한 — 리스크가 극단적이면 등급 제한
  if (risk >= COMPOSITE_GRADE_CUTOFFS.A) { grade = capGrade(grade, "C"); }

  // 게이트 3: 최저 카테고리 극단 낮음 → -1 등급 (B-2: ≤44)
  const minScore = Math.min(...scoreValues);
  if (minScore <= 44 && isAbove(grade, "D")) {
    grade = lowerGrade(grade);
  }

  // grade/composite 일관성 강제
  composite = clampCompositeToGrade(composite, grade);

  const percentileRank = percentileRankFromComposite(composite);
  const topPercent = topPercentFromPercentileRank(percentileRank);

  return { grade, composite, percentileRank, topPercent, confidence };
}

export function scoreToGrade(score: number): GradeLabel {
  // Same cutoffs as composite grade.
  return gradeFromCompositeSafe(score);
}

export type GeminiTextOnlyResponse = {
  tier: { title: string; description: string };
  sections: Array<{ icon: string; title: string; content: string }>;
  coreFearAxisBlock: string;
};

export type FinalResult = {
  tier: TierResult & { title: string; description: string };
  scores: ServerScores;
  sections: GeminiTextOnlyResponse["sections"];
  coreFearAxisBlock: string;
  scoringVersion?: number;
};

export function assembleFinalResult(
  serverTier: TierResult,
  serverScores: ServerScores,
  geminiResponse: GeminiTextOnlyResponse
): FinalResult {
  return {
    tier: {
      grade: serverTier.grade,
      composite: serverTier.composite,
      percentileRank: serverTier.percentileRank,
      topPercent: serverTier.topPercent,
      confidence: serverTier.confidence,
      title: geminiResponse.tier.title,
      description: geminiResponse.tier.description,
    },
    scores: serverScores,
    sections: geminiResponse.sections,
    coreFearAxisBlock: geminiResponse.coreFearAxisBlock,
    scoringVersion: SCORING_VERSION,
  };
}

export function calculateServerScoring(enriched: EnrichedSajuData | null | undefined) {
  const scoringInput = parseScoringInput(enriched);
  const scores = calculateScores(scoringInput);
  const tier = calculateTier(scoringInput, scores);
  return { scoringInput, scores, tier };
}
