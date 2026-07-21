// 커리어운 등급은 개인사주 직장운 점수와 결정론 매핑 — 같은 사람이 직장운 78인데 커리어운
// 등급 B로 튀는 모순 방지. 표시 라벨은 개인사주 displayGrade 격상 체계(SS/S/A/B/C)와 통일.
// 컷 라인은 재물운(wealth-grade.ts)·결혼운(marriage-grade.ts)과 동일 — 세 검사 모두 개인사주
// 점수 밴드를 그대로 상속해 "등급 인플레이션"이 검사마다 따로 놀지 않도록 함(운영자 확정).
// ★직장운 clamp 상한은 90(saju-scoring.ts)이라 SS(≥90)는 정확히 90점만 — SS는 의도적으로
// 희귀 등급(결혼운도 동일 조건). 컷/채점 변경 없음.
export type CareerGrade = "SS" | "S" | "A" | "B" | "C";

export function computeCareerGrade(careerScore: number): { grade: CareerGrade } {
  const s = Math.max(0, Math.min(100, Number.isFinite(careerScore) ? careerScore : 0));
  if (s >= 90) return { grade: "SS" };
  if (s >= 82) return { grade: "S" };
  if (s >= 72) return { grade: "A" };
  if (s >= 55) return { grade: "B" };
  return { grade: "C" };
}

// 개인사주 full_json.scores.직장운 → 커리어운 등급의 유일한 입력값.
// resultSchema.normalizeScoreValue 와 달리 "결측"과 "실제 0점"을 구분한다: 결측이면 null 을
// 돌려 호출부(career start/analyze)가 0→C 로 뭉개는 대신 결제를 막고 500 을 내게 한다
// (889b83d 결제 견고성 F-3 선반영). 값은 number 또는 { score:number } 두 형태 방어.
export function extractCareerScore(fullJson: unknown): number | null {
  const scores = (fullJson as any)?.scores;
  if (!scores || typeof scores !== "object") return null;
  const raw = (scores as any)["직장운"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && typeof (raw as any).score === "number"
      && Number.isFinite((raw as any).score)) return (raw as any).score;
  return null;
}
