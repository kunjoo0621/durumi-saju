import {
  COMPOSITE_GRADE_CUTOFFS,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  type GradeLabel,
} from "@/lib/gradeSystem";
import type { EnrichedSajuData } from "./saju-enrichment";

export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

export type ServerScores = Record<CategoryKey, number>;

export type TierResult = {
  grade: GradeLabel;
  composite: number;
  percentileRank: number;
  topPercent: number;
};

export type ScoringInput = {
  elementDist: Record<string, number>;
  strength: "신강" | "신약" | "추정 신강" | "추정 신약" | undefined;
  tenStars: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: string[];
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
      isTimeUnknown: true,
      hasManselyeok: false,
    };
  }

  return {
    elementDist: enriched.elementDist as unknown as Record<string, number>,
    strength: enriched.strength?.result as ScoringInput["strength"],
    tenStars: Array.isArray(enriched.tenStars) ? enriched.tenStars : [],
    relationships: enriched.relationships || { hap: [], chung: [], hyung: [] },
    shinsal: Array.isArray(enriched.shinsal) ? enriched.shinsal : [],
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

  let 재물운 = 58;
  if (hasStar(input.tenStars, "정재")) 재물운 += 6;
  if (hasStar(input.tenStars, "편재")) 재물운 += 4;
  if (hasStar(input.tenStars, "식신")) 재물운 += 3;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 재물운 -= 4;
  if (elem.hasDeficiency || elem.hasDominance) 재물운 -= 3;
  재물운 += commonPenalty;

  let 직장운 = 58;
  if (hasStar(input.tenStars, "정관")) 직장운 += 6;
  if (hasStar(input.tenStars, "편관")) 직장운 += 3;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성"))
    직장운 += 2;
  if (hasStar(input.tenStars, "상관")) 직장운 -= 3;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 직장운 -= 2;
  직장운 += commonPenalty;

  let 연애운 = 58;
  if ((input.shinsal || []).some((s) => String(s).includes("도화") || String(s).includes("홍염"))) 연애운 += 3;
  if (hasChungOrHyung) 연애운 -= 2;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 연애운 -= 2;
  연애운 += commonPenalty;

  let 건강운 = 58;
  if (hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인"))
    건강운 += 2;
  if (hasStar(input.tenStars, "편관") && hasChungOrHyung) 건강운 -= 4;
  if (elem.hasDeficiency || elem.hasDominance) 건강운 -= 3;
  건강운 += commonPenalty;

  let 대인운 = 58;
  if (hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "정관"))
    대인운 += 2;
  if (hasHap) 대인운 += 1;
  if (hasStar(input.tenStars, "비견") || hasStar(input.tenStars, "겁재")) 대인운 -= 3;
  if (hasStar(input.tenStars, "상관")) 대인운 -= 2;
  if (hasChungOrHyung) 대인운 -= 2;
  대인운 += commonPenalty;

  const dataTypes = countDataTypes(input);
  const isInsufficient = !input.hasManselyeok || dataTypes < 2;

  const scores: ServerScores = { 재물운, 연애운, 직장운, 건강운, 대인운 };
  (Object.keys(scores) as CategoryKey[]).forEach((key) => {
    scores[key] = isInsufficient ? clampInt(scores[key], 50, 68) : clampInt(scores[key], 35, 90);
  });

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

export function calculateTier(input: ScoringInput, scores: ServerScores): TierResult {
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
  if ((input.shinsal || []).length >= 2) risk += 2;
  if (elem.hasDeficiency || elem.hasDominance) risk += 2;
  risk = clampInt(risk, 35, 85);

  let composite = Math.round(0.45 * potential + 0.45 * stability - 0.35 * risk);

  const categoryAvg = Math.round(
    Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
  );

  if (composite - categoryAvg > 15) composite = Math.round((composite + categoryAvg) / 2);
  if (categoryAvg - composite > 15) composite = Math.round((composite + categoryAvg) / 2);

  const dataTypes = countDataTypes(input);
  const isInsufficient = !input.hasManselyeok || dataTypes < 2;
  if (isInsufficient) composite -= 6;
  if (input.isTimeUnknown) composite -= 1;

  let grade = gradeFromCompositeSafe(composite);

  if (risk >= 78 && (grade === "S" || grade === "A" || grade === "B")) grade = "C";
  else if (risk >= 70 && (grade === "S" || grade === "A")) grade = "B";
  if (stability <= 45 && (grade === "S" || grade === "A")) grade = "B";
  if (isInsufficient && (grade === "S" || grade === "A")) grade = "B";

  const dCount = Object.values(scores).filter((v) => v <= 57).length;
  if (dCount >= 4 && (grade === "S" || grade === "A" || grade === "B")) grade = "C";
  if (dCount >= 3 && (grade === "S" || grade === "A")) grade = "B";

  if (grade === "C" && composite >= 68) composite = 67;
  if (grade === "B" && composite >= 78) composite = 77;
  if (grade === "D" && composite >= 58) composite = 57;
  composite = clampInt(composite, 0, 100);

  const percentileRank = percentileRankFromComposite(composite);
  const topPercent = topPercentFromPercentileRank(percentileRank);

  return { grade, composite, percentileRank, topPercent };
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
