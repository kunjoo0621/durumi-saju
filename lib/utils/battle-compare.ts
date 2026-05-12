import type { CategoryKey, ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import type {
  BattleComparison,
  BattleIntensity,
  CategoryMatchResult,
} from "@/types/battle";

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

// 카테고리별 점수 차이를 강도로 변환 (압승은 가중 +3, 승리 +2, 신승 +1)
function categoryIntensity(diff: number): BattleIntensity {
  const abs = Math.abs(diff);
  if (abs >= 15) return "압승";
  if (abs >= 8) return "승리";
  if (abs >= 1) return "신승";
  return "무승부";
}

const INTENSITY_WEIGHT: Record<BattleIntensity, number> = {
  "압승": 3,
  "승리": 2,
  "신승": 1,
  "무승부": 0,
};

// 가중 승점 차이 → 전체 강도. 임계값은 실 데이터(34건) 분포 기반: 압승 9+, 승리 5+, 신승 1+
function pointsIntensity(pointsDiff: number): BattleIntensity {
  if (pointsDiff >= 9) return "압승";
  if (pointsDiff >= 5) return "승리";
  if (pointsDiff >= 1) return "신승";
  return "무승부";
}

// composite 차이 → 강도 (가중 승점 동률 시 강도 재산출용)
function compositeIntensity(diff: number): BattleIntensity {
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
      intensity: categoryIntensity(diff),
    };
  });

  const winsA = matches.filter((m) => m.winner === "A").length;
  const winsB = matches.filter((m) => m.winner === "B").length;
  const draws = matches.filter((m) => m.winner === "draw").length;

  // 가중 승점 합산 — 압승 한 방이 단순 1승보다 더 결정력 있음
  let pointsA = 0;
  let pointsB = 0;
  for (const m of matches) {
    const w = INTENSITY_WEIGHT[m.intensity];
    if (m.winner === "A") pointsA += w;
    else if (m.winner === "B") pointsB += w;
  }

  let overallWinner: "A" | "B" | "draw";
  let overallIntensity: BattleIntensity;

  if (pointsA > pointsB) {
    overallWinner = "A";
    overallIntensity = pointsIntensity(pointsA - pointsB);
  } else if (pointsB > pointsA) {
    overallWinner = "B";
    overallIntensity = pointsIntensity(pointsB - pointsA);
  } else {
    // 가중 승점 동률 → composite tiebreaker + composite 차이로 강도 재산출
    if (tierA.composite > tierB.composite) {
      overallWinner = "A";
    } else if (tierB.composite > tierA.composite) {
      overallWinner = "B";
    } else {
      overallWinner = "draw";
    }
    const compositeDiff = Math.abs(tierA.composite - tierB.composite);
    overallIntensity = compositeIntensity(compositeDiff);
  }

  return {
    matches,
    winsA,
    winsB,
    draws,
    overallWinner,
    overallIntensity,
  };
}
