import type { CategoryKey, ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import type {
  BattleComparison,
  BattleIntensity,
  CategoryMatchResult,
} from "@/types/battle";

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

function intensityFromDiff(diff: number): BattleIntensity {
  const abs = Math.abs(diff);
  if (abs >= 15) return "압승";
  if (abs >= 8) return "승리";
  if (abs >= 1) return "신승";
  return "무승부";
}

export function compareBattle(
  scoresA: ServerScores,
  scoresB: ServerScores,
  tierA: TierResult,
  tierB: TierResult,
  nameA: string,
  nameB: string,
): BattleComparison {
  const matches: CategoryMatchResult[] = CATEGORY_ORDER.map((category) => {
    const a = scoresA[category];
    const b = scoresB[category];
    const diff = a - b;
    const winner: "A" | "B" | "draw" = diff > 0 ? "A" : diff < 0 ? "B" : "draw";
    return {
      category,
      scoreA: a,
      scoreB: b,
      winner,
      diff: Math.abs(diff),
      intensity: intensityFromDiff(diff),
    };
  });

  const winsA = matches.filter((m) => m.winner === "A").length;
  const winsB = matches.filter((m) => m.winner === "B").length;
  const draws = matches.filter((m) => m.winner === "draw").length;

  let overallWinner: "A" | "B" | "draw";

  if (winsA > winsB) {
    overallWinner = "A";
  } else if (winsB > winsA) {
    overallWinner = "B";
  } else {
    // Tiebreaker: composite score
    if (tierA.composite > tierB.composite) {
      overallWinner = "A";
    } else if (tierB.composite > tierA.composite) {
      overallWinner = "B";
    } else {
      overallWinner = "draw";
    }
  }

  const compositeDiff = Math.abs(tierA.composite - tierB.composite);
  const overallIntensity = intensityFromDiff(
    overallWinner === "draw" ? 0 : overallWinner === "A" ? compositeDiff : -compositeDiff
  );

  return {
    matches,
    winsA,
    winsB,
    draws,
    overallWinner,
    overallIntensity,
  };
}
