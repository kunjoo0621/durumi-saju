import {
  COMPOSITE_GRADE_CUTOFFS,
  GRADE_MAX,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  type GradeLabel,
  type ConfidenceLevel,
} from "@/lib/gradeSystem";
import type { EnrichedSajuData } from "./saju-enrichment";

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
    };
  }

  return {
    elementDist: enriched.elementDist as unknown as Record<string, number>,
    strength: enriched.strength?.result as ScoringInput["strength"],
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
  };
}

export function hasStar(stars: string[], keyword: string): boolean {
  return (stars || []).some((s) => String(s).includes(keyword));
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
  const hasChungOrHyung =
    (input.relationships?.chung?.length || 0) > 0 || (input.relationships?.hyung?.length || 0) > 0;
  const hasHap = (input.relationships?.hap?.length || 0) > 0;

  const commonPenalty = elem.hasDeficiency || elem.hasDominance ? -1 : 0;

  const base = COMPOSITE_GRADE_CUTOFFS.C; // 58 — C등급 하한 (neutral 기준)

  let 재물운 = base;
  if (hasStar(input.tenStars, "정재")) 재물운 += 6;
  if (hasStar(input.tenStars, "편재")) 재물운 += 4;
  if (hasStar(input.tenStars, "식신")) 재물운 += 3;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 재물운 -= 4;
  if (elem.hasDeficiency || elem.hasDominance) 재물운 -= 3;
  재물운 += commonPenalty;

  let 직장운 = base;
  if (hasStar(input.tenStars, "정관")) 직장운 += 6;
  if (hasStar(input.tenStars, "편관")) 직장운 += 3;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    직장운 += 2;
  if (hasStar(input.tenStars, "상관")) 직장운 -= 3;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 직장운 -= 2;
  직장운 += commonPenalty;

  let 연애운 = base;
  if ((input.shinsal || []).some((s) => String(s).includes("도화") || String(s).includes("홍염"))) 연애운 += 3;
  if (hasChungOrHyung) 연애운 -= 2;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 연애운 -= 2;
  연애운 += commonPenalty;

  let 건강운 = base;
  if (hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인"))
    건강운 += 2;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 건강운 -= 4;
  if (elem.hasDeficiency || elem.hasDominance) 건강운 -= 3;
  건강운 += commonPenalty;

  let 대인운 = base;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "정관"))
    대인운 += 2;
  if ((input.shinsal || []).some((s) => String(s).includes("천을귀인"))) 대인운 += 2;
  if (hasHap) 대인운 += 1;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 대인운 -= 3;
  if (hasStar(input.tenStars, "상관")) 대인운 -= 2;
  if (hasChungOrHyung) 대인운 -= 2;
  대인운 += commonPenalty;

  const confidence = determineConfidence(input);

  const scores: ServerScores = { 재물운, 연애운, 직장운, 건강운, 대인운 };
  if (confidence === "low") {
    // enriched=null → 모든 카테고리 neutral C하한
    (Object.keys(scores) as CategoryKey[]).forEach((key) => {
      scores[key] = COMPOSITE_GRADE_CUTOFFS.C;
    });
  } else if (confidence === "medium") {
    (Object.keys(scores) as CategoryKey[]).forEach((key) => {
      scores[key] = clampInt(scores[key], 45, 82);
    });
  } else {
    (Object.keys(scores) as CategoryKey[]).forEach((key) => {
      scores[key] = clampInt(scores[key], 35, 90);
    });
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

  let potential = 50;
  if (hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관")) potential += 5;
  if (hasStar(input.tenStars, "정재") || hasStar(input.tenStars, "편재")) potential += 5;
  if (hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "상관")) potential += 4;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    potential += 3;
  if (input.strength === "신강" || input.strength === "추정 신강") potential += 3;
  if (elem.isBalanced) potential += 2;
  if (Object.values(input.elementDist || {}).every((v) => v === 0)) potential -= 4;
  potential = clampInt(potential, 35, 85);

  let stability = 50;
  if (elem.diff <= 2 && !Object.values(input.elementDist || {}).every((v) => v === 0)) stability += 6;
  if (hasHap) stability += 4;
  if (hasStar(input.tenStars, "정관")) stability += 3;
  if (hasStar(input.tenStars, "정재")) stability += 2;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    stability += 2;
  if (elem.hasDominance) stability -= 8;
  if (elem.hasDeficiency) stability -= 6;
  if (hasChungOrHyung) stability -= 4;
  if (input.strength === "신약" || input.strength === "추정 신약") stability -= 3;
  if (Object.values(input.elementDist || {}).every((v) => v === 0)) stability -= 4;
  stability = clampInt(stability, 35, 85);

  let risk = 45;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) risk += 6;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) risk += 5;
  if (hasStar(input.tenStars, "상관") && (hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관")))
    risk += 4;
  if (hasChungOrHyung) risk += 4;
  if (input.shinsalBadCount >= 2) risk += 2;
  if (elem.hasDeficiency || elem.hasDominance) risk += 2;
  risk = clampInt(risk, 35, 85);

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
  const max = grade === "S" ? 100 : GRADE_MAX[grade];
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
  const axisAdj = clampInt(
    Math.round(0.15 * (potential - 50) + 0.15 * (stability - 50) - 0.10 * (risk - 50)),
    -10, 10
  );
  let composite = clampInt(catAvg + axisAdj, 0, 100);

  // 단조성: composite와 catAvg 차이 15 이내 강제
  if (Math.abs(composite - catAvg) > 15) {
    composite = Math.round((composite + catAvg) / 2);
  }

  // 시간 미상 감점
  if (input.isTimeUnknown) composite -= 1;

  let grade = gradeFromCompositeSafe(composite);

  const scoreValues = Object.values(scores);

  // 게이트 1: D 카테고리 수 기반 상한
  const dCount = scoreValues.filter((v) => v <= GRADE_MAX.D).length;
  if (dCount >= 4) { grade = capGrade(grade, "D"); }
  else if (dCount >= 2) { grade = capGrade(grade, "C"); }

  // 게이트 2: risk 상한 — 리스크가 극단적이면 등급 제한
  if (risk >= COMPOSITE_GRADE_CUTOFFS.A) { grade = capGrade(grade, "C"); }

  // 게이트 3: 최저 카테고리 극단 낮음 → -1 등급
  const minScore = Math.min(...scoreValues);
  if (minScore <= GRADE_MAX.D - 8 && isAbove(grade, "D")) {
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
  };
}

export function calculateServerScoring(enriched: EnrichedSajuData | null | undefined) {
  const scoringInput = parseScoringInput(enriched);
  const scores = calculateScores(scoringInput);
  const tier = calculateTier(scoringInput, scores);
  return { scoringInput, scores, tier };
}
