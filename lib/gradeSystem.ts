export type GradeLabel = "S" | "A" | "B" | "C" | "D";

export type GradeCutoffs = {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
};

export const COMPOSITE_GRADE_CUTOFFS: GradeCutoffs = {
  S: 86,
  A: 78,
  B: 68,
  C: 58,
  D: 0,
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
  { min: 0, max: 55, start: 5, end: 35 },
  { min: 55, max: 70, start: 35, end: 65 },
  { min: 70, max: 78, start: 65, end: 85 },
  { min: 78, max: 86, start: 85, end: 95 },
  { min: 86, max: 100, start: 95, end: 99 },
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
