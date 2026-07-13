export type GradeLabel = "S" | "A" | "B" | "C" | "D";
export type ConfidenceLevel = "high" | "medium" | "low";

export type GradeCutoffs = {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
};

// 2026-05-19 옵션 18 컷 조정 (D 4% → C 10.4%, B 47% → 43.2%로 균형화).
// 라벨 격상(SS/S/A/B/C)과 동시 적용. DB 저장값은 여전히 S/A/B/C/D.
export const COMPOSITE_GRADE_CUTOFFS: GradeCutoffs = {
  S: 85,
  A: 80,
  B: 70,
  C: 50,  // 2026-07-13 v18: 52→50 (버그①② 수정으로 인한 최하등급 증가 상쇄, 분포 안정)
  D: 0,
};

/** 각 등급의 composite 상한 (해당 등급 내 최대값) */
export const GRADE_MAX: Record<GradeLabel, number> = {
  S: 100,
  A: COMPOSITE_GRADE_CUTOFFS.S - 1,  // 84
  B: COMPOSITE_GRADE_CUTOFFS.A - 1,  // 79
  C: COMPOSITE_GRADE_CUTOFFS.B - 1,  // 69
  D: COMPOSITE_GRADE_CUTOFFS.C - 1,  // 51
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

// 옵션 18 컷 (S85/A80/B70/C52) + 536명 unique 실측 누적 분포 기반.
// D 10.4% / C 43.2% / B 26.4% / A 12.5% / S 7.4%.
const PERCENTILE_PIECEWISE = [
  { min: 0, max: 50, start: 1, end: 10 },    // D ~8% (v18 컷 50)
  { min: 50, max: 70, start: 10, end: 54 },  // C ~45% (v18 컷 50)
  { min: 70, max: 80, start: 54, end: 80 },  // B ~26%
  { min: 80, max: 85, start: 80, end: 93 },  // A ~13%
  { min: 85, max: 100, start: 93, end: 99 }, // S ~7%
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

// ─────────────────────────────────────────────────────────────
// 등급 표기 체계 개편 (2026-05): S/A/B/C/D → SS/S/A/B/C
// 내부 산식·DB 저장값은 그대로 유지. 표시 시점에만 변환.
// 현 분포에서 C/D가 약 절반이라 첫인상이 가혹해 라벨 한 단계 격상.
// ─────────────────────────────────────────────────────────────

export type DisplayGradeLabel = "SS" | "S" | "A" | "B" | "C";

const DISPLAY_GRADE_MAP: Record<GradeLabel, DisplayGradeLabel> = {
  S: "SS",
  A: "S",
  B: "A",
  C: "B",
  D: "C",
};

export function displayGrade(grade: GradeLabel): DisplayGradeLabel {
  return DISPLAY_GRADE_MAP[grade];
}

// 비어 있거나 알 수 없는 grade도 안전하게 처리 (DB raw 값을 받는 표시 위치용).
export function safeDisplayGrade(grade: unknown, fallback = "?"): string {
  if (typeof grade !== "string") return fallback;
  const trimmed = grade.trim();
  if (["S", "A", "B", "C", "D"].includes(trimmed)) {
    return DISPLAY_GRADE_MAP[trimmed as GradeLabel];
  }
  // 이미 새 라벨이거나 임의 문자열은 그대로 노출
  return trimmed || fallback;
}

const TEXT_GRADE_MAP: Record<string, string> = {
  S: "SS",
  A: "S",
  B: "A",
  C: "B",
  D: "C",
};

// "X등급" / "X급" / "등급 X" 패턴을 단일 콜백으로 변환 — 이중 변환("A→S→SS") 차단.
// "급" 뒤 한글 단어(급식·급여 등) 오변환 방지 lookahead.
// 역순 패턴("종합등급 S")의 X 뒤가 영문/숫자면(예: "등급 Sky") 매칭 제외.
export function transformGradeText(text: string): string {
  if (!text) return text;
  let out = text.replace(
    /(^|[^A-Za-z0-9_])([SABCD])(등급|급(?![가-힣]))/gu,
    (_m, lead: string, g: string, suffix: string) => `${lead}${TEXT_GRADE_MAP[g] ?? g}${suffix}`
  );
  out = out.replace(
    // "등급(조사) X" — 등급 뒤에 조사가 붙어도 매칭 ("등급이 A인", "등급은 S로", "등급의 B는" 등).
    // X 뒤가 "등급"이면 (1)이 이미 변환한 결과("A등급 S등급"의 "등급 S")를 다시 건드리지 않도록 제외.
    /(등급)([가-힣]*)(\s+)([SABCD])(?![A-Za-z0-9_])(?!등급)/gu,
    (_m, prefix: string, particle: string, ws: string, g: string) =>
      `${prefix}${particle}${ws}${TEXT_GRADE_MAP[g] ?? g}`
  );
  return out;
}

// 깊은 JSON 구조를 재귀로 순회하며 문자열 값만 transformGradeText 적용.
export function transformGradesDeep<T>(value: T): T {
  if (typeof value === "string") return transformGradeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => transformGradesDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = transformGradesDeep(v);
    return out as unknown as T;
  }
  return value;
}
