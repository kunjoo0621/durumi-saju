import type { CategoryKey, ServerScores, TierResult } from "@/lib/utils/saju-scoring";

export type RelationshipType = "lover" | "friend" | "colleague" | "family" | "other";

export type BattlePlayerInput = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: string;
  unknownBirthTime: boolean;
};

export type BattleIntensity = "압승" | "승리" | "신승" | "무승부";

export type CategoryMatchResult = {
  category: CategoryKey;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | "draw";
  diff: number;
  intensity: BattleIntensity;
};

export type BattleComparison = {
  matches: CategoryMatchResult[];
  winsA: number;
  winsB: number;
  draws: number;
  overallWinner: "A" | "B" | "draw";
  overallIntensity: BattleIntensity;
};

export type BattleLlmAnalysis = {
  headVerdict: string;
  categoryComments: Array<{
    category: string;
    comment: string;
  }>;
  overallComment: string;
  playerASummary: string;
  playerBSummary: string;
};

export type BattleListItem = {
  id: string;
  player_a_name: string;
  player_b_name: string;
  player_a_grade: string;
  player_b_grade: string;
  overall_winner: "A" | "B" | "draw";
  overall_intensity: BattleIntensity;
  wins_a: number;
  wins_b: number;
  draws: number;
  relationship_type: RelationshipType;
  created_at: string;
};

export type BattleResult = {
  playerA: {
    name: string;
    tier: TierResult;
    scores: ServerScores;
  };
  playerB: {
    name: string;
    tier: TierResult;
    scores: ServerScores;
  };
  comparison: BattleComparison;
  llmAnalysis: BattleLlmAnalysis;
  relationshipType: RelationshipType;
};
