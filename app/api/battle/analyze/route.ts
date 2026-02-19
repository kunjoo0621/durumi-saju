import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { resolveSajuEnrichedData, type InputPayload } from "@/lib/analysis";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";
import { compareBattle } from "@/lib/utils/battle-compare";
import { runBattleAnalysis } from "@/lib/battle-prompt";
import type { BattlePlayerInput, RelationshipType } from "@/types/battle";

type BattleAnalyzeBody = {
  playerA: BattlePlayerInput;
  playerB: BattlePlayerInput;
  relationshipType: RelationshipType;
  sessionId?: string;
};

function playerToInputPayload(p: BattlePlayerInput): InputPayload {
  return {
    name: p.name,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    calendarType: p.calendarType,
    birthHour: p.birthHour,
    birthMinute: p.birthMinute,
    birthLocation: p.birthLocation,
    gender: p.gender,
    relationshipStatus: p.relationshipStatus,
    employmentStatus: p.employmentStatus,
    coreFearAxis: p.coreFearAxis as InputPayload["coreFearAxis"],
    unknownBirthTime: p.unknownBirthTime,
  };
}

function hasRequiredBattleInput(p: BattlePlayerInput): boolean {
  if (
    !p.name?.trim() ||
    !p.birthYear ||
    !p.birthMonth ||
    !p.birthDay ||
    !p.birthLocation ||
    !p.gender
  ) {
    return false;
  }
  if (!p.unknownBirthTime && (!p.birthHour || !p.birthMinute)) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as BattleAnalyzeBody;

    if (!body.playerA || !body.playerB || !body.relationshipType) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    if (!hasRequiredBattleInput(body.playerA) || !hasRequiredBattleInput(body.playerB)) {
      return NextResponse.json({ error: "양쪽 플레이어 정보가 부족합니다." }, { status: 400 });
    }

    // Enrich + score Player A
    const inputA = playerToInputPayload(body.playerA);
    const { sajuText: sajuTextA, enriched: enrichedA } = await resolveSajuEnrichedData(inputA);
    const scoringA = calculateServerScoring(enrichedA);

    // Enrich + score Player B
    const inputB = playerToInputPayload(body.playerB);
    const { sajuText: sajuTextB, enriched: enrichedB } = await resolveSajuEnrichedData(inputB);
    const scoringB = calculateServerScoring(enrichedB);

    // Compare
    const comparison = compareBattle(
      scoringA.scores,
      scoringB.scores,
      scoringA.tier,
      scoringB.tier,
      body.playerA.name,
      body.playerB.name,
    );

    // LLM analysis
    const llmAnalysis = await runBattleAnalysis({
      nameA: body.playerA.name,
      nameB: body.playerB.name,
      scoresA: scoringA.scores,
      scoresB: scoringB.scores,
      tierA: scoringA.tier,
      tierB: scoringB.tier,
      comparison,
      relationshipType: body.relationshipType,
      sajuTextA,
      sajuTextB,
    });

    const result = {
      playerA: {
        name: body.playerA.name,
        tier: scoringA.tier,
        scores: scoringA.scores,
      },
      playerB: {
        name: body.playerB.name,
        tier: scoringB.tier,
        scores: scoringB.scores,
      },
      comparison,
      llmAnalysis,
      relationshipType: body.relationshipType,
    };

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error("[BATTLE_ANALYZE]", error);
    return NextResponse.json(
      { error: error?.message || "배틀 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
