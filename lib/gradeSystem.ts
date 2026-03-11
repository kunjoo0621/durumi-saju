export type GradeLabel = "S" | "A" | "B" | "C" | "D";
export type ConfidenceLevel = "high" | "medium" | "low";

export type GradeCutoffs = {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
};

export const COMPOSITE_GRADE_CUTOFFS: GradeCutoffs = {
  S: 86,
  A: 79,
  B: 66,
  C: 45,
  D: 0,
};

/** 각 등급의 composite 상한 (해당 등급 내 최대값) */
export const GRADE_MAX: Record<GradeLabel, number> = {
  S: 100,
  A: COMPOSITE_GRADE_CUTOFFS.S - 1,  // 85
  B: COMPOSITE_GRADE_CUTOFFS.A - 1,  // 78
  C: COMPOSITE_GRADE_CUTOFFS.B - 1,  // 65
  D: COMPOSITE_GRADE_CUTOFFS.C - 1,  // 44
};

export function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeComposite(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampValue(Math.round(value), 0, 100);
  }
  return 0;
}

export function gradeFromComposite(value: number, cutoffs: GradeCutoffs = COMPOSITE_GRADE_CUTOFFS): GradeLabel {
  if (value >= cutoffs.S) return "S";
  if (value >= cutoffs.A) return "A";
  if (value >= cutoffs.B) return "B";
  if (value >= cutoffs.C) return "C";
  return "D";
}

const PERCENTILE_PIECEWISE = [
  { min: 0, max: 45, start: 5, end: 30 },   // D
  { min: 45, max: 66, start: 30, end: 58 },  // C
  { min: 66, max: 79, start: 58, end: 85 },  // B
  { min: 79, max: 86, start: 85, end: 95 },  // A
  { min: 86, max: 100, start: 95, end: 99 }, // S
];

export function percentileRankFromComposite(value: number) {
  const composite = clampValue(value, 0, 100);
  const segment =
    PERCENTILE_PIECEWISE.find((item) => composite >= item.min && composite <= item.max) ||
    PERCENTILE_PIECEWISE[PERCENTILE_PIECEWISE.length - 1];
  const ratio = segment.max === segment.min ? 0 : (composite - segment.min) / (segment.max - segment.min);
  const interpolated = segment.start + (segment.end - segment.start) * ratio;
  return clampValue(Math.round(interpolated), 1, 99);
}

export function topPercentFromPercentileRank(rank: number) {
  const clamped = clampValue(Math.round(rank), 1, 99);
  return 100 - clamped;
}
