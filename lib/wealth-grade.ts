// 재물운 등급은 개인사주 재물운 점수와 결정론 매핑 — 같은 사람이 재물운 78인데 재물운 등급
// B로 튀는 모순 방지. 표시 라벨은 개인사주 displayGrade 격상 체계(SS/S/A/B/C)와 통일.
// 컷 라인은 결혼운(marriage-grade.ts)과 동일 — 두 검사 모두 개인사주 점수 밴드를 그대로
// 상속해 "등급 인플레이션"이 검사마다 따로 놀지 않도록 함.
export type WealthGrade = "SS" | "S" | "A" | "B" | "C";

export function computeWealthGrade(wealthScore: number): { grade: WealthGrade } {
  const s = Math.max(0, Math.min(100, Number.isFinite(wealthScore) ? wealthScore : 0));
  if (s >= 90) return { grade: "SS" };
  if (s >= 82) return { grade: "S" };
  if (s >= 72) return { grade: "A" };
  if (s >= 55) return { grade: "B" };
  return { grade: "C" };
}
