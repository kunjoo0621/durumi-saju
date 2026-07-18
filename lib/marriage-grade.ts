// 결혼운 등급은 개인사주 연애운 점수와 결정론 매핑 — 같은 사람이 연애운 78인데 결혼운 B로
// 튀는 모순 방지. 표시 라벨은 개인사주 displayGrade 격상 체계(SS/S/A/B/C)와 통일.
export type MarriageGrade = "SS" | "S" | "A" | "B" | "C";

export function computeMarriageGrade(loveScore: number): { grade: MarriageGrade } {
  const s = Math.max(0, Math.min(100, Number.isFinite(loveScore) ? loveScore : 0));
  if (s >= 90) return { grade: "SS" };
  if (s >= 82) return { grade: "S" };
  if (s >= 72) return { grade: "A" };
  if (s >= 55) return { grade: "B" };
  return { grade: "C" };
}
