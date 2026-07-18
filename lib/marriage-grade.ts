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

// 개인사주 full_json.scores.연애운 → 결혼운 등급의 유일한 입력값.
// resultSchema.normalizeScoreValue 와 달리 "결측"과 "실제 0점"을 구분한다: 결측이면 null 을
// 돌려 호출부(marriage start/analyze)가 0→C 로 뭉개는 대신 결제를 막고 500 을 내게 한다.
// 값은 number 이거나 { score:number } 두 형태 모두 허용(개인사주 스키마 변형 방어).
export function extractLoveScore(fullJson: unknown): number | null {
  const scores = (fullJson as any)?.scores;
  if (!scores || typeof scores !== "object") return null;
  const raw = (scores as any)["연애운"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && typeof (raw as any).score === "number"
      && Number.isFinite((raw as any).score)) return (raw as any).score;
  return null;
}
