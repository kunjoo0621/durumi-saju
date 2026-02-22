import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { resolveSajuEnrichedData, type InputPayload } from "@/lib/analysis";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";
import { compareBattle } from "@/lib/utils/battle-compare";
import { runBattleAnalysis } from "@/lib/battle-prompt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
    console.info("[BATTLE_ENRICHED_A]", JSON.stringify(enrichedA).slice(0, 2000));

    const scoringA = calculateServerScoring(enrichedA);

    console.info("[BATTLE_SCORING] playerA", {
      name: body.playerA.name,
      isTimeUnknown: scoringA.scoringInput.isTimeUnknown,
      calendarType: inputA.calendarType,
      birthHour: inputA.birthHour,
      birthMinute: inputA.birthMinute,
      confidence: scoringA.tier.confidence,
      grade: scoringA.tier.grade,
      composite: scoringA.tier.composite,
      scores: scoringA.scores,
      tenStars: scoringA.scoringInput.tenStars,
      elementDist: scoringA.scoringInput.elementDist,
    });

    // Enrich + score Player B
    const inputB = playerToInputPayload(body.playerB);
    const { sajuText: sajuTextB, enriched: enrichedB } = await resolveSajuEnrichedData(inputB);
    const scoringB = calculateServerScoring(enrichedB);

    console.info("[BATTLE_SCORING] playerB", {
      name: body.playerB.name,
      isTimeUnknown: scoringB.scoringInput.isTimeUnknown,
      calendarType: inputB.calendarType,
      birthHour: inputB.birthHour,
      birthMinute: inputB.birthMinute,
      confidence: scoringB.tier.confidence,
      grade: scoringB.tier.grade,
      composite: scoringB.tier.composite,
      scores: scoringB.scores,
      tenStars: scoringB.scoringInput.tenStars,
      elementDist: scoringB.scoringInput.elementDist,
    });

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

    // DB 저장 (동기 + 1회 재시도)
    const battleRow = {
      user_id: userId,
      player_a_name: body.playerA.name,
      player_b_name: body.playerB.name,
      player_a_grade: scoringA.tier.grade,
      player_b_grade: scoringB.tier.grade,
      overall_winner: comparison.overallWinner,
      overall_intensity: comparison.overallIntensity,
      wins_a: comparison.winsA,
      wins_b: comparison.winsB,
      draws: comparison.draws,
      relationship_type: body.relationshipType,
      full_result: result,
    };

    let battleId: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("saju_battles")
        .insert(battleRow)
        .select("id")
        .single();

      if (!insertError && inserted?.id) {
        battleId = inserted.id;
        break;
      }

      if (attempt === 0) {
        console.warn("[BATTLE_ANALYZE] DB save attempt 1 failed, retrying:", insertError?.message);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        console.error("[BATTLE_ANALYZE] DB save failed after retry:", insertError?.message);
        return NextResponse.json(
          { error: "배틀 결과 저장에 실패했습니다. 다시 시도해주세요." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, result, battleId });
  } catch (error: any) {
    console.error("[BATTLE_ANALYZE]", error);
    return NextResponse.json(
      { error: error?.message || "배틀 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
